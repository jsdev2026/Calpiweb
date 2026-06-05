# Tiling Wall Thickness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tile cuts land at the wall face (interior) rather than the wall centerline by insetting room polygons by half each wall's thickness before tiling.

**Architecture:** A new pure function `insetRoomPolygon(room, defaultThickness): Point[]` in `polygon.ts` offsets each room edge inward by `edgeThicknesses[i]/2` (or `defaultThickness/2` when no per-edge override) and recomputes vertices as line–line intersections. This function is wired into `computeTilingMultiRoom`, `tileSpaceRooms`, and `TilingCanvas`. The `wallThickness` param is added as an optional third argument (default `0`) to `analyzeQuantities` and `computeTilingMultiRoom` — existing tests pass unchanged. The canvas room outline is also updated to the interior face for visual correctness.

**Tech Stack:** TypeScript, React, Vitest, Testing Library

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/engine/geometry/polygon.ts` | Add `insetRoomPolygon` export + private `lineIntersect` helper |
| Modify | `src/engine/geometry/polygon.test.ts` | Unit tests for `insetRoomPolygon` |
| Modify | `src/engine/tiling/tilingEngine.ts` | Add `wallThickness` param to `computeTilingMultiRoom`, apply inset to `testPoints` |
| Modify | `src/engine/quantities/quantityEngine.ts` | Add `wallThickness` param to `analyzeQuantities` and `tileSpaceRooms`, thread through |
| Modify | `src/engine/quantities/quantityEngine.integration.test.ts` | Failing test verifying inset reduces tile count |
| Modify | `src/components/tiling/TilingEditor.tsx` | Pass `wallThickness` to `analyzeQuantities` |
| Modify | `src/components/tiling/TilingCanvas.tsx` | Draw room outline using inset polygon |

---

### Task 1: `insetRoomPolygon` utility in `polygon.ts`

**Files:**
- Modify: `src/engine/geometry/polygon.ts`
- Modify: `src/engine/geometry/polygon.test.ts`

#### Background

`polygon.ts` currently imports only `Point` from `@/types/plan`. `Room` is in `@/types/project` and has `points: Point[]` and `edgeThicknesses?: (number | undefined)[]`.

The existing `getIntersection` is a **segment** intersection (returns null unless `t ∈ [0,1]` and `u ∈ [0,1]`). Computing inset vertices requires **infinite line** intersection — a private `lineIntersect` helper is added that skips the bounds check.

Winding detection: shoelace sum > 0 for CW (screen y-down, which is the room-drawing convention). For CW, the inward normal is the **left** normal of the edge direction: `(-dy, dx)` normalized. For CCW, it is the **right** normal: `(dy, -dx)`.

- [ ] **Step 1: Write failing tests**

Add to `src/engine/geometry/polygon.test.ts` (after the existing `describe` blocks):

```ts
import { insetRoomPolygon } from './polygon';
import type { Room } from '@/types/project';

// CW rectangle in y-down SVG: (0,0)→(2000,0)→(2000,3000)→(0,3000)
function makeRect(w: number, h: number, edgeThicknesses?: (number | undefined)[]): Room {
  return {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    edgeThicknesses,
  };
}

