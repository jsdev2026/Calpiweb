# Wall Thickness Awareness — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

## Problem

The plan editor currently measures and displays all dimensions as centerline-to-centerline distances (vertex-to-vertex). This means:

- When a user types "4000 mm" for a room width, the interior space is actually `4000 - t_left/2 - t_right/2` mm — smaller than intended.
- There is no UI in the plan editor to change the default wall thickness (100 mm); only the per-edge THICKNESS tool exists.
- Door openings are already stored as face-to-face (centerline gap = face-to-face for straight walls) — no change needed.

## Decisions

- **Shared walls (Q1):** Each room measures to its own interior face independently. No shared-wall reconciliation.
- **Door opening (Q2):** 90 cm = rough opening (baie), face-to-face of masonry. This is already the case in the current implementation; no code change required.
- **Default thickness (Q3):** A default thickness control lives in the plan editor (always visible), with per-edge override still possible via the THICKNESS tool.

## Approach: UI-Layer Conversion (Approach A)

The constraint solver continues to operate on centerline distances. All conversions happen exclusively in the UI layer:

- **Display:** `shown = stored − offset`
- **Input:** `stored = typed + offset`

where `offset = constraintInteriorOffset(constraint, room, project.wallThickness)`.

The solver, `Constraint` type, and data model are untouched.

## Architecture

### New file: `src/engine/constraints/interiorOffset.ts`

Pure utility — no React, no side effects.

```ts
export function constraintInteriorOffset(
  constraint: Constraint,
  room: Room,
  defaultThickness: number
): number
```

**Logic per constraint type:**

| Type | Offset |
|------|--------|
| `LENGTH` | `0` — wall face length = centerline length for straight walls |
| `H_DISTANCE` (nodes i, j) | `t_i / 2 + t_j / 2` — thickness of the most-vertical edge adjacent to each node |
| `V_DISTANCE` (nodes i, j) | `t_i / 2 + t_j / 2` — thickness of the most-horizontal edge adjacent to each node |

**Edge classification:**
- For `H_DISTANCE`: look at the two edges incident to node i; pick the one whose direction makes an angle < 45° with the Y-axis (most vertical). Its thickness = `room.edgeThicknesses[k] ?? defaultThickness`. Repeat for node j.
- For `V_DISTANCE`: same but pick the edge most horizontal (angle < 45° with X-axis).
- If no qualifying edge is found (degenerate polygon), return 0 for that node's contribution.

### Modified: constraint display/input component

The component that renders and edits a constraint value (currently in `PlanEditor.tsx` or a dedicated panel) applies the offset:

- On render: compute offset once, subtract from stored value for display.
- On user commit (Enter / blur): add offset back before calling the store action.

### New component: `src/components/plan/WallThicknessControl.tsx`

A compact numeric input in the plan toolbar:

- Reads `project.wallThickness` from the store.
- Accepts integer mm values, minimum 50 mm, step 5 mm.
- Calls `setWallThickness(value)` on Enter or blur.
- Placed at the bottom of `PlanToolbar`, separated by a divider.
- Labeled "ép." (épaisseur) with the unit "mm" inline.

### Modified: `src/constants/businessRules.ts`

Add a comment on `DOOR_DEFAULT_WIDTH_MM` clarifying that this value is the rough opening (baie), face-to-face of masonry — equivalent to the centerline gap for straight walls.

## Out of Scope

- Angled or curved walls (vertices not on a rectilinear grid) — offset computation returns 0 gracefully.
- Shared-wall thickness reconciliation between rooms.
- Exporting interior dimensions in any output format.
- Changing the coordinate system (vertices remain on centerlines).

## Testing

- Unit tests for `constraintInteriorOffset`: H_DISTANCE with uniform thickness, H_DISTANCE with mixed per-edge thickness, V_DISTANCE, LENGTH (returns 0), degenerate empty polygon.
- UI integration: type an interior dimension → verify stored constraint value = typed + offset.
- Default thickness control: change default → verify `project.wallThickness` updated, per-edge override unchanged.
