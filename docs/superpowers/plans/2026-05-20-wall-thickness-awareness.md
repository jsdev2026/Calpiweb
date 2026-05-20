# Wall Thickness Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the plan editor display and store interior dimensions (face-to-face) instead of centerline distances, and expose a default wall thickness control in the toolbar.

**Architecture:** UI-layer conversion only — the constraint solver is untouched. A new pure utility `constraintInteriorOffset()` computes the thickness offset for H_DISTANCE and V_DISTANCE constraints. All display sites subtract the offset; all input sites add it back before storing. A compact `WallThicknessControl` component is added to `PlanToolbar`.

**Tech Stack:** TypeScript, React 18, Vitest, Zustand (projectStore), Tailwind CSS.

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/engine/constraints/interiorOffset.ts` | Pure utility: `constraintInteriorOffset()` |
| Create | `src/engine/constraints/interiorOffset.test.ts` | Unit tests for the utility |
| Modify | `src/components/plan/DrawingCanvas.tsx` | Subtract offset in room wall badge labels (line ≈406) |
| Modify | `src/components/plan/PlanEditor.tsx` | Apply offset when opening WallEdgeEditor; add offset when submitting; DIMENSION tool open/submit |
| Create | `src/components/plan/WallThicknessControl.tsx` | Compact cm input for default wall thickness |
| Modify | `src/components/plan/PlanToolbar.tsx` | Add `wallThickness` + `onWallThicknessChange` props and render `WallThicknessControl` |
| Modify | `src/constants/businessRules.ts` | Clarifying comment on `DOOR_DEFAULT_WIDTH_MM` |

---

### Task 1: `constraintInteriorOffset` utility + unit tests

**Files:**
- Create: `src/engine/constraints/interiorOffset.ts`
- Create: `src/engine/constraints/interiorOffset.test.ts`

#### Background

Vertices are on wall centerlines. `H_DISTANCE` value stored in a constraint is centerline-to-centerline. Interior = stored − t_left/2 − t_right/2.

For `H_DISTANCE` on edge (i → i+1): the bounding walls are the walls **perpendicular to the horizontal axis** adjacent to each endpoint. "Perpendicular to horizontal" = vertical = `|dy| > |dx|`.

For `V_DISTANCE` on edge (i → i+1): bounding walls are the ones **perpendicular to the vertical axis** = horizontal = `|dx| > |dy|`.

`LENGTH` constraints measure wall-face length = centerline length for straight walls → offset = 0.

For cross-entity constraints (pts from different roomIds) → offset = 0.

#### Key types (already in codebase)

```ts
// src/types/project.ts
interface Room { id: string; points: Point[]; edges: EdgeType[]; edgeThicknesses?: (number | undefined)[]; }
interface Constraint { id: string; type: ConstraintType; pts: PointRef[]; value?: number | { x: number; y: number }; }
interface PointRef { roomId: string; vertexIdx: number; }
```

- [ ] **Step 1: Write failing tests**

```ts
// src/engine/constraints/interiorOffset.test.ts
import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from './interiorOffset';
import type { Room, Constraint } from '@/types/project';

// Rectangle: 0(0,0)→1(3000,0)→2(3000,4000)→3(0,4000)
// edges: 0=(0→1 bottom horiz), 1=(1→2 right vert), 2=(2→3 top horiz), 3=(3→0 left vert)
const room: Room = {
  id: 'r1',
  points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }],
  edges: ['WALL', 'WALL', 'WALL', 'WALL'],
};
const DEFAULT_T = 100;

