# Dimension Face Snap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit interior-only dimension system with a full CAD-style face snap tool where each endpoint can independently reference the interior face, axis, or exterior face of any wall.

**Architecture:** `PointRef` gains an optional `face` field (`'INSIDE' | 'AXIS' | 'OUTSIDE'`); a new `constraintFaceOffset` function replaces `constraintInteriorOffset` and reads it. A new `FaceSnapPoint` type and `findNearestFaceSnap` function handle hover detection; `DrawingCanvas` renders three color-coded snap dots per hovered wall. A new `DimensionPopup` component handles dimension input; `WallEdgeEditor` is stripped to thickness-only.

**Tech Stack:** React 18, TypeScript, SVG pointer events, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-05-27-dimension-face-snap-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/project.ts` | Modify | Add `face?` to `PointRef` |
| `src/engine/constraints/interiorOffset.ts` | Delete | Replaced by faceOffset.ts |
| `src/engine/constraints/faceOffset.ts` | Create | `constraintFaceOffset` reading PointRef.face |
| `src/components/plan/DimensionPopup.tsx` | Create | Popup for dimension input (replaces dim part of WallEdgeEditor) |
| `src/components/plan/DrawingCanvas.tsx` | Modify | `FaceSnapPoint` type, `faceSnapHover`/`dimensionSource` props, snap dot rendering |
| `src/components/plan/PlanEditor.tsx` | Modify | `findNearestFaceSnap`, DIMENSION flow refactor, SELECT thickness-only |
| `src/components/plan/WallEdgeEditor.tsx` | Modify | Remove dim props, keep thickness-only |
| `src/components/plan/PlanEditor.toolbar.test.ts` | Modify | Add faceOffset unit tests, update DIMENSION flow tests |
| `src/components/plan/PlanToolbar.test.tsx` | Modify | Remove stale dim prop references if any |

---

## Task 1: Data model — `PointRef.face` + `faceOffset.ts`

**Files:**
- Modify: `src/types/project.ts:45-48`
- Create: `src/engine/constraints/faceOffset.ts`
- Delete: `src/engine/constraints/interiorOffset.ts` (after migration complete in later tasks)
- Test: `src/components/plan/PlanEditor.toolbar.test.ts`

- [ ] **Step 1: Write the failing tests for `constraintFaceOffset`**

Add at the bottom of `src/components/plan/PlanEditor.toolbar.test.ts`:

```typescript
// ── constraintFaceOffset ──────────────────────────────────────────────────────

describe('constraintFaceOffset', () => {
  // Shared test helpers
  const makeRoom = (id: string): import('@/types/project').Room => ({
    id,
    points: [
      { x: 0,   y: 0   },
      { x: 300, y: 0   },
      { x: 300, y: 300 },
      { x: 0,   y: 300 },
    ],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    edgeThicknesses: [20, 20, 20, 20], // 20mm → halfThick = 10mm
  });

  const makeConstraint = (
    fromFace: import('@/types/project').PointRef['face'],
    toFace: import('@/types/project').PointRef['face'],
    type: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH' = 'H_DISTANCE',
  ): import('@/types/project').Constraint => ({
    id: 'c1',
    type,
    pts: [
      { roomId: 'r1', vertexIdx: 0, face: fromFace },
      { roomId: 'r1', vertexIdx: 1, face: toFace },
    ],
  });

  it('INSIDE→INSIDE: retourne −halfThickA − halfThickB', () => {
    // Both axes lean on vertical edges for H_DISTANCE → halfThick = 10 each
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('INSIDE', 'INSIDE'), makeRoom('r1'), 20);
    expect(offset).toBe(10 + 10); // 20
  });

  it('AXIS→AXIS: retourne 0', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('AXIS', 'AXIS'), makeRoom('r1'), 20);
    expect(offset).toBe(0);
  });

  it('OUTSIDE→OUTSIDE: retourne −(halfThickA + halfThickB)', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('OUTSIDE', 'OUTSIDE'), makeRoom('r1'), 20);
    expect(offset).toBe(-(10 + 10)); // -20
  });

  it('INSIDE→OUTSIDE: retourne halfThickA − halfThickB = 0', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('INSIDE', 'OUTSIDE'), makeRoom('r1'), 20);
    expect(offset).toBe(10 - 10); // 0
  });

  it('undefined → traité comme INSIDE (rétrocompatibilité)', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint(undefined, undefined), makeRoom('r1'), 20);
    expect(offset).toBe(20); // same as INSIDE→INSIDE
  });

  it('LENGTH: retourne toujours 0', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('INSIDE', 'INSIDE', 'LENGTH'), makeRoom('r1'), 20);
    expect(offset).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -20
```

Expected: FAIL — `constraintFaceOffset` module not found.

- [ ] **Step 3: Add `face?` to `PointRef` in `src/types/project.ts`**

Replace the existing `PointRef` interface:

```typescript
export interface PointRef {
  roomId: string;
  vertexIdx: number;
  face?: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  // absent / undefined → 'INSIDE' (backward compatible)
}
```

- [ ] **Step 4: Create `src/engine/constraints/faceOffset.ts`**

```typescript
import type { Room, Constraint } from '@/types/project';

/**
 * Resolve the half-thickness of the wall edge most aligned with the constraint
 * direction at a given vertex index.
 *
 * For H_DISTANCE the bounding walls are vertical → preferVerticalEdge = true.
 * For V_DISTANCE the bounding walls are horizontal → preferVerticalEdge = false.
 */
