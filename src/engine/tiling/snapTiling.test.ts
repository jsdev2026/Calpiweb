import { describe, it, expect } from 'vitest';
import { snapToTiling, getParallelAngle } from './snapTiling';
import type { Room } from '@/types/project';
import type { Tile } from '@/types/tiling';
import type { WallNode } from '@/types/wall';

const room300: Room = {
  id: 'r1',
  points: [
    { x: 0, y: 0 }, { x: 3000, y: 0 },
    { x: 3000, y: 3000 }, { x: 0, y: 3000 },
  ],
  edges: ['WALL', 'WALL', 'WALL', 'WALL'],
};

const tile100: Tile = {
  id: 't1',
  rect: { x: 500, y: 500, w: 100, h: 100 },
  type: 'WHOLE',
};

describe('snapToTiling', () => {
  it('returns null when no target within snap radius', () => {
    const result = snapToTiling({ x: 9999, y: 9999 }, [room300], [tile100], 0, 1);
    expect(result).toBeNull();
  });

  it('prefers wall-vertex over tile-corner when both in range', () => {
    // With wallThickness=0, insetRoomPolygon returns room300.points unchanged.
    // wall-vertex at (0,0); tile corner also within range at (2, 2) from query.
    // Query at (1, 1) — wall vertex (0,0) is 1.41 away; tile corner (0+500,0+500)=500 away → null for tile.
    // Use tile corner that overlaps with wall vertex proximity:
    const tileNearVertex: Tile = {
      id: 't2',
      rect: { x: 3, y: 3, w: 100, h: 100 },
      type: 'WHOLE',
    };
    // query at (1,1): wall-vertex (0,0) dist=1.41 < snap radius (15/1=15); tile corner (3,3) dist=2.83 < 15.
    // wall-vertex priority wins.
    const result = snapToTiling({ x: 1, y: 1 }, [room300], [tileNearVertex], 0, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('wall-vertex');
  });

  it('returns tile-corner when only tile targets in range', () => {
    // query far from room vertices, close to tile corner
    const result = snapToTiling({ x: 502, y: 502 }, [], [tile100], 0, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('tile-corner');
    expect(result!.point.x).toBeCloseTo(500);
    expect(result!.point.y).toBeCloseTo(500);
  });

  it('returns tile-midpoint when closer than corners', () => {
    // tile100: rect {x:500, y:500, w:100, h:100}
    // top-edge midpoint = (550, 500); query at (552, 500)
    const result = snapToTiling({ x: 552, y: 500 }, [], [tile100], 0, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('tile-midpoint');
    expect(result!.point.x).toBeCloseTo(550);
    expect(result!.point.y).toBeCloseTo(500);
  });
});

describe('getParallelAngle', () => {
  it('returns angle of the nearest wall edge midpoint to the query point', () => {
    // room300 top edge: from (0,0) to (3000,0); angle = atan2(0,3000) = 0
    // query near top edge midpoint (1500, 5)
    const angle = getParallelAngle({ x: 1500, y: 5 }, [room300], 0);
    expect(angle).not.toBeNull();
    // top edge angle = 0 (horizontal right); atan2(0,3000) = 0
    expect(angle).toBeCloseTo(0);
  });

  it('returns null for empty rooms list', () => {
    const angle = getParallelAngle({ x: 0, y: 0 }, [], 0);
    expect(angle).toBeNull();
  });
});

describe('snapToTiling — wall-node snap', () => {
  const nodes: WallNode[] = [
    { id: 'n1', x: 0, y: 0 },
    { id: 'n2', x: 3000, y: 0 },
  ];

  it('retourne kind wall-node et nodeId quand le curseur est proche d\'un nœud', () => {
    // n1 est à (0,0), curseur à (5, 3) — dist ~5.8 < rayon 15/1
    const result = snapToTiling({ x: 5, y: 3 }, [room300], [], 0, 1, nodes);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('wall-node');
    expect(result!.nodeId).toBe('n1');
    expect(result!.point.x).toBeCloseTo(0);
    expect(result!.point.y).toBeCloseTo(0);
  });

  it('wall-node a priorité sur wall-vertex quand les deux sont proches', () => {
    // room300 a un wall-vertex à (0,0). n1 est aussi à (0,0).
    // wall-node doit gagner (priorité 0 < 1).
    const result = snapToTiling({ x: 2, y: 2 }, [room300], [], 0, 1, nodes);
    expect(result!.kind).toBe('wall-node');
    expect(result!.nodeId).toBe('n1');
  });

  it('retourne null si aucun nœud dans le rayon et nodes fournis', () => {
    const result = snapToTiling({ x: 9999, y: 9999 }, [], [], 0, 1, nodes);
    expect(result).toBeNull();
  });

  it('sans nodes, le comportement existant est préservé', () => {
    const result = snapToTiling({ x: 1, y: 1 }, [room300], [], 0, 1);
    expect(result!.kind).toBe('wall-vertex');
    expect(result!.nodeId).toBeUndefined();
  });
});
