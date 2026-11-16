import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { getBoundingBox, insetRoomPolygon, rotatePoint } from '@/engine/geometry/polygon';

// Origine de la pose : conversions entre un déplacement à l'écran (repère monde)
// et les décalages offsetX / offsetY exprimés dans le repère des carreaux.

const mod = (v: number, m: number): number => ((v % m) + m) % m;

/**
 * Ramène un décalage dans [0, pas[ pour la pose droite (périodique),
 * arrondi au mm. Les autres poses gardent la valeur brute arrondie.
 */
export function normalizeOffset(
  config: TilingConfig,
  offsetX: number,
  offsetY: number,
): { offsetX: number; offsetY: number } {
  if (config.layout !== 'STRAIGHT')
    return { offsetX: Math.round(offsetX), offsetY: Math.round(offsetY) };
  const stepX = config.width + config.joint;
  const stepY = config.height + config.joint;
  return { offsetX: Math.round(mod(offsetX, stepX)), offsetY: Math.round(mod(offsetY, stepY)) };
}

/**
 * Applique un glissement (dx, dy en mm, repère monde) aux décalages de la pose.
 * Les carreaux sont tournés de config.angle autour du centre : le déplacement
 * est donc ramené dans le repère des carreaux (rotation de -angle).
 */
export function dragOffset(
  config: TilingConfig,
  dx: number,
  dy: number,
): { offsetX: number; offsetY: number } {
  const a = (config.angle * Math.PI) / 180;
  const dxT = dx * Math.cos(a) + dy * Math.sin(a);
  const dyT = -dx * Math.sin(a) + dy * Math.cos(a);
  return { offsetX: config.offsetX + dxT, offsetY: config.offsetY + dyT };
}

/** Boîte englobante des pièces dans le repère des carreaux (même pivot que le moteur). */
export function tileSpaceBBox(
  rooms: Room[],
  config: TilingConfig,
  wallThickness: number,
  doorOpenings: DoorOpening[] = [],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const valid = rooms.filter((r) => r.points.length >= 3);
  if (valid.length === 0) return null;
  const insets = valid.map((r) => insetRoomPolygon(r, wallThickness));
  // Pivot identique à computeTiling / computeTilingMultiRoom
  const pivotSource =
    valid.length === 1 && doorOpenings.length === 0 ? insets[0]! : valid.flatMap((r) => r.points);
  const pb = getBoundingBox(pivotSource);
  const cx = (pb.minX + pb.maxX) / 2;
  const cy = (pb.minY + pb.maxY) / 2;
  const pts = insets
    .flat()
    .map((p) => (config.angle !== 0 ? rotatePoint(p.x, p.y, -config.angle, cx, cy) : p));
  return getBoundingBox(pts);
}

export type LayoutOrigin = 'CORNER' | 'CENTER';

/**
 * Décalages pour démarrer la pose :
 * - CORNER : un carreau entier dans l'angle haut-gauche de la pièce ;
 * - CENTER : un carreau centré sur la pièce (coupes symétriques).
 * Pour bâton rompu / point de Hongrie, la pose est déjà calée sur le centre.
 */
export function originOffset(
  origin: LayoutOrigin,
  rooms: Room[],
  config: TilingConfig,
  wallThickness: number,
  doorOpenings: DoorOpening[] = [],
): { offsetX: number; offsetY: number } {
  if (config.layout !== 'STRAIGHT' || origin === 'CORNER') return { offsetX: 0, offsetY: 0 };
  const bb = tileSpaceBBox(rooms, config, wallThickness, doorOpenings);
  if (!bb) return { offsetX: 0, offsetY: 0 };
  const stepX = config.width + config.joint;
  const stepY = config.height + config.joint;
  const cx = (bb.maxX - bb.minX) / 2;
  const cy = (bb.maxY - bb.minY) / 2;
  return {
    offsetX: Math.round(mod(cx - config.width / 2, stepX)),
    offsetY: Math.round(mod(cy - config.height / 2, stepY)),
  };
}

/**
 * Aimantation en fin de glissement : si un décalage est à moins de `tolerance` mm
 * d'une valeur cible (angle ou centre), il s'y accroche. Pose droite uniquement.
 */
export function snapOffset(
  config: TilingConfig,
  offset: { offsetX: number; offsetY: number },
  targets: { offsetX: number; offsetY: number }[],
  tolerance = 30,
): { offsetX: number; offsetY: number } {
  if (config.layout !== 'STRAIGHT') return offset;
  const stepX = config.width + config.joint;
  const stepY = config.height + config.joint;
  const snapAxis = (v: number, step: number, ts: number[]): number => {
    for (const t of ts) {
      const d = Math.abs(mod(v - t + step / 2, step) - step / 2);
      if (d <= tolerance) return Math.round(mod(t, step));
    }
    return v;
  };
  return {
    offsetX: snapAxis(
      offset.offsetX,
      stepX,
      targets.map((t) => t.offsetX),
    ),
    offsetY: snapAxis(
      offset.offsetY,
      stepY,
      targets.map((t) => t.offsetY),
    ),
  };
}
