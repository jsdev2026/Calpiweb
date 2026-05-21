# DimLine : fix badge, rendu épuré et déplacement — Design Spec

**Date:** 2026-05-21
**Status:** Approved

## Problem

Three independent issues affect dimension display:

1. **Badge fallback bug (plan editor)**: room edge badges without an explicit H/V constraint show `edgeLen` (centerline distance) while the edit popup correctly subtracts the interior offset — an inconsistency visible to the user before any click.

2. **DimLine rendering (tiling canvas)**: dimension annotations use fixed world-space sizes, so they scale with zoom — the label pill overflows the font at close zoom and arrows become invisible when zoomed out. No consistent pixel-size on screen.

3. **No drag-to-move**: once a dimension is placed its `perpOffset` is frozen. Users cannot adjust annotation position for readability.

## Goal

- Fix the badge fallback to subtract the interior offset, matching the popup.
- Redesign `DimLine` to maintain constant pixel sizes at all zoom levels (scale-invariant).
- Label style: translucent white pill (no border), 8 px above the dim line.
- Let users drag a placed dimension line perpendicular to its measured segment to adjust `perpOffset`.

## Architecture

Four existing files are modified, one new store action is added. No new files.

### File map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/plan/DrawingCanvas.tsx` | Apply fallback interior offset to room edge badge |
| Modify | `src/components/tiling/DimLine.tsx` | Scale-invariant sizing, new label style, drag cursor |
| Modify | `src/components/tiling/TilingDimensionLayer.tsx` | Propagate `scale`, `onDimDragStart`, `livePerpOverride` |
| Modify | `src/components/tiling/TilingEditor.tsx` | Drag state, pointer capture, `livePerp` commit |
| Modify | `src/store/projectStore.ts` | New action `updateTilingDimensionPerpOffset` |

---

## Section 1 — Badge fallback fix (`DrawingCanvas.tsx`)

**Location:** room edge badge block, around line 412.

**Current code (line 412):**
```ts
: formatCm(edgeLen);
```

**Fix:** before the `dimVal` ternary, compute a fallback offset based on edge direction:

```ts
const dx = np.x - p.x, dy = np.y - p.y;
const fallbackType = Math.abs(dx) >= Math.abs(dy) ? 'H_DISTANCE' : 'V_DISTANCE';
const fallbackOffset = constraintInteriorOffset(
  { id: '', type: fallbackType, pts: [{ roomId: room.id, vertexIdx: i }, { roomId: room.id, vertexIdx: (i + 1) % room.points.length }] },
  room,
  wallThickness,
);
```

Then replace the fallback line:
```ts
: formatCm(edgeLen - fallbackOffset);
```

`constraintInteriorOffset` is already imported. `dx`/`dy`/`np`/`p` are already in scope in the badge loop.

---

## Section 2 — DimLine redesign (`DimLine.tsx`)

### New props

```ts
interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  scale?: number;                              // NEW — canvas scale, default 1
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (e: PointerEvent<SVGGElement>) => void;  // NEW — drag start
}
```

### Scale-invariant sizes

All constants expressed as **screen pixels / scale** = world units:

```ts
const S = scale ?? 1;
const ARROW_L  = 12 / S;   // arrowhead length
const ARROW_W  = 6  / S;   // arrowhead half-width
const EXT_GAP  = 6  / S;   // extension line start gap
const EXT_OVER = 8  / S;   // extension line overshoot past dim line
const FONT_PX  = 12 / S;   // label font size
const PILL_H   = 20 / S;   // pill height
const LABEL_GAP = 8 / S;   // gap between dim line and label bottom
```

Pill width is dynamic based on label character count:
```ts
const PILL_W = (label.length * 7.5 + 16) / S;
```

### Label position — 8 px above the dim line

The label is no longer centered on the dim line. It is offset in the normal direction (away from the measured segment) by `LABEL_GAP + PILL_H / 2`:

```ts
// perpSign: direction away from measured segment (same sign as perpOffset)
const perpSign = perpOffset >= 0 ? 1 : -1;
const labelOffsetWorld = LABEL_GAP + PILL_H / 2;
const lx = midX + nx * perpSign * labelOffsetWorld;
const ly = midY + ny * perpSign * labelOffsetWorld;
```

Label SVG:
```tsx
<g transform={`translate(${lx}, ${ly}) rotate(${ang})`}>
  <rect
    x={-PILL_W / 2} y={-PILL_H / 2}
    width={PILL_W} height={PILL_H}
    fill="rgba(255,255,255,0.82)" rx={PILL_H / 2}
  />
  <text
    x="0" y="1"
    textAnchor="middle" dominantBaseline="middle"
    fontSize={FONT_PX} fill="#475569" fontWeight="600"
  >
    {label}
  </text>
</g>
```

### Cursor

```tsx
<g
  className={onPointerDown ? 'cursor-grab' : onContextMenu ? undefined : 'pointer-events-none'}
  onContextMenu={onContextMenu}
  onPointerDown={onPointerDown}
>
```

### Arrowheads

Replace current adaptive-cap formula with scale-invariant:

```ts
const a1 = `${dlx1},${dly1} ${dlx1 + ARROW_L*ux + ARROW_W*nx},${dly1 + ARROW_L*uy + ARROW_W*ny} ${dlx1 + ARROW_L*ux - ARROW_W*nx},${dly1 + ARROW_L*uy - ARROW_W*ny}`;
const a2 = `${dlx2},${dly2} ${dlx2 - ARROW_L*ux + ARROW_W*nx},${dly2 - ARROW_L*uy + ARROW_W*ny} ${dlx2 - ARROW_L*ux - ARROW_W*nx},${dly2 - ARROW_L*uy - ARROW_W*ny}`;
```

