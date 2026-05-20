import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { Tile } from '@/types/tiling';
import { insetRoomPolygon } from '@/engine/geometry/polygon';

export interface SnapResult {
  point: Point;
  kind: 'wall-vertex' | 'wall-midpoint' | 'tile-corner' | 'tile-midpoint';
}

export function snapToTiling(
  worldPt: Point,
  rooms: Room[],
  tiles: Tile[],
  wallThickness: number,
  scale: number,
): SnapResult | null {
  const radius = 15 / scale;
  let best: { priority: number; dist: number; result: SnapResult } | null = null;

  const consider = (pt: Point, kind: SnapResult['kind'], priority: number) => {
    const dist = Math.hypot(pt.x - worldPt.x, pt.y - worldPt.y);
    if (dist > radius) return;
    if (
      !best ||
      priority < best.priority ||
      (priority === best.priority && dist < best.dist)
    ) {
      best = { priority, dist, result: { point: { x: pt.x, y: pt.y }, kind } };
    }
  };

  // Priority 1: wall-vertex (inset polygon vertices)
  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (const v of poly) {
      consider(v, 'wall-vertex', 1);
    }
  }

  // Priority 2: wall-midpoint (inset polygon edge midpoints)
  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      consider({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 'wall-midpoint', 2);
    }
  }

  // Priority 3: tile-corner (four corners of tile.rect)
  for (const tile of tiles) {
    const { x, y, w, h } = tile.rect;
    for (const pt of [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ]) {
      consider(pt, 'tile-corner', 3);
    }
  }

  // Priority 4: tile-midpoint (four edge midpoints of tile.rect)
  for (const tile of tiles) {
    const { x, y, w, h } = tile.rect;
    for (const pt of [
      { x: x + w / 2, y }, { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h }, { x, y: y + h / 2 },
    ]) {
      consider(pt, 'tile-midpoint', 4);
    }
  }

  return best?.result ?? null;
}

export function getParallelAngle(
  p1: Point,
  rooms: Room[],
  wallThickness: number,
): number | null {
  let bestDist = Infinity;
  let bestAngle: number | null = null;

  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(mid.x - p1.x, mid.y - p1.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestAngle = Math.atan2(b.y - a.y, b.x - a.x);
      }
    }
  }

  return bestAngle;
}
