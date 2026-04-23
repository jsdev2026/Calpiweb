import type { Point } from '@/types/plan';
import type { EdgeType } from '@/types/project';
import type { TileRect, TileType } from '@/types/tiling';
import { getIntersection, pointInPolygon } from './polygon';

export const classifyTile = (
  tileRect: TileRect,
  roomPoly: Point[],
  edges?: EdgeType[],
): TileType => {
  const corners: Point[] = [
    { x: tileRect.x, y: tileRect.y },
    { x: tileRect.x + tileRect.w, y: tileRect.y },
    { x: tileRect.x + tileRect.w, y: tileRect.y + tileRect.h },
    { x: tileRect.x, y: tileRect.y + tileRect.h },
  ];

  const tileEdges: Array<[Point, Point]> = [
    [corners[0]!, corners[1]!],
    [corners[1]!, corners[2]!],
    [corners[2]!, corners[3]!],
    [corners[3]!, corners[0]!],
  ];

  let cornersInside = 0;
  for (const c of corners) {
    if (pointInPolygon(c, roomPoly)) cornersInside += 1;
  }

  if (cornersInside === 4) {
    // Exclude both endpoints of every door edge (dA = start, dB = end)
    // so that tiles near door openings are not falsely classified as CUT.
    const doorPts = new Set<number>();
    if (edges) {
      for (let i = 0; i < edges.length; i++) {
        if (edges[i] === 'DOOR') {
          doorPts.add(i);
          doorPts.add((i + 1) % roomPoly.length);
        }
      }
    }
    for (let i = 0; i < roomPoly.length; i++) {
      if (doorPts.has(i)) continue;
      const rv = roomPoly[i]!;
      if (
        rv.x > tileRect.x &&
        rv.x < tileRect.x + tileRect.w &&
        rv.y > tileRect.y &&
        rv.y < tileRect.y + tileRect.h
      ) {
        return 'CUT';
      }
    }
    return 'WHOLE';
  }

  for (let i = 0; i < roomPoly.length; i++) {
    if (edges?.[i] === 'DOOR') continue;
    const p1 = roomPoly[i]!;
    const p2 = roomPoly[(i + 1) % roomPoly.length]!;
    for (const edge of tileEdges) {
      if (getIntersection(edge[0], edge[1], p1, p2)) {
        return 'CUT';
      }
    }
  }

  if (cornersInside > 0) return 'CUT';
  if (roomPoly.length > 0 && pointInPolygon(roomPoly[0]!, corners)) return 'CUT';

  return 'OUTSIDE';
};

export const classifyPolygonTile = (
  tilePoints: Point[],
  roomPoly: Point[],
): TileType => {
  let inside = 0;
  for (const p of tilePoints) {
    if (pointInPolygon(p, roomPoly)) inside++;
  }
  if (inside === 0) return 'OUTSIDE';
  if (inside === tilePoints.length) return 'WHOLE';
  return 'CUT';
};
