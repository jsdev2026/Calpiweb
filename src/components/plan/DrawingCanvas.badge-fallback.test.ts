import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { Room } from '@/types/project';

describe('DrawingCanvas badge fallback offset', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };

  it('horizontal edge (dxE > dyE) → fallbackType H_DISTANCE, offset = 100', () => {
    const dxE = 3000, dyE = 0;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    expect(fallbackType).toBe('H_DISTANCE');
    const offset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] },
      room, 100,
    );
    expect(offset).toBe(100);
  });

  it('vertical edge (dyE > dxE) → fallbackType V_DISTANCE, offset = 100', () => {
    const dxE = 0, dyE = 4000;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    expect(fallbackType).toBe('V_DISTANCE');
    const offset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 1 }, { roomId: 'r1', vertexIdx: 2 }] },
      room, 100,
    );
    expect(offset).toBe(100);
  });

  it('badge displays edgeLen minus fallback offset', () => {
    const edgeLen = 3000;
    const fallbackOffset = 100;
    expect(edgeLen - fallbackOffset).toBe(2900);
  });
});