describe('constraintInteriorOffset', () => {
  it('returns 0 for LENGTH constraints', () => {
    const c: Constraint = { id: 'c', type: 'LENGTH', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintInteriorOffset(c, room, DEFAULT_T)).toBe(0);
  });

  it('returns 0 for cross-entity constraints', () => {
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r2', vertexIdx: 0 }] };
    expect(constraintInteriorOffset(c, room, DEFAULT_T)).toBe(0);
  });

  it('H_DISTANCE on bottom edge (0→1): offset = left_t/2 + right_t/2 = 50+50 = 100', () => {
    // At vertex 0: edge3 (left vert wall, dx=0,dy=4000) is most vertical → t=100, half=50
    // At vertex 1: edge1 (right vert wall, dx=0,dy=4000) is most vertical → t=100, half=50
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintInteriorOffset(c, room, DEFAULT_T)).toBe(100);
  });

  it('V_DISTANCE on right edge (1→2): offset = bottom_t/2 + top_t/2 = 50+50 = 100', () => {
    // At vertex 1: edge0 (bottom horiz, dx=3000,dy=0) is most horizontal → t=100, half=50
    // At vertex 2: edge2 (top horiz, dx=3000,dy=0) is most horizontal → t=100, half=50
    const c: Constraint = { id: 'c', type: 'V_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 1 }, { roomId: 'r1', vertexIdx: 2 }] };
    expect(constraintInteriorOffset(c, room, DEFAULT_T)).toBe(100);
  });

  it('H_DISTANCE with per-edge thickness: left=200mm, right=150mm → offset=175', () => {
    const roomOverride: Room = {
      ...room,
      edgeThicknesses: [undefined, 150, undefined, 200], // edge1=150, edge3=200
    };
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }] };
    expect(constraintInteriorOffset(c, roomOverride, DEFAULT_T)).toBe(175); // 100 + 75
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --run src/engine/constraints/interiorOffset.test.ts
```
Expected: FAIL with "Cannot find module './interiorOffset'"

- [ ] **Step 3: Implement the utility**

```ts
// src/engine/constraints/interiorOffset.ts
import type { Room, Constraint } from '@/types/project';

function halfThicknessAt(
  nodeIdx: number,
  room: Room,
  defaultThickness: number,
  preferVertical: boolean,
): number {
  const n = room.points.length;
  const edgeIndices = [(nodeIdx - 1 + n) % n, nodeIdx];
  let bestEdge = -1;
  let bestScore = -1;

  for (const eIdx of edgeIndices) {
    const p1 = room.points[eIdx];
    const p2 = room.points[(eIdx + 1) % n];
    if (!p1 || !p2) continue;
    const adx = Math.abs(p2.x - p1.x);
    const ady = Math.abs(p2.y - p1.y);
    const total = adx + ady;
    if (total < 0.001) continue;
    const score = preferVertical ? ady / total : adx / total;
    if (score > bestScore) { bestScore = score; bestEdge = eIdx; }
  }

  if (bestEdge === -1 || bestScore < 0.5) return 0;
  const t = room.edgeThicknesses?.[bestEdge] ?? defaultThickness;
  return t / 2;
}

export function constraintInteriorOffset(
  constraint: Constraint,
  room: Room,
  defaultThickness: number,
): number {
  if (
    (constraint.type !== 'H_DISTANCE' && constraint.type !== 'V_DISTANCE') ||
    constraint.pts.length < 2
  ) {
    return 0;
  }
  const [p1ref, p2ref] = [constraint.pts[0]!, constraint.pts[1]!];
  if (p1ref.roomId !== p2ref.roomId) return 0;
  const preferVertical = constraint.type === 'H_DISTANCE';
  return (
    halfThicknessAt(p1ref.vertexIdx, room, defaultThickness, preferVertical) +
    halfThicknessAt(p2ref.vertexIdx, room, defaultThickness, preferVertical)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/engine/constraints/interiorOffset.test.ts
```
Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/engine/constraints/interiorOffset.ts src/engine/constraints/interiorOffset.test.ts
git commit -m "feat: constraintInteriorOffset utility for wall thickness awareness"
```

---

### Task 2: DrawingCanvas — subtract offset in room wall badge labels

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:406-409`

#### Background

`DrawingCanvas` already receives `wallThickness: number` (line 44) and `rooms`. The room wall badge is rendered in a loop over `rooms` → edges at approximately line 406-409. Currently it formats the stored constraint value directly.

Stored value = centerline distance. We want to display: `stored − offset`.

`constraintInteriorOffset` needs the full `Constraint` object (which has `.pts` with correct `roomId` and `vertexIdx`). The `hDistC`, `vDistC` variables are already the filtered constraint objects for the current edge.

- [ ] **Step 1: Write failing test**

Add a test verifying that when a room has a 100mm wall thickness and an H_DISTANCE constraint of 3100mm (centerline), the badge label shows "310 cm" (= 3100mm centerline) before the fix and "300 cm" (= 3000mm interior) after.

Since badge logic is inside a React SVG component, test via the existing vitest+react-testing-library setup:

```ts
// src/components/plan/DrawingCanvas.badge.test.tsx
import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { Room, Constraint } from '@/types/project';

// Verify the offset formula that will be used in the badge
it('badge label for H_DISTANCE 3100mm with 100mm walls shows 300cm interior', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const c: Constraint = {
    id: 'c1', type: 'H_DISTANCE',
    pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }],
    value: 3100,
  };
  const offset = constraintInteriorOffset(c, room, 100);
  expect(offset).toBe(100);
  expect(c.value as number - offset).toBe(3000); // 300 cm
});
```

- [ ] **Step 2: Run test to verify it passes** (this is a pure-logic test, no DOM)

```bash
npm run test -- --run src/components/plan/DrawingCanvas.badge.test.tsx
```
Expected: PASS

- [ ] **Step 3: Update badge display in DrawingCanvas**

In `src/components/plan/DrawingCanvas.tsx`, add import at the top (near existing imports):

```ts
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
```

Find the room wall badge block (search for `badge-${room.id}-${i}`). Replace lines ~406-409:

```ts
// BEFORE:
const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value)
  : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value)
  : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
  : formatCm(edgeLen);

