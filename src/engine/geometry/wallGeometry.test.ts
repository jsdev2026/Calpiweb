// src/engine/geometry/wallGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { computeCornerGeometry, computeJointLines } from './wallGeometry';
import type { Wall } from '@/types/wall';

function pt(x: number, y: number) { return { x, y }; }

function near(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number },
  eps = 0.01,
): boolean {
  if (!a) return false;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

// ── computeCornerGeometry ────────────────────────────────────────────────────

describe('computeCornerGeometry', () => {
  it('preserves wallId', () => {
    const walls: Wall[] = [{ id: 'abc', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    expect(computeCornerGeometry(walls)[0]!.wallId).toBe('abc');
  });

  it('returns empty points for zero-length wall', () => {
    const walls: Wall[] = [{ id: 'z', p1: pt(0,0), p2: pt(0,0), thickness: 10 }];
    expect(computeCornerGeometry(walls)[0]!.points).toHaveLength(0);
  });

  it('single horizontal wall — flat caps at both ends', () => {
    // No neighbors: simple rectangle, no extension
    const walls: Wall[] = [{ id: 'h', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], pt(0,   5))).toBe(true);
    expect(near(pts[1], pt(100, 5))).toBe(true);
    expect(near(pts[2], pt(100,-5))).toBe(true);
    expect(near(pts[3], pt(0,  -5))).toBe(true);
  });

  it('single vertical wall — flat caps', () => {
    const walls: Wall[] = [{ id: 'v', p1: pt(0,0), p2: pt(0,100), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5,  0))).toBe(true);
    expect(near(pts[1], pt(-5,100))).toBe(true);
    expect(near(pts[2], pt( 5,100))).toBe(true);
    expect(near(pts[3], pt( 5,  0))).toBe(true);
  });

  it('two walls at 90° — each extends by neighbor half-thickness', () => {
    // W1 (0,0)→(100,0) h=5, W2 (100,0)→(100,100) h=5
    // W1 at p2: extends by W2.half=5 → p2 cap at x=105
    //   n-side=(105,5), anti-n=(105,-5)
    // W2 at p1: extends by W1.half=5 upward → p1 cap at y=-5
    //   n-side=(95,-5), anti-n=(105,-5)
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;

    // W1: left end flat, right end extended
    expect(near(p1.points[0], pt(0,   5))).toBe(true);  // p1 flat n-side
    expect(near(p1.points[3], pt(0,  -5))).toBe(true);  // p1 flat anti-n
    expect(near(p1.points[1], pt(105, 5))).toBe(true);  // p2 extended n-side
    expect(near(p1.points[2], pt(105,-5))).toBe(true);  // p2 extended anti-n

    // W2: top extended, bottom flat
    expect(near(p2.points[0], pt(95, -5))).toBe(true);  // p1 extended n-side
    expect(near(p2.points[3], pt(105,-5))).toBe(true);  // p1 extended anti-n
    expect(near(p2.points[1], pt(95, 100))).toBe(true); // p2 flat n-side
    expect(near(p2.points[2], pt(105,100))).toBe(true); // p2 flat anti-n
  });

  it('exterior corners are identical — overlap fills corner completely', () => {
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;
    // Both anti-n vertices at the corner = same exterior point
    expect(near(p1.points[2], p2.points[3]!)).toBe(true);
  });

  it('different thicknesses — each extends by the other\'s half', () => {
    // W1 h=5, W2 h=10 at corner (100,0)
    // W1 at p2: extends by 10 → x=110; n=(110,5), anti=(110,-5)
    // W2 at p1: extends by 5 up → y=-5; n=(90,-5), anti=(110,-5)
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 20 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;

    expect(near(p1.points[1], pt(110,  5))).toBe(true);
    expect(near(p1.points[2], pt(110, -5))).toBe(true);
    expect(near(p2.points[0], pt(90,  -5))).toBe(true);
    expect(near(p2.points[3], pt(110, -5))).toBe(true);
    // Both exterior corners at (110,-5)
    expect(near(p1.points[2], p2.points[3]!)).toBe(true);
  });

  it('diagonal wall — flat caps perpendicular to wall', () => {
    const walls: Wall[] = [{ id: 'd', p1: pt(0,0), p2: pt(100,100), thickness: 10*Math.SQRT2 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5,  5))).toBe(true);
    expect(near(pts[3], pt( 5, -5))).toBe(true);
  });
});

// ── computeJointLines ────────────────────────────────────────────────────────

describe('computeJointLines', () => {
  it('returns no lines for isolated walls', () => {
    const walls: Wall[] = [
      { id: 'a', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 },
      { id: 'b', p1: pt(200,0), p2: pt(300,0),   thickness: 10 },
    ];
    expect(computeJointLines(walls)).toHaveLength(0);
  });

  it('returns one line for two connected walls', () => {
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 10 };
    expect(computeJointLines([w1, w2])).toHaveLength(1);
  });

  it('does not duplicate lines', () => {
    // Three walls forming an L — 2 corners → 2 lines
    const walls: Wall[] = [
      { id: 'a', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 },
      { id: 'b', p1: pt(100,0), p2: pt(100,100), thickness: 10 },
      { id: 'c', p1: pt(0,0),   p2: pt(0,100),   thickness: 10 },
    ];
    expect(computeJointLines(walls)).toHaveLength(2);
  });

  it('joint line endpoints for 90° equal-thickness corner — 45°', () => {
    // n1=(0,1) h1=5, n2=(-1,0) h2=5 at p=(100,0)
    // interior = (100+0-5, 0+5+0) = (95, 5)
    // exterior = (100-0+5, 0-5-0) = (105,-5)
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 10 };
    const lines = computeJointLines([w1, w2]);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    // Either p1=(95,5),p2=(105,-5) or reversed — both are correct
    const a = near(l.p1, pt(95,5)) && near(l.p2, pt(105,-5));
    const b = near(l.p1, pt(105,-5)) && near(l.p2, pt(95,5));
    expect(a || b).toBe(true);
  });

  it('joint line angle = arctan(h1/h2) for different thicknesses', () => {
    // h1=5, h2=10 → angle = arctan(5/10) ≈ 26.6°
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 20 };
    const lines = computeJointLines([w1, w2]);
    const l = lines[0]!;
    const dx = Math.abs(l.p2.x - l.p1.x);
    const dy = Math.abs(l.p2.y - l.p1.y);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    expect(angle).toBeCloseTo(Math.atan2(5, 10) * 180 / Math.PI, 1);
  });
});
