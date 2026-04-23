import type { Point } from '@/types/plan';

// Sutherland-Hodgman polygon clipping.
// Exact for convex clip polygons; conservative approximation for non-convex rooms.
export function clipPolygon(subject: Point[], clip: Point[]): Point[] {
  if (subject.length === 0 || clip.length === 0) return [];

  let output = [...subject];

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const input = [...output];
    output = [];

    for (let j = 0; j < input.length; j++) {
      const curr = input[j]!;
      const prev = input[(j - 1 + input.length) % input.length]!;
      const currIn = sideOf(a, b, curr) >= 0;
      const prevIn = sideOf(a, b, prev) >= 0;

      if (currIn) {
        if (!prevIn) {
          const inter = segIntersect(prev, curr, a, b);
          if (inter) output.push(inter);
        }
        output.push(curr);
      } else if (prevIn) {
        const inter = segIntersect(prev, curr, a, b);
        if (inter) output.push(inter);
      }
    }
  }

  return output;
}

function sideOf(a: Point, b: Point, p: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function segIntersect(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}
