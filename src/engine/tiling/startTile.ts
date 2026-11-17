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

/** Contour d'un carreau dans le repère monde (les carreaux sont tournés autour du pivot). */
function tileOutline(tile: Tile, angle: number, cx: number, cy: number): Point[] {
  const pts = tile.points ?? [
    { x: tile.rect.x, y: tile.rect.y },
    { x: tile.rect.x + tile.rect.w, y: tile.rect.y },
    { x: tile.rect.x + tile.rect.w, y: tile.rect.y + tile.rect.h },
    { x: tile.rect.x, y: tile.rect.y + tile.rect.h },
  ];
  return angle !== 0 ? pts.map((p) => rotatePoint(p.x, p.y, angle, cx, cy)) : pts;
}

function centroid(pts: Point[]): Point {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

/**
 * Pour chaque pièce : l'angle de référence est le coin intérieur en haut à gauche ;
 * le carreau de départ est le carreau entier dont un coin en est le plus proche.
 * Il est coté perpendiculairement aux deux murs qui forment cet angle.
 */
export function computeStartTiles(
  rooms: Room[],
  tiles: Tile[],
  config: TilingConfig,
  wallThickness: number,
): StartTileMark[] {
  const valid = rooms.filter((r) => r.points.length >= 3);
  if (valid.length === 0) return [];

  // Même pivot de rotation que la couche de carreaux (TileLayer)
  const bb = getBoundingBox(valid.flatMap((r) => r.points));
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;

  const whole = tiles
    .filter((t) => t.type === 'WHOLE')
    .map((t) => {
      const outline = tileOutline(t, config.angle, cx, cy);
      return { outline, center: centroid(outline) };
    });

  const marks: StartTileMark[] = [];
  for (const room of valid) {
    const inner = insetRoomPolygon(room, wallThickness);
    const n = inner.length;
    if (n < 3) continue;

    // Angle de référence : coin intérieur le plus en haut à gauche
    let ref = 0;
    for (let i = 1; i < n; i++) {
      if (inner[i]!.x + inner[i]!.y < inner[ref]!.x + inner[ref]!.y) ref = i;
    }
    const roomCorner = inner[ref]!;
    const prev = inner[(ref - 1 + n) % n]!;
    const next = inner[(ref + 1) % n]!;

    let best: { outline: Point[]; corner: Point; d: number } | null = null;
    for (const t of whole) {
      if (!pointInPolygon(t.center, inner)) continue;
      for (const c of t.outline) {
        const d = distance(c, roomCorner);
        if (!best || d < best.d) best = { outline: t.outline, corner: c, d };
      }
    }
    if (!best) continue;

    const cote = (a: Point, b: Point): StartCote => {
      const from = project(best!.corner, a, b);
      return { from, to: best!.corner, value: distance(from, best!.corner) };
    };

    marks.push({
      roomId: room.id,
      tile: best.outline,
      corner: best.corner,
      roomCorner,
      cotes: [cote(prev, roomCorner), cote(roomCorner, next)],
    });
  }
  return marks;
}

/** 325 → « 32,5 cm » */
export function formatCote(mm: number): string {
  return `${(Math.round(mm) / 10).toFixed(1).replace('.', ',')} cm`;
}
