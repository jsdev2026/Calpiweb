# Tiling Dimension Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static auto-computed tile-cut dimension lines with a manual interactive dimension placement tool: activate via Ruler button → click two snap points → dimension persisted in project store.

**Architecture:** Five new files (type, snap utility, hook, DimLine component, dimension layer) and minimal changes to four existing files. The `TilingDimensionLayer` renders as an SVG `<g>` inside `TilingCanvas`'s existing coordinate space. `TilingEditor` owns the state machine via `useTilingDimension` and converts screen→world before routing events to the hook.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, Tailwind CSS, lucide-react

---

## File Map

| Status | Path | Responsibility |
|--------|------|----------------|
| Create | `src/types/tilingDimension.ts` | `TilingDimension` and `DimDirection` types |
| Modify | `src/types/project.ts` | Add `tilingDimensions?` to `Project` |
| Modify | `src/store/projectStore.ts` | Add `addTilingDimension` / `removeTilingDimension` actions |
| Create | `src/engine/tiling/snapTiling.ts` | Pure snap + parallel-angle utility |
| Create | `src/engine/tiling/snapTiling.test.ts` | Unit tests |
| Create | `src/hooks/useTilingDimension.ts` | State machine hook |
| Create | `src/components/tiling/DimLine.tsx` | Extracted DimLine component (shared) |
| Modify | `src/components/tiling/TilingCanvas.tsx` | Import DimLine, add props, remove cut dims, render layer |
| Create | `src/components/tiling/TilingDimensionLayer.tsx` | SVG layer: snap indicator, preview, placed dims |
| Modify | `src/components/tiling/TilingEditor.tsx` | Wire hook, route events, Escape handler |

---

### Task 1: Type definitions, Project model, store actions

**Files:**
- Create: `src/types/tilingDimension.ts`
- Modify: `src/types/project.ts`
- Modify: `src/store/projectStore.ts`

- [ ] **Step 1: Create `src/types/tilingDimension.ts`**

```ts
import type { Point } from '@/types/plan';

export type DimDirection = 'H' | 'V' | 'parallel';

export interface TilingDimension {
  id: string;
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
  perpOffset: number;
}
```

- [ ] **Step 2: Add `tilingDimensions?` to `Project` in `src/types/project.ts`**

After line 84 (`notes: ProjectNote[];`), add:
```ts
  tilingDimensions?: TilingDimension[];
```

Also add the import at the top:
```ts
import type { TilingDimension } from './tilingDimension';
```

- [ ] **Step 3: Add actions to `src/store/projectStore.ts`**

Add `TilingDimension` to the import at line 2:
```ts
import type { Project, Room, EdgeType, ProjectStatus, ClientInfo, Constraint, ProjectNote, Partition, ExcludedZone, TilingDimension } from '@/types/project';
```

In the `ProjectState` interface (after the existing `clearPartitionsAndZones` declaration, before the closing `}`), add:
```ts
  addTilingDimension: (dim: TilingDimension) => void;
  removeTilingDimension: (id: string) => void;
```

