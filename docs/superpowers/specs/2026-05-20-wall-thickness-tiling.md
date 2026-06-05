# Wall Thickness Awareness in Tile Cuts — Design Spec

**Date:** 2026-05-20
**Status:** Approved

## Problem

Room polygons are defined at wall centerlines. The tiling engine uses these centerline polygons directly, so tile cuts land at the wall center instead of the wall face. For a 9 mm wall, each cut is off by ~4.5 mm. The canvas also draws the room outline at the centerline rather than the interior face.

## Goal

Tile computation and the room outline visual both operate on the wall interior face — the polygon inset by half each wall's thickness.

## Architecture

A new pure function `insetRoomPolygon(room, defaultThickness): Point[]` in `src/engine/geometry/polygon.ts` offsets each room edge inward by `edgeThicknesses[i] / 2` (or `defaultThickness / 2` when no per-edge override exists) and recomputes each vertex as the intersection of its two adjacent offset edges.

This function is applied in three places:
- `computeTilingMultiRoom` (tile generation and clipping)
- `tileSpaceRooms` inside `analyzeQuantities` (cut table geometry)
- `TilingCanvas` room outline drawing

`wallThickness` is added as a third parameter to `computeTilingMultiRoom` and `analyzeQuantities`; `TilingEditor` already holds `wallThickness` and passes it through.

Partitions are unaffected: `partitionToPolygon` already expands `± thickness/2` from centerline endpoints, producing the exact partition body (face-to-face). No change needed.

## Changes

### `src/engine/geometry/polygon.ts`

Add:

```ts
export function insetRoomPolygon(room: Room, defaultThickness: number): Point[] {
  const pts = room.points;
  const n = pts.length;
  if (n < 3) return pts;

  // For each edge, compute the inward-offset edge
  const offsetEdges: { p1: Point; p2: Point }[] = pts.map((p, i) => {
    const next = pts[(i + 1) % n]!;
    const t = room.edgeThicknesses?.[i] ?? defaultThickness;
    const inset = t / 2;
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return { p1: p, p2: next };
    // Inward normal (assuming CCW polygon: inward is to the right of the edge direction)
    const nx = (dy / len) * inset;
    const ny = (-dx / len) * inset;
    return { p1: { x: p.x + nx, y: p.y + ny }, p2: { x: next.x + nx, y: next.y + ny } };
  });

  // Recompute each vertex as intersection of adjacent offset edges
  return offsetEdges.map((edge, i) => {
    const prev = offsetEdges[(i + n - 1) % n]!;
    const inter = getIntersection(prev.p1, prev.p2, edge.p1, edge.p2);
    return inter ?? edge.p1;
  });
}
```

Requires `Room` import from `@/types/project` (add if not already present).

### `src/engine/tiling/tilingEngine.ts`

1. Add `wallThickness: number` parameter to `computeTilingMultiRoom`
2. Import `insetRoomPolygon` from `@/engine/geometry/polygon`
3. Replace all uses of `r.points` (room polygon) with `insetRoomPolygon(r, wallThickness)` when building tile grids and clipping masks
4. Single-room path (`computeTiling` call): pass inset points instead of `valid[0]!.points`

### `src/engine/quantities/quantityEngine.ts`

1. Add `wallThickness: number` parameter to `analyzeQuantities`
2. Add `wallThickness: number` parameter to `tileSpaceRooms`
3. In `tileSpaceRooms`: replace `r.points` with `insetRoomPolygon(r, wallThickness)`
4. Thread `wallThickness` through: `computeTilingMultiRoom(rooms, config, wallThickness)` and `tileSpaceRooms(validRooms, config.angle, cx, cy, wallThickness)`

### `src/components/tiling/TilingEditor.tsx`

Replace:
```ts
const result = useMemo(() => analyzeQuantities(rooms, config), [rooms, config]);
```
With:
```ts
const result = useMemo(() => analyzeQuantities(rooms, config, wallThickness), [rooms, config, wallThickness]);
```

### `src/components/tiling/TilingCanvas.tsx`

1. Import `insetRoomPolygon` from `@/engine/geometry/polygon`
2. Replace `room.points` with `insetRoomPolygon(room, wallThickness)` in the two places that draw the room outline (SVG path and polygon element)

## Out of Scope

- `partitionToPolygon` — no change needed
- `computeTiling` (single-room internal function) — receives inset points from `computeTilingMultiRoom`, no signature change
- Excluded zones (`excludedZones`) — these are already defined as interior regions; no inset needed
- Plan editor polygon drawing — separate concern

## Polygon Winding Note

The polygon winding order (CW vs CCW) determines which side "inward" is. The inset normal formula assumes **CCW** (counter-clockwise) room polygons, which is the convention in this codebase (SVG coordinate system: y increases downward, so CCW visually is the standard winding for room outlines). If a room is CW, the inset will expand rather than contract — this is an edge case that does not need to be handled here.
