// src/engine/geometry/wallGeometry.ts
import type { Wall } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points, clockwise: [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1] */
  points: Point[];
}

/** Euclidean distance. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Dot product. */
function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** Normalize; returns zero vector on degenerate input. */
function normalize(v: Point): Point {
  const l = Math.sqrt(v.x * v.x + v.y * v.y);
  return l < 1e-10 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

/** 90° counter-clockwise rotation. */
function perp(v: Point): Point {
  return { x: -v.y, y: v.x };
}

/** Endpoints within this world-unit distance are considered coincident. */
const ENDPOINT_TOL = 2;

/**
 * Compute a miter corner vertex.
 *
 * @param corner     - The shared endpoint (world coords)
 * @param awayW      - Unit vector from corner ALONG W toward W's other endpoint
 * @param wallNormal - W's left normal: { x: -dir.y, y: dir.x }, always based on p1→p2
 * @param awayN      - Unit vector from corner ALONG the neighbor toward its other endpoint
 * @param half       - W's half-thickness
 * @param side       - +1 = normal-side vertex, -1 = anti-normal-side vertex
 */
function miterCorner(
  corner: Point,
  awayW: Point,
  wallNormal: Point,
  awayN: Point,
  half: number,
  side: 1 | -1,
): Point {
  const bis = normalize({ x: awayW.x + awayN.x, y: awayW.y + awayN.y });
  // Degenerate: anti-parallel walls (U-turn) → flat cap
  if (bis.x === 0 && bis.y === 0) {
    return { x: corner.x + wallNormal.x * half * side, y: corner.y + wallNormal.y * half * side };
  }
  const cut = perp(bis);
  const denom = dot(wallNormal, cut);
  // Degenerate: near-parallel walls → flat cap
  if (Math.abs(denom) < 1e-6) {
    return { x: corner.x + wallNormal.x * half * side, y: corner.y + wallNormal.y * half * side };
  }
  const t = (half * side) / denom;
  return { x: corner.x + t * cut.x, y: corner.y + t * cut.y };
}

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
 * Return unit vector from corner ALONG neighbor toward its other endpoint.
 */
function awayFromCorner(neighbor: Wall, corner: Point): Point {
  const other = dist(neighbor.p1, corner) < ENDPOINT_TOL ? neighbor.p2 : neighbor.p1;
  return normalize({ x: other.x - corner.x, y: other.y - corner.y });
}

/**
 * Compute SVG polygon points for each wall, applying miter cuts at joined corners.
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

    // away-from-corner direction for W at each endpoint
    const awayP1 = dir;                                         // from p1 toward p2
    const awayP2: Point = { x: -dir.x, y: -dir.y };            // from p2 toward p1

    const nbP1 = findNeighbor(wall.id, wall.p1, walls);
    const nbP2 = findNeighbor(wall.id, wall.p2, walls);

    const p1_n: Point = nbP1
      ? miterCorner(wall.p1, awayP1, n, awayFromCorner(nbP1, wall.p1), half, +1)
      : { x: wall.p1.x + n.x * half, y: wall.p1.y + n.y * half };
    const p1_a: Point = nbP1
      ? miterCorner(wall.p1, awayP1, n, awayFromCorner(nbP1, wall.p1), half, -1)
      : { x: wall.p1.x - n.x * half, y: wall.p1.y - n.y * half };

    const p2_n: Point = nbP2
      ? miterCorner(wall.p2, awayP2, n, awayFromCorner(nbP2, wall.p2), half, +1)
      : { x: wall.p2.x + n.x * half, y: wall.p2.y + n.y * half };
    const p2_a: Point = nbP2
      ? miterCorner(wall.p2, awayP2, n, awayFromCorner(nbP2, wall.p2), half, -1)
      : { x: wall.p2.x - n.x * half, y: wall.p2.y - n.y * half };

    return {
      wallId: wall.id,
      points: [p1_n, p2_n, p2_a, p1_a],
    };
  });
}
