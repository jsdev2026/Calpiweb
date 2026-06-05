import { describe, expect, it } from 'vitest';
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
import type { Room, Constraint } from '@/types/project';

describe('WallEdgeEditor interior round-trip', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const wallThickness = 100;

  it('open: stored 3100mm H_DISTANCE → user sees 300cm (interior)', () => {
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }], value: 3100 };
    const offset = constraintFaceOffset(c, room, wallThickness);
    const displayedCm = (3100 - offset) / 10;
    expect(displayedCm).toBe(300);
  });

  it('submit: user types 300cm → stores 3100mm (centerline)', () => {
    const p1Ref = { roomId: 'r1', vertexIdx: 0 };
    const p2Ref = { roomId: 'r1', vertexIdx: 1 };
    const c: Constraint = { id: '', type: 'H_DISTANCE', pts: [p1Ref, p2Ref] };
    const offset = constraintFaceOffset(c, room, wallThickness);
    const storedMm = 300 * 10 + offset;
    expect(storedMm).toBe(3100);
  });
});
