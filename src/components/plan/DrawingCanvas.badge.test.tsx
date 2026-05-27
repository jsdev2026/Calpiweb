import { expect, it } from 'vitest';
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
import type { Room, Constraint } from '@/types/project';

// Verify the offset formula that will be used in the badge
it('badge label for H_DISTANCE 3100mm with 100mm walls shows 300cm interior', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const c: Constraint = {
    id: 'c1', type: 'H_DISTANCE',
    pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }],
    value: 3100,
  };
  const offset = constraintFaceOffset(c, room, 100);
  expect(offset).toBe(100);
  expect(c.value as number - offset).toBe(3000); // 300 cm
});

it('badge label for V_DISTANCE 4200mm with 100mm walls shows 410cm interior', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const c: Constraint = {
    id: 'c2', type: 'V_DISTANCE',
    pts: [{ roomId: 'r1', vertexIdx: 1 }, { roomId: 'r1', vertexIdx: 2 }],
    value: 4200,
  };
  const offset = constraintFaceOffset(c, room, 100);
  expect(offset).toBe(100);
  expect(c.value as number - offset).toBe(4100); // 410 cm
});
