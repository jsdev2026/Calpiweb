// src/engine/geometry/wallFaces.test.ts
import { describe, it, expect } from 'vitest';
import { wallsToRooms } from './wallFaces';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

describe('wallsToRooms', () => {
  it('returns [] for empty walls', () => {
    expect(wallsToRooms([], [])).toEqual([]);
  });

  it('returns [] for a single wall (no closed cycle)', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0)];
    const walls: Wall[] = [{ id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 }];
    expect(wallsToRooms(walls, nodes)).toEqual([]);
  });

  it('returns [] for an open chain of 3 nodes', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
    ];
    expect(wallsToRooms(walls, nodes)).toEqual([]);
  });

  it('returns 1 Room for a simple rectangle', () => {
    // Nodes in SVG coords (Y down): a(0,0) b(100,0) c(100,100) d(0,100)
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.points).toHaveLength(4);
    expect(rooms[0]!.edges).toEqual(['WALL', 'WALL', 'WALL', 'WALL']);
    expect(rooms[0]!.name).toBe('Pièce 1');
    expect(rooms[0]!.partitions).toEqual([]);
    expect(rooms[0]!.excludedZones).toEqual([]);
  });

  it('returns 2 Rooms for two rectangles sharing a wall', () => {
    // 6 nodes: a(0,0) b(100,0) c(200,0) d(200,100) e(100,100) f(0,100)
    // Room L: a-b-e-f   Room R: b-c-d-e
    const nodes = [
      nd('a', 0, 0), nd('b', 100, 0), nd('c', 200, 0),
      nd('d', 200, 100), nd('e', 100, 100), nd('f', 0, 100),
    ];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'e', thickness: 20 },
      { id: 'w5', node1Id: 'e', node2Id: 'b', thickness: 20 }, // mur partagé
      { id: 'w6', node1Id: 'e', node2Id: 'f', thickness: 20 },
      { id: 'w7', node1Id: 'f', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(2);
    rooms.forEach(r => expect(r.points).toHaveLength(4));
    const ids = rooms.map(r => r.id);
    expect(new Set(ids).size).toBe(2); // IDs are unique
    expect(rooms[0]!.name).toBe('Pièce 1');
    expect(rooms[1]!.name).toBe('Pièce 2');
  });

  it('generates stable IDs — same graph always produces same room IDs', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    const r1 = wallsToRooms(walls, nodes);
    const r2 = wallsToRooms(walls, nodes);
    expect(r1[0]!.id).toBe(r2[0]!.id);
    expect(r1[0]!.id).toMatch(/^wf-/);
  });
});
