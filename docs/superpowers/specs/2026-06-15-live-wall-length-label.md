# Live Wall Length Label Design Spec

**Date:** 2026-06-15
**Status:** Approved

## Problem

While drawing a wall with the WALL tool, the user has no indication of the length of the segment currently being drawn until after they click to place the next point. This makes it hard to draw walls of a precise length without trial and error or relying on auto-cotations after the fact.

## Goals

- Show the length of the in-progress wall segment live, updating as the cursor moves
- Keep it readable and visually consistent with existing plan annotations (auto-cotations, tool status bar)
- No behavior change to snapping, orthogonal mode, or chain logic — purely a visual addition

## Design

### 1. Trigger condition

The label renders exactly when the existing `chainPreview` (in `WallDrawingCanvas.tsx`) is non-null — i.e. the WALL tool is active, at least one point has been placed, and the cursor is far enough from the last node (`len >= 0.5` screen px). It disappears under the same conditions the dashed preview segment disappears (chain closed, cancelled, or tool switched).

### 2. Value & format

Length = distance in world units (mm) between the last placed chain node and the current cursor position (`cursor` state, already snap-adjusted). Formatted with the existing `formatCm()` helper from `@/utils/formatters`, matching the format used by auto-cotation labels (e.g. `"240.0 cm"`).

### 3. Position & style

- Positioned at the screen-space midpoint of the preview segment, offset perpendicular to the segment's direction by ~14px (same offset pattern as auto-cotation labels in `wallCotation.ts` / rendered in `WallDrawingCanvas.tsx`).
- Rendered as **horizontal text** (own `<g>`, not inside the rotated `chainPreview` transform group), so it stays readable at any wall angle.
- Small rounded pill background using `var(--surf)` fill and `var(--bdr)` stroke (consistent with `ToolStatusBar`), with bold monospace text colored `#e67e22` (the chain-preview accent color), so it visually associates with the dashed preview segment.

### 4. Edge cases

- Same minimum-length guard as `chainPreview` itself (`len < 0.5` → nothing rendered, inherited for free since the label is gated on `chainPreview !== null`).
- Orthogonal snap (Shift) and wall/node snapping already adjust `cursor` before `chainPreview` is computed — the label reflects the final (post-snap) length with no additional logic.

---

## Architecture

| Action | File | Responsibility |
|--------|------|-----------------|
| Modify | `src/components/plan/WallDrawingCanvas.tsx` | Add a `chainLengthLabel` computation (mirrors `chainPreview`, computes world-space length + screen-space label position) and render it as a pill + text `<g>` alongside the existing chain preview |
| Unchanged | `src/utils/formatters.ts` | `formatCm` reused as-is |

## Testing

- Component test for `WallDrawingCanvas`: with the WALL tool active, after placing one point and moving the pointer, a label showing the formatted length (`formatCm` of the world distance) is rendered; the label is absent when no chain is in progress.
