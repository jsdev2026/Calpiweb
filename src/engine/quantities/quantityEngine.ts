import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';
import { getBoundingBox, rotatePoint } from '@/engine/geometry/polygon';
import { clipPolygon } from '@/engine/geometry/clipper';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';

export interface CutDetail {
  id: string;
  roomId: string;        // room where this cut sits (closest / most-inside)
  usedW: number;         // mm – dimension of the piece actually used
  usedH: number;
  chuteW: number;        // mm – largest rectangular chute available after cut (0 if none)
  chuteH: number;
  chuteArea: number;
  coveredById: string | null;   // this cut is fulfilled by another tile's chute
  reusedForId: string | null;   // this tile's chute is used to fulfil another cut
}

export interface CutGroup {
  usedW: number;
  usedH: number;
  chuteW: number;
  chuteH: number;
  totalCount: number;
  reuseCount: number; // cuts within this group covered by chutes
  netTiles: number;   // tiles to buy for this group
}

export interface QuantityResult {
  tileW: number;
  tileH: number;
  joint: number;
  wholeCount: number;
  cuts: CutDetail[];
  cutGroups: CutGroup[];
  totalReuseCount: number;
  tilesForCuts: number; // tiles bought for cuts (after reuse)
  totalTiles: number;   // whole + tilesForCuts
  toOrder: number;      // with margin
  roomArea: number;     // mm²
  tiles: Tile[];        // raw tile rects for plan view
}

// ─── helpers ────────────────────────────────────────────────────────────────

function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) =>
      angle !== 0
        ? r.points.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : r.points,
    );
}

function computeCutDimensions(
  tile: Tile,
  roomPolygons: Point[][],
  tileW: number,
  tileH: number,
): { usedW: number; usedH: number; chuteW: number; chuteH: number } {
  const corners: Point[] = [
    { x: tile.rect.x, y: tile.rect.y },
    { x: tile.rect.x + tileW, y: tile.rect.y },
    { x: tile.rect.x + tileW, y: tile.rect.y + tileH },
    { x: tile.rect.x, y: tile.rect.y + tileH },
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const poly of roomPolygons) {
    const clipped = clipPolygon(corners, poly);
    for (const p of clipped) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) {
    // Fallback: bounding box intersection
    minX = Math.max(tile.rect.x, Math.min(...roomPolygons.flatMap((p) => p.map((pt) => pt.x))));
    minY = Math.max(tile.rect.y, Math.min(...roomPolygons.flatMap((p) => p.map((pt) => pt.y))));
    maxX = Math.min(tile.rect.x + tileW, Math.max(...roomPolygons.flatMap((p) => p.map((pt) => pt.x))));
    maxY = Math.min(tile.rect.y + tileH, Math.max(...roomPolygons.flatMap((p) => p.map((pt) => pt.y))));
  }

  const usedW = Math.max(1, Math.round(Math.min(tileW, maxX - minX)));
  const usedH = Math.max(1, Math.round(Math.min(tileH, maxY - minY)));

  // Compute all potential chute strips and keep the largest
  const tx = tile.rect.x, ty = tile.rect.y;
  const rightW = Math.round(tx + tileW - maxX);
  const leftW = Math.round(minX - tx);
  const bottomH = Math.round(ty + tileH - maxY);
  const topH = Math.round(minY - ty);

  const strips = [
    { w: rightW, h: tileH },
    { w: leftW, h: tileH },
    { w: tileW, h: bottomH },
    { w: tileW, h: topH },
  ].filter((s) => s.w > 20 && s.h > 20);

  if (strips.length === 0) return { usedW, usedH, chuteW: 0, chuteH: 0 };

  const best = strips.reduce((a, b) => a.w * a.h >= b.w * b.h ? a : b);
  return { usedW, usedH, chuteW: best.w, chuteH: best.h };
}

// ─── reuse optimisation (greedy) ────────────────────────────────────────────

