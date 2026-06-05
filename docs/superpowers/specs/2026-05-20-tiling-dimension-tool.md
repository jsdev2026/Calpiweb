# Outil de Côte Interactif (Tiling) — Design Spec

**Date:** 2026-05-20
**Status:** Approved

## Problem

The existing dimension system in the tiling canvas is static and auto-computed: it shows left/right/top/bottom tile cut sizes that are often unwanted, unreadable, and not ergonomic. There is no way to place a custom dimension, and the displayed cotes cannot be controlled by the user.

## Goal

Replace the auto-computed tile-cut dimension lines with a manual dimension placement tool. The user activates a "Cote" tool, clicks two snap points on the canvas, and a dimension line is placed and persisted in the project. Room total width/height dimensions are kept. Snap targets include interior wall face vertices/edges and tile corners/edges. Dimensions are constrained to H, V, or parallel to the nearest wall — never oblique.

## Architecture

Five new files handle the feature in isolated layers: a type definition, a pure snap utility (testable), a hook (state machine), a rendering layer, and unit tests. Four existing files are modified minimally. The `TilingDimensionLayer` is an SVG `<g>` rendered inside `TilingCanvas`'s existing SVG, sharing its coordinate space. `TilingCanvas` receives an `activeTool` prop and disables pan/zoom handlers when the dimension tool is active.

## Data Model

### `src/types/tilingDimension.ts` (new)

```ts
import type { Point } from '@/types/plan';

export type DimDirection = 'H' | 'V' | 'parallel';

export interface TilingDimension {
  id: string;
  p1: Point;             // world-space coordinates of first snap point
  p2: Point;             // world-space coordinates of second snap point
  direction: DimDirection;
  parallelAngle?: number; // degrees, only when direction === 'parallel'
  perpOffset: number;    // signed world-space offset for the dim line (positive = above/left of p1→p2)
}
```

### `src/types/project.ts`

Add to `Project` interface:
```ts
tilingDimensions?: TilingDimension[];
```

### `src/store/projectStore.ts`

Add two actions:
```ts
addTilingDimension: (dim: TilingDimension) => void;
removeTilingDimension: (id: string) => void;
```

Implementations use `updateActive`:
```ts
addTilingDimension: (dim) => get().updateActive((p) => ({
  ...p,
  tilingDimensions: [...(p.tilingDimensions ?? []), dim],
})),
removeTilingDimension: (id) => get().updateActive((p) => ({
  ...p,
  tilingDimensions: (p.tilingDimensions ?? []).filter((d) => d.id !== id),
})),
```

## Snap Computation

### `src/engine/tiling/snapTiling.ts` (new)

```ts
export interface SnapResult {
  point: Point;
  kind: 'wall-vertex' | 'wall-midpoint' | 'tile-corner' | 'tile-midpoint';
}

export function snapToTiling(
  worldPt: Point,
  rooms: Room[],
  tiles: Tile[],
  wallThickness: number,
  scale: number,
): SnapResult | null
```

**Snap radius:** `15 / scale` world-space units (15 pixels on screen).

**Targets, by priority (first match wins):**

| Priority | Kind | Source |
|---|---|---|
| 1 | `wall-vertex` | Vertices of `insetRoomPolygon(room, wallThickness)` for each room |
| 2 | `wall-midpoint` | Midpoints of each edge of `insetRoomPolygon` |
| 3 | `tile-corner` | Four corners of each `tile.rect` |
| 4 | `tile-midpoint` | Four edge midpoints of each `tile.rect` |

Returns `null` when no target is within snap radius.

### Direction logic

**Auto-detection** (while moving from p1 to cursor): `|dx| > |dy|` → `'H'`, else `'V'`.

**Ctrl cycling order:** `'H'` → `'V'` → `'parallel'` → `'H'`.

**`'parallel'` angle:** find the interior wall edge (from `insetRoomPolygon`) whose midpoint is closest to `p1`; use `Math.atan2(dy, dx)` of that edge as `parallelAngle`. The dimension measures the scalar projection of `p2 - p1` onto the unit vector at that angle.

### `src/engine/tiling/snapTiling.test.ts` (new)

Unit tests covering:
- Returns `null` when no point within snap radius
- Prefers `wall-vertex` over `tile-corner` when both in range
- Returns `tile-corner` when only tile targets in range
- `parallelAngle` matches nearest wall edge direction

## Hook

