// src/engine/geometry/wallFaces.test.ts
import { describe, it, expect } from 'vitest';
import { wallsToRooms, wallFaceCycles } from './wallFaces';
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';

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

describe('wallsToRooms — excludedZones', () => {
  const rectNodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
  const rectWalls: Wall[] = [
    { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
    { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
    { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
    { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
  ];

  it('returns rooms with empty excludedZones when no zones provided', () => {
    const rooms = wallsToRooms(rectWalls, rectNodes);
    expect(rooms[0]!.excludedZones).toEqual([]);
  });

  it('assigns zone to room when zone centroid is inside the room', () => {
    const zones: WallExcludedZone[] = [{
      id: 'z1',
      nodes: [{ id: 'n1', x: 30, y: 30 }, { id: 'n2', x: 70, y: 30 }, { id: 'n3', x: 70, y: 70 }, { id: 'n4', x: 30, y: 70 }],
    }];
    const rooms = wallsToRooms(rectWalls, rectNodes, zones);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.excludedZones).toHaveLength(1);
    expect(rooms[0]!.excludedZones![0]!.id).toBe('z1');
  });

  it('ignores zone whose centroid is outside all rooms', () => {
    const zones: WallExcludedZone[] = [{
      id: 'z2',
      nodes: [{ id: 'n1', x: 200, y: 200 }, { id: 'n2', x: 250, y: 200 }, { id: 'n3', x: 250, y: 250 }, { id: 'n4', x: 200, y: 250 }],
    }];
    const rooms = wallsToRooms(rectWalls, rectNodes, zones);
    expect(rooms[0]!.excludedZones).toHaveLength(0);
  });
});

describe('wallsToRooms — isDoor propagation', () => {
  it('marque l\'arête porte comme DOOR dans le tableau edges de la pièce', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20, isDoor: true },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(1);
    const doorCount = rooms[0]!.edges.filter(e => e === 'DOOR').length;
    const wallCount = rooms[0]!.edges.filter(e => e === 'WALL').length;
    expect(doorCount).toBe(1);
    expect(wallCount).toBe(3);
  });

  it('deux pièces partageant un mur porte — les deux pièces ont une arête DOOR', () => {
    // 6 nodes: a(0,0) b(100,0) c(200,0) d(200,100) e(100,100) f(0,100)
    // Room gauche : a-b-e-f   Room droite : b-c-d-e
    const nodes = [
      nd('a', 0, 0), nd('b', 100, 0), nd('c', 200, 0),
      nd('d', 200, 100), nd('e', 100, 100), nd('f', 0, 100),
    ];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'e', thickness: 20 },
      { id: 'w5', node1Id: 'e', node2Id: 'b', thickness: 20, isDoor: true },
      { id: 'w6', node1Id: 'e', node2Id: 'f', thickness: 20 },
      { id: 'w7', node1Id: 'f', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(2);
    const totalDoorEdges = rooms.reduce((sum, r) => sum + r.edges.filter(e => e === 'DOOR').length, 0);
    expect(totalDoorEdges).toBe(2); // chaque pièce voit l'arête porte comme DOOR
  });
});

describe('wallFaceCycles', () => {
  it('retourne [] pour un graphe vide', () => {
    expect(wallFaceCycles([], [])).toEqual([]);
  });

  it('rectangle 4 murs → 1 cycle, 4 nodeIds, 4 wallIds', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
      { id:'w4', node1Id:'d', node2Id:'a', thickness:10 },
    ];
    const result = wallFaceCycles(walls, nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.nodeIds).toHaveLength(4);
    expect(result[0]!.wallIds).toHaveLength(4);
    expect(new Set(result[0]!.wallIds)).toEqual(new Set(['w1','w2','w3','w4']));
  });

  it('wallIds[i] est le mur entre nodeIds[i] et nodeIds[(i+1)%n]', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
      { id:'w4', node1Id:'d', node2Id:'a', thickness:10 },
    ];
    const [cycle] = wallFaceCycles(walls, nodes);
    for (let i = 0; i < cycle!.nodeIds.length; i++) {
      const n1 = cycle!.nodeIds[i]!;
      const n2 = cycle!.nodeIds[(i + 1) % cycle!.nodeIds.length]!;
      const wId = cycle!.wallIds[i]!;
      const wall = walls.find(w => w.id === wId)!;
      expect(
        (wall.node1Id === n1 && wall.node2Id === n2) ||
        (wall.node1Id === n2 && wall.node2Id === n1)
      ).toBe(true);
    }
  });

  it('T-junction (2 pièces partageant un mur) → 2 cycles', () => {
    const nodes = [
      nd('a',0,0), nd('b',100,0), nd('c',200,0),
      nd('d',200,100), nd('e',100,100), nd('f',0,100),
    ];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
      { id:'w4', node1Id:'d', node2Id:'e', thickness:10 },
      { id:'w5', node1Id:'e', node2Id:'b', thickness:10 },
      { id:'w6', node1Id:'e', node2Id:'f', thickness:10 },
      { id:'w7', node1Id:'f', node2Id:'a', thickness:10 },
    ];
    const result = wallFaceCycles(walls, nodes);
    expect(result).toHaveLength(2);
    expect(result[0]!.nodeIds).toHaveLength(4);
    expect(result[1]!.nodeIds).toHaveLength(4);
  });

  it('chaîne ouverte → 0 cycles', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
    ];
    expect(wallFaceCycles(walls, nodes)).toHaveLength(0);
  });
});

