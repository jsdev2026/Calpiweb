// src/engine/geometry/wallGeometry.ts
import type { Wall } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points: [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1] */
  points: Point[];
}

export interface JointLine {
  /** World-coord endpoints of the joint line (interior corner → exterior corner). */
  p1: Point;
  p2: Point;
}

/** Euclidean distance. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Endpoints within this world-unit distance are considered coincident. */
const ENDPOINT_TOL = 2;

/** Return the unit direction vector of a wall (p1→p2). */
function wallDir(wall: Wall): Point {
  const dx = wall.p2.x - wall.p1.x;
  const dy = wall.p2.y - wall.p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

/** Return the first wall (other than wallId) sharing an endpoint within ENDPOINT_TOL. */
function findNeighbor(wallId: string, pt: Point, walls: Wall[]): Wall | null {
  for (const w of walls) {
    if (w.id === wallId) continue;
    if (dist(w.p1, pt) < ENDPOINT_TOL || dist(w.p2, pt) < ENDPOINT_TOL) return w;
  }
  return null;
}

/**
 * Compute SVG polygon points for each wall.
 *
 * Each wall is rendered as a simple rectangle (no polygon cutting at corners).
 * At joined endpoints the rectangle is extended by the neighbor's half-thickness
 * so that adjacent walls overlap and fill the corner region completely.
 *
 * Polygon order: [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1].
 * Zero-length walls return an empty points array.
 */
export function computeCornerGeometry(walls: Wall[]): WallPolygon[] {
  return walls.map((wall) => {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return { wallId: wall.id, points: [] };

    const dir: Point = { x: dx / len, y: dy / len };
    const n: Point = { x: -dir.y, y: dir.x };
    const half = wall.thickness / 2;

    const nbP1 = findNeighbor(wall.id, wall.p1, walls);
    const nbP2 = findNeighbor(wall.id, wall.p2, walls);

    // How far to extend past each endpoint to fill the corner overlap region
    const extP1 = nbP1 ? nbP1.thickness / 2 : 0;
    const extP2 = nbP2 ? nbP2.thickness / 2 : 0;

    return {
      wallId: wall.id,
      points: [
        { x: wall.p1.x - dir.x * extP1 + n.x * half, y: wall.p1.y - dir.y * extP1 + n.y * half },
        { x: wall.p2.x + dir.x * extP2 + n.x * half, y: wall.p2.y + dir.y * extP2 + n.y * half },
        { x: wall.p2.x + dir.x * extP2 - n.x * half, y: wall.p2.y + dir.y * extP2 - n.y * half },
        { x: wall.p1.x - dir.x * extP1 - n.x * half, y: wall.p1.y - dir.y * extP1 - n.y * half },
      ],
    };
  });
}

/**
 * Compute the joint lines to draw on top of the wall rectangles at each corner.
 *
 * Each joint line runs from the interior corner (p + n1×h1 + n2×h2) to the
 * exterior corner (p − n1×h1 − n2×h2), crossing the full width of the overlap
 * region diagonally.
 *
 * For perpendicular walls of equal thickness: 45°.
 * For different thicknesses: arctan(h1/h2).
 */
export function computeJointLines(walls: Wall[]): JointLine[] {
  const lines: JointLine[] = [];
  const seen = new Set<string>();

  for (const wall of walls) {
    const dir = wallDir(wall);
    const n: Point = { x: -dir.y, y: dir.x };
    const h = wall.thickness / 2;

    for (const pt of [wall.p1, wall.p2]) {
      const nb = findNeighbor(wall.id, pt, walls);
      if (!nb) continue;

      // Deduplicate: each corner produces one line, not two
      const key = [wall.id, nb.id].sort().join('~') + `~${Math.round(pt.x)}~${Math.round(pt.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const nbDir = wallDir(nb);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };
      const nbH = nb.thickness / 2;

      lines.push({
        p1: { x: pt.x + n.x * h + nbN.x * nbH, y: pt.y + n.y * h + nbN.y * nbH },
        p2: { x: pt.x - n.x * h - nbN.x * nbH, y: pt.y - n.y * h - nbN.y * nbH },
      });
    }
  }

  return lines;
}
