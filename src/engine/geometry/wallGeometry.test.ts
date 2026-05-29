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
    // Wall (0,0)→(100,0), thickness=10, half=5, no neighbors
    // dir=(1,0), n=(0,1)
    // p1 flat: n-side=(0,5), anti-n=(0,-5)
    // p2 flat: n-side=(100,5), anti-n=(100,-5)
    const walls: Wall[] = [{ id: 'h', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], pt(0,   5))).toBe(true);
    expect(near(pts[1], pt(100, 5))).toBe(true);
    expect(near(pts[2], pt(100,-5))).toBe(true);
    expect(near(pts[3], pt(0,  -5))).toBe(true);
  });

  it('single vertical wall — flat caps', () => {
    // Wall (0,0)→(0,100), thickness=10, dir=(0,1), n=(-1,0), half=5
    const walls: Wall[] = [{ id: 'v', p1: pt(0,0), p2: pt(0,100), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5,  0))).toBe(true);
    expect(near(pts[1], pt(-5,100))).toBe(true);
    expect(near(pts[2], pt( 5,100))).toBe(true);
    expect(near(pts[3], pt( 5,  0))).toBe(true);
  });

  it('two walls at 90°, same thickness — interior bevel at 45°, exterior right angle', () => {
    // W1 (0,0)→(100,0) h=5, W2 (100,0)→(100,100) h=5
    // At corner (100,0):
    //   W1 interior at p2: (100, 5) — stays at corner, no extension
    //   W1 exterior at p2: (105,-5) — extends by W2.half=5
    //   W2 interior at p1: (95,  0) — stays at corner, no extension
    //   W2 exterior at p1: (105,-5) — extends by W1.half=5, same point!
    //   Bevel: (100,5)→(95,0) : Δ=(-5,-5) → 45°
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;

    // W1 at p2
    expect(near(p1.points[1], pt(100,  5))).toBe(true);  // interior (n-side)
    expect(near(p1.points[2], pt(105, -5))).toBe(true);  // exterior (anti-n)

    // W2 at p1
    expect(near(p2.points[0], pt(95,   0))).toBe(true);  // interior (n-side)
    expect(near(p2.points[3], pt(105, -5))).toBe(true);  // exterior (anti-n)

    // W1 p1 (no neighbor): flat cap
    expect(near(p1.points[0], pt(0,  5))).toBe(true);
    expect(near(p1.points[3], pt(0, -5))).toBe(true);
  });

  it('exterior corners are identical — perfect right angle join', () => {
    // Both walls' anti-normal vertices at the join must coincide.
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;
    // W1 anti-n at p2 == W2 anti-n at p1 → exterior right-angle corner
    expect(near(p1.points[2], p2.points[3]!)).toBe(true);
  });

  it('different thicknesses — bevel angle = arctan(T1/T2)', () => {
    // W1 thickness=10 (h1=5), W2 thickness=20 (h2=10)
    // At corner (100,0):
    //   W1 interior at p2: (100, 5)   [n=(0,1), no ext]
    //   W1 exterior at p2: (110,-5)   [extends by h2=10 rightward, anti-n]
    //   W2 interior at p1: (90,  0)   [n=(-1,0), no ext → x=100-10=90]
    //   W2 exterior at p1: (110,-5)   [extends by h1=5 upward, anti-n → x=100+10=110, y=0-5=-5]
    //   Bevel (100,5)→(90,0): Δ=(-10,-5) → arctan(5/10)≈26.6° ≠ 45°
    const w1: Wall = { id: 'w1', p1: pt(0,0),   p2: pt(100,0),   thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0),  p2: pt(100,100), thickness: 20 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;

    expect(near(p1.points[1], pt(100,  5))).toBe(true);  // W1 interior at p2
    expect(near(p1.points[2], pt(110, -5))).toBe(true);  // W1 exterior at p2
    expect(near(p2.points[0], pt(90,   0))).toBe(true);  // W2 interior at p1
    expect(near(p2.points[3], pt(110, -5))).toBe(true);  // W2 exterior at p1 = same!

    // Bevel angle ≈ 26.6°, not 45°
    const dx = p2.points[0]!.x - p1.points[1]!.x;
    const dy = p2.points[0]!.y - p1.points[1]!.y;
    const angleDeg = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
    expect(angleDeg).toBeCloseTo(26.57, 1);
  });

  it('diagonal wall (45°) — flat caps perpendicular to wall', () => {
    // Wall (0,0)→(100,100), thickness=10√2, dir=(1/√2,1/√2), n=(-1/√2,1/√2), half=5√2
    // p1 n-side: (0+(-5),0+5)=(-5,5), p1 anti-n: (5,-5)
    const walls: Wall[] = [{ id: 'd', p1: pt(0,0), p2: pt(100,100), thickness: 10*Math.SQRT2 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5, 5))).toBe(true);
    expect(near(pts[3], pt( 5,-5))).toBe(true);
  });
});