function optimizeReuse(cuts: CutDetail[]): void {
  // Sort: smallest used area first → their chutes are largest → available for larger cuts
  const sorted = [...cuts].sort((a, b) => a.usedW * a.usedH - b.usedW * b.usedH);
  const pool: { w: number; h: number; fromId: string; used: boolean }[] = [];

  for (const cut of sorted) {
    let found = false;
    for (const chute of pool) {
      if (chute.used) continue;
      const fitsNormal = chute.w >= cut.usedW && chute.h >= cut.usedH;
      const fitsRotated = chute.w >= cut.usedH && chute.h >= cut.usedW;
      if (fitsNormal || fitsRotated) {
        chute.used = true;
        cut.coveredById = chute.fromId;
        const src = cuts.find((c) => c.id === chute.fromId);
        if (src) src.reusedForId = cut.id;
        found = true;
        break;
      }
    }
    if (!found && cut.chuteW > 20 && cut.chuteH > 20) {
      pool.push({ w: cut.chuteW, h: cut.chuteH, fromId: cut.id, used: false });
    }
  }
}

// ─── grouping ────────────────────────────────────────────────────────────────

function groupCuts(cuts: CutDetail[]): CutGroup[] {
  const map = new Map<string, CutGroup>();

  for (const cut of cuts) {
    const key = `${cut.usedW}×${cut.usedH}`;
    if (!map.has(key)) {
      map.set(key, {
        usedW: cut.usedW,
        usedH: cut.usedH,
        chuteW: cut.chuteW,
        chuteH: cut.chuteH,
        totalCount: 0,
        reuseCount: 0,
        netTiles: 0,
      });
    }
    const g = map.get(key)!;
    g.totalCount += 1;
    if (cut.coveredById !== null) g.reuseCount += 1;
  }

  for (const g of map.values()) g.netTiles = g.totalCount - g.reuseCount;

  return [...map.values()].sort((a, b) => b.netTiles * b.usedW * b.usedH - a.netTiles * a.usedW * a.usedH);
}

// ─── main export ─────────────────────────────────────────────────────────────

export function analyzeQuantities(rooms: Room[], config: TilingConfig): QuantityResult {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config);

  if (validRooms.length === 0 || !stats) {
    return {
      tileW: config.width, tileH: config.height, joint: config.joint,
      wholeCount: 0, cuts: [], cutGroups: [],
      totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0, toOrder: 0, roomArea: 0,
      tiles: [],
    };
  }

  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const roomPolygons = tileSpaceRooms(validRooms, config.angle, cx, cy);

  // Assign each cut tile to the room it belongs to most
  const roomIds = validRooms.map((r) => r.id);

  const cuts: CutDetail[] = tiles
    .filter((t) => t.type === 'CUT')
    .map((tile) => {
      const { usedW, usedH, chuteW, chuteH } = computeCutDimensions(
        tile, roomPolygons, config.width, config.height,
      );

      // Find closest room (by tile rect center)
      const cx2 = tile.rect.x + config.width / 2;
      const cy2 = tile.rect.y + config.height / 2;
      let bestRoom = roomIds[0]!;
      let bestDist = Infinity;
      for (let r = 0; r < roomPolygons.length; r++) {
        const poly = roomPolygons[r]!;
        const pbbox = getBoundingBox(poly);
        const pcx = (pbbox.minX + pbbox.maxX) / 2;
        const pcy = (pbbox.minY + pbbox.maxY) / 2;
        const d = (cx2 - pcx) ** 2 + (cy2 - pcy) ** 2;
        if (d < bestDist) { bestDist = d; bestRoom = roomIds[r]!; }
      }

      return {
        id: tile.id,
        roomId: bestRoom,
        usedW, usedH, chuteW, chuteH,
        chuteArea: chuteW * chuteH,
        coveredById: null,
        reusedForId: null,
      };
    });

  optimizeReuse(cuts);

  const totalReuseCount = cuts.filter((c) => c.coveredById !== null).length;
  const tilesForCuts = cuts.length - totalReuseCount;
  const totalTiles = stats.whole + tilesForCuts;
  const toOrder = Math.ceil(totalTiles * (1 + ORDER_MARGIN_RATIO));

  return {
    tileW: config.width,
    tileH: config.height,
    joint: config.joint,
    wholeCount: stats.whole,
    cuts,
    cutGroups: groupCuts(cuts),
    totalReuseCount,
    tilesForCuts,
    totalTiles,
    toOrder,
    roomArea: stats.roomArea,
    tiles,
  };
}