// AFTER:
const hvC = hDistC ?? vDistC;
const hvOffset = hvC ? constraintInteriorOffset(hvC, room, wallThickness) : 0;
const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value - hvOffset)
  : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value - hvOffset)
  : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
  : formatCm(edgeLen);
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/plan/DrawingCanvas.tsx src/components/plan/DrawingCanvas.badge.test.tsx
git commit -m "feat: show interior dimensions in wall badge labels"
```

---

### Task 3: PlanEditor — WallEdgeEditor open + submit with interior offset

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx` (two locations)

#### Background

When the user clicks a wall edge (SELECT tool), `handleEdgePointerDown` opens the `WallEdgeEditor` popup and calls `setEditValue((value / 10).toFixed(1))`. The `value` here is the stored constraint (centerline mm) or geometric distance (also centerline). We must subtract offset before displaying.

When the user presses Validate, `submitDimension` converts `editValue` (cm) back to mm and stores it. We must add offset back before storing.

**Import to add** (top of PlanEditor.tsx, near other engine imports):
```ts
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
```

#### `handleEdgePointerDown` — display (open)

Find `handleEdgePointerDown` (search `const handleEdgePointerDown = (roomId: string, edgeIndex: number`). The function ends with:

```ts
setEditingEdgeConstraintType(cType);
setEditingEdge({ roomId, edgeIndex });
setEditValue((value / 10).toFixed(1));
const currentThickness = room.edgeThicknesses?.[edgeIndex] ?? wallThickness;
setEditingEdgeThicknessValue((currentThickness / 10).toFixed(0));
```

Replace `setEditValue((value / 10).toFixed(1));` with:

```ts
const displayOffset = constraintInteriorOffset(
  { id: '', type: cType, pts: [{ roomId, vertexIdx: a }, { roomId, vertexIdx: b }] },
  room,
  wallThickness,
);
setEditValue(((value - displayOffset) / 10).toFixed(1));
```

#### `submitDimension` — store (submit)

Find `const submitDimension = () => {`. After `const valueMm = valCm * 10;` add:

```ts
const offset = constraintInteriorOffset(
  { id: '', type: cType as Constraint['type'], pts: [p1Ref, p2Ref] },
  room,
  wallThickness,
);
```

Then change `const valueMm = valCm * 10;` to:

```ts
const valueMm = valCm * 10 + offset;
```

Full context of the change in `submitDimension` (lines ~1100–1117):

```ts
const submitDimension = () => {
  if (!editingEdge) return;
  const valCm = parseFloat(editValue);
  if (isNaN(valCm) || valCm <= 0) { setEditingEdge(null); return; }
  const room = rooms.find((r) => r.id === editingEdge.roomId); if (!room) { setEditingEdge(null); return; }
  const n = room.points.length, eIdx = editingEdge.edgeIndex;
  const p1Ref = ref(room.id, eIdx), p2Ref = ref(room.id, (eIdx + 1) % n);
  const cType = editingEdgeConstraintType;
  const offset = constraintInteriorOffset(
    { id: '', type: cType as Constraint['type'], pts: [p1Ref, p2Ref] },
    room,
    wallThickness,
  );
  const valueMm = valCm * 10 + offset;
  // ... rest unchanged
```

- [ ] **Step 1: Write failing test** (round-trip: open populates interior value, submit stores centerline)

