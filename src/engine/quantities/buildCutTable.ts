// src/engine/quantities/buildCutTable.ts
import type { Point } from '@/types/plan';
import type { Tile } from '@/types/tiling';
import { clipPolygon } from '@/engine/geometry/clipper';
import { getBoundingBox } from '@/engine/geometry/polygon';
import type { CutRecord } from './types';
import { ALL_FACTORY, computeCutFromBBox } from './cutFromBBox';
import { localFrameFromPoints } from './localFrame';

function ensureCCW(poly: Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i]!;
    const next = poly[(i + 1) % poly.length]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return area < 0 ? [...poly].reverse() : poly;
}

export function buildCutTable(
  tiles: Tile[],
  roomPolygons: Point[][],
  roomIds: string[],
): CutRecord[] {
  return tiles
    .filter((t) => t.type === 'CUT')
    .map((tile): CutRecord => {
      const { x, y, w, h } = tile.rect;

      // CHEVRON tiles carry their real parallelogram in tile.points. Build a
      // local affine frame (axes = the tile's own 2 edges, Wlen x Hlen) so
      // the cut/chute logic below operates on the tile's own rectangle
      // instead of its global (and angle-dependent) bounding box.
      const frame = tile.points ? localFrameFromPoints(tile.points) : null;
      const tilePoly: Point[] = tile.points ?? [
        { x,         y         },
        { x: x + w,  y         },
        { x: x + w,  y: y + h  },
        { x,         y: y + h  },
      ];
      const tileW = frame ? frame.Wlen : w;
      const tileH = frame ? frame.Hlen : h;

      // Clip against all room polygons, accumulate bounding box of result
      // (in the tile's local frame for CHEVRON, in plan coordinates otherwise)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const rawPoly of roomPolygons) {
        const clipped = clipPolygon(tilePoly, ensureCCW(rawPoly));
        for (const p of clipped) {
          const lp = frame ? frame.toLocal(p) : p;
          if (lp.x < minX) minX = lp.x;
          if (lp.y < minY) minY = lp.y;
          if (lp.x > maxX) maxX = lp.x;
          if (lp.y > maxY) maxY = lp.y;
        }
      }

      if (minX === Infinity) {
        return {
          id: tile.id, roomId: roomIds[0] ?? '',
          tileW, tileH,
          usedW: tileW, usedH: tileH,
          pieceEdges: ALL_FACTORY,
          chuteW: 0, chuteH: 0, chuteEdges: ALL_FACTORY, chuteArea: 0,
          clipCx: x + w / 2, clipCy: y + h / 2,
          coveredById: null, reusedForId: null,
        };
      }

      const refX = frame ? 0 : x;
      const refY = frame ? 0 : y;
      const cut = computeCutFromBBox(tileW, tileH, { minX, minY, maxX, maxY }, refX, refY);

      const clipPoint = frame
        ? frame.toGlobal({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 })
        : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

      // Assign roomId by proximity (tile center <-> room polygon center)
      const center = frame
        ? frame.toGlobal({ x: tileW / 2, y: tileH / 2 })
        : { x: x + w / 2, y: y + h / 2 };
      let bestRoom = roomIds[0] ?? '';
      let bestDist = Infinity;
      for (let r = 0; r < roomPolygons.length; r++) {
        const pb = getBoundingBox(roomPolygons[r]!);
        const pcx = (pb.minX + pb.maxX) / 2, pcy = (pb.minY + pb.maxY) / 2;
        const d = (center.x - pcx) ** 2 + (center.y - pcy) ** 2;
        if (d < bestDist) { bestDist = d; bestRoom = roomIds[r] ?? ''; }
      }

      return {
        id: tile.id,
        roomId: bestRoom,
        tileW, tileH,
        usedW: cut.usedW, usedH: cut.usedH,
        pieceEdges: cut.pieceEdges,
        chuteW: cut.chuteW, chuteH: cut.chuteH,
        chuteEdges: cut.chuteEdges, chuteArea: cut.chuteArea,
        clipCx: clipPoint.x, clipCy: clipPoint.y,
        coveredById: null,
        reusedForId: null,
      };
    });
}