In the `create` implementation, the new project literal already omits `tilingDimensions` (it's optional — no change needed).

In `migrateProject`, add to the returned object (after `notes` at line ~53):
```ts
    tilingDimensions: p.tilingDimensions as TilingDimension[] | undefined,
```

At the end of the store implementation (after `clearPartitionsAndZones`), add:
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

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/tilingDimension.ts src/types/project.ts src/store/projectStore.ts
git commit -m "feat(tiling): add TilingDimension type, project field, and store actions"
```

---

### Task 2: Snap utility + unit tests (TDD)

**Files:**
- Create: `src/engine/tiling/snapTiling.ts`
- Create: `src/engine/tiling/snapTiling.test.ts`

- [ ] **Step 1: Write the failing tests in `src/engine/tiling/snapTiling.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { snapToTiling, getParallelAngle } from './snapTiling';
import type { Room } from '@/types/project';
import type { Tile } from '@/types/tiling';

const room300: Room = {
  id: 'r1',
  points: [
    { x: 0, y: 0 }, { x: 3000, y: 0 },
    { x: 3000, y: 3000 }, { x: 0, y: 3000 },
  ],
  edges: ['WALL', 'WALL', 'WALL', 'WALL'],
};

const tile100: Tile = {
  id: 't1',
  rect: { x: 500, y: 500, w: 100, h: 100 },
  type: 'WHOLE',
};

describe('snapToTiling', () => {
  it('returns null when no target within snap radius', () => {
    const result = snapToTiling({ x: 9999, y: 9999 }, [room300], [tile100], 0, 1);
    expect(result).toBeNull();
  });

  it('prefers wall-vertex over tile-corner when both in range', () => {
    // With wallThickness=0, insetRoomPolygon returns room300.points unchanged.
    // wall-vertex at (0,0); tile corner also within range at (2, 2) from query.
    // Query at (1, 1) — wall vertex (0,0) is 1.41 away; tile corner (0+500,0+500)=500 away → null for tile.
    // Use tile corner that overlaps with wall vertex proximity:
    const tileNearVertex: Tile = {
      id: 't2',
      rect: { x: 3, y: 3, w: 100, h: 100 },
      type: 'WHOLE',
    };
    // query at (1,1): wall-vertex (0,0) dist=1.41 < snap radius (15/1=15); tile corner (3,3) dist=2.83 < 15.
    // wall-vertex priority wins.
    const result = snapToTiling({ x: 1, y: 1 }, [room300], [tileNearVertex], 0, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('wall-vertex');
  });

  it('returns tile-corner when only tile targets in range', () => {
    // query far from room vertices, close to tile corner
    const result = snapToTiling({ x: 502, y: 502 }, [], [tile100], 0, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('tile-corner');
    expect(result!.point.x).toBeCloseTo(500);
    expect(result!.point.y).toBeCloseTo(500);
  });

  it('returns tile-midpoint when closer than corners', () => {
    // tile100: rect {x:500, y:500, w:100, h:100}
    // top-edge midpoint = (550, 500); query at (552, 500)
    const result = snapToTiling({ x: 552, y: 500 }, [], [tile100], 0, 1);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('tile-midpoint');
    expect(result!.point.x).toBeCloseTo(550);
    expect(result!.point.y).toBeCloseTo(500);
  });
});

describe('getParallelAngle', () => {
  it('returns angle of the nearest wall edge midpoint to the query point', () => {
    // room300 top edge: from (0,0) to (3000,0); angle = atan2(0,3000) = 0
    // query near top edge midpoint (1500, 5)
    const angle = getParallelAngle({ x: 1500, y: 5 }, [room300], 0);
    expect(angle).not.toBeNull();
    // top edge angle = 0 (horizontal right); atan2(0,3000) = 0
    expect(angle).toBeCloseTo(0);
  });

  it('returns null for empty rooms list', () => {
    const angle = getParallelAngle({ x: 0, y: 0 }, [], 0);
    expect(angle).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/tiling/snapTiling.test.ts 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './snapTiling'"

- [ ] **Step 3: Implement `src/engine/tiling/snapTiling.ts`**

```ts
import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { Tile } from '@/types/tiling';
import { insetRoomPolygon } from '@/engine/geometry/polygon';

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
): SnapResult | null {
  const radius = 15 / scale;
  let best: { dist: number; result: SnapResult } | null = null;

  const consider = (pt: Point, kind: SnapResult['kind'], priority: number) => {
    const dist = Math.hypot(pt.x - worldPt.x, pt.y - worldPt.y);
    if (dist > radius) return;
    if (!best || priority < best.dist || (priority === best.dist && dist < best.dist)) {
      best = { dist: priority * 1e9 + dist, result: { point: { x: pt.x, y: pt.y }, kind } };
    }
  };

  // Priority 1: wall-vertex (inset polygon vertices)
  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (const v of poly) {
      consider(v, 'wall-vertex', 1);
    }
  }

  // Priority 2: wall-midpoint (inset polygon edge midpoints)
  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      consider({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 'wall-midpoint', 2);
    }
  }

  // Priority 3: tile-corner (four corners of tile.rect)
  for (const tile of tiles) {
    const { x, y, w, h } = tile.rect;
    for (const pt of [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ]) {
      consider(pt, 'tile-corner', 3);
    }
  }

  // Priority 4: tile-midpoint (four edge midpoints of tile.rect)
  for (const tile of tiles) {
    const { x, y, w, h } = tile.rect;
    for (const pt of [
      { x: x + w / 2, y }, { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h }, { x, y: y + h / 2 },
    ]) {
      consider(pt, 'tile-midpoint', 4);
    }
  }

  return best?.result ?? null;
}

export function getParallelAngle(
  p1: Point,
  rooms: Room[],
  wallThickness: number,
): number | null {
  let bestDist = Infinity;
  let bestAngle: number | null = null;

  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(mid.x - p1.x, mid.y - p1.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestAngle = Math.atan2(b.y - a.y, b.x - a.x);
      }
    }
  }

  return bestAngle;
}
```

Note: The `consider` helper uses `priority * 1e9 + dist` to ensure lower-priority kind candidates never beat higher-priority ones regardless of distance within the snap radius. The `best.dist` comparison is by `priority` first.

Actually the logic above has a bug — let me fix the `consider` helper to use priority correctly:

```ts
  let best: { priority: number; dist: number; result: SnapResult } | null = null;

  const consider = (pt: Point, kind: SnapResult['kind'], priority: number) => {
    const dist = Math.hypot(pt.x - worldPt.x, pt.y - worldPt.y);
    if (dist > radius) return;
    if (
      !best ||
      priority < best.priority ||
      (priority === best.priority && dist < best.dist)
    ) {
      best = { priority, dist, result: { point: { x: pt.x, y: pt.y }, kind } };
    }
  };
```

Use the corrected version with separate `priority` and `dist` fields in the implementation.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/tiling/snapTiling.test.ts 2>&1 | tail -20
```

Expected: 6 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/tiling/snapTiling.ts src/engine/tiling/snapTiling.test.ts
git commit -m "feat(tiling): add snapToTiling and getParallelAngle utilities"
```

---

### Task 3: `useTilingDimension` hook

**Files:**
- Create: `src/hooks/useTilingDimension.ts`

- [ ] **Step 1: Create `src/hooks/useTilingDimension.ts`**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile } from '@/types/tiling';
import type { DimDirection, TilingDimension } from '@/types/tilingDimension';
import { generateId } from '@/utils/id';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { useProjectStore } from '@/store/projectStore';
import { snapToTiling, getParallelAngle } from '@/engine/tiling/snapTiling';
import type { SnapResult } from '@/engine/tiling/snapTiling';

type Phase = 'picking_start' | 'picking_end';
const PERP_OFFSET = 600;
const DIR_CYCLE: DimDirection[] = ['H', 'V', 'parallel'];

export interface DimPreview {
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
}

export function useTilingDimension(
  rooms: Room[],
  tiles: Tile[],
  wallThickness: number,
  scale: number,
  active: boolean,
): {
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  onPointerMove: (worldPt: Point) => void;
  onClick: (worldPt: Point, ctrlHeld: boolean) => void;
  onContextMenu: (dimId: string) => void;
} {
  const addTilingDimension = useProjectStore((s) => s.addTilingDimension);
  const removeTilingDimension = useProjectStore((s) => s.removeTilingDimension);

  const [phase, setPhase] = useState<Phase>('picking_start');
  const [p1, setP1] = useState<Point | null>(null);
  const [hoverSnap, setHoverSnap] = useState<SnapResult | null>(null);
  const [autoDirection, setAutoDirection] = useState<DimDirection>('H');
  const [manualDirection, setManualDirection] = useState<DimDirection | null>(null);

  useEffect(() => {
    if (!active) {
      setPhase('picking_start');
      setP1(null);
      setHoverSnap(null);
      setAutoDirection('H');
      setManualDirection(null);
    }
  }, [active]);

  const effectiveDirection = manualDirection ?? autoDirection;

  const preview: DimPreview | null =
    phase === 'picking_end' && p1 !== null && hoverSnap !== null
      ? {
          p1,
          p2: hoverSnap.point,
          direction: effectiveDirection,
          parallelAngle:
            effectiveDirection === 'parallel'
              ? (getParallelAngle(p1, rooms, wallThickness) ?? 0)
              : undefined,
        }
      : null;

  const onPointerMove = useCallback(
    (worldPt: Point) => {
      if (!active) return;
      const snap = snapToTiling(worldPt, rooms, tiles, wallThickness, scale);
      setHoverSnap(snap);
      if (phase === 'picking_end' && snap && p1 !== null && manualDirection === null) {
        const dx = snap.point.x - p1.x;
        const dy = snap.point.y - p1.y;
        setAutoDirection(Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V');
      }
    },
    [active, rooms, tiles, wallThickness, scale, phase, p1, manualDirection],
  );

  const onClick = useCallback(
    (worldPt: Point, ctrlHeld: boolean) => {
      if (!active) return;
      const snap = snapToTiling(worldPt, rooms, tiles, wallThickness, scale);
      const target = snap?.point ?? worldPt;

      if (phase === 'picking_start') {
        setP1(target);
        setPhase('picking_end');
        setManualDirection(null);
        setAutoDirection('H');
        return;
      }

      // picking_end
      if (ctrlHeld) {
        const current = manualDirection ?? autoDirection;
        const idx = DIR_CYCLE.indexOf(current);
        setManualDirection(DIR_CYCLE[(idx + 1) % DIR_CYCLE.length]!);
        return;
      }

      if (p1 === null) return;
      const dir = manualDirection ?? autoDirection;
      const parallelAngle =
        dir === 'parallel' ? (getParallelAngle(p1, rooms, wallThickness) ?? 0) : undefined;

      // Compute rendered line endpoints
      let rx2: number, ry2: number;
      if (dir === 'H') {
        rx2 = target.x; ry2 = p1.y;
      } else if (dir === 'V') {
        rx2 = p1.x; ry2 = target.y;
      } else {
        const angle = parallelAngle ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const proj = (target.x - p1.x) * cos + (target.y - p1.y) * sin;
        rx2 = p1.x + proj * cos;
        ry2 = p1.y + proj * sin;
      }

      const perpOffset = (() => {
        const dx = rx2 - p1.x;
        const dy = ry2 - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return PERP_OFFSET;
        const nx = -dy / len;
        const ny = dx / len;
        const midX = (p1.x + rx2) / 2;
        const midY = (p1.y + ry2) / 2;
        const validRooms = rooms.filter((r) => r.points.length >= 3);
        if (validRooms.length === 0) return PERP_OFFSET;
        let cx = 0, cy = 0;
        for (const r of validRooms) {
          const bb = getBoundingBox(r.points);
          cx += (bb.minX + bb.maxX) / 2;
          cy += (bb.minY + bb.maxY) / 2;
        }
        cx /= validRooms.length;
        cy /= validRooms.length;
        const dot = (cx - midX) * nx + (cy - midY) * ny;
        return dot > 0 ? -PERP_OFFSET : PERP_OFFSET;
      })();

      const dim: TilingDimension = {
        id: generateId(),
        p1,
        p2: target,
        direction: dir,
        ...(parallelAngle !== undefined ? { parallelAngle } : {}),
        perpOffset,
      };

      addTilingDimension(dim);
      setPhase('picking_start');
      setP1(null);
      setHoverSnap(null);
      setManualDirection(null);
      setAutoDirection('H');
    },
    [active, rooms, tiles, wallThickness, scale, phase, p1, manualDirection, autoDirection, addTilingDimension],
  );

  const onContextMenu = useCallback(
    (dimId: string) => {
      removeTilingDimension(dimId);
    },
    [removeTilingDimension],
  );

  return { hoverSnap, preview, onPointerMove, onClick, onContextMenu };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTilingDimension.ts
git commit -m "feat(tiling): add useTilingDimension state machine hook"
```

---

### Task 4: Extract DimLine component + create TilingDimensionLayer

**Files:**
- Create: `src/components/tiling/DimLine.tsx`
- Modify: `src/components/tiling/TilingCanvas.tsx` (import from new file)
- Create: `src/components/tiling/TilingDimensionLayer.tsx`

- [ ] **Step 1: Create `src/components/tiling/DimLine.tsx`**

Extract the `DimLine` component from `TilingCanvas.tsx`. Copy it exactly, adding an optional `onContextMenu` prop. When `onContextMenu` is provided, remove `pointer-events-none` so right-click events are received:

```tsx
'use client';

import type { MouseEvent } from 'react';

interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
}

export const DimLine = ({ x1, y1, x2, y2, label, perpOffset = 500, onContextMenu }: DimLineProps) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return null;
  const nx = -dy / len, ny = dx / len;
  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;
  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const tLen = 120;

  return (
    <g
      className={onContextMenu ? undefined : 'pointer-events-none'}
      onContextMenu={onContextMenu}
    >
      <line x1={x1} y1={y1} x2={dlx1 + ox * 0.15} y2={dly1 + oy * 0.15} stroke="#475569" strokeWidth={18} strokeDasharray="60,40" />
      <line x1={x2} y1={y2} x2={dlx2 + ox * 0.15} y2={dly2 + oy * 0.15} stroke="#475569" strokeWidth={18} strokeDasharray="60,40" />
      <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke="#64748b" strokeWidth={22} />
      <line x1={dlx1 - nx * tLen} y1={dly1 - ny * tLen} x2={dlx1 + nx * tLen} y2={dly1 + ny * tLen} stroke="#64748b" strokeWidth={22} />
      <line x1={dlx2 - nx * tLen} y1={dly2 - ny * tLen} x2={dlx2 + nx * tLen} y2={dly2 + ny * tLen} stroke="#64748b" strokeWidth={22} />
      <g transform={`translate(${midX}, ${midY}) rotate(${ang})`}>
        <rect x="-280" y="-210" width="560" height="240" fill="#0f172a" rx="50" />
        <text x="0" y="-65" textAnchor="middle" fontSize="145" fill="#94a3b8" fontWeight="bold">
          {label}
        </text>
      </g>
    </g>
  );
};
```

- [ ] **Step 2: Update `TilingCanvas.tsx` to import `DimLine` from the new file**

Remove the inline `DimLineProps` interface and `DimLine` component (lines 11–45).

Add this import at the top (after existing imports):
```ts
import { DimLine } from './DimLine';
```

- [ ] **Step 3: Verify existing dims still render — run TypeScript check**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Create `src/components/tiling/TilingDimensionLayer.tsx`**

```tsx
'use client';

import type { MouseEvent } from 'react';
import type { TilingDimension } from '@/types/tilingDimension';
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
  onContextMenu: (dimId: string) => void;
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
  direction: string,
  parallelAngle: number | undefined,
  perpOffset: number,
): ProjectedDim {
  if (direction === 'H') {
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, label: formatCm(Math.abs(p2.x - p1.x)), perpOffset };
  }
  if (direction === 'V') {
    return { x1: p1.x, y1: p1.y, x2: p1.x, y2: p2.y, label: formatCm(Math.abs(p2.y - p1.y)), perpOffset };
  }
  // 'parallel'
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
  return Math.abs(pd.x2 - pd.x1) + Math.abs(pd.y2 - pd.y1) >= 10;
}

export const TilingDimensionLayer = ({
  activeTool,
  dimensions,
  hoverSnap,
  preview,
  onContextMenu,
}: TilingDimensionLayerProps) => {
  return (
    <g>
      {/* Snap indicator */}
      {activeTool === 'dimension' && hoverSnap && (
        <circle
          cx={hoverSnap.point.x}
          cy={hoverSnap.point.y}
          r={40}
          stroke="#10b981"
          strokeWidth={20}
          fill="none"
          className="pointer-events-none"
        />
      )}

      {/* Preview dimension (during picking_end) */}
      {preview && (() => {
        const pd = projectDim(preview.p1, preview.p2, preview.direction, preview.parallelAngle, 600);
        if (!hasLength(pd)) return null;
        return (
          <g className="pointer-events-none" opacity={0.6}>
            <DimLine x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2} label={pd.label} perpOffset={pd.perpOffset} />
          </g>
        );
      })()}

      {/* Placed dimensions */}
      {dimensions.map((dim) => {
        const pd = projectDim(dim.p1, dim.p2, dim.direction, dim.parallelAngle, dim.perpOffset);
        if (!hasLength(pd)) return null;
        return (
          <DimLine
            key={dim.id}
            x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2}
            label={pd.label}
            perpOffset={pd.perpOffset}
            onContextMenu={(e: MouseEvent<SVGGElement>) => {
              e.preventDefault();
              onContextMenu(dim.id);
            }}
          />
        );
      })}
    </g>
  );
};
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/tiling/DimLine.tsx src/components/tiling/TilingCanvas.tsx src/components/tiling/TilingDimensionLayer.tsx
git commit -m "feat(tiling): extract DimLine component and add TilingDimensionLayer"
```

---

### Task 5: Wire up TilingCanvas and TilingEditor

**Files:**
- Modify: `src/components/tiling/TilingCanvas.tsx`
- Modify: `src/components/tiling/TilingEditor.tsx`

- [ ] **Step 1: Update `TilingCanvas.tsx` props and behavior**

Replace the `TilingCanvasProps` interface (lines 47–59) with:

```ts
interface TilingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  rooms: Room[];
  tiles: Tile[];
  config: TilingConfig;
  scale: number;
  pan: Point;
  activeTool: 'pan' | 'dimension';
  wallThickness: number;
  dimensionLayer: React.ReactNode;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onClick: (e: React.MouseEvent<SVGSVGElement>) => void;
}
```

Add `React` to the import (for `React.ReactNode` and `React.MouseEvent`):
```ts
import type { PointerEvent as ReactPointerEvent, RefObject, ReactNode, MouseEvent } from 'react';
```

Update the component signature to match:
```ts
export const TilingCanvas = ({
  svgRef, rooms, tiles, config, scale, pan,
  activeTool, wallThickness, dimensionLayer,
  onPointerDown, onPointerMove, onPointerUp, onClick,
}: TilingCanvasProps) => {
```

Update `canShowDims` (line 81) — replace `showDimensions &&` with `activeTool === 'dimension' &&`:
```ts
const canShowDims = activeTool === 'dimension' && config.angle === 0 && config.layout === 'STRAIGHT';
```

Update the `<svg>` element — change cursor class and add `onClick`:
```tsx
<svg
  ref={svgRef}
  className={`h-full w-full ${activeTool === 'dimension' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={onPointerUp}
  onPointerLeave={onPointerUp}
  onClick={onClick}
>
```

Remove the auto-computed tile-cut DimLines (lines 261–296 in the original file — the four `{leftCut > 10 && ...}`, `{lastCutX > 10 && ...}`, `{topCut > 10 && ...}`, `{lastCutY > 10 && ...}` blocks plus their associated variable declarations `fullCountX`, `lastCutX`, `fullCountY`, `lastCutY`, `leftCut`, `topCut`, `tilesInX`, `tilesInY`, `leftTileX`, `topTileY`).

Keep only the room total width and height DimLines (the two `<DimLine>` elements for `roomW` and `roomH`). The resulting `canShowDims` block becomes:

```tsx
{canShowDims && validRooms.map((room) => {
  const pts = room.points;
  if (pts.length < 3) return null;
  const rb = getBoundingBox(pts);
  const roomW = rb.maxX - rb.minX;
  const roomH = rb.maxY - rb.minY;
  const offset = 600;
  return (
    <g key={`dims-${room.id}`}>
      <DimLine
        x1={rb.minX} y1={rb.minY}
        x2={rb.maxX} y2={rb.minY}
        label={formatCm(roomW)}
        perpOffset={-offset}
      />
      <DimLine
        x1={rb.maxX} y1={rb.minY}
        x2={rb.maxX} y2={rb.maxY}
        label={formatCm(roomH)}
        perpOffset={offset}
      />
    </g>
  );
})}
```

At the end of the `<g transform={...}>`, add `{dimensionLayer}` as the last child (after the reference dimensions block, before the closing `</g>`):

```tsx
        {/* Dimension tool layer */}
        {dimensionLayer}
      </g>
```

- [ ] **Step 2: Verify TypeScript compiles after TilingCanvas changes**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about TilingEditor not yet passing the new props (will fix next step).

- [ ] **Step 3: Update `TilingEditor.tsx`**

Add these imports at the top:
```ts
import { useProjectStore, selectActiveProject } from '@/store/projectStore';
import { useTilingDimension } from '@/hooks/useTilingDimension';
import { TilingDimensionLayer } from './TilingDimensionLayer';
```

Replace the `useState` for `showDimensions` with `activeTool`:
```ts
// Remove:
// const [showDimensions, setShowDimensions] = useState(false);

// Add:
const [activeTool, setActiveTool] = useState<'pan' | 'dimension'>('pan');
```

Add store access for placed dimensions (after the `useState` declarations):
```ts
const dimensions = useProjectStore((s) => selectActiveProject(s)?.tilingDimensions ?? []);
```

Instantiate the hook (after `dimensions`, after `result`):
```ts
const dimHook = useTilingDimension(rooms, result.tiles, wallThickness, scale, activeTool === 'dimension');
```

Add an Escape key handler to deactivate the dimension tool (add a new `useEffect` after the existing wheel zoom effect):
```ts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && activeTool === 'dimension') setActiveTool('pan');
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [activeTool]);
```

Replace the three pointer handlers with tool-aware versions:
```ts
const toWorld = (e: { clientX: number; clientY: number }): Point => {
  const rect = svgRef.current!.getBoundingClientRect();
  return { x: (e.clientX - rect.left - pan.x) / scale, y: (e.clientY - rect.top - pan.y) / scale };
};

const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
  if (activeTool === 'dimension') return;
  if (e.button === 0) setIsDragging(true);
};

const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
  if (activeTool === 'dimension') {
    dimHook.onPointerMove(toWorld(e));
    return;
  }
  if (isDragging) setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
};

const handlePointerUp = () => {
  if (activeTool === 'dimension') return;
  setIsDragging(false);
};

const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
  if (activeTool !== 'dimension') return;
  dimHook.onClick(toWorld(e), e.ctrlKey);
};
```

Build the dimension layer node (after the hook instantiation):
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

Update the `<TilingCanvas>` call — replace `showDimensions={showDimensions}` with `activeTool={activeTool}`, add `dimensionLayer={dimensionLayer}` and `onClick={handleClick}`:
```tsx
<TilingCanvas
  svgRef={svgRef}
  rooms={rooms}
  tiles={result.tiles}
  config={config}
  scale={scale}
  pan={pan}
  activeTool={activeTool}
  wallThickness={wallThickness}
  dimensionLayer={dimensionLayer}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onClick={handleClick}
/>
```

Update the Ruler/Côtes button in the bottom bar — replace the existing button (the one with `<Ruler size={12} /> Côtes`) with:
```tsx
<button
  type="button"
  onClick={() => setActiveTool((t) => t === 'dimension' ? 'pan' : 'dimension')}
  title="Placer des côtes (Échap pour quitter)"
  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
    activeTool === 'dimension'
      ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
      : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500'
  }`}
>
  <Ruler size={12} /> Côtes
</button>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/tiling/TilingCanvas.tsx src/components/tiling/TilingEditor.tsx
git commit -m "feat(tiling): wire interactive dimension tool into TilingCanvas and TilingEditor"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| Ruler button toggles activeTool | Task 5, TilingEditor Ruler button |
| pan/zoom disabled when dimension tool active | Task 5, handlePointerDown/Move/Up guards |
| `idle → picking_start → picking_end → idle` | Task 3, useTilingDimension |
| Snap to wall-vertex, wall-midpoint, tile-corner, tile-midpoint | Task 2, snapToTiling |
| Snap radius 15/scale world units | Task 2, snapToTiling |
| Auto-detect H/V direction | Task 3, setAutoDirection in onPointerMove |
| Ctrl cycles H→V→parallel | Task 3, onClick with ctrlHeld |
| parallelAngle from nearest wall edge | Task 2, getParallelAngle |
| perpOffset auto-computed (opposite side from rooms) | Task 3, onClick perpOffset block |
| Escape returns to idle | Task 5, Escape useEffect |
| Right-click deletes dimension | Task 4, DimLine onContextMenu; Task 3, onContextMenu |
| Persisted in project store | Task 1, addTilingDimension/removeTilingDimension |
| Snap indicator (emerald circle) | Task 4, TilingDimensionLayer |
| Preview at 60% opacity | Task 4, TilingDimensionLayer preview block |
| Remove auto-computed cut DimLines | Task 5, TilingCanvas |
| Keep room total width/height DimLines | Task 5, TilingCanvas canShowDims block |
| DimLine shared via extraction | Task 4, DimLine.tsx |
| migrateProject handles tilingDimensions | Task 1, projectStore migrateProject |

**Placeholder scan:** No TBDs or vague steps present.

**Type consistency:**
- `DimDirection` defined in Task 1, used in Tasks 3, 4 — ✓
- `TilingDimension` defined in Task 1, used in Tasks 1 (store), 3 (hook), 4 (layer) — ✓
- `SnapResult` defined in Task 2, imported in Tasks 3 and 4 — ✓
- `DimPreview` defined in Task 3, imported in Task 4 — ✓
- `DimLine` (component) defined in Task 4, imported in Tasks 4 (layer) and 5 (canvas) — ✓
- `addTilingDimension` / `removeTilingDimension` declared in interface and implemented in Task 1 — ✓
- `activeTool` prop added to TilingCanvas in Task 5, passed from TilingEditor in Task 5 — ✓
- `dimensionLayer` prop added to TilingCanvas in Task 5, constructed in TilingEditor in Task 5 — ✓
- `onClick` prop added to TilingCanvas in Task 5, `handleClick` wired in TilingEditor in Task 5 — ✓
