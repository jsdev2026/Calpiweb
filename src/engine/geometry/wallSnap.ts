import type { Wall, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';

/** Euclidean distance in world units. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Project `cursor` onto the segment [p1, p2].
 * Returns { t, projected } where t ∈ [0,1] is the parameter along the segment
 * and `projected` is the closest point on the infinite line.
 * Returns null if the segment has zero length.
 */
function projectOntoSegment(
  cursor: Point,
  p1: Point,
  p2: Point,
): { t: number; projected: Point } | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return null;
  const t = ((cursor.x - p1.x) * dx + (cursor.y - p1.y) * dy) / lenSq;
  const projected: Point = { x: p1.x + t * dx, y: p1.y + t * dy };
  return { t, projected };
}

/**
 * Find the best snap target for `cursor` among `walls`.
 *
 * Priority:
 *  1. Endpoint snap (radius = endpointRadiusPx / scale)
 *  2. Face snap — cursor projected onto wall centerline within segment bounds
 *     (radius = faceRadiusPx / scale)
 *  3. null (free placement)
 */
export function snapToWalls(
  cursor: Point,
  walls: Wall[],
  scale: number,
  endpointRadiusPx: number,
  faceRadiusPx: number,
): SnapResult | null {
  const epRadius = endpointRadiusPx / scale;
  const faceRadius = faceRadiusPx / scale;

  // 1. Endpoint snap
  let bestEpDist = epRadius;
  let bestEp: SnapResult | null = null;
  for (const wall of walls) {
    for (const pt of [wall.p1, wall.p2]) {
      const d = dist(cursor, pt);
      if (d < bestEpDist) {
        bestEpDist = d;
        bestEp = { point: pt, type: 'endpoint', wallId: wall.id };
      }
    }
  }
  if (bestEp) return bestEp;

  // 2. Face snap (project onto centerline)
  let bestFaceDist = faceRadius;
  let bestFace: SnapResult | null = null;
  for (const wall of walls) {
    const proj = projectOntoSegment(cursor, wall.p1, wall.p2);
    if (!proj) continue;
    if (proj.t < 0 || proj.t > 1) continue;  // outside segment bounds
    const d = dist(cursor, proj.projected);
    if (d < bestFaceDist) {
      bestFaceDist = d;
      bestFace = { point: proj.projected, type: 'face', wallId: wall.id };
    }
  }
  if (bestFace) return bestFace;

  return null;
}
