import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { Room } from '@/types/project';

describe('DrawingCanvas badge fallback offset', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const wallThickness = 100;

  it('horizontal edge uses H_DISTANCE offset = wallThickness', () => {
    // bottom edge: vertex 0→1, dxE=3000 > dyE=0 → H_DISTANCE
    const dxE = 3000, dyE = 0;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    const offset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] },
      room, wallThickness,
    );
    expect(offset).toBe(wallThickness);
  });

  it('vertical edge uses V_DISTANCE offset = wallThickness', () => {
    // right edge: vertex 1→2, dxE=0 < dyE=4000 → V_DISTANCE
    const dxE = 0, dyE = 4000;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    const offset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 1 }, { roomId: 'r1', vertexIdx: 2 }] },
      room, wallThickness,
    );
    expect(offset).toBe(wallThickness);
  });

  it('badge value is edgeLen minus real fallback offset', () => {
    // bottom edge: length 3000, fallback offset from H_DISTANCE with wallThickness=100
    const edgeLen = 3000;
    const dxE = 3000, dyE = 0;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    const fallbackOffset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] },
      room, wallThickness,
    );
    expect(edgeLen - fallbackOffset).toBe(2900);
  });
});
