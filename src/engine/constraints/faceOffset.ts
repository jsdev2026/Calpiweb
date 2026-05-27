import type { Room, Constraint } from '@/types/project';

/**
 * Resolve the half-thickness of the wall edge most aligned with the constraint
 * direction at a given vertex index.
 *
 * For H_DISTANCE the bounding walls are vertical → preferVerticalEdge = true.
 * For V_DISTANCE the bounding walls are horizontal → preferVerticalEdge = false.
 */
function halfThicknessAt(
  nodeIdx: number,
  room: Room,
  defaultThickness: number,
  preferVerticalEdge: boolean,
): number {
  const n = room.points.length;
  const edgeIndices = [(nodeIdx - 1 + n) % n, nodeIdx];
  let bestEdge = -1;
  let bestScore = -1;

  for (const eIdx of edgeIndices) {
    const p1 = room.points[eIdx];
    const p2 = room.points[(eIdx + 1) % n];
    if (!p1 || !p2) continue;
    const adx = Math.abs(p2.x - p1.x);
    const ady = Math.abs(p2.y - p1.y);
    const total = adx + ady;
    if (total < 0.001) continue;
    const score = preferVerticalEdge ? ady / total : adx / total;
    if (score > bestScore) {
      bestScore = score;
      bestEdge = eIdx;
    }
  }

  if (bestEdge === -1 || bestScore < 0.5) return 0;
  return (room.edgeThicknesses?.[bestEdge] ?? defaultThickness) / 2;
}

/**
 * Compute the total display offset for a constraint, taking each endpoint's
 * face reference into account.
 *
 * Offset semantics (added to stored value to get displayed value):
 *   INSIDE  → +halfThickness  (interior face is closer to room interior)
 *   AXIS    →  0
 *   OUTSIDE → −halfThickness  (exterior face extends beyond axis)
 *
 * Formula:  displayed = stored + offsetA + offsetB
 *           stored    = displayed − offsetA − offsetB
 *
 * Backward compatibility: absent `face` is treated as 'INSIDE'.
 */
export function constraintFaceOffset(
  constraint: Constraint,
  room: Room,
  defaultThickness: number,
): number {
  if (
    (constraint.type !== 'H_DISTANCE' && constraint.type !== 'V_DISTANCE') ||
    constraint.pts.length < 2
  ) {
    return 0;
  }

  const [p1ref, p2ref] = [constraint.pts[0]!, constraint.pts[1]!];
  if (p1ref.roomId !== p2ref.roomId) return 0;
  if (p1ref.roomId !== room.id) return 0;

  const preferVerticalEdge = constraint.type === 'H_DISTANCE';
  const halfA = halfThicknessAt(p1ref.vertexIdx, room, defaultThickness, preferVerticalEdge);
  const halfB = halfThicknessAt(p2ref.vertexIdx, room, defaultThickness, preferVerticalEdge);

  const faceOffset = (face: 'INSIDE' | 'AXIS' | 'OUTSIDE' | undefined, half: number): number => {
    const f = face ?? 'INSIDE';
    if (f === 'INSIDE')  return +half;
    if (f === 'OUTSIDE') return -half;
    return 0; // AXIS
  };

  return faceOffset(p1ref.face, halfA) + faceOffset(p2ref.face, halfB);
}
