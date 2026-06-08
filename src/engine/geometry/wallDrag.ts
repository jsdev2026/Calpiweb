import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function computeWallNormal(wall: Wall, nodes: WallNode[]): Point | null {
  const n1 = nodes.find((n) => n.id === wall.node1Id);
  const n2 = nodes.find((n) => n.id === wall.node2Id);
  if (!n1 || !n2) return null;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return null;
  return { x: -dy / len, y: dx / len };
}

export function computeWallPerpMove(
  n1Start: Point,
  n2Start: Point,
  pointerStart: Point,
  cursor: Point,
  normal: Point,
  otherNodes: WallNode[],
  scale: number,
  snapPx: number,
): { node1Target: Point; node2Target: Point } {
  const delta = { x: cursor.x - pointerStart.x, y: cursor.y - pointerStart.y };
  let t = dot(delta, normal);

  const snapRadius = snapPx / scale;
  let best: { val: number; dist: number } | null = null;
  for (const on of otherNodes) {
    const tOn = dot({ x: on.x - n1Start.x, y: on.y - n1Start.y }, normal);
    const d = Math.abs(t - tOn);
    if (d < snapRadius && (!best || d < best.dist)) {
      best = { val: tOn, dist: d };
    }
  }
  if (best) t = best.val;

  return {
    node1Target: { x: n1Start.x + t * normal.x, y: n1Start.y + t * normal.y },
    node2Target: { x: n2Start.x + t * normal.x, y: n2Start.y + t * normal.y },
  };
}
