import { describe, expect, it } from 'vitest';
import { constraintFaceOffset } from './faceOffset';
import type { Room, Constraint } from '@/types/project';

// Rectangle: 0(0,0)→1(3000,0)→2(3000,4000)→3(0,4000)
// edges: 0=(0→1 bottom horiz), 1=(1→2 right vert), 2=(2→3 top horiz), 3=(3→0 left vert)
const room: Room = {
  id: 'r1',
  points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }],
  edges: ['WALL', 'WALL', 'WALL', 'WALL'],
};
const DEFAULT_T = 100;

// ── Backward-compatibility tests (face=undefined behaves as INSIDE) ──────────

describe('constraintFaceOffset — backward compat (face=undefined → INSIDE)', () => {
  it('returns 0 for LENGTH constraints', () => {
    const c: Constraint = { id: 'c', type: 'LENGTH', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintFaceOffset(c, room, DEFAULT_T)).toBe(0);
  });

  it('returns 0 for cross-entity constraints', () => {
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r2', vertexIdx: 0 }] };
    expect(constraintFaceOffset(c, room, DEFAULT_T)).toBe(0);
  });

  it('H_DISTANCE on bottom edge (0→1): offset = left_t/2 + right_t/2 = 50+50 = 100', () => {
    // At vertex 0: edge3 (left vert wall) is most vertical → half=50 → INSIDE offset=+50
    // At vertex 1: edge1 (right vert wall) is most vertical → half=50 → INSIDE offset=+50
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintFaceOffset(c, room, DEFAULT_T)).toBe(100);
  });

  it('V_DISTANCE on right edge (1→2): offset = bottom_t/2 + top_t/2 = 50+50 = 100', () => {
    // At vertex 1: edge0 (bottom horiz) is most horizontal → half=50 → INSIDE offset=+50
    // At vertex 2: edge2 (top horiz) is most horizontal → half=50 → INSIDE offset=+50
    const c: Constraint = { id: 'c', type: 'V_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 1 }, { roomId: 'r1', vertexIdx: 2 }] };
    expect(constraintFaceOffset(c, room, DEFAULT_T)).toBe(100);
  });

  it('H_DISTANCE with per-edge thickness: left=200mm, right=150mm → offset=175', () => {
    const roomOverride: Room = {
      ...room,
      edgeThicknesses: [undefined, 150, undefined, 200], // edge1=150, edge3=200
    };
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintFaceOffset(c, roomOverride, DEFAULT_T)).toBe(175); // 100 + 75
  });

  it('returns 0 for constraint.pts with fewer than 2 points', () => {
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }] };
    expect(constraintFaceOffset(c, room, DEFAULT_T)).toBe(0);
  });

  it('returns 0 for diagonal edge (score < 0.5 threshold)', () => {
    const almostHorizontalRoom: Room = {
      id: 'r1',
      points: [{ x: 0, y: 0 }, { x: 10000, y: 1 }, { x: 10001, y: 1 }, { x: 1, y: 0 }],
      edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    };
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintFaceOffset(c, almostHorizontalRoom, DEFAULT_T)).toBe(0);
  });

  it('returns 0 when room.id does not match constraint roomId', () => {
    const wrongRoom: Room = { ...room, id: 'r_other' };
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintFaceOffset(c, wrongRoom, DEFAULT_T)).toBe(0);
  });
});
