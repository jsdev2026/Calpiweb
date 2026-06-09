import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { getBoundingBox, rotatePoint, insetRoomPolygon } from '@/engine/geometry/polygon';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';
import { buildCutTable } from './buildCutTable';
import { assignOffcuts } from './assignOffcuts';
import { groupCuts } from './groupCuts';
import type { QuantityResult } from './types';

export type { TileEdgeSide, PieceEdges, CutRecord, CutGroup, QuantityResult } from './types';

function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number, wallThickness = 0): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) => {
      const inset = insetRoomPolygon(r, wallThickness);
      return angle !== 0
        ? inset.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : inset;
    });
}

export function analyzeQuantities(rooms: Room[], config: TilingConfig, wallThickness = 0, doorOpenings: DoorOpening[] = []): QuantityResult {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config, wallThickness, doorOpenings);

  if (validRooms.length === 0 || !stats) {
    return {
      tileW: config.width, tileH: config.height, joint: config.joint,
      wholeCount: 0, cuts: [], cutGroups: [],
      totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0, toOrder: 0, roomArea: 0,
      tiles: [],
      margin: ORDER_MARGIN_RATIO,
      consumables: {
        colle: { total: 0, bags: 0, bagSize: 25, rendement: 4 },
        joint: { total: 0, bags: 0, bagSize: 5, rendement: 0 },
        croisillons: { total: 0, bags: 0, bagSize: 200, rendement: 1.2 },
      },
    };
  }

  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const roomPolygons = tileSpaceRooms(validRooms, config.angle, cx, cy, wallThickness);
  const roomIds = validRooms.map((r) => r.id);

  const cuts = buildCutTable(tiles, roomPolygons, roomIds);
  assignOffcuts(cuts);
  const cutGroups = groupCuts(cuts);

  const totalReuseCount = cuts.filter((c) => c.coveredById !== null).length;
  const tilesForCuts = cuts.length - totalReuseCount;
  const totalTiles = stats.whole + tilesForCuts;
  const toOrder = Math.ceil(totalTiles * (1 + ORDER_MARGIN_RATIO));

  return {
    tileW: config.width, tileH: config.height, joint: config.joint,
    wholeCount: stats.whole,
    cuts,
    cutGroups,
    totalReuseCount,
    tilesForCuts,
    totalTiles,
    toOrder,
    roomArea: stats.roomArea,
    tiles,
    margin: ORDER_MARGIN_RATIO,
    consumables: {
      colle: { total: 0, bags: 0, bagSize: 25, rendement: 4 },
      joint: { total: 0, bags: 0, bagSize: 5, rendement: 0 },
      croisillons: { total: 0, bags: 0, bagSize: 200, rendement: 1.2 },
    },
  };
}
