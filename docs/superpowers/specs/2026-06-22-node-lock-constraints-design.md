# Node Lock Constraints — Design Spec

## Goal

Allow the user to lock any node (and therefore any wall segment) so that its position cannot be accidentally modified when editing dimensions or rearranging the plan. The first node traced is always locked by default to anchor the drawing.

## Context

The wall engine stores geometry as a node/segment graph (`WallNode[]` + `Wall[]`). Today, any node can be dragged freely — there is no mechanism to protect reference points. This creates instability when the user adjusts a dimension and the solver propagates changes to nodes they wanted to stay fixed.

## Data Model

Add one optional field to `WallNode` in `src/types/wall.ts`:

```typescript
interface WallNode {
  id: string;
  x: number;
  y: number;
  locked?: boolean; // absent or false = free
}
```

No field is added to `Wall`. A segment is considered "locked" when **both** its endpoint nodes are locked. The store's `updateNode` already accepts a partial patch — no store changes are required.

**First node rule:** the very first node created in a drawing session (first `onAddNode` call when `nodes` is empty) is created with `locked: true`.

## Interactions

### Dedicated LOCK tool

A new `LOCK` tool is added to the toolbar. When active:

- **Click on a node** → toggles `node.locked` (calls `onUpdateNode(id, { locked: !node.locked })`)
- **Click on a wall segment** → toggles `locked` on both endpoint nodes simultaneously, in a single undo step

### Double-click toggle (SELECT mode)

In SELECT mode:

- **Double-click on a node** → same toggle as LOCK tool click
- **Double-click on a wall segment** → same as LOCK tool click on segment (toggles both nodes)

Both paths call `onUpdateNode` — the same action, two entry points.

## Visual Rendering

### Locked node

- Stroke color: `#27ae60` (green)
- Fill: `#eafaf1` (light green tint)
- A small lock icon (SVG, ~9×12px) floats above the node center

### Locked segment

A wall segment renders green (`stroke: #27ae60`) **only when both endpoint nodes are locked**. If only one endpoint is locked, the segment keeps its default color and only the locked node renders green.

### LOCK tool in toolbar

The LOCK tool button uses the lock icon in green and follows the same button pattern as existing tools (SELECT, MUR, etc.). When the LOCK tool is active, hovering over a free node or segment shows a `pointer` cursor. Hovering over a locked node in SELECT mode shows a `not-allowed` cursor.

## Behavior Guards

When a node has `locked === true`, the following operations are blocked:

| Operation | Result |
|---|---|
| Drag node (SELECT mode) | Blocked silently — cursor `not-allowed` on hover |
| Perpendicular wall segment drag | Blocked if either endpoint node is locked |
| Node snap-merge on pointer release | Blocked if either involved node is locked |
| Wall deletion | Allowed — orphaned locked node persists |
| Wall split on locked segment | Allowed — newly inserted node is free by default |
| Undo / Redo | Lock state is part of wall engine snapshot — fully reversible |

## Scope Boundaries

- **In scope:** position locking (prevents drag and merge)
- **Out of scope:** length constraints, angle constraints, solver-driven dimensions (separate feature)
- **Out of scope:** locking excluded zones

## Files Changed

| File | Change |
|---|---|
| `src/types/wall.ts` | Add `locked?: boolean` to `WallNode` |
| `src/components/plan/WallDrawingCanvas.tsx` | LOCK tool handling, double-click toggle, drag/merge guards, green rendering |
| `src/app/project/[id]/page.tsx` | LOCK tool button in toolbar |
| `src/store/projectStore.ts` | No change needed |

## Testing

- Unit: locked node cannot be dragged (guard returns early)
- Unit: segment click in LOCK mode locks both endpoint nodes
- Unit: first node created with `locked: true`
- Unit: double-click on node in SELECT mode toggles lock
- Integration: undo after lock toggle restores previous state