describe('insetRoomPolygon', () => {
  it('returns copy of points when thickness is 0', () => {
    const room = makeRect(2000, 3000);
    const result = insetRoomPolygon(room, 0);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[2]).toEqual({ x: 2000, y: 3000 });
  });

  it('insets uniformly: 100mm walls → 50mm inset per side', () => {
    const room = makeRect(2000, 3000);
    const result = insetRoomPolygon(room, 100);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 50, y: 50 });
    expect(result[1]).toEqual({ x: 1950, y: 50 });
    expect(result[2]).toEqual({ x: 1950, y: 2950 });
    expect(result[3]).toEqual({ x: 50, y: 2950 });
  });

  it('respects per-edge thickness: edges [100,200,100,200]', () => {
    // Edge 0 (bottom, 100mm → inset 50): y goes from 0 to 50
    // Edge 1 (right,  200mm → inset 100): x goes from 2000 to 1900
    // Edge 2 (top,    100mm → inset 50):  y goes from 3000 to 2950
    // Edge 3 (left,   200mm → inset 100): x goes from 0 to 100
    const room = makeRect(2000, 3000, [100, 200, 100, 200]);
    const result = insetRoomPolygon(room, 0); // defaultThickness irrelevant, all overridden
    expect(result[0]).toEqual({ x: 100, y: 50 });   // edge3∩edge0
    expect(result[1]).toEqual({ x: 1900, y: 50 });  // edge0∩edge1
    expect(result[2]).toEqual({ x: 1900, y: 2950 }); // edge1∩edge2
    expect(result[3]).toEqual({ x: 100, y: 2950 });  // edge2∩edge3
  });

  it('returns original points for degenerate polygon (< 3 pts)', () => {
    const room: Room = { id: 'r', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], edges: [] };
    expect(insetRoomPolygon(room, 100)).toEqual(room.points);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/engine/geometry/polygon.test.ts
```

Expected: FAIL — `insetRoomPolygon is not a function` (not yet exported)

- [ ] **Step 3: Implement `insetRoomPolygon` in `polygon.ts`**

Add `import type { Room } from '@/types/project';` at the top of `src/engine/geometry/polygon.ts` (after the existing `Point` import).

Then append the following to the end of `src/engine/geometry/polygon.ts`:

```ts
/** Line–line intersection (infinite lines). Returns null if lines are parallel. */
function lineIntersect(A: Point, B: Point, C: Point, D: Point): Point | null {
  const denom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x)) / denom;
  return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
}

/**
 * Returns the room polygon inset inward by half each wall's thickness.
 * For edge i: inset = (room.edgeThicknesses?.[i] ?? defaultThickness) / 2.
 * Winding-aware: detects CW/CCW from shoelace and picks the correct inward normal.
 */
export function insetRoomPolygon(room: Room, defaultThickness: number): Point[] {
  const pts = room.points;
  const n = pts.length;
  if (n < 3) return pts;

  // Shoelace to detect winding. > 0 → CW in y-down (standard room convention).
  let shoelace = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    shoelace += p.x * q.y - q.x * p.y;
  }
  // CW in y-down → inward is left of edge direction: normal = (-dy, dx).
  // CCW in y-down → inward is right of edge direction: normal = (dy, -dx).
  const sign = shoelace > 0 ? 1 : -1;

  const offsetEdges = pts.map((p, i) => {
    const q = pts[(i + 1) % n]!;
    const t = room.edgeThicknesses?.[i] ?? defaultThickness;
    const inset = t / 2;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return { p1: p, p2: q };
    const nx = sign * (-dy / len) * inset;
    const ny = sign * (dx / len) * inset;
    return { p1: { x: p.x + nx, y: p.y + ny }, p2: { x: q.x + nx, y: q.y + ny } };
  });

  return offsetEdges.map((edge, i) => {
    const prev = offsetEdges[(i + n - 1) % n]!;
    return lineIntersect(prev.p1, prev.p2, edge.p1, edge.p2) ?? edge.p1;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/engine/geometry/polygon.test.ts
```

Expected: all tests pass (existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add src/engine/geometry/polygon.ts src/engine/geometry/polygon.test.ts
git commit -m "feat(tiling): insetRoomPolygon utility for wall face alignment"
```

---

### Task 2: Thread `wallThickness` through the engine

**Files:**
- Modify: `src/engine/quantities/quantityEngine.integration.test.ts`
- Modify: `src/engine/tiling/tilingEngine.ts`
- Modify: `src/engine/quantities/quantityEngine.ts`
- Modify: `src/components/tiling/TilingEditor.tsx`

#### Background

`computeTilingMultiRoom` signature: `(rooms: Room[], config: TilingConfig): TilingResult`  
After change: `(rooms: Room[], config: TilingConfig, wallThickness = 0): TilingResult`

`analyzeQuantities` signature: `(rooms: Room[], config: TilingConfig): QuantityResult`  
After change: `(rooms: Room[], config: TilingConfig, wallThickness = 0): QuantityResult`

Default `0` preserves existing tests without modification.

In `computeTilingMultiRoom`, two code paths use `r.points` for classification:
1. **Single-room path** (line 273–275): passes `valid[0]!.points` directly to `computeTiling`
2. **Multi-room path** (lines 289–295): builds `testRooms` with `testPoints` from `r.points`

Both must use the inset polygon. The bbox/center calc at lines 278–281 stays on `r.points` (used only for grid sizing — original bounds needed to cover the full grid area).

In `tileSpaceRooms` (quantityEngine line 14–22): replace `r.points` with `insetRoomPolygon(r, wallThickness)` in the `map`.

`TilingEditor` already has `wallThickness` as a prop and receives it from the parent; just pass it to `analyzeQuantities`.

- [ ] **Step 1: Write failing integration test**

In `src/engine/quantities/quantityEngine.integration.test.ts`, add after the last test:

```ts
it('S-WT: wall thickness inset reduces tile count (300×300 room, 100mm walls)', () => {
  // Without inset: 9 whole tiles (3×3 grid of 100mm tiles in 300×300 room)
  const room = makeRoom(300, 300);
  const config = { ...BASE_CONFIG, width: 100, height: 100, joint: 0 };
  const resultNoWall = analyzeQuantities([room], config, 0);
  expect(resultNoWall.wholeCount).toBe(9);

  // With 100mm walls (50mm inset per side): effective interior is 200×200
  // Grid aligns to inset bbox, producing only 2×2 = 4 tiles
  const resultWithWall = analyzeQuantities([room], config, 100);
  expect(resultWithWall.wholeCount).toBeLessThan(9);
});
```

- [ ] **Step 2: Run failing test**

```bash
npm run test -- --run src/engine/quantities/quantityEngine.integration.test.ts
```

Expected: FAIL — `resultWithWall.wholeCount` equals 9 (wallThickness not yet wired in)

- [ ] **Step 3: Update `computeTilingMultiRoom` in `tilingEngine.ts`**

In `src/engine/tiling/tilingEngine.ts`:

**a) Add import** at the top of the existing import from `@/engine/geometry/polygon`:

```ts
// BEFORE:
import { getBoundingBox, distance, rotatePoint, getPolygonArea, pointInPolygon, getIntersection } from '@/engine/geometry/polygon';

// AFTER:
import { getBoundingBox, distance, rotatePoint, getPolygonArea, pointInPolygon, getIntersection, insetRoomPolygon } from '@/engine/geometry/polygon';
```

**b) Update the function signature** (line 270):