```ts
// src/components/plan/PlanEditor.interior.test.ts
import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { Room, Constraint } from '@/types/project';

describe('WallEdgeEditor interior round-trip', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const wallThickness = 100;

  it('open: stored 3100mm H_DISTANCE → user sees 300cm (interior)', () => {
    const c: Constraint = { id: 'c', type: 'H_DISTANCE', pts: [{ roomId: 'r1', vertexIdx: 0 }, { roomId: 'r1', vertexIdx: 1 }], value: 3100 };
    const offset = constraintInteriorOffset(c, room, wallThickness);
    const displayedCm = (3100 - offset) / 10;
    expect(displayedCm).toBe(300);
  });

  it('submit: user types 300cm → stores 3100mm (centerline)', () => {
    const p1Ref = { roomId: 'r1', vertexIdx: 0 };
    const p2Ref = { roomId: 'r1', vertexIdx: 1 };
    const c: Constraint = { id: '', type: 'H_DISTANCE', pts: [p1Ref, p2Ref] };
    const offset = constraintInteriorOffset(c, room, wallThickness);
    const storedMm = 300 * 10 + offset;
    expect(storedMm).toBe(3100);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (pure logic test, should pass without code changes)

```bash
npm run test -- --run src/components/plan/PlanEditor.interior.test.ts
```
Expected: PASS (tests verify the formula, not the component behaviour yet)

- [ ] **Step 3: Apply offset in `handleEdgePointerDown`**

In `src/components/plan/PlanEditor.tsx`, add the import at the top of the engine imports section:

```ts
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
```

Find and update the final three lines of `handleEdgePointerDown`:

```ts
// BEFORE:
setEditingEdgeConstraintType(cType);
setEditingEdge({ roomId, edgeIndex });
setEditValue((value / 10).toFixed(1));

