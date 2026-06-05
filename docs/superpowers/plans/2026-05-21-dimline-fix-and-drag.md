# DimLine Fix, Scale-Invariant Rendering & Drag-to-Move — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the room-edge badge fallback to show interior distances, redesign DimLine for scale-invariant rendering with a subtle translucent label 8 px above the line, and let users drag placed dimension lines to adjust their perpendicular offset.

**Architecture:** Four files are modified. The store gains one new action (`updateTilingDimensionPerpOffset`). `DimLine` is rewritten for scale-invariant pixel sizes. `TilingDimensionLayer` grows `scale`, `livePerpOverride`, and `onDimDragStart` props. `TilingEditor` adds drag state and wires everything together.

**Tech Stack:** TypeScript, React 18, SVG, Zustand, Vitest.

---

## File Structure

| Action | File | Change |
|--------|------|--------|
| Modify | `src/store/projectStore.ts` | Add `updateTilingDimensionPerpOffset` action |
| Modify | `src/components/plan/DrawingCanvas.tsx` | Apply fallback interior offset to room-edge badge |
| Modify | `src/components/tiling/DimLine.tsx` | Scale-invariant sizes, translucent pill 8 px above line, drag cursor |
| Modify | `src/components/tiling/TilingDimensionLayer.tsx` | Add `scale`, `livePerpOverride`, `onDimDragStart` props |
| Modify | `src/components/tiling/TilingEditor.tsx` | Drag state, pointer capture, live + committed perp |

---

### Task 1: Store action — `updateTilingDimensionPerpOffset`

**Files:**
- Modify: `src/store/projectStore.ts:108-111` (interface) and `src/store/projectStore.ts:358-366` (implementation)

#### Background

The store currently has `addTilingDimension` and `removeTilingDimension`. We need a third action to mutate `perpOffset` of an existing dimension in place. The action follows the same `updateActive` pattern as its siblings.

- [ ] **Step 1: Add the action to the interface**

In `src/store/projectStore.ts`, find the tiling dimension actions block (lines 108–110):
```ts
  // Tiling dimension actions
  addTilingDimension: (dim: TilingDimension) => void;
  removeTilingDimension: (id: string) => void;
```

Replace with:
```ts
  // Tiling dimension actions
  addTilingDimension: (dim: TilingDimension) => void;
  removeTilingDimension: (id: string) => void;
  updateTilingDimensionPerpOffset: (id: string, perpOffset: number) => void;
```

- [ ] **Step 2: Add the implementation**

In `src/store/projectStore.ts`, find the `removeTilingDimension` implementation (lines 363–366):
```ts
  removeTilingDimension: (id) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).filter((d) => d.id !== id),
  })),
```

Add immediately after it (before the closing `}));`):
```ts
  updateTilingDimensionPerpOffset: (id, perpOffset) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
      d.id === id ? { ...d, perpOffset } : d,
    ),
  })),
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/store/projectStore.ts
git commit -m "feat(tiling): add updateTilingDimensionPerpOffset store action

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Badge fallback fix — DrawingCanvas

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:407-412`
- Create: `src/components/plan/DrawingCanvas.badge-fallback.test.ts`

#### Background

`constraintInteriorOffset` is already imported in `DrawingCanvas.tsx`. The badge loop already computes `hOffset`/`vOffset` for constrained edges (lines 407–408), but the fallback branch (no H/V/LENGTH constraint) still renders `formatCm(edgeLen)` — the raw centerline distance. Variables `dxE` and `dyE` (edge direction, line 400) are already in scope and give us the edge orientation.

- [ ] **Step 1: Write the failing test**

