// src/engine/geometry/wallGeometry.ts
import type { Wall } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points: [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1] */
  points: Point[];
}

/** Euclidean distance. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Endpoints within this world-unit distance are considered coincident. */
const ENDPOINT_TOL = 2;

/**
 * Return the first wall (other than wallId) that has an endpoint within ENDPOINT_TOL of pt.
 */
function findNeighbor(wallId: string, pt: Point, walls: Wall[]): Wall | null {
  for (const w of walls) {
    if (w.id === wallId) continue;
    if (dist(w.p1, pt) < ENDPOINT_TOL || dist(w.p2, pt) < ENDPOINT_TOL) return w;
  }
  return null;
}

/**
 * Compute SVG polygon points for each wall using the extend+bevel algorithm.
 *
 * At each joined corner:
 *   - Exterior vertex (anti-normal side): extends past the corner by the neighbor's half-thickness.
 *     Both walls share the same exterior corner point → perfect right-angle exterior corner.
 *   - Interior vertex (normal side): stays at the wall's endpoint (no extension).
 *     The gap between W and N's interior vertices is the visible bevel.
 *     Its angle = arctan(W.half / N.half), so it reflects the actual wall proportions.
 *
 * For walls of equal thickness at 90°, the bevel is at 45°.
 * For walls of different thicknesses, the angle changes proportionally.
 *
 * Each wall becomes a 4-point polygon [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1].
 * Zero-length walls return an empty points array.
 */
export function computeCornerGeometry(walls: Wall[]): WallPolygon[] {
  return walls.map((wall) => {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return { wallId: wall.id, points: [] };

    const dir: Point = { x: dx / len, y: dy / len };
    const n: Point = { x: -dir.y, y: dir.x };  // left normal, fixed p1→p2 orientation
    const half = wall.thickness / 2;

    const nbP1 = findNeighbor(wall.id, wall.p1, walls);
    const nbP2 = findNeighbor(wall.id, wall.p2, walls);

    // Direction continuing PAST each endpoint (used only for exterior vertex extension)
    const pastP1: Point = { x: -dir.x, y: -dir.y };  // backward past p1
    const pastP2: Point = dir;                         // forward past p2

    // ── p1 corner ──────────────────────────────────────────────────────────

    let p1_n: Point, p1_a: Point;
    if (nbP1) {
      const halfN = nbP1.thickness / 2;
      p1_n = { x: wall.p1.x + n.x * half,                           y: wall.p1.y + n.y * half };
      p1_a = { x: wall.p1.x + pastP1.x * halfN - n.x * half,        y: wall.p1.y + pastP1.y * halfN - n.y * half };
    } else {
      p1_n = { x: wall.p1.x + n.x * half, y: wall.p1.y + n.y * half };
      p1_a = { x: wall.p1.x - n.x * half, y: wall.p1.y - n.y * half };
    }

    // ── p2 corner ──────────────────────────────────────────────────────────

    let p2_n: Point, p2_a: Point;
    if (nbP2) {
      const halfN = nbP2.thickness / 2;
      p2_n = { x: wall.p2.x + n.x * half,                           y: wall.p2.y + n.y * half };
      p2_a = { x: wall.p2.x + pastP2.x * halfN - n.x * half,        y: wall.p2.y + pastP2.y * halfN - n.y * half };
    } else {
      p2_n = { x: wall.p2.x + n.x * half, y: wall.p2.y + n.y * half };
      p2_a = { x: wall.p2.x - n.x * half, y: wall.p2.y - n.y * half };
    }

    return {
      wallId: wall.id,
      points: [p1_n, p2_n, p2_a, p1_a],
    };
  });
}
