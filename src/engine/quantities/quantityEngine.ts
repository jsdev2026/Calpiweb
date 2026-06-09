import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { getBoundingBox, rotatePoint, insetRoomPolygon } from '@/engine/geometry/polygon';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { MARGIN_STRAIGHT, MARGIN_DIAGONAL, MARGIN_CHEVRON } from '@/constants/businessRules';
import { buildCutTable } from './buildCutTable';
import { assignOffcuts } from './assignOffcuts';
import { groupCuts } from './groupCuts';
import type { QuantityResult, Consumables } from './types';

export type { TileEdgeSide, PieceEdges, CutRecord, CutGroup, QuantityResult } from './types';

export function computeMargin(config: TilingConfig): number {
  if (config.marginOverride !== undefined) return config.marginOverride;
  if (config.layout === 'CHEVRON' || config.layout === 'HERRINGBONE') return MARGIN_CHEVRON;
  if (config.angle === 45) return MARGIN_DIAGONAL;
  return MARGIN_STRAIGHT;
}

function computeConsumables(
  roomArea: number,
  totalTiles: number,
  config: TilingConfig,
): Consumables {
  const params = config.consumableParams ?? {};
  const surface = roomArea / 1_000_000; // mm² → m²

  const colleRendement = params.colleRendement ?? 4;
  const colleBagSize = params.colleBagSize ?? 25;
  const colleTotal = surface * colleRendement;

  const tileThickness = params.tileThickness ?? 10;
  const isoRendement =
    ((config.width + config.height) / (config.width * config.height)) *
    config.joint * tileThickness * 1.6 * 1.05;
  const jointRendement = params.jointRendement ?? isoRendement;
  const jointBagSize = params.jointBagSize ?? 5;
  const jointTotal = surface * jointRendement;

  const croisillonsBagSize = params.croisillonsBagSize ?? 200;
  const croisillonsTotal = Math.ceil(totalTiles * 1.2);

  return {
    colle: {
      total: colleTotal,
      bags: Math.ceil(colleTotal / colleBagSize),
      bagSize: colleBagSize,
      rendement: colleRendement,
    },
    joint: {
      total: jointTotal,
      bags: Math.ceil(jointTotal / jointBagSize),
      bagSize: jointBagSize,
      rendement: jointRendement,
    },
    croisillons: {
      total: croisillonsTotal,
      bags: Math.ceil(croisillonsTotal / croisillonsBagSize),
      bagSize: croisillonsBagSize,
      rendement: 1.2,
    },
  };
}

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

const EMPTY_CONSUMABLES: Consumables = {
  colle: { total: 0, bags: 0, bagSize: 25, rendement: 4 },
  joint: { total: 0, bags: 0, bagSize: 5, rendement: 0 },
  croisillons: { total: 0, bags: 0, bagSize: 200, rendement: 1.2 },
};

export function analyzeQuantities(
  rooms: Room[],
  config: TilingConfig,
  wallThickness = 0,
  doorOpenings: DoorOpening[] = [],
): QuantityResult {
  const margin = computeMargin(config);
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config, wallThickness, doorOpenings);

  if (validRooms.length === 0 || !stats) {
    return {
      tileW: config.width, tileH: config.height, joint: config.joint,
      wholeCount: 0, cuts: [], cutGroups: [],
      totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0,
      toOrder: 0, margin, roomArea: 0, tiles: [],
      consumables: EMPTY_CONSUMABLES,
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
  const toOrder = Math.ceil(totalTiles * (1 + margin));
  const consumables = computeConsumables(stats.roomArea, totalTiles, config);

  return {
    tileW: config.width, tileH: config.height, joint: config.joint,
    wholeCount: stats.whole,
    cuts,
    cutGroups,
    totalReuseCount,
    tilesForCuts,
    totalTiles,
    toOrder,
    margin,
    roomArea: stats.roomArea,
    tiles,
    consumables,
  };
}