```ts
// BEFORE:
export const computeTilingMultiRoom = (rooms: Room[], config: TilingConfig): TilingResult => {

// AFTER:
export const computeTilingMultiRoom = (rooms: Room[], config: TilingConfig, wallThickness = 0): TilingResult => {
```

**c) Update the single-room path** (lines 273–275):

```ts
// BEFORE:
  if (valid.length === 1) return computeTiling(
    valid[0]!.points, config, valid[0]!.edges, valid[0]!.excludedZones, valid[0]!.partitions,
  );

// AFTER:
  if (valid.length === 1) return computeTiling(
    insetRoomPolygon(valid[0]!, wallThickness), config, valid[0]!.edges, valid[0]!.excludedZones, valid[0]!.partitions,
  );
```

**d) Update `testRooms` in the multi-room path** (lines 289–295):

```ts
// BEFORE:
  const testRooms = valid.map((r) => ({
    testPoints:
      angle !== 0
        ? r.points.map((p) => rotatePoint(p.x, p.y, -angle, centerX, centerY))
        : r.points,
    edges: r.edges,
  }));

// AFTER:
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
```

- [ ] **Step 4: Update `tileSpaceRooms` and `analyzeQuantities` in `quantityEngine.ts`**

In `src/engine/quantities/quantityEngine.ts`:

**a) Add import** at the top of the existing import from `@/engine/geometry/polygon`:

```ts
// BEFORE:
import { getBoundingBox, rotatePoint } from '@/engine/geometry/polygon';

// AFTER:
import { getBoundingBox, rotatePoint, insetRoomPolygon } from '@/engine/geometry/polygon';
```

**b) Update `tileSpaceRooms`** (lines 14–22):

```ts
// BEFORE:
function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) =>
      angle !== 0
        ? r.points.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : r.points,
    );
}

// AFTER:
function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number, wallThickness = 0): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) => {
      const inset = insetRoomPolygon(r, wallThickness);
      return angle !== 0
        ? inset.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : inset;
    });
}
```

