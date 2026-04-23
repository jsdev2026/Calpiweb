import type { Point } from '@/types/plan';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const distance = (p1: Point, p2: Point): number => Math.hypot(p2.x - p1.x, p2.y - p1.y);

export const angle = (p1: Point, p2: Point): number => Math.atan2(p2.y - p1.y, p2.x - p1.x);

export const getPolygonArea = (pts: Point[]): number => {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]!;
    const pj = pts[j]!;
    area += (pj.x + pi.x) * (pj.y - pi.y);
  }
  return Math.abs(area / 2);
};

export const pointInPolygon = (point: Point, vs: Point[]): boolean => {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const vi = vs[i]!;
    const vj = vs[j]!;
    const intersect = vi.y > y !== vj.y > y && x < ((vj.x - vi.x) * (y - vi.y)) / (vj.y - vi.y) + vi.x;
    if (intersect) inside = !inside;
  }
  return inside;
};

export const getIntersection = (A: Point, B: Point, C: Point, D: Point): Point | null => {
  const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
  if (bottom === 0) return null;
  const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
  const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
  const t = tTop / bottom;
  const u = uTop / bottom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
  }
  return null;
};

export const rotatePoint = (x: number, y: number, angleDeg: number, cx = 0, cy = 0): Point => {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cos * (x - cx) - sin * (y - cy) + cx,
    y: sin * (x - cx) + cos * (y - cy) + cy,
  };
};

export const getPointOnSegment = (p: Point, a: Point, b: Point): Point & { t: number } => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...a, t: 0 };
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return { x: a.x + dx * t, y: a.y + dy * t, t };
};

export const getBoundingBox = (pts: Point[]): BoundingBox => {
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};
