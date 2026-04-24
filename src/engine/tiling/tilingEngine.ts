import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { Tile, TileType, TilingConfig, TilingResult } from '@/types/tiling';
import { getBoundingBox, distance, rotatePoint, getPolygonArea } from '@/engine/geometry/polygon';
import { classifyTile, classifyPolygonTile } from '@/engine/geometry/clipping';
import { computeStats } from './cutCalculator';

function buildGrid(
  centerX: number,
  centerY: number,
  maxRadius: number,
  config: TilingConfig,
): { startX: number; startY: number; endX: number; endY: number; stepX: number; stepY: number } {
  const { width, height, joint, offsetX, offsetY } = config;
  const stepX = width + joint;
  const stepY = height + joint;
  const safetyMargin = Math.max(width, height) * 2;
  const gridSide = maxRadius * 2 + safetyMargin;
  return {
    startX: centerX - gridSide / 2 + (offsetX % stepX),
    startY: centerY - gridSide / 2 + (offsetY % stepY),
    endX: centerX + gridSide / 2,
    endY: centerY + gridSide / 2,
    stepX,
    stepY,
  };
}

// Bâton rompu (herringbone): diagonal lattice with basis vectors (H, H) and (W, -W).
// Each cell places two tiles forming an L: one horizontal (H×W) and one vertical (W×H).
// Joints appear via SVG strokeWidth; tiles are placed touching.
function buildHerringbonePositions(
  centerX: number,
  centerY: number,
  maxRadius: number,
  config: TilingConfig,
): Array<{ x: number; y: number; w: number; h: number }> {
  const { width: W, height: H, offsetX, offsetY } = config;

  const margin = Math.max(W, H) * 2;
  const span = maxRadius * 2 + margin;
  const iRange = Math.ceil(span / H) + 2;
  const jRange = Math.ceil(span / W) + 2;

  const result: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (let i = -iRange; i <= iRange; i++) {
    for (let j = -jRange; j <= jRange; j++) {
      const bx = centerX + offsetX + i * H + j * W;
      const by = centerY + offsetY + i * H - j * W;
      // Tile 1: horizontal (H × W)
      result.push({ x: bx, y: by, w: H, h: W });
      // Tile 2: vertical (W × H), right-aligned with tile 1 and offset downward
      result.push({ x: bx + H - W, y: by + W, w: W, h: H });
    }
  }

  return result;
}

export const computeTiling = (plan: Point[], config: TilingConfig): TilingResult => {
  if (!plan || plan.length < 3) return { tiles: [], stats: null };

  const { width, height, stagger, angle, layout, joint, offsetX, offsetY } = config;
  const bbox = getBoundingBox(plan);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  let maxRadius = 0;
  for (const p of plan) {
    const d = distance(p, { x: centerX, y: centerY });
    if (d > maxRadius) maxRadius = d;
  }

  const testPlan =
    angle !== 0
      ? plan.map((p) => rotatePoint(p.x, p.y, -angle, centerX, centerY))
      : plan;

  if (layout === 'STRAIGHT') {
    const staggerRatio = stagger / 100;
    const { startX, startY, endX, endY, stepX, stepY } = buildGrid(centerX, centerY, maxRadius, config);
    const tiles: Tile[] = [];
    let rowIndex = 0;

    for (let y = startY - stepY; y < endY + stepY; y += stepY) {
      const rowStagger = (rowIndex % 2) * (stepX * staggerRatio);
      for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
        const rect = { x, y, w: width, h: height };
        const type = classifyTile(rect, testPlan);
        if (type !== 'OUTSIDE') {
          tiles.push({ id: `${x.toFixed(0)}-${y.toFixed(0)}`, rect, type });
        }
      }
      rowIndex += 1;
    }

    return { tiles, stats: computeStats(tiles, getPolygonArea(plan), width, height) };
  }

  if (layout === 'HERRINGBONE') {
    const positions = buildHerringbonePositions(centerX, centerY, maxRadius, config);
    const tiles: Tile[] = [];

    for (const pos of positions) {
      const rect = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      const type = classifyTile(rect, testPlan);
      if (type !== 'OUTSIDE') {
        tiles.push({ id: `${pos.x.toFixed(1)}-${pos.y.toFixed(1)}-${pos.w}`, rect, type });
      }
    }

    return { tiles, stats: computeStats(tiles, getPolygonArea(plan), width, height) };
  }

  // CHEVRON – parallelogram tiles with configurable opening angle (default 45°).
  // dy = horizontal lean; tile dimensions (width × height) stay fixed regardless of angle.
  const rotatedBbox = getBoundingBox(testPlan);
  const tanB = Math.tan(config.chevronAngle * Math.PI / 180);
  const dy = height * tanB;
  const colStepX = height + joint;
  const rowStepY = width + joint;
  const margin = Math.max(width, height) * 2;
  const cRange = Math.ceil((rotatedBbox.maxX - rotatedBbox.minX + margin * 2) / colStepX) + 2;
  const rRange = Math.ceil((rotatedBbox.maxY - rotatedBbox.minY + margin * 2 + dy * 2) / rowStepY) + 2;

  const tiles: Tile[] = [];

  for (let c = -cRange; c <= cRange; c++) {
    const isEven = Math.abs(c) % 2 === 0;
    const xBase = centerX + offsetX + c * colStepX;
    for (let r = -rRange; r <= rRange; r++) {
      const yBase = centerY + offsetY + r * rowStepY;

      let pts: Point[];
      if (isEven) {
        pts = [
          { x: xBase,          y: yBase },
          { x: xBase + height, y: yBase + dy },
          { x: xBase + height, y: yBase + dy + width },
          { x: xBase,          y: yBase + width },
        ];
      } else {
        pts = [
          { x: xBase,          y: yBase + dy },
          { x: xBase + height, y: yBase },
          { x: xBase + height, y: yBase + width },
          { x: xBase,          y: yBase + dy + width },
        ];
      }

      const type = classifyPolygonTile(pts, testPlan);
      if (type !== 'OUTSIDE') {
        const pb = getBoundingBox(pts);
        tiles.push({
          id: `${c}-${r}`,
          points: pts,
          rect: { x: pb.minX, y: pb.minY, w: pb.maxX - pb.minX, h: pb.maxY - pb.minY },
          type,
        });
      }
    }
  }

  return { tiles, stats: computeStats(tiles, getPolygonArea(plan), width, height) };
};

