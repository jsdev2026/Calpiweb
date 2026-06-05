// src/engine/geometry/wallGeometry.ts
import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points: [+n-node1, +n-node2, -n-node2, -n-node1] */
  points: Point[];
}

export interface JointLine {
  p1: Point;
  p2: Point;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function nodePos(id: string, nodes: WallNode[]): Point {
  const n = nodes.find((n) => n.id === id);
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

function wallDir(wall: Wall, nodes: WallNode[]): Point {
  const p1 = nodePos(wall.node1Id, nodes);
  const p2 = nodePos(wall.node2Id, nodes);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

function findNeighborsByNode(wallId: string, nodeId: string, walls: Wall[]): Wall[] {
  return walls.filter(
    (w) => w.id !== wallId && (w.node1Id === nodeId || w.node2Id === nodeId),
  );
}

/**
 * Compute t such that:
 *   vertex_interior = P + nA*hA + t*dA
 *   vertex_exterior = P - nA*hA - t*dA
 * Returns null if walls are nearly parallel.
 */
function jointParam(
  nA: Point, hA: number, dA: Point,
  nB: Point, hB: number, dB: Point,
): number | null {
  const denom = cross(dA, dB);
  if (Math.abs(denom) < 1e-6) return null;
  const diff: Point = { x: nB.x * hB - nA.x * hA, y: nB.y * hB - nA.y * hA };
  return cross(diff, dB) / denom;
}

/**
 * Compute SVG polygon points for each wall.
 * Each wall is a rectangle extended at connected endpoints using line-line intersection.
 * Zero-length walls return empty points.
 */
export function computeCornerGeometry(walls: Wall[], nodes: WallNode[]): WallPolygon[] {
  return walls.map((wall) => {
    const p1 = nodePos(wall.node1Id, nodes);
    const p2 = nodePos(wall.node2Id, nodes);
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return { wallId: wall.id, points: [] };

    const dir: Point = { x: dx / len, y: dy / len };
    const n: Point = { x: -dir.y, y: dir.x };
    const h = wall.thickness / 2;

    const nbsN1 = findNeighborsByNode(wall.id, wall.node1Id, walls);
    let extN1 = 0;
    if (nbsN1.length > 0) {
      const nb = nbsN1[0]!;
      const nbDir = wallDir(nb, nodes);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };
      const t = jointParam(n, h, dir, nbN, nb.thickness / 2, nbDir);
      if (t !== null) extN1 = t;
    }

    const nbsN2 = findNeighborsByNode(wall.id, wall.node2Id, walls);
    let extN2 = 0;
    if (nbsN2.length > 0) {
      const nb = nbsN2[0]!;
      const nbDir = wallDir(nb, nodes);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };
      const t = jointParam(n, h, dir, nbN, nb.thickness / 2, nbDir);
      if (t !== null) extN2 = -t;
    }

    return {
      wallId: wall.id,
      points: [
        { x: p1.x + dir.x * extN1 + n.x * h, y: p1.y + dir.y * extN1 + n.y * h },
        { x: p2.x - dir.x * extN2 + n.x * h, y: p2.y - dir.y * extN2 + n.y * h },
        { x: p2.x + dir.x * extN2 - n.x * h, y: p2.y + dir.y * extN2 - n.y * h },
        { x: p1.x - dir.x * extN1 - n.x * h, y: p1.y - dir.y * extN1 - n.y * h },
      ],
    };
  });
}

/**
 * Compute joint lines at each shared node between connected walls.
 * Joint endpoints computed by line-line intersection. Deduplication: one line per shared node.
 */
export function computeJointLines(walls: Wall[], nodes: WallNode[]): JointLine[] {
  const lines: JointLine[] = [];
  const seen = new Set<string>();

  for (const wall of walls) {
    const dir = wallDir(wall, nodes);
    const n: Point = { x: -dir.y, y: dir.x };
    const h = wall.thickness / 2;

    for (const nodeId of [wall.node1Id, wall.node2Id]) {
      const nbs = findNeighborsByNode(wall.id, nodeId, walls);
      if (nbs.length === 0) continue;

      const nb = nbs[0]!;
      const key = [wall.id, nb.id].sort().join('~') + '~' + nodeId;
      if (seen.has(key)) continue;
      seen.add(key);

      const nbDir = wallDir(nb, nodes);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };

      const t = jointParam(n, h, dir, nbN, nb.thickness / 2, nbDir);
      if (t === null) continue;

      const P = nodePos(nodeId, nodes);
      lines.push({
        p1: { x: P.x + n.x * h + t * dir.x, y: P.y + n.y * h + t * dir.y },
        p2: { x: P.x - n.x * h - t * dir.x, y: P.y - n.y * h - t * dir.y },
      });
    }
  }

  return lines;
}