Create `src/components/plan/DrawingCanvas.badge-fallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { Room } from '@/types/project';

describe('DrawingCanvas badge fallback offset', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };

  it('horizontal edge (dxE > dyE) → fallbackType H_DISTANCE, offset = 100', () => {
    // bottom edge: dxE=3000, dyE=0 → |dxE|>=|dyE| → H_DISTANCE
    const dxE = 3000, dyE = 0;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    expect(fallbackType).toBe('H_DISTANCE');
    const offset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] },
      room, 100,
    );
    expect(offset).toBe(100);
  });

  it('vertical edge (dyE > dxE) → fallbackType V_DISTANCE, offset = 100', () => {
    // right edge: dxE=0, dyE=4000 → |dyE|>|dxE| → V_DISTANCE
    const dxE = 0, dyE = 4000;
    const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
    expect(fallbackType).toBe('V_DISTANCE');
    const offset = constraintInteriorOffset(
      { id: '', type: fallbackType, pts: [{ roomId: 'r1', vertexIdx: 1 }, { roomId: 'r1', vertexIdx: 2 }] },
      room, 100,
    );
    expect(offset).toBe(100);
  });

  it('badge displays edgeLen minus fallback offset', () => {
    const edgeLen = 3000;
    const fallbackOffset = 100;
    expect(edgeLen - fallbackOffset).toBe(2900);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (pure logic, no component needed)

```bash
npm run test -- --run src/components/plan/DrawingCanvas.badge-fallback.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 3: Apply the fix in DrawingCanvas.tsx**

In `src/components/plan/DrawingCanvas.tsx`, find lines 407–412:

```ts
                const hOffset = hDistC ? constraintInteriorOffset(hDistC, room, wallThickness) : 0;
                const vOffset = vDistC ? constraintInteriorOffset(vDistC, room, wallThickness) : 0;
                const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value - hOffset)
                  : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value - vOffset)
                  : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
                  : formatCm(edgeLen);
```

Replace with:

```ts
                const hOffset = hDistC ? constraintInteriorOffset(hDistC, room, wallThickness) : 0;
                const vOffset = vDistC ? constraintInteriorOffset(vDistC, room, wallThickness) : 0;
                const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
                const fallbackOffset = constraintInteriorOffset(
                  { id: '', type: fallbackType, pts: [{ roomId: room.id, vertexIdx: i }, { roomId: room.id, vertexIdx: (i + 1) % pts.length }] },
                  room, wallThickness,
                );
                const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value - hOffset)
                  : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value - vOffset)
                  : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
                  : formatCm(edgeLen - fallbackOffset);
```

Note: `dxE`, `dyE`, `pts`, `i`, `room`, `wallThickness` are all already in scope in this block.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Run all tests**

```bash
npm run test -- --run
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/components/plan/DrawingCanvas.tsx src/components/plan/DrawingCanvas.badge-fallback.test.ts
git commit -m "fix(plan): apply interior offset to room-edge badge fallback

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: DimLine — scale-invariant rendering

**Files:**
- Modify: `src/components/tiling/DimLine.tsx` (full rewrite)

#### Background

The current component uses fixed world-space constants (`GAP = 60`, `OVER = 130`, `AL = min(180, len*0.2)`, font 138, pill 540×220). These scale with the SVG transform, so they look different at each zoom level. The fix: accept a `scale` prop and divide all pixel-target constants by `scale`, producing world units that render at constant screen size. The label moves 8 screen-pixels above the dim line, uses a translucent white pill without border, grey text.

- [ ] **Step 1: Rewrite DimLine.tsx**

Replace the entire content of `src/components/tiling/DimLine.tsx` with:

```tsx
'use client';

import type { MouseEvent, PointerEvent } from 'react';

interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  scale?: number;
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (e: PointerEvent<SVGGElement>) => void;
}

