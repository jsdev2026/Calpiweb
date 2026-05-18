import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';
import { getBoundingBox, rotatePoint } from '@/engine/geometry/polygon';
import { clipPolygon } from '@/engine/geometry/clipper';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';

const CUT_TOLERANCE_MM = 5;

export type TileEdgeSide = 'factory' | 'cut';

export interface PieceEdges {
  left: TileEdgeSide;
  right: TileEdgeSide;
  top: TileEdgeSide;
  bottom: TileEdgeSide;
}

export interface CutDetail {
  id: string;
  roomId: string;
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;
  clipCx: number;
  clipCy: number;
  coveredById: string | null;
  reusedForId: string | null;
}

export interface CutGroup {
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  totalCount: number;
  reuseCount: number;
  netTiles: number;
}

export interface QuantityResult {
  tileW: number;
  tileH: number;
  joint: number;
  wholeCount: number;
  cuts: CutDetail[];
  cutGroups: CutGroup[];
  totalReuseCount: number;
  tilesForCuts: number;
  totalTiles: number;
  toOrder: number;
  roomArea: number;
  tiles: Tile[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const ALL_FACTORY: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'factory' };

/**
 * Returns the polygon with vertices in CCW order (positive signed area).
 * clipPolygon (Sutherland-Hodgman) only works for CCW clip polygons.
 * Rooms can be drawn CW or CCW, so we normalise before clipping.
 */
function ensureCCW(poly: Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i]!;
    const next = poly[(i + 1) % poly.length]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return area < 0 ? [...poly].reverse() : poly;
}

function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) =>
      angle !== 0
        ? r.points.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : r.points,
    );
}

function computeCutInfo(
  tile: Tile,
  roomPolygons: Point[][],
): {
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;
  clipCx: number;
  clipCy: number;
} {
  const tileW = tile.rect.w;
  const tileH = tile.rect.h;
  const tx = tile.rect.x;
  const ty = tile.rect.y;

  const corners: Point[] = [
    { x: tx,         y: ty         },
    { x: tx + tileW, y: ty         },
    { x: tx + tileW, y: ty + tileH },
    { x: tx,         y: ty + tileH },
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rawPoly of roomPolygons) {
    const poly = ensureCCW(rawPoly);
    const clipped = clipPolygon(corners, poly);
    for (const p of clipped) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }

  if (minX === Infinity) {
    return {
      usedW: tileW, usedH: tileH,
      pieceEdges: ALL_FACTORY,
      chuteW: 0, chuteH: 0,
      chuteEdges: ALL_FACTORY,
      chuteArea: 0,
      clipCx: tx + tileW / 2, clipCy: ty + tileH / 2,
    };
  }

  const usedW = Math.max(1, Math.round(Math.min(tileW, maxX - minX)));
  const usedH = Math.max(1, Math.round(Math.min(tileH, maxY - minY)));
  const clipCx = (minX + maxX) / 2;
  const clipCy = (minY + maxY) / 2;

  const isCutLeft  = minX > tx + CUT_TOLERANCE_MM;
  const isCutRight = maxX < tx + tileW - CUT_TOLERANCE_MM;
  const isCutTop   = minY > ty + CUT_TOLERANCE_MM;
  const isCutBot   = maxY < ty + tileH - CUT_TOLERANCE_MM;

  const pieceEdges: PieceEdges = {
    left:   isCutLeft  ? 'cut' : 'factory',
    right:  isCutRight ? 'cut' : 'factory',
    top:    isCutTop   ? 'cut' : 'factory',
    bottom: isCutBot   ? 'cut' : 'factory',
  };

  const isCutH = isCutLeft || isCutRight;
  const isCutV = isCutTop  || isCutBot;

  const hTrim = isCutLeft ? (minX - tx) : isCutRight ? (tx + tileW - maxX) : 0;
  const vTrim = isCutTop  ? (minY - ty) : isCutBot   ? (ty + tileH - maxY) : 0;

  let chuteW: number;
  let chuteH: number;
  let chuteEdges: PieceEdges = ALL_FACTORY;

  if (isCutH && isCutV) {
    // Corner cut: choose the larger strip (3 factory edges) over the corner piece (2 factory edges)
    if (hTrim * tileH >= tileW * vTrim) {
      // Side strip
      chuteW = hTrim;
      chuteH = tileH;
      chuteEdges = isCutLeft
        ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
        : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
    } else {
      // Top/bottom strip
      chuteW = tileW;
      chuteH = vTrim;
      chuteEdges = isCutTop
        ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
        : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
    }
  } else if (isCutH) {
    chuteW = hTrim;
    chuteH = tileH;
    chuteEdges = isCutLeft
      ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
      : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
  } else if (isCutV) {
    chuteW = tileW;
    chuteH = vTrim;
    chuteEdges = isCutTop
      ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
      : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
  } else {
    chuteW = 0;
    chuteH = 0;
  }

  const viable = chuteW > 20 && chuteH > 20;
  return {
    usedW,
    usedH,
    pieceEdges,
    chuteW: viable ? chuteW : 0,
    chuteH: viable ? chuteH : 0,
    chuteEdges: viable ? chuteEdges : ALL_FACTORY,
    chuteArea: viable ? chuteW * chuteH : 0,
    clipCx,
    clipCy,
  };
}

