import type { Tile, TilingStats } from '@/types/tiling';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';
import { getPolygonArea } from '@/engine/geometry/polygon';
import type { Point } from '@/types/plan';

export const computeStats = (
  tiles: Tile[],
  plan: Point[],
  tileWidth: number,
  tileHeight: number,
): TilingStats => {
  let whole = 0;
  let cuts = 0;

  for (const tile of tiles) {
    if (tile.type === 'WHOLE') whole += 1;
    else if (tile.type === 'CUT') cuts += 1;
  }

  const total = whole + cuts;
  const tileArea = tileWidth * tileHeight;
  const totalTilesArea = total * tileArea;
  const roomArea = getPolygonArea(plan);
  const wasteArea = Math.max(0, totalTilesArea - roomArea);
  const wastePercent = totalTilesArea > 0 ? (wasteArea / totalTilesArea) * 100 : 0;

  return {
    whole,
    cuts,
    total,
    toOrder: Math.ceil(total * (1 + ORDER_MARGIN_RATIO)),
    roomArea,
    wastePercent,
  };
};