### `src/hooks/useTilingDimension.ts` (new)

**State machine:**

```
idle → picking_start → picking_end → idle
```

- **`idle`**: no-op; all pointer events pass through to TilingCanvas pan/zoom
- **`picking_start`**: pointerMove → compute snap candidate, store as `hoverSnap`; click → set `p1 = hoverSnap.point`, advance to `picking_end`
- **`picking_end`**: pointerMove → compute snap candidate, store as `hoverSnap`, compute preview direction; Ctrl+click or Ctrl held → cycle `pendingDirection`; click → set `p2`, compute `perpOffset`, call `addTilingDimension`, return to `idle`; Escape → return to `idle`

**`perpOffset` auto-computation:** project the center of all room bounding boxes onto the perpendicular of the dim line; choose the sign that places the dim line on the opposite side.

**Hook returns:**
```ts
{
  hoverSnap: SnapResult | null;
  preview: { p1: Point; p2: Point; direction: DimDirection; parallelAngle?: number } | null;
  onPointerMove: (worldPt: Point) => void;
  onClick: (worldPt: Point, ctrlHeld: boolean) => void;
  onContextMenu: (dimId: string) => void; // calls removeTilingDimension
}
```

## Rendering

### `src/components/tiling/TilingDimensionLayer.tsx` (new)

SVG `<g>` component rendered inside `TilingCanvas`'s `<g transform={translate/scale}>`. Receives world-space coordinates directly; no coordinate transform needed.

**Renders:**
1. **Snap indicators** (when `activeTool === 'dimension'`): small circle at `hoverSnap.point`, radius `40` world units, stroke emerald, fill none
2. **Preview dimension** (during `picking_end`): `DimLine` rendered at 60% opacity using preview `p1`/`p2` projected by direction
3. **Placed dimensions**: one `DimLine` per `TilingDimension` in `project.tilingDimensions`; each has `onContextMenu` handler for deletion

**DimLine projection per direction:**
- `'H'`: render from `(p1.x, p1.y)` to `(p2.x, p1.y)` — label = `formatCm(|p2.x - p1.x|)`
- `'V'`: render from `(p1.x, p1.y)` to `(p1.x, p2.y)` — label = `formatCm(|p2.y - p1.y|)`
- `'parallel'`: render from `p1` to `p1 + projection * unitVec(parallelAngle)` where `projection = (p2-p1)·unitVec(parallelAngle)` — label = `formatCm(|projection|)`

Reuses the existing `DimLine` component from `TilingCanvas.tsx` (extracted to its own file or kept as a shared internal).

## Changes to Existing Files

### `src/components/tiling/TilingCanvas.tsx`

1. Add `activeTool: 'pan' | 'dimension'` prop
2. Add `dimensionLayer: React.ReactNode` prop (rendered as last child inside the main `<g transform>`)
3. When `activeTool === 'dimension'`: the SVG's `onPointerDown`, `onPointerMove`, `onPointerUp` are replaced with no-ops (pan/zoom disabled)
4. **Remove** the auto-computed tile-cut DimLines (left/right/top/bottom cuts — lines 261–296)
5. **Keep** room total width and height DimLines (lines 248–260)

### `src/components/tiling/TilingEditor.tsx`

1. Add `activeTool` state: `const [activeTool, setActiveTool] = useState<'pan' | 'dimension'>('pan')`
2. Instantiate `useTilingDimension` hook
3. Construct `<TilingDimensionLayer>` and pass as `dimensionLayer` prop to `TilingCanvas`
4. Convert pointer events from screen space to world space before passing to hook handlers:
   - World coordinate = `(screenPt - pan) / scale`
5. Pass `activeTool` to `TilingCanvas` and `TilingControls`

### `src/components/tiling/TilingControls.tsx`

Add a Ruler button (lucide-react `Ruler` icon) that toggles `activeTool` between `'pan'` and `'dimension'`. Styled consistently with existing tool buttons; highlighted when active.

## Out of Scope

- Editing a placed dimension's direction or offset after placement (delete and re-place instead)
- Snap to partition vertices/edges (only interior wall face and tile grid)
- Dimension labels in tile units (only cm)
- Undo/redo for dimension placement (uses the existing project store undo if available, otherwise not handled specially)
- Dimensions for HERRINGBONE or CHEVRON layouts (the tool works on all layouts but auto-direction detection is most useful for STRAIGHT)