export const computeTilingMultiRoom = (rooms: Room[], config: TilingConfig): TilingResult => {
  const valid = rooms.filter((r) => r.points.length >= 3);
  if (valid.length === 0) return { tiles: [], stats: null };
  if (valid.length === 1) return computeTiling(valid[0]!.points, config);

  const { width, height, stagger, angle, layout, joint, offsetX, offsetY } = config;
  const allPoints = valid.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  let maxRadius = 0;
  for (const p of allPoints) {
    const d = distance(p, { x: centerX, y: centerY });
    if (d > maxRadius) maxRadius = d;
  }

  const testRooms = valid.map((r) => ({
    testPoints:
      angle !== 0
        ? r.points.map((p) => rotatePoint(p.x, p.y, -angle, centerX, centerY))
        : r.points,
    edges: r.edges,
  }));

  const tiles: Tile[] = [];

  if (layout === 'STRAIGHT') {
    const staggerRatio = stagger / 100;
    const { startX, startY, endX, endY, stepX, stepY } = buildGrid(centerX, centerY, maxRadius, config);
    let rowIndex = 0;

    for (let y = startY - stepY; y < endY + stepY; y += stepY) {
      const rowStagger = (rowIndex % 2) * (stepX * staggerRatio);
      for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
        const rect = { x, y, w: width, h: height };

        let bestType: TileType = 'OUTSIDE';
        for (const { testPoints, edges } of testRooms) {
          const t = classifyTile(rect, testPoints, edges);
          if (t === 'WHOLE') { bestType = 'WHOLE'; break; }
          if (t === 'CUT') bestType = 'CUT';
        }

        if (bestType !== 'OUTSIDE') {
          tiles.push({ id: `${x.toFixed(0)}-${y.toFixed(0)}`, rect, type: bestType });
        }
      }
      rowIndex += 1;
    }
  } else if (layout === 'HERRINGBONE') {
    const positions = buildHerringbonePositions(centerX, centerY, maxRadius, config);

    for (const pos of positions) {
      const rect = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };

      let bestType: TileType = 'OUTSIDE';
      for (const { testPoints, edges } of testRooms) {
        const t = classifyTile(rect, testPoints, edges);
        if (t === 'WHOLE') { bestType = 'WHOLE'; break; }
        if (t === 'CUT') bestType = 'CUT';
      }

      if (bestType !== 'OUTSIDE') {
        tiles.push({ id: `${pos.x.toFixed(1)}-${pos.y.toFixed(1)}-${pos.w}`, rect, type: bestType });
      }
    }
  } else {
    // CHEVRON – parallelogram tiles with configurable opening angle (default 45°).
    const rotatedAllPoints = testRooms.flatMap((r) => r.testPoints);
    const rotatedBbox = getBoundingBox(rotatedAllPoints);
    const tanB = Math.tan(config.chevronAngle * Math.PI / 180);
    const dy = height * tanB;
    const colStepX = height + joint;
    const rowStepY = width + joint;
    const margin = Math.max(width, height) * 2;
    const cRange = Math.ceil((rotatedBbox.maxX - rotatedBbox.minX + margin * 2) / colStepX) + 2;
    const rRange = Math.ceil((rotatedBbox.maxY - rotatedBbox.minY + margin * 2 + dy * 2) / rowStepY) + 2;

    for (let c = -cRange; c <= cRange; c++) {
      const isEven = Math.abs(c) % 2 === 0;
      const xBase = centerX + offsetX + c * colStepX;
      for (let r = -rRange; r <= rRange; r++) {
        const yBase = centerY + offsetY + r * rowStepY;

        let pts: Point[];
        if (isEven) {
          pts = [
            { x: xBase,          y: yBase },
            { x: xBase + height, y: yBase + dy },
            { x: xBase + height, y: yBase + dy + width },
            { x: xBase,          y: yBase + width },
          ];
        } else {
          pts = [
            { x: xBase,          y: yBase + dy },
            { x: xBase + height, y: yBase },
            { x: xBase + height, y: yBase + width },
            { x: xBase,          y: yBase + dy + width },
          ];
        }

        let bestType: TileType = 'OUTSIDE';
        for (const { testPoints } of testRooms) {
          const t = classifyPolygonTile(pts, testPoints);
          if (t === 'WHOLE') { bestType = 'WHOLE'; break; }
          if (t === 'CUT') bestType = 'CUT';
        }

        if (bestType !== 'OUTSIDE') {
          const pb = getBoundingBox(pts);
          tiles.push({
            id: `${c}-${r}`,
            points: pts,
            rect: { x: pb.minX, y: pb.minY, w: pb.maxX - pb.minX, h: pb.maxY - pb.minY },
            type: bestType,
          });
        }
      }
    }
  }

  const totalRoomArea = valid.reduce((sum, r) => sum + getPolygonArea(r.points), 0);
  return { tiles, stats: computeStats(tiles, totalRoomArea, width, height) };
};
