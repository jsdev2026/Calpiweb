import type { Point } from '@/types/plan';
import type { Tile, TilingConfig, TilingResult } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { classifyTile } from '@/engine/geometry/clipping';
import { iterateGridCells } from '@/engine/geometry/grid';
import { computeStats } from './cutCalculator';

export const computeTiling = (plan: Point[], config: TilingConfig): TilingResult => {
  if (!plan || plan.length < 3) {
    return { tiles: [], stats: null };
  }

  const bbox = getBoundingBox(plan);
  const { width, height, joint, offsetX, offsetY, stagger } = config;
  const stepX = width + joint;
  const stepY = height + joint;

  const tiles: Tile[] = [];

  for (const cell of iterateGridCells({ bbox, stepX, stepY, offsetX, offsetY, stagger })) {
    const rect = { x: cell.x, y: cell.y, w: width, h: height };
    const type = classifyTile(rect, plan);

    if (type !== 'OUTSIDE') {
      tiles.push({ id: `${cell.x}-${cell.y}`, rect, type });
    }
  }

  return {
    tiles,
    stats: computeStats(tiles, plan, width, height),
  };
};
