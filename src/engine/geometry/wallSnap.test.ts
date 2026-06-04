// src/engine/geometry/wallSnap.test.ts
import { describe, it, expect } from 'vitest';
import { snapToWalls, perpendicularSnapForNode, adjacentAxisSnapForNode, collinearSnap, collinearSnapForNode } from './wallSnap';
import type { Wall, WallNode } from '@/types/wall';

const SCALE = 1;
const EP_R = 12;
const FA_R = 8;
const HV_R = 8;

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

// Two walls sharing node 'n2' at (100,0)
const nodes: WallNode[] = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,200)];
const horizontal: Wall = { id:'h', node1Id:'n1', node2Id:'n2', thickness:20 };
const vertical:   Wall = { id:'v', node1Id:'n2', node2Id:'n3', thickness:20 };

describe('snapToWalls — endpoint', () => {
  it('snaps to node1 position within radius', () => {
    const r = snapToWalls({ x:5, y:3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x:0, y:0 });
    expect(r?.nodeId).toBe('n1');
  });

  it('snaps to node2 position within radius', () => {
    const r = snapToWalls({ x:97, y:-2 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x:100, y:0 });
    expect(r?.nodeId).toBe('n2');
  });

  it('returns null far from all walls', () => {
    const r = snapToWalls({ x:500, y:500 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over face snap', () => {
    const r = snapToWalls({ x:100, y:5 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
  });
});

describe('snapToWalls — face', () => {
  it('snaps to projected point on centerline within face radius', () => {
    const r = snapToWalls({ x:50, y:5 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('face');
    expect(r?.point.x).toBeCloseTo(50);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('does not snap to face beyond wall bounds', () => {
    const r = snapToWalls({ x:300, y:20 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });
});

describe('adjacentAxisSnapForNode', () => {
  // A=(0,0), B=(300,200) — adjacent nodes of the dragged node
  const A = nd('a', 0, 0);
  const B = nd('b', 300, 200);
  const HV = 20;

  it('returns intersection when cursor is within H of A and V of B simultaneously', () => {
    // Cursor near (300, 5): within V of B.x=300 (dx=0) and H of A.y=0 (dy=5)
    const r = adjacentAxisSnapForNode({ x: 300, y: 5 }, [A, B], 1, HV);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBeUndefined(); // intersection
    expect(r?.point).toEqual({ x: 300, y: 0 });
  });

  it('returns single H snap when only H is in range', () => {
    // Cursor at (500, 5): H of A.y=0 active, but no node at x≈500
    const r = adjacentAxisSnapForNode({ x: 500, y: 5 }, [A, B], 1, HV);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('returns single V snap when only V is in range', () => {
    const r = adjacentAxisSnapForNode({ x: 5, y: 500 }, [A, B], 1, HV);
    expect(r?.axis).toBe('v');
    expect(r?.point.x).toBeCloseTo(0);
  });

  it('returns null when cursor is far from all adjacent nodes', () => {
    const r = adjacentAxisSnapForNode({ x: 150, y: 100 }, [A, B], 1, HV);
    expect(r).toBeNull();
  });

  it('works with a single adjacent node (no intersection possible)', () => {
    const r = adjacentAxisSnapForNode({ x: 5, y: 5 }, [A], 1, HV);
    // Both H and V snap to A=(0,0) → intersection at (0,0)
    expect(r?.point).toEqual({ x: 0, y: 0 });
  });
});

describe('perpendicularSnapForNode — Thales circle', () => {
  // A at (0,0), B at (200,0) → Thales circle center=(100,0) radius=100
  // Any point on the circle makes a 90° angle between OA and OB
  const A = nd('a', 0, 0);
  const B = nd('b', 200, 0);
  const PERP_R = 20; // px

  it('snaps to Thales circle when cursor is near the 90° position above', () => {
    // Perfect 90° point: (100,100) — on the circle, above the diameter
    // Move cursor slightly off: (100, 95) — within perpR/scale of circle
    const r = perpendicularSnapForNode({ x: 100, y: 95 }, [A, B], 1, PERP_R);
    expect(r?.type).toBe('perpendicular');
    expect(r?.point.x).toBeCloseTo(100, 0);
    expect(r?.point.y).toBeCloseTo(100, 0);
  });

  it('snaps to Thales circle when cursor is near the 90° position below', () => {
    const r = perpendicularSnapForNode({ x: 100, y: -95 }, [A, B], 1, PERP_R);
    expect(r?.type).toBe('perpendicular');
    expect(r?.point.y).toBeCloseTo(-100, 0);
  });

  it('returns null when cursor is far from the Thales circle', () => {
    // (100, 50) — on center, far inside circle (dist to circle = 50, perpR = 20)
    const r = perpendicularSnapForNode({ x: 100, y: 50 }, [A, B], 1, PERP_R);
    expect(r).toBeNull();
  });

  it('returns null when only one adjacent node (no pair)', () => {
    const r = perpendicularSnapForNode({ x: 100, y: 95 }, [A], 1, PERP_R);
    expect(r).toBeNull();
  });

  it('returns null near A (degenerate — snap would be at endpoint, not 90°)', () => {
    // (5, 5) is near A — snap point would be near A → excluded
    const r = perpendicularSnapForNode({ x: 5, y: 5 }, [A, B], 1, PERP_R);
    expect(r).toBeNull();
  });
});

describe('snapToWalls — H/V snap without walls (first chain node)', () => {
  it('snaps horizontally to a node even when no walls exist', () => {
    // First node placed at (0,0), cursor at (150, 3) — should snap to y=0
    const startNode = nd('start', 0, 0);
    const r = snapToWalls({ x: 150, y: 3 }, [], [startNode], SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('snaps vertically to a node even when no walls exist', () => {
    const startNode = nd('start', 0, 0);
    const r = snapToWalls({ x: 3, y: 150 }, [], [startNode], SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('v');
    expect(r?.point.x).toBeCloseTo(0);
  });
});

describe('snapToWalls — intersection snap (H + V simultaneous)', () => {
  // n1=(0,0), n2=(100,0), n3=(100,200) with walls h and v
  it('snaps to intersection when cursor is within both H and V radius', () => {
    // Cursor at (5, 3): within V radius of n1.x=0 (dx=5<8) AND H radius of n2.y=0 (dy=3<8)
    // Intersection = (0, 0) = n1 — but n1 is an active node (endpoint would catch it)
    // Use a cursor far from endpoints but within both H and V of different nodes
    // n1=(0,0): V snap at x=0; n3=(100,200): H snap at y=200
    // Cursor at (5, 197): dx=5 from x=0, dy=3 from y=200 → intersection at (0, 200)
    const r = snapToWalls({ x: 5, y: 197 }, [horizontal, vertical], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBeUndefined(); // intersection has no single axis
    expect(r?.point.x).toBeCloseTo(0);
    expect(r?.point.y).toBeCloseTo(200);
  });

  it('intersection snap takes priority over single-axis snap', () => {
    // Cursor at (3, 3): within V of n1.x=0 (dx=3) AND H of n1.y=0 (dy=3)
    // Both active → intersection = (0,0) which is n1 — endpoint snap wins
    // Use distinct nodes: cursor at (3, 197) — V of n1(x=0) + H of n3(y=200)
    const r = snapToWalls({ x: 3, y: 197 }, [horizontal, vertical], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBeUndefined();
    expect(r?.point).toEqual({ x: 0, y: 200 });
  });

  it('falls back to single H snap when only H is in range', () => {
    // Cursor at (150, 3): dy=3 from y=0 (H snap) but no node at x≈150 → single H
    const r = snapToWalls({ x: 150, y: 3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
  });
});

describe('snapToWalls — H/V snap', () => {
  it('snaps horizontally when cursor is near same Y as a node', () => {
    // cursor at (150, 3) — near y=0 of n1/n2 but far from endpoint and face
    const r = snapToWalls({ x:150, y:3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
    expect(r?.point.y).toBeCloseTo(0);
    expect(r?.point.x).toBeCloseTo(150);
  });

  it('snaps vertically when cursor is near same X as a node', () => {
    // cursor at (3, 150) — near x=0 of n1
    const r = snapToWalls({ x:3, y:150 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('v');
    expect(r?.point.x).toBeCloseTo(0);
    expect(r?.point.y).toBeCloseTo(150);
  });

  it('H/V snap does not activate when cursor is beyond snap radius', () => {
    const r = snapToWalls({ x:150, y:20 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over H/V snap', () => {
    // near n2=(100,0) but also near y=0 axis
    const r = snapToWalls({ x:100, y:3 }, [horizontal, vertical], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
  });
});

describe('collinearSnap', () => {
  const nodes = [nd('n1', 0, 0), nd('n2', 200, 0)];
  const walls: Wall[] = [{ id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 }];

  it('snappe le curseur sur la droite infinie du mur (milieu du segment)', () => {
    const r = collinearSnap({ x: 100, y: 8 }, walls, nodes, 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it("snappe au-delà de l'extrémité du mur (extension)", () => {
    const r = collinearSnap({ x: 300, y: 5 }, walls, nodes, 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(300);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('retourne null quand le curseur est trop loin de la droite', () => {
    const r = collinearSnap({ x: 100, y: 20 }, walls, nodes, 1, 12);
    expect(r).toBeNull();
  });

  it('peuple dir avec la direction normalisée du mur', () => {
    const r = collinearSnap({ x: 100, y: 5 }, walls, nodes, 1, 12);
    expect(r?.dir?.x).toBeCloseTo(1);
    expect(r?.dir?.y).toBeCloseTo(0);
  });
});

describe('collinearSnapForNode', () => {
  const A = nd('a', 0, 0);
  const B = nd('b', 200, 0);

  it('snappe le curseur sur la droite A-B', () => {
    const r = collinearSnapForNode({ x: 100, y: 8 }, [A, B], 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('retourne null avec un seul nœud adjacent (pas de paire)', () => {
    const r = collinearSnapForNode({ x: 100, y: 5 }, [A], 1, 12);
    expect(r).toBeNull();
  });

  it('retourne null quand le curseur est trop loin', () => {
    const r = collinearSnapForNode({ x: 100, y: 20 }, [A, B], 1, 12);
    expect(r).toBeNull();
  });

  it('fonctionne avec une paire diagonale', () => {
    const C = nd('c', 0, 0), D = nd('d', 100, 100);
    const r = collinearSnapForNode({ x: 50, y: 55 }, [C, D], 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(52.5, 0);
    expect(r?.point.y).toBeCloseTo(52.5, 0);
  });

  it('peuple dir avec la direction normalisée de la paire', () => {
    const r = collinearSnapForNode({ x: 100, y: 5 }, [A, B], 1, 12);
    expect(r?.dir?.x).toBeCloseTo(1);
    expect(r?.dir?.y).toBeCloseTo(0);
  });
});