describe('wallFaceCycles — cloisons (T-junction)', () => {
  // Rectangle a(0,0) b(100,0) c(100,100) d(0,100)
  // Mur du haut splitté en a→m et m→b, avec m(50,0)
  // Cloison m→f, f(50,60) — pend dans la pièce
  const nodes = [
    nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100),
    nd('m', 50, 0),
    nd('f', 50, 60),
  ];
  const walls: Wall[] = [
    { id: 'w1a', node1Id: 'a', node2Id: 'm', thickness: 20 },
    { id: 'w1b', node1Id: 'm', node2Id: 'b', thickness: 20 },
    { id: 'w2',  node1Id: 'b', node2Id: 'c', thickness: 20 },
    { id: 'w3',  node1Id: 'c', node2Id: 'd', thickness: 20 },
    { id: 'w4',  node1Id: 'd', node2Id: 'a', thickness: 20 },
    { id: 'wC',  node1Id: 'm', node2Id: 'f', thickness: 15 }, // cloison
  ];

  it('pièce rectangulaire préservée quand une cloison pend depuis un nœud du contour', () => {
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(1);
    // Le cycle inclut les 5 nœuds du contour (a, m, b, c, d)
    expect(rooms[0]!.points).toHaveLength(5);
  });

  it('cloison complètement libre ne crée pas de pièce', () => {
    const freeNodes = [nd('p', 0, 0), nd('q', 0, 100)];
    const freeWalls: Wall[] = [{ id: 'wF', node1Id: 'p', node2Id: 'q', thickness: 15 }];
    expect(wallsToRooms(freeWalls, freeNodes)).toHaveLength(0);
  });

  it('pièce + cloison connectée à un coin existant (degré 3)', () => {
    // Rectangle normal + cloison sortant du coin b
    const n2 = [
      nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100),
      nd('e', 100, 50), // free end of cloison
    ];
    const w2: Wall[] = [
      { id: 'r1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'r2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'r3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'r4', node1Id: 'd', node2Id: 'a', thickness: 20 },
      { id: 'rC', node1Id: 'b', node2Id: 'e', thickness: 10 },
    ];
    const rooms = wallsToRooms(w2, n2);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.points).toHaveLength(4); // a, b, c, d
  });
});
