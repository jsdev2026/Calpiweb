import type { Point } from '@/types/plan';
import type { DoorOpening } from '@/types/wall';
import type { EdgeType, ExcludedZone, Partition, Room } from '@/types/project';
import type { Tile, TileType, TilingConfig, TilingResult } from '@/types/tiling';
import { getBoundingBox, distance, rotatePoint, getPolygonArea, pointInPolygon, getIntersection, insetRoomPolygon } from '@/engine/geometry/polygon';
import { classifyTile, classifyPolygonTile } from '@/engine/geometry/clipping';
import { computeStats } from './cutCalculator';

/** Converts a Partition to its 4-corner bounding polygon (accounts for full thickness). */
export function partitionToPolygon(p: Partition): Point[] {
  const dx = p.p2.x - p.p1.x;
  const dy = p.p2.y - p.p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return [];
  const nx = (-dy / len) * (p.thickness / 2);
  const ny = (dx / len) * (p.thickness / 2);
  return [
    { x: p.p1.x + nx, y: p.p1.y + ny },
    { x: p.p2.x + nx, y: p.p2.y + ny },
    { x: p.p2.x - nx, y: p.p2.y - ny },
    { x: p.p1.x - nx, y: p.p1.y - ny },
  ];
}

/**
 * Returns true if the tile rect intersects (overlaps) the given polygon.
 * Used to detect tiles that straddle an exclusion boundary — centre outside,
 * but the tile partially overlaps the excluded area.
 */
function tileStraddles(tile: Tile, poly: Point[]): boolean {
  const { x, y, w, h } = tile.rect;
  const corners: Point[] = [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
  ];
  // Any tile corner inside the polygon
  if (corners.some((c) => pointInPolygon(c, poly))) return true;
  // Any polygon vertex inside the tile bounding box
  if (poly.some((p) => p.x > x && p.x < x + w && p.y > y && p.y < y + h)) return true;
  // Any tile edge intersects any polygon edge
  for (let i = 0; i < 4; i++) {
    const t1 = corners[i]!, t2 = corners[(i + 1) % 4]!;
    for (let j = 0; j < poly.length; j++) {
      if (getIntersection(t1, t2, poly[j]!, poly[(j + 1) % poly.length]!)) return true;
    }
  }
  return false;
}

/**
 * Filters and reclassifies tiles based on exclusion zones and partition polygons.
 *
 * - Tile centre inside exclusion  → remove entirely (tile sits under obstruction).
 * - Tile straddles exclusion edge → reclassify WHOLE → CUT; the even-odd clip path in
 *   TilingCanvas handles the correct visual clipping at the exact partition/zone edge.
 */
function filterExcluded(
  tiles: Tile[],
  excludedZones: ExcludedZone[],
  partitionPolygons: Point[][],
  angle: number,
  centerX: number,
  centerY: number,
): Tile[] {
  if (excludedZones.length === 0 && partitionPolygons.length === 0) return tiles;

  return tiles
    .map((tile): Tile | null => {
      const { x, y, w, h } = tile.rect;
      const cx = x + w / 2, cy = y + h / 2;
      const worldPt = angle !== 0
        ? rotatePoint(cx, cy, angle, centerX, centerY)
        : { x: cx, y: cy };

      // World-space bounding box for straddle checks (un-rotate when needed)
      const wRect = angle !== 0
        ? (() => {
            const cs = [
              { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
            ].map((c) => rotatePoint(c.x, c.y, angle, centerX, centerY));
            const wxs = cs.map((c) => c.x), wys = cs.map((c) => c.y);
            return {
              x: Math.min(...wxs), y: Math.min(...wys),
              w: Math.max(...wxs) - Math.min(...wxs),
              h: Math.max(...wys) - Math.min(...wys),
            };
          })()
        : tile.rect;
      const wTile: Tile = { ...tile, rect: wRect };

      // Centre inside exclusion → remove entirely
      if (excludedZones.some((z) => pointInPolygon(worldPt, z.points))) return null;
      if (partitionPolygons.some((p) => pointInPolygon(worldPt, p))) return null;

      // Tile straddles exclusion boundary → reclassify as CUT
      if (tile.type === 'WHOLE') {
        const straddles =
          excludedZones.some((z) => tileStraddles(wTile, z.points)) ||
          partitionPolygons.some((p) => tileStraddles(wTile, p));
        if (straddles) return { ...tile, type: 'CUT' as const };
      }

      return tile;
    })
    .filter((t): t is Tile => t !== null);
}

function buildGrid(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  config: TilingConfig,
): { startX: number; startY: number; endX: number; endY: number; stepX: number; stepY: number } {
  const { width, height, joint, offsetX, offsetY } = config;
  const stepX = width + joint;
  const stepY = height + joint;
  return {
    startX: bbox.minX + (offsetX % stepX),
    startY: bbox.minY + (offsetY % stepY),
    endX: bbox.maxX,
    endY: bbox.maxY,
    stepX,
    stepY,
  };
}

// Bâton rompu (herringbone): diagonal lattice with basis vectors (H, H) and (W, -W).
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
      result.push({ x: bx, y: by, w: H, h: W });
      result.push({ x: bx + H - W, y: by + W, w: W, h: H });
    }
  }
  return result;
}

