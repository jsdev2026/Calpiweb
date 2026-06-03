// src/engine/geometry/wallGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { computeCornerGeometry, computeJointLines } from './wallGeometry';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function near(a: { x: number; y: number } | undefined, b: { x: number; y: number }, eps = 0.1): boolean {
  if (!a) return false;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

// ── computeCornerGeometry ──────────────────────────────────────────────────

describe('computeCornerGeometry', () => {
  it('preserves wallId', () => {
    const nodes = [nd('a', 0,0), nd('b', 100,0)];
    const walls: Wall[] = [{ id: 'abc', node1Id:'a', node2Id:'b', thickness:10 }];
    expect(computeCornerGeometry(walls, nodes)[0]!.wallId).toBe('abc');
  });

  it('returns empty points for zero-length wall (same node)', () => {
    const nodes = [nd('a', 0,0)];
    const walls: Wall[] = [{ id: 'z', node1Id:'a', node2Id:'a', thickness:10 }];
    expect(computeCornerGeometry(walls, nodes)[0]!.points).toHaveLength(0);
  });

  it('single horizontal wall — flat caps at both ends', () => {
    const nodes = [nd('a', 0,0), nd('b', 100,0)];
    const walls: Wall[] = [{ id: 'h', node1Id:'a', node2Id:'b', thickness:10 }];
    const pts = computeCornerGeometry(walls, nodes)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], { x:0,   y:5  })).toBe(true);
    expect(near(pts[1], { x:100, y:5  })).toBe(true);
    expect(near(pts[2], { x:100, y:-5 })).toBe(true);
    expect(near(pts[3], { x:0,   y:-5 })).toBe(true);
  });

  it('single vertical wall — flat caps', () => {
    const nodes = [nd('a', 0,0), nd('b', 0,100)];
    const walls: Wall[] = [{ id: 'v', node1Id:'a', node2Id:'b', thickness:10 }];
    const pts = computeCornerGeometry(walls, nodes)[0]!.points;
    expect(near(pts[0], { x:-5, y:0   })).toBe(true);
    expect(near(pts[1], { x:-5, y:100 })).toBe(true);
    expect(near(pts[2], { x:5,  y:100 })).toBe(true);
    expect(near(pts[3], { x:5,  y:0   })).toBe(true);
  });

  it('two walls at 90° — correct extensions', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find(p => p.wallId==='w1')!;
    const p2 = polys.find(p => p.wallId==='w2')!;
    expect(near(p1.points[0]!, { x:0,   y:5  })).toBe(true);
    expect(near(p1.points[3]!, { x:0,   y:-5 })).toBe(true);
    expect(near(p1.points[1]!, { x:105, y:5  })).toBe(true);
    expect(near(p1.points[2]!, { x:105, y:-5 })).toBe(true);
    expect(near(p2.points[0]!, { x:95,  y:-5 })).toBe(true);
    expect(near(p2.points[3]!, { x:105, y:-5 })).toBe(true);
  });

  it('45° corner — correct extension (not T/2)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',170,70)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find(p => p.wallId==='w1')!;
    const extX = p1.points[1]!.x - 100;
    expect(extX).toBeGreaterThan(0);
    expect(extX).toBeLessThan(5); // must be less than T/2=5
  });

  it('120° corner — extension greater than T/2', () => {
    const angle = (120 * Math.PI) / 180;
    const nodes = [
      nd('n1', 0, 0),
      nd('n2', 100, 0),
      nd('n3', 100 + Math.cos(angle)*80, Math.sin(angle)*80),
    ];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find(p => p.wallId==='w1')!;
    const extX = p1.points[1]!.x - 100;
    expect(extX).toBeGreaterThan(5); // must be greater than T/2=5
  });

});

// ── computeJointLines ──────────────────────────────────────────────────────

describe('computeJointLines', () => {
  it('returns no lines for isolated walls', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0), nd('d',300,0)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'c', node2Id:'d', thickness:10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(0);
  });

  it('returns one line for two connected walls', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(1);
  });

  it('does not duplicate lines', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',100,100), nd('d',0,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(2);
  });

  it('90° equal-thickness — joint at (95,5) and (105,-5)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const lines = computeJointLines(walls, nodes);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    const a = near(l.p1, {x:95,y:5}) && near(l.p2, {x:105,y:-5});
    const b = near(l.p1, {x:105,y:-5}) && near(l.p2, {x:95,y:5});
    expect(a || b).toBe(true);
  });

  it('45° — joint endpoints stay within wall boundaries (|y|≤5)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',170,70)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const lines = computeJointLines(walls, nodes);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(Math.abs(l.p1.y)).toBeLessThanOrEqual(5.01);
    expect(Math.abs(l.p2.y)).toBeLessThanOrEqual(5.01);
  });

  it('different thicknesses — angle = arctan(h1/h2)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:20 },
    ];
    const lines = computeJointLines(walls, nodes);
    const l = lines[0]!;
    const dx = Math.abs(l.p2.x - l.p1.x);
    const dy = Math.abs(l.p2.y - l.p1.y);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    expect(angle).toBeCloseTo(Math.atan2(5, 10) * 180 / Math.PI, 1);
  });
});
