import { describe, expect, it } from 'vitest';
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
import type { Room } from '@/types/project';

describe('DIMENSION tool interior round-trip', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };

  it('room-to-room same room: open shows interior, submit stores centerline', () => {
    const fromRef = { roomId: 'r1', vertexIdx: 0 };
    const toRef   = { roomId: 'r1', vertexIdx: 1 };
    const absDx = Math.abs(3100 - 0);
    const syntheticC = { id: '', type: 'H_DISTANCE' as const, pts: [fromRef, toRef] };
    const offset = constraintFaceOffset(syntheticC, room, 100);
    expect(offset).toBe(100);
    expect((absDx - offset) / 10).toBe(300); // shown as 300cm
    expect(300 * 10 + offset).toBe(3100);    // stored as 3100mm
  });

  it('cross-entity (different roomIds): offset = 0', () => {
    const fromRef = { roomId: 'r1', vertexIdx: 0 };
    const toRef   = { roomId: 'partition-1', vertexIdx: 0 };
    const syntheticC = { id: '', type: 'H_DISTANCE' as const, pts: [fromRef, toRef] };
    const offset = constraintFaceOffset(syntheticC, room, 100);
    expect(offset).toBe(0);
  });
});