Dim line between arrowhead bases (only if space remains):
```tsx
{len > 2 * ARROW_L && (
  <line
    x1={dlx1 + ARROW_L * ux} y1={dly1 + ARROW_L * uy}
    x2={dlx2 - ARROW_L * ux} y2={dly2 - ARROW_L * uy}
    stroke="#f97316" strokeWidth={2 / S}
  />
)}
```

Extension lines:
```tsx
<line
  x1={x1 + enx * EXT_GAP} y1={y1 + eny * EXT_GAP}
  x2={x1 + enx * (absPerp + EXT_OVER)} y2={y1 + eny * (absPerp + EXT_OVER)}
  stroke="#94a3b8" strokeWidth={1 / S}
/>
```

---

## Section 3 — Store action (`projectStore.ts`)

Add alongside `removeTilingDimension`:

```ts
updateTilingDimensionPerpOffset: (id: string, perpOffset: number) => void;
```

Implementation:
```ts
updateTilingDimensionPerpOffset: (id, perpOffset) =>
  get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
      d.id === id ? { ...d, perpOffset } : d,
    ),
  })),
```

---

## Section 4 — TilingDimensionLayer (`TilingDimensionLayer.tsx`)

### New props

```ts
interface TilingDimensionLayerProps {
  activeTool: 'pan' | 'dimension';
  dimensions: TilingDimension[];
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  scale: number;                                          // NEW
  livePerpOverride: { id: string; perpOffset: number } | null;  // NEW
  onContextMenu: (dimId: string) => void;
  onDimDragStart: (                                      // NEW
    id: string,
    nx: number, ny: number,
    startPerp: number,
    e: React.PointerEvent<SVGGElement>,
  ) => void;
}
```

### Rendering placed dimensions

When rendering each placed `TilingDimension`, override `perpOffset` with the live value if dragging:

```ts
const effectivePerp =
  livePerpOverride?.id === dim.id ? livePerpOverride.perpOffset : dim.perpOffset;
const pd = projectDim(dim.p1, dim.p2, dim.direction, dim.parallelAngle, effectivePerp);
```

Pass `scale` and `onPointerDown` to each placed `DimLine`:

```tsx
<DimLine
  key={dim.id}
  x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2}
  label={pd.label}
  perpOffset={effectivePerp}
  scale={scale}
  onContextMenu={(e) => { e.preventDefault(); onContextMenu(dim.id); }}
  onPointerDown={(e) => {
    e.stopPropagation();
    const { x1, y1, x2, y2 } = pd;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    onDimDragStart(dim.id, nx, ny, effectivePerp, e);
  }}
/>
```

Also pass `scale` to the preview DimLine.

---

## Section 5 — TilingEditor (`TilingEditor.tsx`)

### New state

```ts
const [dimDrag, setDimDrag] = useState<{
  id: string;
  nx: number; ny: number;
  startPerp: number;
  startMX: number; startMY: number;
} | null>(null);

const [livePerpOverride, setLivePerpOverride] = useState<{
  id: string; perpOffset: number;
} | null>(null);
```

### New store action

```ts
const updateTilingDimensionPerpOffset = useProjectStore((s) => s.updateTilingDimensionPerpOffset);
```

### `onDimDragStart` callback

```ts
const handleDimDragStart = (
  id: string, nx: number, ny: number, startPerp: number,
  e: React.PointerEvent<SVGGElement>,
) => {
  e.preventDefault();
  svgRef.current?.setPointerCapture(e.pointerId);
  const world = toWorld(e);
  setDimDrag({ id, nx, ny, startPerp, startMX: world.x, startMY: world.y });
  setLivePerpOverride({ id, perpOffset: startPerp });
};
```

### `onPointerMove` — drag takes priority

At the top of the existing pointer-move handler (before pan and dimension tool logic):

```ts
if (dimDrag) {
  const world = toWorld(e);
  const delta = (world.x - dimDrag.startMX) * dimDrag.nx
              + (world.y - dimDrag.startMY) * dimDrag.ny;
  setLivePerpOverride({ id: dimDrag.id, perpOffset: dimDrag.startPerp + delta });
  return;
}
```

### `onPointerUp` — commit drag

At the top of the existing pointer-up handler:

```ts
if (dimDrag && livePerpOverride) {
  updateTilingDimensionPerpOffset(dimDrag.id, livePerpOverride.perpOffset);
  setDimDrag(null);
  setLivePerpOverride(null);
  return;
}
```

### Pass new props to TilingDimensionLayer

```tsx
<TilingDimensionLayer
  activeTool={activeTool}
  dimensions={dimensions}
  hoverSnap={dimHook.hoverSnap}
  preview={dimHook.preview}
  scale={scale}
  livePerpOverride={livePerpOverride}
  onContextMenu={dimHook.onContextMenu}
  onDimDragStart={handleDimDragStart}
/>
```

---

## Out of Scope

- Zone and partition badge fix (only room edge badges targeted)
- Label-only drag (the whole annotation moves as one unit)
- Drag snapping (free movement only)
- Undo/redo for drag (relies on existing project store undo if available)
- Touch drag (pointer events cover touch on most browsers, but not explicitly tested)
