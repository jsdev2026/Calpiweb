import type { Point } from '@/types/plan';
import type { TileRect, TileType } from '@/types/tiling';
import { getIntersection, pointInPolygon } from './polygon';

export const classifyTile = (tileRect: TileRect, roomPoly: Point[]): TileType => {
  const corners: Point[] = [
    { x: tileRect.x, y: tileRect.y },
    { x: tileRect.x + tileRect.w, y: tileRect.y },
    { x: tileRect.x + tileRect.w, y: tileRect.y + tileRect.h },
    { x: tileRect.x, y: tileRect.y + tileRect.h },
  ];

  const edges: Array<[Point, Point]> = [
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
    let roomVertexInside = false;
    for (const rv of roomPoly) {
      if (
        rv.x > tileRect.x &&
        rv.x < tileRect.x + tileRect.w &&
        rv.y > tileRect.y &&
        rv.y < tileRect.y + tileRect.h
      ) {
        roomVertexInside = true;
        break;
      }
    }
    return roomVertexInside ? 'CUT' : 'WHOLE';
  }

  for (let i = 0; i < roomPoly.length; i++) {
    const p1 = roomPoly[i]!;
    const p2 = roomPoly[(i + 1) % roomPoly.length]!;
    for (const edge of edges) {
      if (getIntersection(edge[0], edge[1], p1, p2)) {
        return 'CUT';
      }
    }
  }

  if (cornersInside > 0) return 'CUT';
  if (roomPoly.length > 0 && pointInPolygon(roomPoly[0]!, corners)) return 'CUT';

  return 'OUTSIDE';
};
