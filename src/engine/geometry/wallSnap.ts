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

  // 3. H/V snap — collect H and V candidates independently, then return intersection if both active
  let bestH: { y: number; dist: number } | null = null;
  let bestV: { x: number; dist: number } | null = null;
  for (const n of nodes) {
    const dy = Math.abs(cursor.y - n.y);
    if (dy < hvR && (!bestH || dy < bestH.dist)) bestH = { y: n.y, dist: dy };
    const dx = Math.abs(cursor.x - n.x);
    if (dx < hvR && (!bestV || dx < bestV.dist)) bestV = { x: n.x, dist: dx };
  }
  // Intersection: both H and V active simultaneously → snap to crossing point
  if (bestH && bestV) return { point: { x: bestV.x, y: bestH.y }, type: 'hv' };
  if (bestH) return { point: { x: cursor.x, y: bestH.y }, type: 'hv', axis: 'h' };
  if (bestV) return { point: { x: bestV.x, y: cursor.y }, type: 'hv', axis: 'v' };

  return null;
}

/**
 * Adjacent axis snap for a node being dragged.
 *
 * Specifically checks alignment with the OTHER ends of the walls connected to
 * the dragged node (adjacentNodes = [A, B, …]). When the cursor is simultaneously
 * within hvSnapPx of both y=A.y (horizontal) and x=B.x (vertical), returns the
 * intersection point (B.x, A.y) — the position that makes both walls axis-aligned.
 *
 * This is higher priority than the general H/V snap because it is specific to
 * the walls being reshaped by the drag.
 */
export function adjacentAxisSnapForNode(
  cursor: Point,
  adjacentNodes: WallNode[],
  scale: number,
  hvSnapPx: number,
): SnapResult | null {
  const hvR = hvSnapPx / scale;

  let bestH: { y: number; dist: number } | null = null;
  let bestV: { x: number; dist: number } | null = null;

  for (const n of adjacentNodes) {
    const dy = Math.abs(cursor.y - n.y);
    if (dy < hvR && (!bestH || dy < bestH.dist)) bestH = { y: n.y, dist: dy };
    const dx = Math.abs(cursor.x - n.x);
    if (dx < hvR && (!bestV || dx < bestV.dist)) bestV = { x: n.x, dist: dx };
  }

  if (bestH && bestV) return { point: { x: bestV.x, y: bestH.y }, type: 'hv' }; // intersection
  if (bestH) return { point: { x: cursor.x, y: bestH.y }, type: 'hv', axis: 'h' };
  if (bestV) return { point: { x: bestV.x, y: cursor.y }, type: 'hv', axis: 'v' };
  return null;
}

/**
 * Perpendicular snap for a node being dragged.
 *
 * For each pair of adjacent nodes A and B (the other ends of walls connected to
 * the dragged node), the dragged node forms a 90° angle if and only if it lies
 * on the Thales circle (diameter = AB, center = midpoint(A,B), radius = |AB|/2).
 *
 * Returns the projection of `cursor` onto the closest Thales circle when the
 * cursor is within `perpRadiusPx` pixels of that circle.
 *
 * Priority: lower than endpoint snap, but higher than H/V snap.
 */
export function perpendicularSnapForNode(
  cursor: Point,
  adjacentNodes: WallNode[],
  scale: number,
  perpRadiusPx: number,
): SnapResult | null {
  const perpR = perpRadiusPx / scale;

  let best: { distToCircle: number; point: Point } | null = null;

  for (let i = 0; i < adjacentNodes.length; i++) {
    for (let j = i + 1; j < adjacentNodes.length; j++) {
      const A = adjacentNodes[i]!;
      const B = adjacentNodes[j]!;

      // Thales circle: center = midpoint(A,B), radius = |AB|/2
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      const radius = Math.hypot(B.x - A.x, B.y - A.y) / 2;

      if (radius < 1) continue; // A and B are coincident

      const distToCenter = Math.hypot(cursor.x - mx, cursor.y - my);
      if (distToCenter < 1) continue; // cursor at center — undefined projection

      const distToCircle = Math.abs(distToCenter - radius);
      if (distToCircle >= perpR) continue;

      // Project cursor onto the Thales circle
      const dx = (cursor.x - mx) / distToCenter;
      const dy = (cursor.y - my) / distToCenter;
      const snapPt: Point = { x: mx + dx * radius, y: my + dy * radius };

      // Exclude degenerate snap near A or B (angle would be 0° or 180°, not 90°)
      const nearA = Math.hypot(snapPt.x - A.x, snapPt.y - A.y) < radius * 0.15;
      const nearB = Math.hypot(snapPt.x - B.x, snapPt.y - B.y) < radius * 0.15;
      if (nearA || nearB) continue;

      if (!best || distToCircle < best.distToCircle) {
        best = { distToCircle, point: snapPt };
      }
    }
  }

  if (!best) return null;
  return { point: best.point, type: 'perpendicular' };
}

/**
 * Snap colinéaire pour le DESSIN : projette le curseur sur la droite
 * INFINIE de chaque mur existant. Permet de prolonger un mur en ligne droite.
 */
export function collinearSnap(
  cursor: Point,
  walls: Wall[],
  nodes: WallNode[],
  scale: number,
  snapPx: number,
): SnapResult | null {
  const r = snapPx / scale;
  let best: { point: Point; dist: number; dir: Point } | null = null;

  for (const wall of walls) {
    const n1 = nodes.find(n => n.id === wall.node1Id);
    const n2 = nodes.find(n => n.id === wall.node2Id);
    if (!n1 || !n2) continue;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    const dir: Point = { x: dx / len, y: dy / len };
    const t = ((cursor.x - n1.x) * dx + (cursor.y - n1.y) * dy) / lenSq;
    const proj: Point = { x: n1.x + t * dx, y: n1.y + t * dy };
    const d = Math.hypot(cursor.x - proj.x, cursor.y - proj.y);
    if (d < r && (!best || d < best.dist)) best = { point: proj, dist: d, dir };
  }

  return best ? { point: best.point, type: 'collinear', dir: best.dir } : null;
}

/**
 * Snap colinéaire pour le DRAG de nœud : projette le curseur sur la droite
 * définie par chaque paire de nœuds adjacents du nœud déplacé.
 */
export function collinearSnapForNode(
  cursor: Point,
  adjacentNodes: WallNode[],
  scale: number,
  snapPx: number,
): SnapResult | null {
  const r = snapPx / scale;
  let best: { point: Point; dist: number; dir: Point } | null = null;

  for (let i = 0; i < adjacentNodes.length; i++) {
    for (let j = i + 1; j < adjacentNodes.length; j++) {
      const A = adjacentNodes[i]!, B = adjacentNodes[j]!;
      const dx = B.x - A.x, dy = B.y - A.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1) continue;
      const len = Math.sqrt(lenSq);
      const dir: Point = { x: dx / len, y: dy / len };
      const t = ((cursor.x - A.x) * dx + (cursor.y - A.y) * dy) / lenSq;
      const proj: Point = { x: A.x + t * dx, y: A.y + t * dy };
      const d = Math.hypot(cursor.x - proj.x, cursor.y - proj.y);
      if (d < r && (!best || d < best.dist)) best = { point: proj, dist: d, dir };
    }
  }

  return best ? { point: best.point, type: 'collinear', dir: best.dir } : null;
}
