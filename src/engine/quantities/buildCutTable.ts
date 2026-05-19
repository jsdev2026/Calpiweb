// src/engine/quantities/buildCutTable.ts
import type { Point } from '@/types/plan';
import type { Tile } from '@/types/tiling';
import { clipPolygon } from '@/engine/geometry/clipper';
import { getBoundingBox } from '@/engine/geometry/polygon';
import type { CutRecord, PieceEdges } from './types';
import { MIN_CHUTE_MM, CUT_TOLERANCE_MM } from './constants';

const ALL_FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};

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

      // Use actual polygon for chevron, bounding-box corners otherwise
      const tilePoly: Point[] = tile.points ?? [
        { x,         y         },
        { x: x + w,  y         },
        { x: x + w,  y: y + h  },
        { x,         y: y + h  },
      ];

      // Clip against all room polygons, accumulate bounding box of result
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const rawPoly of roomPolygons) {
        const clipped = clipPolygon(tilePoly, ensureCCW(rawPoly));
        for (const p of clipped) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
      }

      if (minX === Infinity) {
        return {
          id: tile.id, roomId: roomIds[0] ?? '',
          tileW: w, tileH: h,
          usedW: w, usedH: h,
          pieceEdges: ALL_FACTORY,
          chuteW: 0, chuteH: 0, chuteEdges: ALL_FACTORY, chuteArea: 0,
          clipCx: x + w / 2, clipCy: y + h / 2,
          coveredById: null, reusedForId: null,
        };
      }

      const usedW = Math.max(1, Math.round(Math.min(w, maxX - minX)));
      const usedH = Math.max(1, Math.round(Math.min(h, maxY - minY)));
      const clipCx = (minX + maxX) / 2;
      const clipCy = (minY + maxY) / 2;

      const isCutLeft   = minX > x + CUT_TOLERANCE_MM;
      const isCutRight  = maxX < x + w - CUT_TOLERANCE_MM;
      const isCutTop    = minY > y + CUT_TOLERANCE_MM;
      const isCutBottom = maxY < y + h - CUT_TOLERANCE_MM;

      const pieceEdges: PieceEdges = {
        left:   isCutLeft   ? 'cut' : 'factory',
        right:  isCutRight  ? 'cut' : 'factory',
        top:    isCutTop    ? 'cut' : 'factory',
        bottom: isCutBottom ? 'cut' : 'factory',
      };

      const isCutH = isCutLeft || isCutRight;
      const isCutV = isCutTop  || isCutBottom;
      const hTrim = isCutLeft ? (minX - x) : isCutRight ? (x + w - maxX) : 0;
      const vTrim = isCutTop  ? (minY - y) : isCutBottom ? (y + h - maxY) : 0;

      let chuteW = 0, chuteH = 0;
      let chuteEdges: PieceEdges = ALL_FACTORY;

      if (isCutH && isCutV) {
        // Corner cut: choose the larger strip
        if (hTrim * h >= w * vTrim) {
          chuteW = hTrim; chuteH = h;
          chuteEdges = isCutLeft
            ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
            : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
        } else {
          chuteW = w; chuteH = vTrim;
          chuteEdges = isCutTop
            ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
            : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
        }
      } else if (isCutH) {
        chuteW = hTrim; chuteH = h;
        chuteEdges = isCutLeft
          ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
          : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
      } else if (isCutV) {
        chuteW = w; chuteH = vTrim;
        chuteEdges = isCutTop
          ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
          : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
      }

      // Both dims must be >= MIN_CHUTE_MM for any cut type (spec requirement)
      const viable = chuteW >= MIN_CHUTE_MM && chuteH >= MIN_CHUTE_MM;

      // Assign roomId by proximity (tile center ↔ room polygon center)
      const cx2 = x + w / 2, cy2 = y + h / 2;
      let bestRoom = roomIds[0] ?? '';
      let bestDist = Infinity;
      for (let r = 0; r < roomPolygons.length; r++) {
        const pb = getBoundingBox(roomPolygons[r]!);
        const pcx = (pb.minX + pb.maxX) / 2, pcy = (pb.minY + pb.maxY) / 2;
        const d = (cx2 - pcx) ** 2 + (cy2 - pcy) ** 2;
        if (d < bestDist) { bestDist = d; bestRoom = roomIds[r] ?? ''; }
      }

      return {
        id: tile.id,
        roomId: bestRoom,
        tileW: w, tileH: h,
        usedW, usedH,
        pieceEdges,
        chuteW:     viable ? chuteW : 0,
        chuteH:     viable ? chuteH : 0,
        chuteEdges: viable ? chuteEdges : ALL_FACTORY,
        chuteArea:  viable ? chuteW * chuteH : 0,
        clipCx, clipCy,
        coveredById: null,
        reusedForId: null,
      };
    });
}
