import type { Room, Constraint } from '@/types/project';

function halfThicknessAt(
  nodeIdx: number,
  room: Room,
  defaultThickness: number,
  preferVertical: boolean,
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
    const score = preferVertical ? ady / total : adx / total;
    if (score > bestScore) {
      bestScore = score;
      bestEdge = eIdx;
    }
  }

  if (bestEdge === -1 || bestScore < 0.5) return 0;
  const t = room.edgeThicknesses?.[bestEdge] ?? defaultThickness;
  return t / 2;
}

export function constraintInteriorOffset(
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
  const preferVertical = constraint.type === 'H_DISTANCE';
  return (
    halfThicknessAt(p1ref.vertexIdx, room, defaultThickness, preferVertical) +
    halfThicknessAt(p2ref.vertexIdx, room, defaultThickness, preferVertical)
  );
}