export const computeTiling = (
  plan: Point[],
  config: TilingConfig,
  edges?: EdgeType[],
  excludedZones?: ExcludedZone[],
  partitions?: Partition[],
): TilingResult => {
  if (!plan || plan.length < 3) return { tiles: [], stats: null };

  const partitionPolygons = (partitions ?? []).map(partitionToPolygon).filter((p) => p.length >= 3);

  // Net tiled area = room area minus exclusions, for accurate waste statistics
  const rawArea = getPolygonArea(plan);
  const excludedArea =
    (excludedZones ?? []).reduce((s, z) => s + getPolygonArea(z.points), 0) +
    partitionPolygons.reduce((s, p) => s + getPolygonArea(p), 0);
  const netArea = Math.max(0, rawArea - excludedArea);

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
    const testBbox = getBoundingBox(testPlan);
    const { startX, startY, endX, endY, stepX, stepY } = buildGrid(testBbox, config);
    const tiles: Tile[] = [];
    let rowIndex = 0;

    for (let y = startY - stepY; y < endY + stepY; y += stepY) {
      const rowStagger = (rowIndex % 2) * (stepX * staggerRatio);
      for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
        const rect = { x, y, w: width, h: height };
        const type = classifyTile(rect, testPlan, edges);
        if (type !== 'OUTSIDE') {
          tiles.push({ id: `${x.toFixed(0)}-${y.toFixed(0)}`, rect, type });
        }
      }
      rowIndex += 1;
    }

    const filtered = filterExcluded(tiles, excludedZones ?? [], partitionPolygons, angle, centerX, centerY);
    return { tiles: filtered, stats: computeStats(filtered, netArea, width, height) };
  }

  if (layout === 'HERRINGBONE') {
    const positions = buildHerringbonePositions(centerX, centerY, maxRadius, config);
    const tiles: Tile[] = [];

    for (const pos of positions) {
      const rect = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      const type = classifyTile(rect, testPlan, edges);
      if (type !== 'OUTSIDE') {
        tiles.push({ id: `${pos.x.toFixed(1)}-${pos.y.toFixed(1)}-${pos.w}`, rect, type });
      }
    }

    const filtered = filterExcluded(tiles, excludedZones ?? [], partitionPolygons, angle, centerX, centerY);
    return { tiles: filtered, stats: computeStats(filtered, netArea, width, height) };
  }

  // CHEVRON
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

  const filtered = filterExcluded(tiles, excludedZones ?? [], partitionPolygons, angle, centerX, centerY);
  return { tiles: filtered, stats: computeStats(filtered, netArea, width, height) };
};

