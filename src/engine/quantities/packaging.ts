// Conditionnement des carreaux (cartons) et plinthes : calculs purs du quantitatif.
import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { ConsumableParams } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { insetRoomPolygon } from '@/engine/geometry/polygon';

/** Marge appliquée aux plinthes (coupes d'angle, chutes) */
export const SKIRTING_MARGIN = 0.1;
/** Longueur d'une plinthe par défaut (mm) */
export const DEFAULT_SKIRTING_PIECE = 600;

export interface BoxesResult {
  /** Carreaux par carton (donnée du fabricant) */
  perBox: number;
  /** Cartons à commander (arrondi au carton entier supérieur) */
  count: number;
  /** Surface d'un carton (mm²) */
  boxArea: number;
}

export interface SkirtingResult {
  /** Plinthes ajoutées à la commande (réglage de l'utilisateur) */
  included: boolean;
  /** Longueur de murs à habiller, portes déduites (mm) */
  length: number;
  /** Longueur d'une plinthe (mm) */
  pieceLength: number;
  /** Plinthes à commander, marge incluse */
  pieces: number;
  margin: number;
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function perimeter(pts: Point[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) p += dist(pts[i]!, pts[(i + 1) % pts.length]!);
  return p;
}

/** Distance d'un point à un segment */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Cartons : nombre de cartons pour couvrir les carreaux à commander.
 * `undefined` si le conditionnement n'est pas renseigné.
 */
export function computeBoxes(
  toOrder: number,
  tileW: number,
  tileH: number,
  params: ConsumableParams | undefined,
): BoxesResult | undefined {
  const perBox = Math.floor(params?.tilesPerBox ?? 0);
  if (perBox <= 0) return undefined;
  return { perBox, count: Math.ceil(toOrder / perBox), boxArea: perBox * tileW * tileH };
}

/**
 * Longueur de plinthes : périmètre intérieur de chaque pièce, moins la largeur des portes
 * qui s'ouvrent sur cette pièce (une porte entre deux pièces est déduite des deux).
 */
export function skirtingLength(
  rooms: Room[],
  wallThickness: number,
  doorOpenings: DoorOpening[] = [],
): number {
  let total = 0;
  for (const room of rooms) {
    if (room.points.length < 3) continue;
    let length = perimeter(insetRoomPolygon(room, wallThickness));
    const n = room.points.length;
    // Anciennes pièces : côtés marqués « porte »
    room.edges?.forEach((e, i) => {
      if (e === 'DOOR') length -= dist(room.points[i]!, room.points[(i + 1) % n]!);
    });
    // Ouvertures du moteur de murs, posées sur l'axe d'un mur de la pièce
    for (const door of doorOpenings) {
      const mid = { x: (door.from.x + door.to.x) / 2, y: (door.from.y + door.to.y) / 2 };
      const tolerance = Math.max(wallThickness, door.thickness) / 2 + 5;
      const onRoom = room.points.some(
        (a, i) => distToSegment(mid, a, room.points[(i + 1) % n]!) <= tolerance,
      );
      if (onRoom) length -= dist(door.from, door.to);
    }
    total += Math.max(0, length);
  }
  return total;
}

export function computeSkirting(
  rooms: Room[],
  wallThickness: number,
  doorOpenings: DoorOpening[],
  params: ConsumableParams | undefined,
): SkirtingResult {
  const length = skirtingLength(rooms, wallThickness, doorOpenings);
  const pieceLength = Math.max(1, params?.skirtingPieceLength ?? DEFAULT_SKIRTING_PIECE);
  return {
    included: !!params?.skirting,
    length,
    pieceLength,
    pieces: Math.ceil((length * (1 + SKIRTING_MARGIN)) / pieceLength),
    margin: SKIRTING_MARGIN,
  };
}