function halfThicknessAt(
  nodeIdx: number,
  room: Room,
  defaultThickness: number,
  preferVerticalEdge: boolean,
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
    const score = preferVerticalEdge ? ady / total : adx / total;
    if (score > bestScore) {
      bestScore = score;
      bestEdge = eIdx;
    }
  }

  if (bestEdge === -1 || bestScore < 0.5) return 0;
  return (room.edgeThicknesses?.[bestEdge] ?? defaultThickness) / 2;
}

/**
 * Compute the total display offset for a constraint, taking each endpoint's
 * face reference into account.
 *
 * Offset semantics (added to stored value to get displayed value):
 *   INSIDE  → +halfThickness  (face is inside the room, closer to interior)
 *   AXIS    →  0
 *   OUTSIDE → −halfThickness  (face is outside, extending beyond axis)
 *
 * This matches the formula:  displayed = stored + offsetA + offsetB
 * and the inverse:           stored    = displayed − offsetA − offsetB
 *
 * Backward compatibility: absent `face` is treated as 'INSIDE'.
 */
export function constraintFaceOffset(
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
  if (p1ref.roomId !== room.id) return 0;

  const preferVerticalEdge = constraint.type === 'H_DISTANCE';

  const halfA = halfThicknessAt(p1ref.vertexIdx, room, defaultThickness, preferVerticalEdge);
  const halfB = halfThicknessAt(p2ref.vertexIdx, room, defaultThickness, preferVerticalEdge);

  const faceOffset = (face: 'INSIDE' | 'AXIS' | 'OUTSIDE' | undefined, half: number): number => {
    const f = face ?? 'INSIDE';
    if (f === 'INSIDE')  return +half;
    if (f === 'OUTSIDE') return -half;
    return 0; // AXIS
  };

  return faceOffset(p1ref.face, halfA) + faceOffset(p2ref.face, halfB);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -20
```

Expected: PASS — all tests including `constraintFaceOffset` describe.

- [ ] **Step 6: Verify TypeScript compilation**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Note: `interiorOffset.ts` is still imported in `DrawingCanvas.tsx` and `PlanEditor.tsx` — that's expected at this stage and will be migrated in later tasks.

- [ ] **Step 7: Commit**

```bash
cd /workspaces/Calpiweb && git add src/types/project.ts src/engine/constraints/faceOffset.ts src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(constraints): PointRef.face + constraintFaceOffset (rétrocompatible)"
```

---

## Task 2: New `DimensionPopup` component

**Files:**
- Create: `src/components/plan/DimensionPopup.tsx`

- [ ] **Step 1: Write a minimal rendering test**

Add a new test file `src/components/plan/DimensionPopup.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DimensionPopup } from './DimensionPopup';

