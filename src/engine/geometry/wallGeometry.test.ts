// src/engine/geometry/wallGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { computeCornerGeometry } from './wallGeometry';
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

describe('computeCornerGeometry', () => {
  it('preserves wallId', () => {
    const walls: Wall[] = [{ id: 'abc', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    expect(computeCornerGeometry(walls)[0]!.wallId).toBe('abc');
  });

  it('returns empty points for zero-length wall', () => {
    const walls: Wall[] = [{ id: 'z', p1: pt(0,0), p2: pt(0,0), thickness: 10 }];
    expect(computeCornerGeometry(walls)[0]!.points).toHaveLength(0);
  });

  it('single horizontal wall — flat caps, 4 points', () => {
    // Wall from (0,0) to (100,0), thickness 10, half=5
    // dir=(1,0), normal=(0,1)
    // Polygon order: [p1_n, p2_n, p2_a, p1_a]
    const walls: Wall[] = [{ id: 'h', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], pt(0, 5))).toBe(true);    // p1 normal-side
    expect(near(pts[1], pt(100, 5))).toBe(true);  // p2 normal-side
    expect(near(pts[2], pt(100, -5))).toBe(true); // p2 anti-normal
    expect(near(pts[3], pt(0, -5))).toBe(true);   // p1 anti-normal
  });

  it('single vertical wall — flat caps', () => {
    // Wall from (0,0) to (0,100), thickness 10
    // dir=(0,1), normal=(-1,0)
    const walls: Wall[] = [{ id: 'v', p1: pt(0,0), p2: pt(0,100), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5, 0))).toBe(true);
    expect(near(pts[1], pt(-5, 100))).toBe(true);
    expect(near(pts[2], pt(5, 100))).toBe(true);
    expect(near(pts[3], pt(5, 0))).toBe(true);
  });

  it('two walls at 90° — miter at shared corner', () => {
    // W1 right: (0,0)→(100,0), W2 down: (100,0)→(100,100), both thickness=10
    // At shared corner (100,0):
    //   W1: awayW=(-1,0), awayN=(0,1), normal=(0,1)
    //     bisector=(-1/√2,1/√2), cut=(-1/√2,-1/√2)
    //     denom=dot((0,1),(-1/√2,-1/√2))=-1/√2
    //     n-side:  t=5/(-1/√2)=-5√2 → (100,0)+(-5√2)(-1/√2,-1/√2)=(105,5)
    //     anti-n:  t=5√2 → (100,0)+(5√2)(-1/√2,-1/√2)=(95,-5)
    const w1: Wall = { id: 'w1', p1: pt(0,0), p2: pt(100,0), thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0), p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    // W1 p2 (miter): n-side and anti-n
    expect(near(p1.points[1], pt(105, 5))).toBe(true);
    expect(near(p1.points[2], pt(95, -5))).toBe(true);
    // W1 p1 (flat): unchanged
    expect(near(p1.points[0], pt(0, 5))).toBe(true);
    expect(near(p1.points[3], pt(0, -5))).toBe(true);
  });

  it('miter vertices tile without gaps (no seam at shared corner)', () => {
    const w1: Wall = { id: 'w1', p1: pt(0,0), p2: pt(100,0), thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0), p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;
    // W1 n-side at p2 == W2 anti-n at p1
    expect(near(p1.points[1], p2.points[3]!)).toBe(true);
    // W1 anti-n at p2 == W2 n-side at p1
    expect(near(p1.points[2], p2.points[0]!)).toBe(true);
  });

  it('diagonal wall (45°) — flat caps are perpendicular to wall', () => {
    // Wall from (0,0) to (100,100), thickness=10√2 ≈ 14.14
    // dir=(1/√2,1/√2), normal=(-1/√2,1/√2)
    // p1 n-side = (0,0)+half*normal = (0,0)+5√2*(-1/√2,1/√2) = (-5,5)
    // p1 anti-n = (0,0)-5√2*(-1/√2,1/√2) = (5,-5)
    const walls: Wall[] = [{ id: 'd', p1: pt(0,0), p2: pt(100,100), thickness: 10*Math.SQRT2 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5, 5))).toBe(true);
    expect(near(pts[3], pt(5, -5))).toBe(true);
  });
});