// AFTER:
setEditingEdgeConstraintType(cType);
setEditingEdge({ roomId, edgeIndex });
const displayOffset = constraintInteriorOffset(
  { id: '', type: cType, pts: [{ roomId, vertexIdx: a }, { roomId, vertexIdx: b }] },
  room,
  wallThickness,
);
setEditValue(((value - displayOffset) / 10).toFixed(1));
```

- [ ] **Step 4: Apply offset in `submitDimension`**

Find `const submitDimension = () => {`. After these two lines:
```ts
const p1Ref = ref(room.id, eIdx), p2Ref = ref(room.id, (eIdx + 1) % n);
const valueMm = valCm * 10;
```

Replace with:
```ts
const p1Ref = ref(room.id, eIdx), p2Ref = ref(room.id, (eIdx + 1) % n);
const cType = editingEdgeConstraintType;
const offset = constraintInteriorOffset(
  { id: '', type: cType as Constraint['type'], pts: [p1Ref, p2Ref] },
  room,
  wallThickness,
);
const valueMm = valCm * 10 + offset;
```

Note: `cType` is already declared after this in the original code — check that the existing `const cType = editingEdgeConstraintType;` line (a few lines after `valueMm`) is removed or merged. After the edit, `cType` must appear exactly once before `valueMm`.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 6: Run all tests**

```bash
npm run test -- --run
```
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.interior.test.ts
git commit -m "feat: WallEdgeEditor displays and submits interior dimensions"
```

---

### Task 4: PlanEditor — DIMENSION tool with interior offset

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx` (four locations)

#### Background

The DIMENSION tool (tool = `'DIMENSION'`) creates vertex-to-vertex H/V distance constraints. Opening the editor (`handleVertexPointerDown`) shows the current geometric distance. Submitting (`submitPartitionDimensionToElement`) stores it.

There are three `handleVertexPointerDown` contexts:
1. **Room vertex** (roomId ∈ rooms): offset applies when both points in same room
2. **Partition vertex** (roomId = partitionId, not in rooms): `rooms.find(...)` → undefined → offset = 0
3. **Zone vertex** (roomId = zoneId, not in rooms): same → offset = 0

So the same pattern works safely in all three contexts.

**Already imported** (from Task 3): `constraintInteriorOffset`

#### Location 1 — room vertex DIMENSION open

Find `if (tool === 'DIMENSION')` inside the room vertex pointer-down block. The final `setEditPartitionDimValue` call:

```ts
// BEFORE:
setEditPartitionDimValue(((dimType === 'H_DISTANCE' ? absDx : absDy) / 10).toFixed(1));

// AFTER:
const rawVal = dimType === 'H_DISTANCE' ? absDx : absDy;
const fromRoom = rooms.find((r) => r.id === fromRef.roomId);
const syntheticC = { id: '', type: dimType as 'H_DISTANCE' | 'V_DISTANCE', pts: [fromRef, toRef] };
const dimOpenOffset = fromRoom ? constraintInteriorOffset(syntheticC, fromRoom, wallThickness) : 0;
setEditPartitionDimValue(((rawVal - dimOpenOffset) / 10).toFixed(1));
```

#### Location 2 — partition vertex DIMENSION open (same pattern, offset will be 0)

Find the second `setEditPartitionDimValue` call inside the partition vertex block:

```ts
// BEFORE:
setEditPartitionDimValue(((dimType === 'H_DISTANCE' ? absDx : absDy) / 10).toFixed(1));

// AFTER:
const rawVal = dimType === 'H_DISTANCE' ? absDx : absDy;
const fromRoom = rooms.find((r) => r.id === fromRef.roomId);
const syntheticC = { id: '', type: dimType as 'H_DISTANCE' | 'V_DISTANCE', pts: [fromRef, toRef] };
const dimOpenOffset = fromRoom ? constraintInteriorOffset(syntheticC, fromRoom, wallThickness) : 0;
setEditPartitionDimValue(((rawVal - dimOpenOffset) / 10).toFixed(1));
```

#### Location 3 — zone vertex DIMENSION open (same pattern, offset will be 0)

Same replacement for the third `setEditPartitionDimValue` call inside the zone vertex block.

#### Location 4 — `submitPartitionDimensionToElement` (store on submit)

Find `const submitPartitionDimensionToElement = () => {`. Replace:

```ts
const valueMm = valCm * 10;
```

With:

```ts
const { fromRef, toRef } = editingPartitionDimension;
const cType = existing?.type ?? editingPartitionDimType;
const fromRoom = rooms.find((r) => r.id === fromRef.roomId);
const syntheticC = { id: '', type: cType as Constraint['type'], pts: [fromRef, toRef] };
const submitOffset = fromRoom ? constraintInteriorOffset(syntheticC, fromRoom, wallThickness) : 0;
const valueMm = valCm * 10 + submitOffset;
```

Note: `fromRef` and `toRef` are already declared earlier in the function via destructuring `editingPartitionDimension`; do not redeclare them.

- [ ] **Step 1: Write failing test** (round-trip for DIMENSION tool)

```ts
// src/components/plan/PlanEditor.dimension.test.ts
import { describe, expect, it } from 'vitest';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { Room } from '@/types/project';

describe('DIMENSION tool interior round-trip', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };

  it('room-to-room same room: open shows interior, submit stores centerline', () => {
    const fromRef = { roomId: 'r1', vertexIdx: 0 };
    const toRef   = { roomId: 'r1', vertexIdx: 1 };
    const absDx = Math.abs(3100 - 0);
    const syntheticC = { id: '', type: 'H_DISTANCE' as const, pts: [fromRef, toRef] };
    const offset = constraintInteriorOffset(syntheticC, room, 100);
    expect(offset).toBe(100);
    expect((absDx - offset) / 10).toBe(300); // shown as 300cm
    expect(300 * 10 + offset).toBe(3100);    // stored as 3100mm
  });

  it('cross-entity (different roomIds): offset = 0', () => {
    const fromRef = { roomId: 'r1', vertexIdx: 0 };
    const toRef   = { roomId: 'partition-1', vertexIdx: 0 };
    const syntheticC = { id: '', type: 'H_DISTANCE' as const, pts: [fromRef, toRef] };
    const offset = constraintInteriorOffset(syntheticC, room, 100);
    expect(offset).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm run test -- --run src/components/plan/PlanEditor.dimension.test.ts
```
Expected: PASS (pure logic)

- [ ] **Step 3: Apply all four edits to PlanEditor.tsx**

Apply the four location edits described above. Use the unique surrounding context to locate each edit precisely.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Run all tests**

```bash
npm run test -- --run
```
Expected: all passing

- [ ] **Step 6: Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.dimension.test.ts
git commit -m "feat: DIMENSION tool displays and stores interior dimensions"
```

---

### Task 5: WallThicknessControl + PlanToolbar integration + businessRules comment

**Files:**
- Create: `src/components/plan/WallThicknessControl.tsx`
- Modify: `src/components/plan/PlanToolbar.tsx`
- Modify: `src/components/plan/PlanEditor.tsx` (add `setWallThickness` from store + pass new toolbar props)
- Modify: `src/constants/businessRules.ts`

#### Background

`setWallThickness(mm)` already exists in `projectStore.ts:201`. `PlanEditor` reads `wallThickness` but does not yet subscribe to `setWallThickness` (line 187 reads it, but no `setWallThickness` import).

`PlanToolbar` currently has no `wallThickness` or `onWallThicknessChange` props.

The control shows value in **cm** (like all other UI fields in the editor). `wallThickness` is stored in **mm** (default 100mm = 10cm). Step = 0.5cm (= 5mm). Minimum = 5cm (= 50mm).

The `key={wallThickness}` pattern on the `<input>` resets the field to the prop value when the store changes externally (e.g., undo restoring a prior thickness).

- [ ] **Step 1: Write failing test for WallThicknessControl**

```tsx
// src/components/plan/WallThicknessControl.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WallThicknessControl } from './WallThicknessControl';

describe('WallThicknessControl', () => {
  it('displays wallThickness in cm (100mm → "10")', () => {
    render(<WallThicknessControl wallThickness={100} onChange={() => {}} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.defaultValue).toBe('10');
  });

  it('calls onChange with mm value on blur (type "15" → 150mm)', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it('does not call onChange for invalid value on blur', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange on Enter key', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/components/plan/WallThicknessControl.test.tsx
```
Expected: FAIL with "Cannot find module './WallThicknessControl'"

- [ ] **Step 3: Implement WallThicknessControl**

```tsx
// src/components/plan/WallThicknessControl.tsx
'use client';

interface WallThicknessControlProps {
  wallThickness: number;
  onChange: (mm: number) => void;
}

export const WallThicknessControl = ({ wallThickness, onChange }: WallThicknessControlProps) => {
  const defaultCm = Math.round(wallThickness / 10);

  const commit = (raw: string) => {
    const cm = parseFloat(raw);
    if (!isNaN(cm) && cm >= 5) onChange(Math.round(cm * 10));
  };

  return (
    <div className="flex items-center gap-1 px-0.5">
      <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
        ép.
      </span>
      <input
        key={wallThickness}
        type="number"
        step="0.5"
        min="5"
        defaultValue={defaultCm}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        className="w-10 rounded-md bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-center text-[10px] font-bold outline-none"
        style={{ color: 'var(--text1)' }}
      />
      <span className="text-[9px] font-semibold" style={{ color: 'var(--muted)' }}>cm</span>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --run src/components/plan/WallThicknessControl.test.tsx
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Update PlanToolbar interface and render WallThicknessControl**

In `src/components/plan/PlanToolbar.tsx`:

Add import at top:
```ts
import { WallThicknessControl } from './WallThicknessControl';
```

Update `PlanToolbarProps` interface (add two new fields):
```ts
interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearRoom: () => void;
  wallThickness: number;
  onWallThicknessChange: (mm: number) => void;
}
```

Update destructuring in the component signature to include:
```ts
  wallThickness,
  onWallThicknessChange,
```

At the very end of the toolbar JSX, after the last `</ToolTooltip>` (the clear button), add:

```tsx
<div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
<WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} />
```

- [ ] **Step 6: Wire up PlanEditor to pass the new props**

In `src/components/plan/PlanEditor.tsx`, add the `setWallThickness` store subscription near the other store subscriptions (around line 187-195):

```ts
const setWallThickness = useProjectStore((s) => s.setWallThickness);
```

Find the `<PlanToolbar` JSX (around line 1455) and add the two new props:

```tsx
<PlanToolbar
  ...existing props...
  wallThickness={wallThickness}
  onWallThicknessChange={setWallThickness}
/>
```

- [ ] **Step 7: Add comment to businessRules.ts**

In `src/constants/businessRules.ts`, update the `DOOR_DEFAULT_WIDTH_MM` line:

```ts
// BEFORE:
export const DOOR_DEFAULT_WIDTH_MM = 900;

// AFTER:
// 900mm = rough masonry opening (baie), face-to-face. For straight walls, centerline gap = face-to-face.
export const DOOR_DEFAULT_WIDTH_MM = 900;
```

- [ ] **Step 8: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 9: Run all tests**

```bash
npm run test -- --run
```
Expected: all passing

- [ ] **Step 10: Commit**

```bash
git add src/components/plan/WallThicknessControl.tsx src/components/plan/WallThicknessControl.test.tsx src/components/plan/PlanToolbar.tsx src/components/plan/PlanEditor.tsx src/constants/businessRules.ts
git commit -m "feat: wall thickness control in toolbar, interior dimensions complete"
```