export const DimLine = ({
  x1, y1, x2, y2, label,
  perpOffset = 500, scale = 1,
  onContextMenu, onPointerDown,
}: DimLineProps) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return null;

  const ux = dx / len, uy = dy / len;   // unit tangent
  const nx = -dy / len, ny = dx / len;  // left normal

  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;

  const perpSign = perpOffset >= 0 ? 1 : -1;
  const absPerp = Math.abs(perpOffset);
  const enx = nx * perpSign, eny = ny * perpSign;

  // All sizes in screen-pixels / scale = world units that render at constant px size
  const S = scale;
  const ARROW_L  = 12 / S;
  const ARROW_W  = 6  / S;
  const EXT_GAP  = 6  / S;
  const EXT_OVER = 8  / S;
  const FONT_PX  = 12 / S;
  const PILL_H   = 20 / S;
  const PILL_W   = (label.length * 7.5 + 16) / S;
  const LABEL_GAP = 8 / S;

  const a1 = `${dlx1},${dly1} ${dlx1 + ARROW_L*ux + ARROW_W*nx},${dly1 + ARROW_L*uy + ARROW_W*ny} ${dlx1 + ARROW_L*ux - ARROW_W*nx},${dly1 + ARROW_L*uy - ARROW_W*ny}`;
  const a2 = `${dlx2},${dly2} ${dlx2 - ARROW_L*ux + ARROW_W*nx},${dly2 - ARROW_L*uy + ARROW_W*ny} ${dlx2 - ARROW_L*ux - ARROW_W*nx},${dly2 - ARROW_L*uy - ARROW_W*ny}`;

  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;

  // Label centre: 8 screen-px above dim line, away from measured segment
  const labelOffset = LABEL_GAP + PILL_H / 2;
  const lx = midX + nx * perpSign * labelOffset;
  const ly = midY + ny * perpSign * labelOffset;

  return (
    <g
      className={onPointerDown ? 'cursor-grab' : onContextMenu ? undefined : 'pointer-events-none'}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
      {/* Extension lines */}
      <line
        x1={x1 + enx * EXT_GAP} y1={y1 + eny * EXT_GAP}
        x2={x1 + enx * (absPerp + EXT_OVER)} y2={y1 + eny * (absPerp + EXT_OVER)}
        stroke="#94a3b8" strokeWidth={1 / S}
      />
      <line
        x1={x2 + enx * EXT_GAP} y1={y2 + eny * EXT_GAP}
        x2={x2 + enx * (absPerp + EXT_OVER)} y2={y2 + eny * (absPerp + EXT_OVER)}
        stroke="#94a3b8" strokeWidth={1 / S}
      />
      {/* Dim line between arrowhead bases */}
      {len > 2 * ARROW_L && (
        <line
          x1={dlx1 + ARROW_L * ux} y1={dly1 + ARROW_L * uy}
          x2={dlx2 - ARROW_L * ux} y2={dly2 - ARROW_L * uy}
          stroke="#f97316" strokeWidth={2 / S}
        />
      )}
      {/* Arrowheads */}
      <polygon points={a1} fill="#f97316" />
      <polygon points={a2} fill="#f97316" />
      {/* Label: translucent pill, 8 px above dim line */}
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
    </g>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors (TilingCanvas and TilingDimensionLayer pass no `scale` yet — that's fine, default is 1)

- [ ] **Step 3: Run all tests**

```bash
npm run test -- --run
```
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/components/tiling/DimLine.tsx
git commit -m "feat(tiling): scale-invariant DimLine with translucent label above line

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Wire scale + drag through TilingDimensionLayer and TilingEditor

**Files:**
- Modify: `src/components/tiling/TilingDimensionLayer.tsx`
- Modify: `src/components/tiling/TilingEditor.tsx`

#### Background

`TilingEditor` already holds `scale` (line 27) and `pan` (line 28) state, and constructs `TilingDimensionLayer` inline (lines 87–95). After this task, `TilingDimensionLayer` forwards `scale` to every `DimLine`, accepts `livePerpOverride` for the dragged dim, and calls `onDimDragStart` when a dim's `onPointerDown` fires. `TilingEditor` adds drag state and commits `updateTilingDimensionPerpOffset` on pointer-up.

#### 4A — Rewrite TilingDimensionLayer.tsx

- [ ] **Step 1: Replace TilingDimensionLayer.tsx**

Replace the entire content of `src/components/tiling/TilingDimensionLayer.tsx` with:

```tsx
'use client';

import type { MouseEvent, PointerEvent } from 'react';
import type { TilingDimension, DimDirection } from '@/types/tilingDimension';
import type { Point } from '@/types/plan';
import type { SnapResult } from '@/engine/tiling/snapTiling';
import type { DimPreview } from '@/hooks/useTilingDimension';
import { formatCm } from '@/utils/formatters';
import { DimLine } from './DimLine';

interface TilingDimensionLayerProps {
  activeTool: 'pan' | 'dimension';
  dimensions: TilingDimension[];
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  scale: number;
  livePerpOverride: { id: string; perpOffset: number } | null;
  onContextMenu: (dimId: string) => void;
  onDimDragStart: (
    id: string,
    nx: number, ny: number,
    startPerp: number,
    e: PointerEvent<SVGGElement>,
  ) => void;
}

interface ProjectedDim {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset: number;
}

function projectDim(
  p1: Point,
  p2: Point,
  direction: DimDirection,
  parallelAngle: number | undefined,
  perpOffset: number,
): ProjectedDim {
  if (direction === 'H') {
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, label: formatCm(Math.abs(p2.x - p1.x)), perpOffset };
  }
  if (direction === 'V') {
    return { x1: p1.x, y1: p1.y, x2: p1.x, y2: p2.y, label: formatCm(Math.abs(p2.y - p1.y)), perpOffset };
  }
  const angle = parallelAngle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const proj = (p2.x - p1.x) * cos + (p2.y - p1.y) * sin;
  return {
    x1: p1.x, y1: p1.y,
    x2: p1.x + proj * cos, y2: p1.y + proj * sin,
    label: formatCm(Math.abs(proj)),
    perpOffset,
  };
}

function hasLength(pd: ProjectedDim): boolean {
  return Math.hypot(pd.x2 - pd.x1, pd.y2 - pd.y1) >= 10;
}

export const TilingDimensionLayer = ({
  activeTool,
  dimensions,
  hoverSnap,
  preview,
  scale,
  livePerpOverride,
  onContextMenu,
  onDimDragStart,
}: TilingDimensionLayerProps) => {
  return (
    <g>
      {/* Snap indicator */}
      {activeTool === 'dimension' && hoverSnap && (
        <circle
          cx={hoverSnap.point.x}
          cy={hoverSnap.point.y}
          r={40 / scale}
          stroke="#10b981"
          strokeWidth={20 / scale}
          fill="none"
          className="pointer-events-none"
        />
      )}

      {/* Preview dimension (during picking_end) */}
      {preview && (() => {
        const pd = projectDim(preview.p1, preview.p2, preview.direction, preview.parallelAngle, preview.perpOffset);
        if (!hasLength(pd)) return null;
        return (
          <g className="pointer-events-none" opacity={0.6}>
            <DimLine x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2} label={pd.label} perpOffset={pd.perpOffset} scale={scale} />
          </g>
        );
      })()}

      {/* Placed dimensions */}
      {dimensions.map((dim) => {
        const effectivePerp = livePerpOverride?.id === dim.id ? livePerpOverride.perpOffset : dim.perpOffset;
        const pd = projectDim(dim.p1, dim.p2, dim.direction, dim.parallelAngle, effectivePerp);
        if (!hasLength(pd)) return null;
        return (
          <DimLine
            key={dim.id}
            x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2}
            label={pd.label}
            perpOffset={effectivePerp}
            scale={scale}
            onContextMenu={(e: MouseEvent<SVGGElement>) => {
              e.preventDefault();
              onContextMenu(dim.id);
            }}
            onPointerDown={(e: PointerEvent<SVGGElement>) => {
              e.stopPropagation();
              const { x1, y1, x2, y2 } = pd;
              const segLen = Math.hypot(x2 - x1, y2 - y1);
              if (segLen < 1) return;
              const snx = -(y2 - y1) / segLen;
              const sny =  (x2 - x1) / segLen;
              onDimDragStart(dim.id, snx, sny, effectivePerp, e);
            }}
          />
        );
      })}
    </g>
  );
};
```

Note: the snap indicator circle radius and stroke are also made scale-invariant (`40 / scale`, `20 / scale`).

- [ ] **Step 2: Typecheck** (will fail because TilingEditor hasn't been updated yet)

```bash
npm run typecheck 2>&1 | grep -i "error"
```
Expected: TypeScript errors about missing props `scale`, `livePerpOverride`, `onDimDragStart` in TilingEditor — that's expected, proceed to 4B.

#### 4B — Update TilingEditor.tsx

- [ ] **Step 3: Add store action subscription**

In `src/components/tiling/TilingEditor.tsx`, find line 83:
```ts
  const dimensions = useProjectStore((s) => selectActiveProject(s)?.tilingDimensions ?? []);
```

Add the new action subscription immediately after it:
```ts
  const updateTilingDimensionPerpOffset = useProjectStore((s) => s.updateTilingDimensionPerpOffset);
```

- [ ] **Step 4: Add drag state**

In `src/components/tiling/TilingEditor.tsx`, find the existing state declarations (around lines 27–32):
```ts
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTool, setActiveTool] = useState<'pan' | 'dimension'>('pan');
  const [mobileTab, setMobileTab] = useState<'apercu' | 'reglages'>('apercu');
```

Add two new state declarations after `mobileTab`:
```ts
  const [dimDrag, setDimDrag] = useState<{
    id: string; nx: number; ny: number;
    startPerp: number; startMX: number; startMY: number;
  } | null>(null);
  const [livePerpOverride, setLivePerpOverride] = useState<{ id: string; perpOffset: number } | null>(null);
```

- [ ] **Step 5: Add `handleDimDragStart`**

In `src/components/tiling/TilingEditor.tsx`, find `const handlePointerDown = ` (line 149). Add a new function immediately before it:

```ts
  const handleDimDragStart = (
    id: string, nx: number, ny: number, startPerp: number,
    e: React.PointerEvent<SVGGElement>,
  ) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    const world = toWorld(e);
    if (!world) return;
    setDimDrag({ id, nx, ny, startPerp, startMX: world.x, startMY: world.y });
    setLivePerpOverride({ id, perpOffset: startPerp });
  };
```

- [ ] **Step 6: Update `handlePointerMove` to handle drag first**

Find `handlePointerMove` (lines 154–161):
```ts
  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool === 'dimension') {
      const pt = toWorld(e);
      if (pt) dimHook.onPointerMove(pt);
      return;
    }
    if (isDragging) setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
  };
```

Replace with:
```ts
  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dimDrag) {
      const world = toWorld(e);
      if (!world) return;
      const delta = (world.x - dimDrag.startMX) * dimDrag.nx
                  + (world.y - dimDrag.startMY) * dimDrag.ny;
      setLivePerpOverride({ id: dimDrag.id, perpOffset: dimDrag.startPerp + delta });
      return;
    }
    if (activeTool === 'dimension') {
      const pt = toWorld(e);
      if (pt) dimHook.onPointerMove(pt);
      return;
    }
    if (isDragging) setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
  };
```

- [ ] **Step 7: Update `handlePointerUp` to commit drag**

Find `handlePointerUp` (lines 163–166):
```ts
  const handlePointerUp = () => {
    if (activeTool === 'dimension') return;
    setIsDragging(false);
  };
```

Replace with:
```ts
  const handlePointerUp = () => {
    if (dimDrag) {
      if (livePerpOverride) {
        updateTilingDimensionPerpOffset(dimDrag.id, livePerpOverride.perpOffset);
      }
      setDimDrag(null);
      setLivePerpOverride(null);
      return;
    }
    if (activeTool === 'dimension') return;
    setIsDragging(false);
  };
```

- [ ] **Step 8: Pass new props to TilingDimensionLayer**

Find the `dimensionLayer` constant (lines 87–95):
```ts
  const dimensionLayer = (
    <TilingDimensionLayer
      activeTool={activeTool}
      dimensions={dimensions}
      hoverSnap={dimHook.hoverSnap}
      preview={dimHook.preview}
      onContextMenu={dimHook.onContextMenu}
    />
  );
```

Replace with:
```ts
  const dimensionLayer = (
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
  );
```

- [ ] **Step 9: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 10: Run all tests**

```bash
npm run test -- --run
```
Expected: all pass

- [ ] **Step 11: Commit**

```bash
git add src/components/tiling/TilingDimensionLayer.tsx src/components/tiling/TilingEditor.tsx
git commit -m "feat(tiling): scale-invariant DimLayer and drag-to-move perpOffset

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
