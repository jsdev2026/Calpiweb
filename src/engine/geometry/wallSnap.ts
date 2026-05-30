// src/engine/geometry/wallSnap.ts
import type { Wall, WallNode, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function projectOntoSegment(cursor: Point, p1: Point, p2: Point) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return null;
  const t = ((cursor.x - p1.x) * dx + (cursor.y - p1.y) * dy) / lenSq;
  return { t, projected: { x: p1.x + t * dx, y: p1.y + t * dy } };
}

/**
 * Find the best snap target for `cursor` among `walls` and `nodes`.
 *
 * Priority:
 *  1. Endpoint snap — cursor within endpointRadiusPx of a node used by any wall
 *  2. Face snap — cursor projected onto wall centerline within segment bounds
 *  3. H/V snap — cursor within hvSnapPx on the H or V axis of any node
 *  4. null
 */
export function snapToWalls(
  cursor: Point,
  walls: Wall[],
  nodes: WallNode[],
  scale: number,
  endpointRadiusPx: number,
  faceRadiusPx: number,
  hvSnapPx: number,
): SnapResult | null {
  const epR  = endpointRadiusPx / scale;
  const faR  = faceRadiusPx / scale;
  const hvR  = hvSnapPx / scale;

  // Collect node IDs actually used by walls
  const usedNodeIds = new Set(walls.flatMap((w) => [w.node1Id, w.node2Id]));
  const activeNodes = nodes.filter((n) => usedNodeIds.has(n.id));

  // 1. Endpoint snap
  let bestEpDist = epR;
  let bestEp: SnapResult | null = null;
  for (const n of activeNodes) {
    const d = dist(cursor, { x: n.x, y: n.y });
    if (d < bestEpDist) {
      bestEpDist = d;
      bestEp = { point: { x: n.x, y: n.y }, type: 'endpoint', nodeId: n.id };
    }
  }
  if (bestEp) return bestEp;

  // 2. Face snap
  let bestFaDist = faR;
  let bestFa: SnapResult | null = null;
  for (const wall of walls) {
    const p1n = nodes.find((n) => n.id === wall.node1Id);
    const p2n = nodes.find((n) => n.id === wall.node2Id);
    if (!p1n || !p2n) continue;
    const p1: Point = { x: p1n.x, y: p1n.y };
    const p2: Point = { x: p2n.x, y: p2n.y };
    const proj = projectOntoSegment(cursor, p1, p2);
    if (!proj || proj.t < 0 || proj.t > 1) continue;
    const d = dist(cursor, proj.projected);
    if (d < bestFaDist) {
      bestFaDist = d;
      bestFa = { point: proj.projected, type: 'face', wallId: wall.id };
    }
  }
  if (bestFa) return bestFa;

  // 3. H/V snap — check alignment with any active node
  let bestHvDist = hvR;
  let bestHv: SnapResult | null = null;
  for (const n of activeNodes) {
    const dy = Math.abs(cursor.y - n.y);
    if (dy < bestHvDist) {
      bestHvDist = dy;
      bestHv = { point: { x: cursor.x, y: n.y }, type: 'hv', axis: 'h' };
    }
    const dx = Math.abs(cursor.x - n.x);
    if (dx < bestHvDist) {
      bestHvDist = dx;
      bestHv = { point: { x: n.x, y: cursor.y }, type: 'hv', axis: 'v' };
    }
  }
  if (bestHv) return bestHv;

  return null;
}
