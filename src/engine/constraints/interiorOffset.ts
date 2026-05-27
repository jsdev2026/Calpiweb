import type { Room, Constraint } from '@/types/project';
import { halfThicknessAt } from './faceOffset';

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
  if (p1ref.roomId !== room.id) return 0;
  // H_DISTANCE span is horizontal, so the bounding walls are vertical edges
  const preferVerticalEdge = constraint.type === 'H_DISTANCE';
  return (
    halfThicknessAt(p1ref.vertexIdx, room, defaultThickness, preferVerticalEdge) +
    halfThicknessAt(p2ref.vertexIdx, room, defaultThickness, preferVerticalEdge)
  );
}