**c) Update `analyzeQuantities` signature** (line 24):

```ts
// BEFORE:
export function analyzeQuantities(rooms: Room[], config: TilingConfig): QuantityResult {

// AFTER:
export function analyzeQuantities(rooms: Room[], config: TilingConfig, wallThickness = 0): QuantityResult {
```

**d) Thread `wallThickness` through inside `analyzeQuantities`** — update the two calls (lines 26 and 42):

```ts
// Line 26 — BEFORE:
  const { tiles, stats } = computeTilingMultiRoom(rooms, config);

// AFTER:
  const { tiles, stats } = computeTilingMultiRoom(rooms, config, wallThickness);
```

```ts
// Line 42 — BEFORE:
  const roomPolygons = tileSpaceRooms(validRooms, config.angle, cx, cy);

// AFTER:
  const roomPolygons = tileSpaceRooms(validRooms, config.angle, cx, cy, wallThickness);
```

- [ ] **Step 5: Update `TilingEditor.tsx` useMemo call**

In `src/components/tiling/TilingEditor.tsx`, update line 77:

```ts
// BEFORE:
  const result = useMemo(() => analyzeQuantities(rooms, config), [rooms, config]);

// AFTER:
  const result = useMemo(() => analyzeQuantities(rooms, config, wallThickness), [rooms, config, wallThickness]);
```

- [ ] **Step 6: Run integration test to verify it passes**

```bash
npm run test -- --run src/engine/quantities/quantityEngine.integration.test.ts
```

Expected: all tests pass including the new S-WT test

- [ ] **Step 7: Run full suite + typecheck**

```bash
npm run typecheck && npm run test -- --run
```

Expected: no TypeScript errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/engine/tiling/tilingEngine.ts src/engine/quantities/quantityEngine.ts src/engine/quantities/quantityEngine.integration.test.ts src/components/tiling/TilingEditor.tsx
git commit -m "feat(tiling): apply wall-face inset in computeTilingMultiRoom and analyzeQuantities"
```

---

### Task 3: Update `TilingCanvas` room outline to interior face

**Files:**
- Modify: `src/components/tiling/TilingCanvas.tsx`

#### Background

`TilingCanvas` already imports from `@/engine/geometry/polygon` (`getBoundingBox`, `rotatePoint`) and already receives `wallThickness: number` as a prop (line 55). Two places render the room polygon using `room.points`:

- **Line 103**: inside `<clipPath>` → the SVG clip that restricts tile rendering to the room area
- **Line 124**: `<polygon>` background fill behind tiles

Both should use `insetRoomPolygon(room, wallThickness)` to match the engine's tile classification boundary.

There is no behavioral test for this change (it is purely visual). Typecheck and the existing test suite confirm no regressions.

- [ ] **Step 1: Add `insetRoomPolygon` to the polygon import**

In `src/components/tiling/TilingCanvas.tsx`, update the import at line 4:

```ts
// BEFORE:
import { getBoundingBox, rotatePoint } from '@/engine/geometry/polygon';

// AFTER:
import { getBoundingBox, rotatePoint, insetRoomPolygon } from '@/engine/geometry/polygon';
```

- [ ] **Step 2: Update the `<clipPath>` path (line 103)**

Find the `clipPath` block. The inner `<path d={[...validRooms.map(...)]}>` maps each room to:

```ts
// BEFORE:
`M ${r.points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`

// AFTER:
`M ${insetRoomPolygon(r, wallThickness).map((p) => `${p.x},${p.y}`).join(' L ')} Z`
```

- [ ] **Step 3: Update the background `<polygon>` (line 124)**

Find the `validRooms.map((room) => (<polygon key={...} points={room.points.map(...)} ...>))`:

```ts
// BEFORE:
points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}

// AFTER:
points={insetRoomPolygon(room, wallThickness).map((p) => `${p.x},${p.y}`).join(' ')}
```

- [ ] **Step 4: Typecheck + run full suite**

```bash
npm run typecheck && npm run test -- --run
```

Expected: no TypeScript errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/tiling/TilingCanvas.tsx
git commit -m "feat(tiling): draw room outline at interior wall face in TilingCanvas"
```