const defaultProps = {
  fromFace: 'INSIDE' as const,
  toFace: 'OUTSIDE' as const,
  dimType: 'H_DISTANCE' as const,
  onDimTypeChange: vi.fn(),
  value: '285.0',
  onValueChange: vi.fn(),
  hasExisting: false,
  onRelease: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('DimensionPopup', () => {
  it('affiche le label de référence I→E', () => {
    render(<DimensionPopup {...defaultProps} />);
    expect(screen.getByText('I→E')).toBeInTheDocument();
  });

  it('affiche la valeur pré-remplie', () => {
    render(<DimensionPopup {...defaultProps} />);
    expect(screen.getByDisplayValue('285.0')).toBeInTheDocument();
  });

  it('appelle onSubmit sur Enter', async () => {
    const onSubmit = vi.fn();
    render(<DimensionPopup {...defaultProps} onSubmit={onSubmit} />);
    const input = screen.getByDisplayValue('285.0');
    await userEvent.type(input, '{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('appelle onCancel sur Escape', async () => {
    const onCancel = vi.fn();
    render(<DimensionPopup {...defaultProps} onCancel={onCancel} />);
    const input = screen.getByDisplayValue('285.0');
    await userEvent.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('bouton Libérer visible si hasExisting=true', () => {
    render(<DimensionPopup {...defaultProps} hasExisting={true} />);
    expect(screen.getByTitle('Libérer la contrainte')).toBeInTheDocument();
  });

  it('bouton Libérer absent si hasExisting=false', () => {
    render(<DimensionPopup {...defaultProps} hasExisting={false} />);
    expect(screen.queryByTitle('Libérer la contrainte')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/DimensionPopup.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `DimensionPopup` not found.

- [ ] **Step 3: Create `src/components/plan/DimensionPopup.tsx`**

```typescript
'use client';

import type { KeyboardEvent } from 'react';
import { CheckCircle2, Unlink } from 'lucide-react';

type Face = 'INSIDE' | 'AXIS' | 'OUTSIDE';
type DimType = 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';

const FACE_LABEL: Record<Face, string> = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' };

export interface DimensionPopupProps {
  screenX?: number;
  screenY?: number;
  above?: boolean;
  fromFace: Face;
  toFace: Face;
  dimType: DimType;
  onDimTypeChange: (t: DimType) => void;
  value: string;
  onValueChange: (v: string) => void;
  hasExisting: boolean;
  onRelease: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const DimensionPopup = ({
  screenX,
  screenY,
  above = true,
  fromFace,
  toFace,
  dimType,
  onDimTypeChange,
  value,
  onValueChange,
  hasExisting,
  onRelease,
  onSubmit,
  onCancel,
}: DimensionPopupProps) => {
  const refLabel = `${FACE_LABEL[fromFace]}→${FACE_LABEL[toFace]}`;
  const positioned = screenX !== undefined && screenY !== undefined;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="absolute z-30 flex flex-col gap-1.5 rounded-xl border border-orange-500/70 bg-zinc-900 p-2 shadow-2xl"
      style={
        positioned
          ? {
              left: screenX,
              top: screenY,
              transform: above
                ? 'translate(-50%, calc(-100% - 10px))'
                : 'translate(-50%, 10px)',
            }
          : { left: '50%', top: '1rem', transform: 'translateX(-50%)' }
      }
    >
      {/* Header: "Cote" + reference label */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Cote</p>
        <span className="text-[9px] font-black tracking-widest text-orange-400">{refLabel}</span>
      </div>

      {/* Type selector + value input */}
      <div className="flex items-center gap-1">
        {/* H / V / L type buttons */}
        <div className="flex gap-0.5">
          {(['H_DISTANCE', 'V_DISTANCE', 'LENGTH'] as const).map((t) => (
            <button
              key={t}
              type="button"
              title={
                t === 'H_DISTANCE' ? 'Distance horizontale'
                  : t === 'V_DISTANCE' ? 'Distance verticale'
                  : 'Longueur'
              }
              onClick={() => onDimTypeChange(t)}
              className={`h-6 w-6 rounded text-[10px] font-black transition-colors ${
                dimType === t
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {t === 'H_DISTANCE' ? 'H' : t === 'V_DISTANCE' ? 'V' : 'L'}
            </button>
          ))}
        </div>

        {/* Value input */}
        <input
          type="number"
          step="0.1"
          className="h-7 w-20 rounded border border-zinc-700 bg-zinc-800 px-2 text-right text-sm font-semibold text-zinc-100 focus:border-orange-500 focus:outline-none"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <span className="text-[10px] text-zinc-500">cm</span>

        {/* Submit */}
        <button
          type="button"
          title="Valider"
          onClick={onSubmit}
          className="flex h-7 w-7 items-center justify-center rounded bg-orange-600 text-white hover:bg-orange-500"
        >
          <CheckCircle2 size={14} />
        </button>

        {/* Release existing constraint */}
        {hasExisting && (
          <button
            type="button"
            title="Libérer la contrainte"
            onClick={onRelease}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Unlink size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/DimensionPopup.test.tsx 2>&1 | tail -20
```

Expected: PASS — all 6 tests.

- [ ] **Step 5: TypeScript check**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/DimensionPopup.tsx src/components/plan/DimensionPopup.test.tsx
git commit -m "feat(plan): DimensionPopup component — saisie cote avec label I/A/E"
```

---

## Task 3: `DrawingCanvas` — `FaceSnapPoint` type + snap dot rendering

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx`

The goal here is to:
1. Export `FaceSnapPoint` type from `DrawingCanvas.tsx`
2. Add `faceSnapHover` and update `dimensionSource` props to the new shape
3. Render 3 colored snap dots when hovering in DIMENSION mode
4. Render the confirmed orange source point with face letter

- [ ] **Step 1: Write tests for the snap rendering logic**

Add to `src/components/plan/PlanEditor.toolbar.test.ts`:

```typescript
// ── FaceSnapPoint — face label ────────────────────────────────────────────────

describe('FaceSnapPoint — label mapping', () => {
  const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' } as const;

  it('INSIDE → "I"', () => { expect(FACE_LABEL['INSIDE']).toBe('I'); });
  it('AXIS → "A"',   () => { expect(FACE_LABEL['AXIS']).toBe('A'); });
  it('OUTSIDE → "E"', () => { expect(FACE_LABEL['OUTSIDE']).toBe('E'); });
});
```

- [ ] **Step 2: Run tests to verify they pass immediately (pure logic)**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Add `FaceSnapPoint` type export and new props to `DrawingCanvas.tsx`**

After the `DeleteHoverTarget` export (line ~27), add:

```typescript
export interface FaceSnapPoint {
  roomId: string;
  vertexIdx: number;
  face: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  worldPos: Point;
  wallNormal: Point; // unit vector perpendicular to wall segment, toward interior
}
```

In `DrawingCanvasProps`, replace:
```typescript
  dimensionSource: { roomId: string; idx: number } | null;
```
with:
```typescript
  faceSnapHover:   FaceSnapPoint | null;
  dimensionSource: {
    ref:      PointRef;
    worldPos: Point;
  } | null;
```

- [ ] **Step 4: Add snap dot rendering in the SVG output of `DrawingCanvas`**

Find the section where `tool === 'DIMENSION'` renders the dimension preview line (search for `dimensionSource` in the component's return JSX). Replace/augment the DIMENSION rendering section.

The snap dots should render as a separate `<g>` layer, after wall elements but before annotations. Insert this block into the JSX return, just before the closing `</svg>` or before the constraints annotation layer:

```tsx
{/* ── Face snap dots (DIMENSION tool hover) ─────────────────────── */}
{tool === 'DIMENSION' && faceSnapHover && (() => {
  const { worldPos, face, wallNormal, roomId, vertexIdx } = faceSnapHover;

  // Locate the hovered segment to draw the three snap positions
  // We need the segment's two endpoints to project worldPos back to proj
  // For simplicity: render dots at fixed offsets along wallNormal from worldPos
  // The snap was computed in PlanEditor; worldPos IS the snapped point.
  // We re-derive the INSIDE/AXIS/OUTSIDE positions from worldPos + face + normal.

  // Find half-thickness for this room/edge
  const room = rooms.find(r => r.id === roomId);
  const n = room ? room.points.length : 0;
  const half = room
    ? (room.edgeThicknesses?.[vertexIdx < n ? vertexIdx : 0] ?? wallThickness) / 2
    : wallThickness / 2;

  // Reconstruct the 3 snap positions from worldPos and face
  let axisPos: Point;
  if (face === 'AXIS') {
    axisPos = worldPos;
  } else if (face === 'INSIDE') {
    axisPos = { x: worldPos.x - wallNormal.x * half, y: worldPos.y - wallNormal.y * half };
  } else {
    axisPos = { x: worldPos.x + wallNormal.x * half, y: worldPos.y - wallNormal.y * half };
  }
  const insidePos:  Point = { x: axisPos.x + wallNormal.x * half, y: axisPos.y + wallNormal.y * half };
  const outsidePos: Point = { x: axisPos.x - wallNormal.x * half, y: axisPos.y - wallNormal.y * half };

  const dots: Array<{ pos: Point; face: 'INSIDE' | 'AXIS' | 'OUTSIDE'; color: string; baseR: number }> = [
    { pos: outsidePos, face: 'OUTSIDE', color: '#3b82f6', baseR: 120 },
    { pos: axisPos,    face: 'AXIS',    color: '#a855f7', baseR: 100 },
    { pos: insidePos,  face: 'INSIDE',  color: '#22c55e', baseR: 120 },
  ];

  return (
    <g>
      {dots.map(({ pos, face: dotFace, color, baseR }) => {
        const isActive = dotFace === face;
        const r = isActive ? baseR * 1.6 : baseR;
        const opacity = isActive ? 1 : 0.5;
        return (
          <circle
            key={dotFace}
            cx={pos.x} cy={pos.y}
            r={r}
            fill={color}
            opacity={opacity}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}
    </g>
  );
})()}

{/* ── Confirmed dimension source point ───────────────────────────── */}
{tool === 'DIMENSION' && dimensionSource && (() => {
  const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' } as const;
  const { worldPos, ref } = dimensionSource;
  const label = FACE_LABEL[ref.face ?? 'INSIDE'];
  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle cx={worldPos.x} cy={worldPos.y} r={180} fill="#f97316" />
      <text
        x={worldPos.x} y={worldPos.y}
        textAnchor="middle" dominantBaseline="central"
        fontSize={160} fontWeight="800" fill="white"
      >
        {label}
      </text>
    </g>
  );
})()}
```

Also update the existing preview line logic: find where `dimensionSource` is used to draw the dashed line and update it to use `dimensionSource.worldPos` instead of resolving via `roomId`/`idx`.

- [ ] **Step 5: Update the place where `dimensionSource` position was resolved**

Search for usage of `dimensionSource.roomId` and `dimensionSource.idx` in the DrawingCanvas JSX. The preview line currently does something like:
```tsx
const srcPt = rooms.find(r => r.id === dimensionSource.roomId)?.points[dimensionSource.idx];
```

Replace with:
```tsx
const srcPt = dimensionSource.worldPos;
```

- [ ] **Step 6: TypeScript check**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -40
```

Expected errors: TypeScript will complain in `PlanEditor.tsx` that it's passing the old-shape `dimensionSource` — that's expected and will be fixed in Task 4. Note the exact errors but don't fix them yet.

- [ ] **Step 7: Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/DrawingCanvas.tsx src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(canvas): FaceSnapPoint type + snap dot rendering DIMENSION mode"
```

---

## Task 4: `PlanEditor` — DIMENSION flow refactor + SELECT thickness-only

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

This is the largest task. It covers:
1. Import `constraintFaceOffset` instead of `constraintInteriorOffset`
2. Import `FaceSnapPoint` from `DrawingCanvas`
3. Replace `dimensionSource` state shape with the new `{ ref: PointRef; worldPos: Point }` shape
4. Add `faceSnapHover` state
5. Add `findNearestFaceSnap` function
6. Refactor `handlePointerMove` DIMENSION branch
7. Refactor `handlePointerDown` DIMENSION branch: two-click flow with face snaps
8. Add `dimensionPopup` state and `openDimensionPopup` / `submitDimensionPopup` handlers
9. Simplify `tapActivateEdge` to thickness-only (remove constraint lookup/display)
10. Rename `submitDimension` → `submitThickness`, remove constraint logic from it
11. Update `<DrawingCanvas>` JSX to pass new props
12. Update `<WallEdgeEditor>` JSX to remove dim props
13. Remove `import { constraintInteriorOffset }` line

- [ ] **Step 1: Write tests for `findNearestFaceSnap` logic**

Add to `src/components/plan/PlanEditor.toolbar.test.ts`:

```typescript
// ── findNearestFaceSnap — snap candidat selection ─────────────────────────────

describe('findNearestFaceSnap — sélection du candidat', () => {
  type FaceType = 'INSIDE' | 'AXIS' | 'OUTSIDE';
  type Candidate = { face: FaceType; dist: number };

  const pickNearest = (candidates: Candidate[]): FaceType =>
    candidates.reduce((best, c) => c.dist < best.dist ? c : best).face;

  it('INSIDE sélectionné quand le curseur est sur la face intérieure', () => {
    const result = pickNearest([
      { face: 'OUTSIDE', dist: 30 },
      { face: 'AXIS',    dist: 15 },
      { face: 'INSIDE',  dist: 5  },
    ]);
    expect(result).toBe('INSIDE');
  });

  it('AXIS sélectionné quand le curseur est sur l\'axe', () => {
    const result = pickNearest([
      { face: 'OUTSIDE', dist: 20 },
      { face: 'AXIS',    dist: 3  },
      { face: 'INSIDE',  dist: 20 },
    ]);
    expect(result).toBe('AXIS');
  });

  it('retourne null si tous les segments sont hors seuil', () => {
    const threshold = 80;
    const candidates: Candidate[] = [];
    // No candidates within threshold
    const result = candidates.length > 0
      ? pickNearest(candidates)
      : null;
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass immediately (pure logic)**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Update imports in `PlanEditor.tsx`**

Replace:
```typescript
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
```
with:
```typescript
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
```

Also add `FaceSnapPoint` to the DrawingCanvas import:
```typescript
import {
  DrawingCanvas,
  type EditingEdgeState, type HoveredEdge, type SnapPreview,
  type HoveredZoneEdge, type EditingZoneEdge, type HoveredPartitionEdge,
  type PartitionDimLine,
  type DeleteHoverTarget,
  type FaceSnapPoint,    // ← add this
} from './DrawingCanvas';
```

- [ ] **Step 4: Replace `dimensionSource` state and add `faceSnapHover` + `dimensionPopup`**

Find the existing `dimensionSource` state declaration:
```typescript
const [dimensionSource, setDimensionSource] = useState<{ roomId: string; idx: number } | null>(null);
```

Replace with:
```typescript
const [faceSnapHover, setFaceSnapHover] = useState<FaceSnapPoint | null>(null);
const [dimensionSource, setDimensionSource] = useState<{
  ref:      PointRef;
  worldPos: Point;
} | null>(null);
const [dimensionPopup, setDimensionPopup] = useState<{
  fromRef:  PointRef;
  toRef:    PointRef;
  dimType:  'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';
  value:    string; // displayed value in cm
} | null>(null);
```

- [ ] **Step 5: Add `findNearestFaceSnap` function**

Add this function inside the `PlanEditor` component, before the event handlers:

```typescript
const findNearestFaceSnap = useCallback((cursor: Point): FaceSnapPoint | null => {
  const threshold = 80 / scale;
  let best: { snap: FaceSnapPoint; dist: number } | null = null;

  const trySegment = (
    p1: Point, p2: Point,
    roomId: string, vertexIdx: number,
    halfThick: number,
  ) => {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.001) return;

    const t = Math.max(0, Math.min(1, ((cursor.x - p1.x) * dx + (cursor.y - p1.y) * dy) / len2));
    const proj: Point = { x: p1.x + t * dx, y: p1.y + t * dy };
    if (distance(cursor, proj) > threshold) return;

    // Normal pointing inward (rotate segment 90° CCW)
    const rawNx = -dy / Math.sqrt(len2), rawNy = dx / Math.sqrt(len2);
    const wallNormal: Point = { x: rawNx, y: rawNy };

    const candidates: Array<{ face: 'INSIDE' | 'AXIS' | 'OUTSIDE'; pos: Point }> = [
      { face: 'INSIDE',  pos: { x: proj.x + wallNormal.x * halfThick, y: proj.y + wallNormal.y * halfThick } },
      { face: 'AXIS',    pos: proj },
      { face: 'OUTSIDE', pos: { x: proj.x - wallNormal.x * halfThick, y: proj.y - wallNormal.y * halfThick } },
    ];

    for (const { face, pos } of candidates) {
      const d = distance(cursor, pos);
      if (!best || d < best.dist) {
        best = {
          snap: { roomId, vertexIdx, face, worldPos: pos, wallNormal },
          dist: d,
        };
      }
    }
  };

  for (const room of rooms) {
    const n = room.points.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const p1 = room.points[i]!;
      const p2 = room.points[(i + 1) % n]!;
      const halfThick = (room.edgeThicknesses?.[i] ?? wallThickness) / 2;
      trySegment(p1, p2, room.id, i, halfThick);
    }
    for (const part of room.partitions ?? []) {
      trySegment(part.p1, part.p2, room.id, 0, part.thickness / 2);
    }
    for (const zone of room.excludedZones ?? []) {
      const zn = zone.points.length;
      for (let i = 0; i < zn; i++) {
        trySegment(zone.points[i]!, zone.points[(i + 1) % zn]!, zone.id, i, 0);
      }
    }
  }

  return best ? best.snap : null;
}, [rooms, scale, wallThickness]);
```

- [ ] **Step 6: Update `handlePointerMove` — DIMENSION branch**

Find the existing DIMENSION branch in `handlePointerMove` (search for `tool === 'DIMENSION'` in the move handler). Replace the entire DIMENSION branch with:

```typescript
if (tool === 'DIMENSION') {
  setFaceSnapHover(findNearestFaceSnap(raw));
  return;
}
```

Also in the `else` (non-DIMENSION) branch, add `setFaceSnapHover(null)` and `setDimensionSource(null)` if not already present (they should be cleared when leaving the tool context):

```typescript
} else {
  setDeleteHover(null);
  setFaceSnapHover(null);
  // (dimensionSource cleared on tool change, not here)
}
```

- [ ] **Step 7: Update `handlePointerDown` — DIMENSION branch**

Find the existing DIMENSION branch in `handlePointerDown`. It currently calls `setDimensionSource` with `{ roomId, idx }` from vertex click. Replace entirely with:

```typescript
if (tool === 'DIMENSION') {
  if (!dimensionSource) {
    // First click: confirm snap point as source
    if (faceSnapHover) {
      setDimensionSource({
        ref: {
          roomId: faceSnapHover.roomId,
          vertexIdx: faceSnapHover.vertexIdx,
          face: faceSnapHover.face,
        },
        worldPos: faceSnapHover.worldPos,
      });
    }
    // Click in void → ignore
    return;
  }
  // Second click
  if (faceSnapHover) {
    openDimensionPopup(
      dimensionSource.ref,
      {
        roomId: faceSnapHover.roomId,
        vertexIdx: faceSnapHover.vertexIdx,
        face: faceSnapHover.face,
      },
      dimensionSource.worldPos,
      faceSnapHover.worldPos,
    );
    setDimensionSource(null);
  } else {
    // Click in void → cancel
    setDimensionSource(null);
  }
  return;
}
```

- [ ] **Step 8: Add `openDimensionPopup` helper**

Add this function inside the component:

```typescript
const openDimensionPopup = useCallback((
  fromRef: PointRef,
  toRef: PointRef,
  fromWorld: Point,
  toWorld: Point,
) => {
  const dx = Math.abs(toWorld.x - fromWorld.x);
  const dy = Math.abs(toWorld.y - fromWorld.y);
  const dimType: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH' =
    dx >= dy ? 'H_DISTANCE' : 'V_DISTANCE';

  const rawValue = dimType === 'H_DISTANCE' ? dx : dy;

  // Find existing constraint between these two vertices
  const existing = constraints.find((c) =>
    (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
    c.pts.length >= 2 &&
    ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
      c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
     (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
      c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
  );

  let displayedValue: number;
  if (existing) {
    // Pre-fill with existing constraint value (apply face offset for display)
    const room = rooms.find(r => r.id === fromRef.roomId);
    const offset = room ? constraintFaceOffset({ ...existing, pts: [fromRef, toRef] }, room, wallThickness) : 0;
    displayedValue = ((existing.value as number ?? 0) + offset) / 10;
  } else {
    displayedValue = rawValue / 10;
  }

  setDimensionPopup({
    fromRef,
    toRef,
    dimType: existing ? (existing.type as 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH') : dimType,
    value: displayedValue.toFixed(1),
  });
}, [constraints, rooms, wallThickness]);
```

- [ ] **Step 9: Add `submitDimensionPopup` and `releaseDimensionPopup` handlers**

```typescript
const submitDimensionPopup = useCallback(() => {
  if (!dimensionPopup) return;
  const { fromRef, toRef, dimType, value } = dimensionPopup;
  const displayedMm = parseFloat(value) * 10;
  if (isNaN(displayedMm)) return;

  const room = rooms.find(r => r.id === fromRef.roomId);
  const offset = room
    ? constraintFaceOffset({ id: '', type: dimType, pts: [fromRef, toRef] }, room, wallThickness)
    : 0;
  const storedMm = displayedMm - offset;

  pushHistory();

  // Remove existing constraint between these vertices if present
  const existingId = constraints.find((c) =>
    (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
    c.pts.length >= 2 &&
    ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
      c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
     (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
      c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
  )?.id;

  const newConstraints = existingId
    ? constraints.filter(c => c.id !== existingId)
    : [...constraints];

  newConstraints.push({
    id: generateId(),
    type: dimType,
    pts: [fromRef, toRef],
    value: storedMm,
  });

  const result = buildAndSolve(rooms, newConstraints, wallThickness);
  if (result.ok) {
    setRoomsAndConstraints(result.rooms, result.constraints);
  }

  setDimensionPopup(null);
}, [dimensionPopup, rooms, constraints, wallThickness, pushHistory, buildAndSolve, setRoomsAndConstraints]);

const releaseDimensionPopup = useCallback(() => {
  if (!dimensionPopup) return;
  const { fromRef, toRef } = dimensionPopup;

  const existingId = constraints.find((c) =>
    c.pts.length >= 2 &&
    ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
      c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
     (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
      c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
  )?.id;

  if (existingId) {
    pushHistory();
    const newConstraints = constraints.filter(c => c.id !== existingId);
    const result = buildAndSolve(rooms, newConstraints, wallThickness);
    if (result.ok) setRoomsAndConstraints(result.rooms, result.constraints);
  }
  setDimensionPopup(null);
}, [dimensionPopup, constraints, rooms, wallThickness, pushHistory, buildAndSolve, setRoomsAndConstraints]);
```

- [ ] **Step 10: Simplify `tapActivateEdge` to thickness-only**

Find `tapActivateEdge` (around line 1141). Remove all lines that:
- Lookup constraints for the edge (`edgeDimConstraintIds`, `hDist`, `vDist`, `lenC`)
- Call `constraintInteriorOffset`
- Set `editValue` with a dimension value
- Set `editingEdgeConstraintType`

Keep only:
```typescript
setEditingEdge({ roomId, edgeIndex });
const t = (room.edgeThicknesses?.[edgeIndex] ?? wallThickness);
setEditingEdgeThicknessValue(String(t / 10));
```

- [ ] **Step 11: Rename `submitDimension` → `submitThickness`, remove constraint logic**

Find the `submitDimension` function. Rename it to `submitThickness`. Remove all code that:
- Reads `editValue` as a constraint value
- Calls `constraintInteriorOffset`
- Creates/modifies constraints

Keep only the thickness update logic:
```typescript
const submitThickness = useCallback(() => {
  if (!editingEdge) return;
  const mm = parseFloat(editingEdgeThicknessValue) * 10;
  if (isNaN(mm) || mm <= 0) return;

  pushHistory();
  const updatedRooms = rooms.map((r) => {
    if (r.id !== editingEdge.roomId) return r;
    const thicknesses = [...(r.edgeThicknesses ?? r.edges.map(() => wallThickness))];
    thicknesses[editingEdge.edgeIndex] = mm;
    return { ...r, edgeThicknesses: thicknesses };
  });
  setRoomsAndConstraints(updatedRooms, constraints);
  setEditingEdge(null);
}, [editingEdge, editingEdgeThicknessValue, rooms, constraints, wallThickness, pushHistory, setRoomsAndConstraints]);
```

Update any call sites that referenced `submitDimension` to use `submitThickness`.

- [ ] **Step 12: Update Escape handler and `onChangeTool`**

In the Escape key handler, add cleanup:
```typescript
setFaceSnapHover(null);
setDimensionSource(null);
setDimensionPopup(null);
```

In `onChangeTool` (the function passed to `PlanToolbar`), add:
```typescript
setFaceSnapHover(null);
setDimensionSource(null);
setDimensionPopup(null);
```

- [ ] **Step 13: Update `<DrawingCanvas>` JSX**

Find the `<DrawingCanvas ... />` usage and update props:
- Replace `dimensionSource={{ roomId: ..., idx: ... }}` with `dimensionSource={dimensionSource}`
- Add `faceSnapHover={faceSnapHover}`

- [ ] **Step 14: Add `<DimensionPopup>` to the component JSX**

Add import:
```typescript
import { DimensionPopup } from './DimensionPopup';
```

Add the popup render (near `WallEdgeEditor` in the JSX):
```tsx
{dimensionPopup && (
  <DimensionPopup
    fromFace={dimensionPopup.fromRef.face ?? 'INSIDE'}
    toFace={dimensionPopup.toRef.face ?? 'INSIDE'}
    dimType={dimensionPopup.dimType}
    onDimTypeChange={(t) => setDimensionPopup(prev => prev ? { ...prev, dimType: t } : null)}
    value={dimensionPopup.value}
    onValueChange={(v) => setDimensionPopup(prev => prev ? { ...prev, value: v } : null)}
    hasExisting={constraints.some((c) =>
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === dimensionPopup.fromRef.roomId &&
        c.pts[0]!.vertexIdx === dimensionPopup.fromRef.vertexIdx &&
        c.pts[1]!.roomId === dimensionPopup.toRef.roomId &&
        c.pts[1]!.vertexIdx === dimensionPopup.toRef.vertexIdx) ||
       (c.pts[0]!.roomId === dimensionPopup.toRef.roomId &&
        c.pts[0]!.vertexIdx === dimensionPopup.toRef.vertexIdx &&
        c.pts[1]!.roomId === dimensionPopup.fromRef.roomId &&
        c.pts[1]!.vertexIdx === dimensionPopup.fromRef.vertexIdx))
    )}
    onRelease={releaseDimensionPopup}
    onSubmit={submitDimensionPopup}
    onCancel={() => setDimensionPopup(null)}
  />
)}
```

- [ ] **Step 15: TypeScript check**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors (or only errors from Task 5's `WallEdgeEditor` props if not yet done).

- [ ] **Step 16: Run full test suite**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 17: Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/PlanEditor.tsx
git commit -m "feat(plan): DIMENSION face-snap flow — findNearestFaceSnap, two-click CAD workflow, DimensionPopup integration"
```

---

## Task 5: `WallEdgeEditor` — simplify to thickness-only

**Files:**
- Modify: `src/components/plan/WallEdgeEditor.tsx`

- [ ] **Step 1: Write tests for thickness-only WallEdgeEditor**

Add a test file `src/components/plan/WallEdgeEditor.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WallEdgeEditor } from './WallEdgeEditor';

const defaultProps = {
  thicknessValue: '20.0',
  onThicknessChange: vi.fn(),
  hasExistingConstraint: false,
  onRelease: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('WallEdgeEditor (thickness-only)', () => {
  it('affiche le champ épaisseur avec la valeur', () => {
    render(<WallEdgeEditor {...defaultProps} />);
    expect(screen.getByDisplayValue('20.0')).toBeInTheDocument();
  });

  it('n\'affiche pas de sélecteur H/V/L', () => {
    render(<WallEdgeEditor {...defaultProps} />);
    expect(screen.queryByText('H')).not.toBeInTheDocument();
    expect(screen.queryByText('V')).not.toBeInTheDocument();
  });

  it('appelle onSubmit sur Enter', async () => {
    const onSubmit = vi.fn();
    render(<WallEdgeEditor {...defaultProps} onSubmit={onSubmit} />);
    const input = screen.getByDisplayValue('20.0');
    await userEvent.type(input, '{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('appelle onCancel sur Escape', async () => {
    const onCancel = vi.fn();
    render(<WallEdgeEditor {...defaultProps} onCancel={onCancel} />);
    const input = screen.getByDisplayValue('20.0');
    await userEvent.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/WallEdgeEditor.test.tsx 2>&1 | tail -20
```

Expected: FAIL — either WallEdgeEditor not found or props mismatch.

- [ ] **Step 3: Rewrite `WallEdgeEditor.tsx` to thickness-only**

Replace the entire file with:

```typescript
'use client';

import { CheckCircle2, Unlink } from 'lucide-react';
import type { KeyboardEvent } from 'react';

interface WallEdgeEditorProps {
  screenX?: number;
  screenY?: number;
  above?: boolean;
  thicknessValue: string;
  onThicknessChange: (v: string) => void;
  hasExistingConstraint: boolean;
  onRelease: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const WallEdgeEditor = ({
  screenX,
  screenY,
  above = true,
  thicknessValue,
  onThicknessChange,
  hasExistingConstraint,
  onRelease,
  onSubmit,
  onCancel,
}: WallEdgeEditorProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };

  const positioned = screenX !== undefined && screenY !== undefined;

  return (
    <div
      className="absolute z-30 flex flex-col gap-1.5 rounded-xl border border-orange-500/70 bg-zinc-900 p-2 shadow-2xl"
      style={
        positioned
          ? {
              left: screenX,
              top: screenY,
              transform: above
                ? 'translate(-50%, calc(-100% - 10px))'
                : 'translate(-50%, 10px)',
            }
          : { left: '50%', top: '1rem', transform: 'translateX(-50%)' }
      }
    >
      {/* Header label */}
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 px-0.5">Mur — Épaisseur</p>

      {/* Thickness value row */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.1"
          className="h-7 w-20 rounded border border-zinc-700 bg-zinc-800 px-2 text-right text-sm font-semibold text-zinc-100 focus:border-orange-500 focus:outline-none"
          value={thicknessValue}
          onChange={(e) => onThicknessChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <span className="text-[10px] text-zinc-500">cm</span>

        <button
          type="button"
          title="Valider"
          onClick={onSubmit}
          className="flex h-7 w-7 items-center justify-center rounded bg-orange-600 text-white hover:bg-orange-500"
        >
          <CheckCircle2 size={14} />
        </button>

        {hasExistingConstraint && (
          <button
            type="button"
            title="Libérer la contrainte"
            onClick={onRelease}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Unlink size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/WallEdgeEditor.test.tsx 2>&1 | tail -20
```

Expected: PASS — all 4 tests.

- [ ] **Step 5: TypeScript check**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. If PlanEditor.tsx still passes removed props to WallEdgeEditor, fix those call sites now.

- [ ] **Step 6: Run full test suite**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/WallEdgeEditor.tsx src/components/plan/WallEdgeEditor.test.tsx
git commit -m "refactor(plan): WallEdgeEditor — épaisseur uniquement, suppression props dimension"
```

---

## Task 6: Cleanup — remove `interiorOffset.ts`, update remaining usages and tests

**Files:**
- Delete: `src/engine/constraints/interiorOffset.ts`
- Modify: `src/components/plan/DrawingCanvas.tsx` (remove stale import)
- Modify: `src/components/plan/PlanEditor.toolbar.test.ts` (update DIMENSION-related tests)
- Modify: `src/components/plan/PlanToolbar.test.tsx` (verify no stale props)

- [ ] **Step 1: Remove `constraintInteriorOffset` import from `DrawingCanvas.tsx`**

Find and remove:
```typescript
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
```

Search for any usage of `constraintInteriorOffset` inside `DrawingCanvas.tsx` and replace with `constraintFaceOffset` (add the import):
```typescript
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
```

- [ ] **Step 2: Check no remaining imports of `interiorOffset`**

```bash
cd /workspaces/Calpiweb && grep -r "interiorOffset" src/ --include="*.ts" --include="*.tsx"
```

Expected: no results.

- [ ] **Step 3: Delete `interiorOffset.ts`**

```bash
cd /workspaces/Calpiweb && rm src/engine/constraints/interiorOffset.ts
```

- [ ] **Step 4: Check `PlanToolbar.test.tsx` for stale props**

```bash
cd /workspaces/Calpiweb && grep -n "onDelete\|canDelete\|deleteTooltipLabel\|dimValue\|onDimChange\|constraintType\|onConstraintTypeChange" src/components/plan/PlanToolbar.test.tsx
```

If any found, remove those prop references from the test's `defaultProps` and test bodies.

- [ ] **Step 5: Run full test suite**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -30
```

Expected: All tests pass, including the new `constraintFaceOffset`, `DimensionPopup`, and `WallEdgeEditor` tests.

- [ ] **Step 6: TypeScript full check**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd /workspaces/Calpiweb && git add -A
git commit -m "chore(cleanup): supprimer interiorOffset.ts, migrer tous les appels vers constraintFaceOffset"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Task |
|---|---|
| §2 `PointRef.face` field | Task 1 |
| §2 `constraintFaceOffset` replaces `constraintInteriorOffset` | Task 1 |
| §3 `FaceSnapPoint` type exported from DrawingCanvas | Task 3 |
| §4 `findNearestFaceSnap` in PlanEditor | Task 4 |
| §4 snap threshold 80/scale | Task 4 (step 5) |
| §4 3 candidates INSIDE/AXIS/OUTSIDE per segment | Task 4 (step 5) |
| §4 `halfThickness` from `edgeThicknesses` or `partition.thickness` or 0 for zones | Task 4 (step 5) |
| §5 `faceSnapHover` + `dimensionSource` props on DrawingCanvas | Task 3 |
| §5 3 colored dots (blue/purple/green), active one enlarged ×1.6 | Task 3 (step 4) |
| §5 orange confirmed source dot with I/A/E letter | Task 3 (step 4) |
| §6 `handlePointerMove` DIMENSION branch → `findNearestFaceSnap` | Task 4 (step 6) |
| §6 `handlePointerDown` DIMENSION branch — 1st/2nd click logic | Task 4 (step 7) |
| §6 `dimensionPopup` state | Task 4 (step 4) |
| §6 `openDimensionPopup` — auto-detect H/V, pre-fill existing | Task 4 (step 8) |
| §6 Escape / tool change clears source + hover | Task 4 (step 12) |
| §7 `DimensionPopup` component with face label, H/V/L toggle, value input | Task 2 |
| §8 `WallEdgeEditor` thickness-only | Task 5 |
| §9 `tapActivateEdge` → thickness only | Task 4 (step 10) |
| §9 `submitDimension` → `submitThickness` | Task 4 (step 11) |
| §10 Dimension line auto-positioned (existing behavior preserved) | Existing code untouched |
| §12 `interiorOffset.ts` deleted | Task 6 |

### Backward Compatibility

`PointRef.face` is optional → all existing constraints load without `face` and are treated as `INSIDE`, matching the old `constraintInteriorOffset` behavior. The stored solver value is unchanged.

### Notes for Implementer

- **`buildAndSolve` / `setRoomsAndConstraints`**: use whichever pattern the existing `submitDimension` uses — likely `setProject` or direct store mutation. Mirror the existing pattern exactly.
- **`pushHistory`**: call before any constraint mutation, same as existing code.
- **DrawingCanvas snap rendering** (Task 3, step 4): The `axisPos` re-derivation from `worldPos + face + wallNormal` is a reconstruction to find all 3 dot positions given only the active snap. This avoids threading the full segment through; it's a rendering approximation that's geometrically correct when `halfThick > 0`. For zones (`halfThick = 0`) all three dots collapse to the same point — that's acceptable per §11.
- **Task 4 is large** — do it in one subagent session with careful step-by-step execution. TypeScript will show intermediate errors between steps (e.g. after step 3 but before step 13). That's normal; check after step 15.