// ─── reuse optimisation (greedy) ─────────────────────────────────────────────
//
// A leftover piece can satisfy a target cut position if, in some rotation (0°/90°/180°/270°),
// its dimensions are at least as large AND its factory edges cover all factory edge
// requirements of the target position.
//
// Factory edge requirement: if target.side === 'factory', the replacement must also have
// 'factory' on that side. Cut-edge positions have no requirement (any edge type is fine).

function canReuseFor(
  cw: number, ch: number, ce: PieceEdges,
  nw: number, nh: number, ne: PieceEdges,
): boolean {
  let ew = cw, eh = ch;
  let el: TileEdgeSide = ce.left, er: TileEdgeSide = ce.right;
  let et: TileEdgeSide = ce.top,  eb: TileEdgeSide = ce.bottom;

  for (let r = 0; r < 4; r++) {
    if (ew >= nw - CUT_TOLERANCE_MM && eh >= nh - CUT_TOLERANCE_MM) {
      const ok =
        (ne.left   === 'factory' ? el === 'factory' : true) &&
        (ne.right  === 'factory' ? er === 'factory' : true) &&
        (ne.top    === 'factory' ? et === 'factory' : true) &&
        (ne.bottom === 'factory' ? eb === 'factory' : true);
      if (ok) return true;
    }
    // Rotate 90° clockwise: new_left=old_bottom, new_top=old_left, new_right=old_top, new_bottom=old_right
    const nl = eb, nt = el, nr = et, nb = er;
    el = nl; et = nt; er = nr; eb = nb;
    [ew, eh] = [eh, ew];
  }
  return false;
}

function optimizeReuse(cuts: CutDetail[]): void {
  const sorted = [...cuts].sort((a, b) => a.usedW * a.usedH - b.usedW * b.usedH);
  const pool: { w: number; h: number; edges: PieceEdges; fromId: string; used: boolean }[] = [];

  for (const cut of sorted) {
    let found = false;
    for (const chute of pool) {
      if (chute.used) continue;
      if (canReuseFor(chute.w, chute.h, chute.edges, cut.usedW, cut.usedH, cut.pieceEdges)) {
        chute.used = true;
        cut.coveredById = chute.fromId;
        const src = cuts.find((c) => c.id === chute.fromId);
        if (src) src.reusedForId = cut.id;
        found = true;
        break;
      }
    }
    if (!found && cut.chuteW > 20 && cut.chuteH > 20) {
      pool.push({ w: cut.chuteW, h: cut.chuteH, edges: cut.chuteEdges, fromId: cut.id, used: false });
    }
  }
}

// ─── grouping ────────────────────────────────────────────────────────────────

function edgeKey(pe: PieceEdges): string {
  return `${pe.left[0]}${pe.right[0]}${pe.top[0]}${pe.bottom[0]}`;
}

function groupCuts(cuts: CutDetail[]): CutGroup[] {
  const map = new Map<string, CutGroup>();

  for (const cut of cuts) {
    const key = `${cut.usedW}×${cut.usedH}|${edgeKey(cut.pieceEdges)}`;
    if (!map.has(key)) {
      map.set(key, {
        usedW: cut.usedW,
        usedH: cut.usedH,
        pieceEdges: cut.pieceEdges,
        chuteW: cut.chuteW,
        chuteH: cut.chuteH,
        chuteEdges: cut.chuteEdges,
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
  const roomIds = validRooms.map((r) => r.id);

  const cuts: CutDetail[] = tiles
    .filter((t) => t.type === 'CUT')
    .map((tile) => {
      const { usedW, usedH, pieceEdges, chuteW, chuteH, chuteEdges, chuteArea, clipCx, clipCy } =
        computeCutInfo(tile, roomPolygons);

      const cx2 = tile.rect.x + tile.rect.w / 2;
      const cy2 = tile.rect.y + tile.rect.h / 2;
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
        usedW,
        usedH,
        pieceEdges,
        chuteW,
        chuteH,
        chuteEdges,
        chuteArea,
        clipCx,
        clipCy,
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