export const computeTilingMultiRoom = (rooms: Room[], config: TilingConfig, wallThickness = 0, doorOpenings: DoorOpening[] = []): TilingResult => {
  const valid = rooms.filter((r) => r.points.length >= 3);
  if (valid.length === 0) return { tiles: [], stats: null };
  // Note: computeTiling derives its rotation pivot from the inset polygon bbox.
  // For rectangular rooms this equals the raw bbox center (symmetric inset).
  // For irregular rooms with asymmetric wall thickness and angle !== 0, a small
  // pivot offset may occur. Acceptable for current use cases.
  if (valid.length === 1 && doorOpenings.length === 0) return computeTiling(
    insetRoomPolygon(valid[0]!, wallThickness), config, valid[0]!.edges, valid[0]!.excludedZones, valid[0]!.partitions,
  );

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

  const testRooms = valid.map((r) => {
    const inset = insetRoomPolygon(r, wallThickness);
    return {
      testPoints:
        angle !== 0
          ? inset.map((p) => rotatePoint(p.x, p.y, -angle, centerX, centerY))
          : inset,
      edges: r.edges,
    };
  });

  const tiles: Tile[] = [];

  if (layout === 'STRAIGHT') {
    const staggerRatio = stagger / 100;
    const allTestPoints = testRooms.flatMap((r) => r.testPoints);
    const testBbox = getBoundingBox(allTestPoints);
    const { startX, startY, endX, endY, stepX, stepY } = buildGrid(testBbox, config);
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

    // Carreaux dans les ouvertures de porte (STRAIGHT, angle = 0 uniquement)
    if (angle === 0 && doorOpenings.length > 0) {
      for (const door of doorOpenings) {
        const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        if (L < 1) continue;
        const dirX = dx / L, dirY = dy / L;
        const perpX = -dirY, perpY = dirX;
        const halfGap = wallThickness;
        let ri = 0;
        for (let y = startY - stepY; y < endY + stepY; y += stepY) {
          const rowStagger = (ri % 2) * (stepX * staggerRatio);
          for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
            const corners = [
              { x, y }, { x: x + width, y },
              { x: x + width, y: y + height }, { x, y: y + height },
            ];
            const fits = corners.every((c) => {
              const t = (c.x - door.from.x) * dirX + (c.y - door.from.y) * dirY;
              const s = (c.x - door.from.x) * perpX + (c.y - door.from.y) * perpY;
              return t >= 0 && t <= L && Math.abs(s) <= halfGap;
            });
            if (fits) {
              const id = `door-${x.toFixed(0)}-${y.toFixed(0)}`;
              if (!tiles.some((t) => t.id === id)) {
                tiles.push({ id, rect: { x, y, w: width, h: height }, type: 'WHOLE' as const });
              }
            }
          }
          ri++;
        }
      }
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
    // CHEVRON
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

        if (bestType === 'CUT') {
          const allInUnion = pts.every((p) => testRooms.some(({ testPoints }) => pointInPolygon(p, testPoints)));
          if (allInUnion) {
            const ptEdges = pts.map((p, i) => [p, pts[(i + 1) % pts.length]!] as [Point, Point]);
            const wallCuts = testRooms.some(({ testPoints, edges }) =>
              edges.some((et, i) => {
                if (et === 'DOOR') return false;
                const p1 = testPoints[i]!;
                const p2 = testPoints[(i + 1) % testPoints.length]!;
                return ptEdges.some((te) => !!getIntersection(te[0], te[1], p1, p2));
              }),
            );
            if (!wallCuts) bestType = 'WHOLE';
          }
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

  const allExcludedZones = valid.flatMap((r) => r.excludedZones ?? []);
  const allPartitionPolygons = valid.flatMap((r) =>
    (r.partitions ?? []).map(partitionToPolygon).filter((p) => p.length >= 3),
  );

  // Net area for statistics
  const totalRoomArea = valid.reduce((sum, r) => sum + getPolygonArea(insetRoomPolygon(r, wallThickness)), 0);
  const excArea =
    allExcludedZones.reduce((s, z) => s + getPolygonArea(z.points), 0) +
    allPartitionPolygons.reduce((s, p) => s + getPolygonArea(p), 0);
  const netArea = Math.max(0, totalRoomArea - excArea);

  const finalTiles = filterExcluded(tiles, allExcludedZones, allPartitionPolygons, angle, centerX, centerY);
  return { tiles: finalTiles, stats: computeStats(finalTiles, netArea, width, height) };
};
