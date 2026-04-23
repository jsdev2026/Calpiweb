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

export const computeTiling = (plan: Point[], config: TilingConfig): TilingResult => {
  if (!plan || plan.length < 3) return { tiles: [], stats: null };

  const { width, height, joint, stagger, angle, offsetX, offsetY, layout } = config;
  const bbox = getBoundingBox(plan);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  let maxRadius = 0;
  for (const p of plan) {
    const d = distance(p, { x: centerX, y: centerY });
    if (d > maxRadius) maxRadius = d;
  }

  if (layout === 'STRAIGHT') {
    const staggerRatio = stagger / 100;
    const { startX, startY, endX, endY, stepX, stepY } = buildGrid(centerX, centerY, maxRadius, config);
    const tiles: Tile[] = [];
    let rowIndex = 0;

    for (let y = startY - stepY; y < endY + stepY; y += stepY) {
      const rowStagger = (rowIndex % 2) * (stepX * staggerRatio);
      for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
        const rect = { x, y, w: width, h: height };
        const type = classifyTile(rect, plan);
        if (type !== 'OUTSIDE') {
          tiles.push({ id: `${x.toFixed(0)}-${y.toFixed(0)}`, rect, type });
        }
      }
      rowIndex += 1;
    }

    return { tiles, stats: computeStats(tiles, getPolygonArea(plan), width, height) };
  }

  if (layout === 'HERRINGBONE') {
    const effectiveAngle = angle - 45;
    const testPlan =
      effectiveAngle !== 0
        ? plan.map((p) => rotatePoint(p.x, p.y, -effectiveAngle, centerX, centerY))
        : plan;

    const rotatedBbox = getBoundingBox(testPlan);
    const L = height + joint;
    const W = width + joint;
    const margin = Math.max(width, height) * 2;
    const iRange = Math.ceil((rotatedBbox.maxX - rotatedBbox.minX + margin * 2) / L) + 2;
    const jRange = Math.ceil((rotatedBbox.maxY - rotatedBbox.minY + margin * 2) / W) + 2;

    const tiles: Tile[] = [];

    for (let i = -iRange; i <= iRange; i++) {
      for (let j = -jRange; j <= jRange; j++) {
        const bx = centerX + offsetX + i * L + j * W;
        const by = centerY + offsetY + i * L - j * W;

        // Tile 1: height × width
        const rect1 = { x: bx, y: by, w: height, h: width };
        const type1 = classifyTile(rect1, testPlan);
        if (type1 !== 'OUTSIDE') {
          tiles.push({ id: `${i}-${j}-1`, rect: rect1, type: type1 });
        }

        // Tile 2: width × height
        const vx = bx + L - W;
        const vy = by + W;
        const rect2 = { x: vx, y: vy, w: width, h: height };
        const type2 = classifyTile(rect2, testPlan);
        if (type2 !== 'OUTSIDE') {
          tiles.push({ id: `${i}-${j}-2`, rect: rect2, type: type2 });
        }
      }
    }

    return { tiles, stats: computeStats(tiles, getPolygonArea(plan), width, height) };
  }

  // CHEVRON
  const effectiveAngle = angle;
  const testPlan =
    effectiveAngle !== 0
      ? plan.map((p) => rotatePoint(p.x, p.y, -effectiveAngle, centerX, centerY))
      : plan;

  const rotatedBbox = getBoundingBox(testPlan);
  const angleRad = Math.PI / 4;
  const colWidth = height * Math.cos(angleRad);
  const biseauHeight = width / Math.cos(angleRad);
  const margin = Math.max(width, height) * 2;
  const cRange = Math.ceil((rotatedBbox.maxX - rotatedBbox.minX + margin * 2) / colWidth) + 2;
  const rRange = Math.ceil((rotatedBbox.maxY - rotatedBbox.minY + margin * 2) / biseauHeight) + 2;

  const tiles: Tile[] = [];

  for (let c = -cRange; c <= cRange; c++) {
    const isEven = Math.abs(c) % 2 === 0;
    const xBase = centerX + offsetX + c * (colWidth + joint * Math.cos(angleRad));
    for (let r = -rRange; r <= rRange; r++) {
      const yBase = centerY + offsetY + r * (biseauHeight + joint);
      const yOffset = isEven ? 0 : colWidth;

      let pts: Point[];
      if (isEven) {
        pts = [
          { x: xBase, y: yBase + yOffset },
          { x: xBase + colWidth, y: yBase + colWidth + yOffset },
          { x: xBase + colWidth, y: yBase + colWidth + biseauHeight + yOffset },
          { x: xBase, y: yBase + biseauHeight + yOffset },
        ];
      } else {
        pts = [
          { x: xBase, y: yBase + yOffset },
          { x: xBase + colWidth, y: yBase - colWidth + yOffset },
          { x: xBase + colWidth, y: yBase - colWidth + biseauHeight + yOffset },
          { x: xBase, y: yBase + biseauHeight + yOffset },
        ];
      }

      const type = classifyPolygonTile(pts, testPlan);
      if (type !== 'OUTSIDE') {
        tiles.push({
          id: `${c}-${r}`,
          points: pts,
          rect: { x: pts[0]!.x, y: pts[0]!.y, w: width, h: height },
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

  const { width, height, joint, stagger, angle, offsetX, offsetY, layout } = config;
  const allPoints = valid.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  let maxRadius = 0;
  for (const p of allPoints) {
    const d = distance(p, { x: centerX, y: centerY });
    if (d > maxRadius) maxRadius = d;
  }

  const tiles: Tile[] = [];

  if (layout === 'STRAIGHT') {
    const staggerRatio = stagger / 100;
    const { startX, startY, endX, endY, stepX, stepY } = buildGrid(centerX, centerY, maxRadius, config);
    const testRooms = valid.map((r) => ({ testPoints: r.points, edges: r.edges }));
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
    const effectiveAngle = angle - 45;
    const testRooms = valid.map((r) => ({
      testPoints:
        effectiveAngle !== 0
          ? r.points.map((p) => rotatePoint(p.x, p.y, -effectiveAngle, centerX, centerY))
          : r.points,
      edges: r.edges,
    }));

    const rotatedAllPoints = testRooms.flatMap((r) => r.testPoints);
    const rotatedBbox = getBoundingBox(rotatedAllPoints);
    const L = height + joint;
    const W = width + joint;
    const margin = Math.max(width, height) * 2;
    const iRange = Math.ceil((rotatedBbox.maxX - rotatedBbox.minX + margin * 2) / L) + 2;
    const jRange = Math.ceil((rotatedBbox.maxY - rotatedBbox.minY + margin * 2) / W) + 2;

    for (let i = -iRange; i <= iRange; i++) {
      for (let j = -jRange; j <= jRange; j++) {
        const bx = centerX + offsetX + i * L + j * W;
        const by = centerY + offsetY + i * L - j * W;

        // Tile 1: height × width
        const rect1 = { x: bx, y: by, w: height, h: width };
        let bestType1: TileType = 'OUTSIDE';
        for (const { testPoints, edges } of testRooms) {
          const t = classifyTile(rect1, testPoints, edges);
          if (t === 'WHOLE') { bestType1 = 'WHOLE'; break; }
          if (t === 'CUT') bestType1 = 'CUT';
        }
        if (bestType1 !== 'OUTSIDE') {
          tiles.push({ id: `${i}-${j}-1`, rect: rect1, type: bestType1 });
        }

        // Tile 2: width × height
        const vx = bx + L - W;
        const vy = by + W;
        const rect2 = { x: vx, y: vy, w: width, h: height };
        let bestType2: TileType = 'OUTSIDE';
        for (const { testPoints, edges } of testRooms) {
          const t = classifyTile(rect2, testPoints, edges);
          if (t === 'WHOLE') { bestType2 = 'WHOLE'; break; }
          if (t === 'CUT') bestType2 = 'CUT';
        }
        if (bestType2 !== 'OUTSIDE') {
          tiles.push({ id: `${i}-${j}-2`, rect: rect2, type: bestType2 });
        }
      }
    }
  } else {
    // CHEVRON
    const effectiveAngle = angle;
    const testRooms = valid.map((r) => ({
      testPoints:
        effectiveAngle !== 0
          ? r.points.map((p) => rotatePoint(p.x, p.y, -effectiveAngle, centerX, centerY))
          : r.points,
      edges: r.edges,
    }));

    const rotatedAllPoints = testRooms.flatMap((r) => r.testPoints);
    const rotatedBbox = getBoundingBox(rotatedAllPoints);
    const angleRad = Math.PI / 4;
    const colWidth = height * Math.cos(angleRad);
    const biseauHeight = width / Math.cos(angleRad);
    const margin = Math.max(width, height) * 2;
    const cRange = Math.ceil((rotatedBbox.maxX - rotatedBbox.minX + margin * 2) / colWidth) + 2;
    const rRange = Math.ceil((rotatedBbox.maxY - rotatedBbox.minY + margin * 2) / biseauHeight) + 2;

    for (let c = -cRange; c <= cRange; c++) {
      const isEven = Math.abs(c) % 2 === 0;
      const xBase = centerX + offsetX + c * (colWidth + joint * Math.cos(angleRad));
      for (let r = -rRange; r <= rRange; r++) {
        const yBase = centerY + offsetY + r * (biseauHeight + joint);
        const yOffset = isEven ? 0 : colWidth;

        let pts: Point[];
        if (isEven) {
          pts = [
            { x: xBase, y: yBase + yOffset },
            { x: xBase + colWidth, y: yBase + colWidth + yOffset },
            { x: xBase + colWidth, y: yBase + colWidth + biseauHeight + yOffset },
            { x: xBase, y: yBase + biseauHeight + yOffset },
          ];
        } else {
          pts = [
            { x: xBase, y: yBase + yOffset },
            { x: xBase + colWidth, y: yBase - colWidth + yOffset },
            { x: xBase + colWidth, y: yBase - colWidth + biseauHeight + yOffset },
            { x: xBase, y: yBase + biseauHeight + yOffset },
          ];
        }

        let bestType: TileType = 'OUTSIDE';
        for (const { testPoints } of testRooms) {
          const t = classifyPolygonTile(pts, testPoints);
          if (t === 'WHOLE') { bestType = 'WHOLE'; break; }
          if (t === 'CUT') bestType = 'CUT';
        }

        if (bestType !== 'OUTSIDE') {
          tiles.push({
            id: `${c}-${r}`,
            points: pts,
            rect: { x: pts[0]!.x, y: pts[0]!.y, w: width, h: height },
            type: bestType,
          });
        }
      }
    }
  }

  const totalRoomArea = valid.reduce((sum, r) => sum + getPolygonArea(r.points), 0);
  return { tiles, stats: computeStats(tiles, totalRoomArea, width, height) };
};
