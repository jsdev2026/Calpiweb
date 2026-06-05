import { describe, expect, it } from 'vitest';
import { selectRooms } from './projectStore';
import type { ProjectState } from './projectStore';

const makeNode = (id: string, x: number, y: number) => ({ id, x, y });
const makeWall = (id: string, n1: string, n2: string) => ({ id, node1Id: n1, node2Id: n2, thickness: 100 });

const nodes = [
  makeNode('A', 0, 0), makeNode('B', 1000, 0),
  makeNode('C', 1000, 1000), makeNode('D', 0, 1000),
];
const walls = [
  makeWall('w1', 'A', 'B'), makeWall('w2', 'B', 'C'),
  makeWall('w3', 'C', 'D'), makeWall('w4', 'D', 'A'),
];

function makeState(wallRoomNames?: Record<string, string>): ProjectState {
  return {
    projects: [{
      id: 'p1', name: 'Test', status: 'new' as const,
      createdAt: 0, updatedAt: 0, rooms: [], constraints: [], notes: [],
      config: { width: 300, height: 300, joint: 3, stagger: 0, angle: 0, layout: 'STRAIGHT' as const, offsetX: 0, offsetY: 0, chevronAngle: 45 },
      wallThickness: 100,
      wallEngine: { nodes, walls, excludedZones: [], ...(wallRoomNames ? { wallRoomNames } : {}) },
    }],
    activeProjectId: 'p1',
    hydrated: true,
  } as unknown as ProjectState;
}

describe('selectRooms — noms de pièces', () => {
  it('retourne le nom par défaut quand wallRoomNames est absent', () => {
    const rooms = selectRooms(makeState());
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.name).toBe('Pièce 1');
  });

  it('applique le nom stocké dans wallRoomNames', () => {
    const rooms = selectRooms(makeState());
    const roomId = rooms[0]!.id;
    const rooms2 = selectRooms(makeState({ [roomId]: 'Salon' }));
    expect(rooms2[0]!.name).toBe('Salon');
  });

  it("conserve le nom par défaut si l'ID n'est pas dans wallRoomNames", () => {
    const rooms = selectRooms(makeState({ 'unknown-id': 'Xyz' }));
    expect(rooms[0]!.name).toBe('Pièce 1');
  });
});
