import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';
import { getBoundingBox, rotatePoint } from '@/engine/geometry/polygon';
import { clipPolygon } from '@/engine/geometry/clipper';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';

// Un bord est considéré "coupé" si la dimension utilisée est inférieure à la
// dimension nominale d'au moins cette tolérance.
const CUT_TOLERANCE_MM = 5;

export interface CutDetail {
  id: string;
  roomId: string;
  usedW: number;           // mm – dimension du morceau posé
  usedH: number;
  cutEdgeCount: 1 | 2;    // 1 = coupe simple (3 bords usine), 2 = coupe d'angle (2 bords usine)
  chuteW: number;          // mm – dimensions de la chute récupérable (0 si inexploitable)
  chuteH: number;
  chuteArea: number;
  clipCx: number;          // centre du morceau posé dans l'espace tuile (pour annotation sur le plan)
  clipCy: number;
  coveredById: string | null;   // cette coupe est satisfaite par la chute d'un autre carreau
  reusedForId: string | null;   // la chute de ce carreau sert à satisfaire une autre coupe
}

export interface CutGroup {
  usedW: number;
  usedH: number;
  cutEdgeCount: 1 | 2;
  chuteW: number;
  chuteH: number;
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

// Calcule les dimensions réelles du morceau posé et de la chute,
// en utilisant les dimensions nominales du carreau (tile.rect.w / tile.rect.h)
// — ce qui corrige le cas herringbone où les carreaux alternent W×H et H×W.
function computeCutInfo(
  tile: Tile,
  roomPolygons: Point[][],
): {
  usedW: number;
  usedH: number;
  cutEdgeCount: 1 | 2;
  chuteW: number;
  chuteH: number;
  chuteArea: number;
  clipCx: number;
  clipCy: number;
} {
  const tileW = tile.rect.w;
  const tileH = tile.rect.h;

  const corners: Point[] = [
    { x: tile.rect.x,         y: tile.rect.y         },
    { x: tile.rect.x + tileW, y: tile.rect.y         },
    { x: tile.rect.x + tileW, y: tile.rect.y + tileH },
    { x: tile.rect.x,         y: tile.rect.y + tileH },
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
    return { usedW: tileW, usedH: tileH, cutEdgeCount: 1, chuteW: 0, chuteH: 0, chuteArea: 0, clipCx: tile.rect.x + tileW / 2, clipCy: tile.rect.y + tileH / 2 };
  }

  const usedW = Math.max(1, Math.round(Math.min(tileW, maxX - minX)));
  const usedH = Math.max(1, Math.round(Math.min(tileH, maxY - minY)));
  const clipCx = (minX + maxX) / 2;
  const clipCy = (minY + maxY) / 2;

  const isCutW = usedW < tileW - CUT_TOLERANCE_MM;
  const isCutH = usedH < tileH - CUT_TOLERANCE_MM;

  // Nombre de bords de coupe : 1 (coupe simple) ou 2 (coupe d'angle)
  const cutEdgeCount: 1 | 2 = isCutW && isCutH ? 2 : 1;

  // Dimensions de la chute :
  //   Coupe simple horizontale : bande pleine largeur  → tileW × (tileH − usedH)
  //   Coupe simple verticale   : bande pleine hauteur  → (tileW − usedW) × tileH
  //   Coupe d'angle            : rectangle de coin     → (tileW − usedW) × (tileH − usedH)
  let chuteW: number, chuteH: number;
  if (isCutW && isCutH) {
    chuteW = tileW - usedW;
    chuteH = tileH - usedH;
  } else if (isCutH) {
    chuteW = tileW;
    chuteH = tileH - usedH;
  } else {
    chuteW = tileW - usedW;
    chuteH = tileH;
  }

  const viable = chuteW > 20 && chuteH > 20;
  return {
    usedW,
    usedH,
    cutEdgeCount,
    chuteW: viable ? chuteW : 0,
    chuteH: viable ? chuteH : 0,
    chuteArea: viable ? chuteW * chuteH : 0,
    clipCx,
    clipCy,
  };
}

// ─── reuse optimisation (greedy) ────────────────────────────────────────────
//
// Règle des bords d'usine :
//   Coupe simple  (cutEdgeCount=1) → chute avec 3 bords usine → couvre tout type de coupe
//   Coupe d'angle (cutEdgeCount=2) → chute avec 2 bords usine → couvre uniquement les coupes d'angle
//
// Contrainte : chute.cutEdgeCount <= cut.cutEdgeCount
//   (une chute d'angle ne peut pas remplacer une coupe simple)

function optimizeReuse(cuts: CutDetail[]): void {
  const sorted = [...cuts].sort((a, b) => a.usedW * a.usedH - b.usedW * b.usedH);
  const pool: {
    w: number;
    h: number;
    fromId: string;
    used: boolean;
    cutEdgeCount: 1 | 2;
  }[] = [];

  for (const cut of sorted) {
    let found = false;
    for (const chute of pool) {
      if (chute.used) continue;
      // Contrainte bords d'usine : la chute doit avoir au moins autant de bords
      // usine que le poste de coupe l'exige.
      if (chute.cutEdgeCount > cut.cutEdgeCount) continue;
      const fitsNormal  = chute.w >= cut.usedW && chute.h >= cut.usedH;
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
      pool.push({
        w: cut.chuteW,
        h: cut.chuteH,
        fromId: cut.id,
        used: false,
        cutEdgeCount: cut.cutEdgeCount,
      });
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
        cutEdgeCount: cut.cutEdgeCount,
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
  const roomIds = validRooms.map((r) => r.id);

  const cuts: CutDetail[] = tiles
    .filter((t) => t.type === 'CUT')
    .map((tile) => {
      const { usedW, usedH, cutEdgeCount, chuteW, chuteH, chuteArea, clipCx, clipCy } = computeCutInfo(
        tile,
        roomPolygons,
      );

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
        cutEdgeCount,
        chuteW,
        chuteH,
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
