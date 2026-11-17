import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { Tile, TilingConfig } from '@/types/tiling';
import {
  distance,
  getBoundingBox,
  insetRoomPolygon,
  pointInPolygon,
  rotatePoint,
} from '@/engine/geometry/polygon';

// Carreau de départ : repère de pose coté par rapport aux murs de la pièce.
// Toutes les coordonnées renvoyées sont en mm, repère monde.

export interface StartCote {
  /** Pied de la perpendiculaire sur la face intérieure du mur */
  from: Point;
  /** Coin du carreau de départ */
  to: Point;
  /** Distance en mm */
  value: number;
}

export interface StartTileMark {
  roomId: string;
  /** Contour du carreau de départ */
  tile: Point[];
  /** Coin du carreau le plus proche de l'angle de référence */
  corner: Point;
  /** Angle de référence de la pièce (face intérieure des murs) */
  roomCorner: Point;
  /** Deux cotes : une par mur formant l'angle de référence */
  cotes: [StartCote, StartCote];
  /** Carreau choisi par l'utilisateur (sinon choix automatique) */
  manual: boolean;
}

/** Projection orthogonale de p sur la droite (a, b). */
function project(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return a;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function tileSpaceOutline(tile: Tile): Point[] {
  return (
    tile.points ?? [
      { x: tile.rect.x, y: tile.rect.y },
      { x: tile.rect.x + tile.rect.w, y: tile.rect.y },
      { x: tile.rect.x + tile.rect.w, y: tile.rect.y + tile.rect.h },
      { x: tile.rect.x, y: tile.rect.y + tile.rect.h },
    ]
  );
}

function centroid(pts: Point[]): Point {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

/** Pivot de rotation des carreaux : même calcul que la couche de carreaux (TileLayer). */
function pivotOf(rooms: Room[]): Point | null {
  const valid = rooms.filter((r) => r.points.length >= 3);
  if (valid.length === 0) return null;
  const bb = getBoundingBox(valid.flatMap((r) => r.points));
  return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
}

const toWorld = (p: Point, angle: number, pivot: Point) =>
  angle !== 0 ? rotatePoint(p.x, p.y, angle, pivot.x, pivot.y) : p;
const toTileSpace = (p: Point, angle: number, pivot: Point) =>
  angle !== 0 ? rotatePoint(p.x, p.y, -angle, pivot.x, pivot.y) : p;

/** Carreau (repère des carreaux) contenant le point, ou le plus proche à défaut. */
function tileAt(tiles: Tile[], p: Point): Tile | null {
  let best: Tile | null = null;
  let bestD = Infinity;
  for (const t of tiles) {
    if (t.type === 'OUTSIDE') continue;
    const outline = tileSpaceOutline(t);
    if (pointInPolygon(p, outline)) return t;
    const d = distance(centroid(outline), p);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/**
 * Appui sur le plan → carreau de départ à mémoriser dans la config
 * (centre du carreau dans le repère des carreaux, moins le décalage de pose).
 * null si aucun carreau n'est touché.
 */
export function pickStartTile(
  world: Point,
  rooms: Room[],
  tiles: Tile[],
  config: TilingConfig,
): { x: number; y: number } | null {
  const pivot = pivotOf(rooms);
  if (!pivot) return null;
  const p = toTileSpace(world, config.angle, pivot);
  const tile = tiles.find((t) => t.type !== 'OUTSIDE' && pointInPolygon(p, tileSpaceOutline(t)));
  if (!tile) return null;
  const c = centroid(tileSpaceOutline(tile));
  return { x: Math.round(c.x - config.offsetX), y: Math.round(c.y - config.offsetY) };
}

/** Repère complet (angle de référence, coin, cotes) pour un carreau donné dans une pièce. */
function markFor(
  roomId: string,
  inner: Point[],
  outline: Point[],
  refIndex: number,
  manual: boolean,
): StartTileMark {
  const n = inner.length;
  const roomCorner = inner[refIndex]!;
  const prev = inner[(refIndex - 1 + n) % n]!;
  const next = inner[(refIndex + 1) % n]!;
  let corner = outline[0]!;
  for (const c of outline) if (distance(c, roomCorner) < distance(corner, roomCorner)) corner = c;
  const cote = (a: Point, b: Point): StartCote => {
    const from = project(corner, a, b);
    return { from, to: corner, value: distance(from, corner) };
  };
  return {
    roomId,
    tile: outline,
    corner,
    roomCorner,
    cotes: [cote(prev, roomCorner), cote(roomCorner, next)],
    manual,
  };
}

/**
 * Repères de départ, un par pièce :
 * - carreau choisi (config.startTile) : coté depuis l'angle de sa pièce le plus proche ;
 * - autres pièces : carreau entier le plus proche de l'angle intérieur haut-gauche.
 * Les cotes sont perpendiculaires aux deux murs qui forment l'angle de référence.
 */
export function computeStartTiles(
  rooms: Room[],
  tiles: Tile[],
  config: TilingConfig,
  wallThickness: number,
): StartTileMark[] {
  const valid = rooms.filter((r) => r.points.length >= 3);
  const pivot = pivotOf(valid);
  if (!pivot) return [];
  const world = (t: Tile) => tileSpaceOutline(t).map((p) => toWorld(p, config.angle, pivot));

  const inners = valid.map((r) => insetRoomPolygon(r, wallThickness));

  // Carreau choisi par l'utilisateur (il suit la pose : on rajoute le décalage actuel)
  let manual: { roomIndex: number; outline: Point[] } | null = null;
  if (config.startTile) {
    const target = {
      x: config.startTile.x + config.offsetX,
      y: config.startTile.y + config.offsetY,
    };
    const tile = tileAt(tiles, target);
    if (tile) {
      const outline = world(tile);
      const center = centroid(outline);
      const roomIndex = inners.findIndex((inner) => pointInPolygon(center, inner));
      if (roomIndex >= 0) manual = { roomIndex, outline };
    }
  }

  const whole = tiles
    .filter((t) => t.type === 'WHOLE')
    .map((t) => {
      const outline = world(t);
      return { outline, center: centroid(outline) };
    });

  const marks: StartTileMark[] = [];
  valid.forEach((room, ri) => {
    const inner = inners[ri]!;
    const n = inner.length;
    if (n < 3) return;

    if (manual && manual.roomIndex === ri) {
      // Angle de référence : le coin de la pièce le plus proche du carreau choisi
      const center = centroid(manual.outline);
      let ref = 0;
      for (let i = 1; i < n; i++) {
        if (distance(inner[i]!, center) < distance(inner[ref]!, center)) ref = i;
      }
      marks.push(markFor(room.id, inner, manual.outline, ref, true));
      return;
    }

    // Choix automatique : coin intérieur le plus en haut à gauche
    let ref = 0;
    for (let i = 1; i < n; i++) {
      if (inner[i]!.x + inner[i]!.y < inner[ref]!.x + inner[ref]!.y) ref = i;
    }
    const roomCorner = inner[ref]!;
    let best: { outline: Point[]; d: number } | null = null;
    for (const t of whole) {
      if (!pointInPolygon(t.center, inner)) continue;
      for (const c of t.outline) {
        const d = distance(c, roomCorner);
        if (!best || d < best.d) best = { outline: t.outline, d };
      }
    }
    if (best) marks.push(markFor(room.id, inner, best.outline, ref, false));
  });
  return marks;
}

/** 325 → « 32,5 cm » */
export function formatCote(mm: number): string {
  return `${(Math.round(mm) / 10).toFixed(1).replace('.', ',')} cm`;
}
