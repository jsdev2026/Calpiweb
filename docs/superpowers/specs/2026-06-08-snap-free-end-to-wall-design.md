# Snap Free-End Node to Wall on Drop — Design Spec

## Goal

When the user drags a free-end node (SELECT tool) and releases it on a wall face, the wall is split at the snap point and the dragged node is inserted at the junction — connecting the open wall end to the existing wall.

## Context

In the current SELECT tool drag flow:
- Face snaps are already detected visually (the cursor/node sticks to the wall during drag)
- On release, only `endpoint` snaps are acted on (node merge via `onMergeNodes`)
- Face snaps on release are silently ignored — the node just moves to the snap position without any topological connection

## Scope

- **Tool:** SELECT only
- **Node condition:** Degree-1 nodes only (free end — connected to exactly 1 wall). Nodes with degree ≥ 2 keep their current drag behavior.
- **Target:** Wall face snap (type `'face'`). The target wall is never the wall already connected to the dragged node (already excluded by the existing `snapWalls` filter).

## Architecture

### New store action: `connectNodeToWall`

```typescript
connectNodeToWall(wallId: string, nodeId: string, newPos: Point): void
```

Atomic sequence:
1. Find wall `W` by `wallId` → read `W.node1Id`, `W.node2Id`, `W.thickness`
2. Move node `nodeId` to `newPos`
3. Delete wall `W`
4. Create wall `W1`: `W.node1Id → nodeId` (same thickness as `W`)
5. Create wall `W2`: `nodeId → W.node2Id` (same thickness as `W`)

Wrapped in `updateActive()` — persisted and undoable via existing undo/redo history.

`wallFaceCycles` re-detects faces automatically on next render from the updated topology.

### Canvas changes (`WallDrawingCanvas.tsx`)

**During drag:** No change. Face snap visual already works.

**On pointer up (`handlePointerUp`)** — add after the existing endpoint merge case:

```typescript
if (snap?.type === 'face' && snap.wallId) {
  const degree = walls.filter(
    w => w.node1Id === draggingNodeId || w.node2Id === draggingNodeId
  ).length;
  if (degree === 1) {
    onPushHistory();
    onConnectNodeToWall(snap.wallId, draggingNodeId, snap.point);
  }
}
```

New prop added to `WallDrawingCanvas`:
```typescript
onConnectNodeToWall: (wallId: string, nodeId: string, newPos: Point) => void;
```

### PlanEditor.tsx

Wire the new action:
```tsx
onConnectNodeToWall={connectNodeToWall}
```

## Data Flow

```
User releases node on wall face
  → handlePointerUp detects snap.type === 'face'
  → checks dragged node degree === 1
  → onPushHistory()
  → onConnectNodeToWall(snap.wallId, draggingNodeId, snap.point)
    → moves nodeId to snap.point
    → splits wall into W1 and W2 with nodeId at junction
  → Zustand re-render
  → wallFaceCycles sees new topology → new room(s) detected if applicable
```

## Testing

- Unit test for `connectNodeToWall` store action: verify walls split correctly, node moved to correct position
- Integration: drag free-end node onto wall → wall splits → two sub-walls created → node at junction
- Negative case: drag degree-2 node onto wall → no split (node just moves)
- Negative case: snap to endpoint → merge behavior unchanged
