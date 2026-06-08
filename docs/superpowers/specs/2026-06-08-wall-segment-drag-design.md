# Wall Segment Perpendicular Drag — Design Spec

## Goal

In SELECT mode, allow the user to drag any wall segment perpendicular to its axis. Both endpoint nodes move by the same delta, keeping the segment parallel to itself. Adjacent walls follow automatically.

## Interaction Model

| Action | Result |
|--------|--------|
| Pointer down on wall body + move > 4px | Segment drag (perpendicular movement) |
| Pointer down + up without movement | Visual wall selection only |
| Double-click on wall body | Open thickness editor (previously: single click) |

- Pointer capture starts on pointer down (same as node drag).
- `lastClickRef` (already present) detects double-click for thickness editor.
- The 4px threshold (world coordinates scaled to screen) distinguishes accidental click from intentional drag.

## Geometry

For a wall from node P1 to P2:

```
dir    = normalize(P2 - P1)
normal = { x: -dir.y, y: dir.x }   // perpendicular (left-hand normal)

delta_total = cursor_world - pointer_start_world
delta_perp  = dot(delta_total, normal) × normal

P1_target = P1_start + delta_perp
P2_target = P2_start + delta_perp   // same delta — segment stays parallel
```

Adjacent walls follow automatically because they reference the same node IDs — no extra logic required.

## Snap

During segment drag, snap is applied only on the perpendicular component:

- **Horizontal wall** (normal ≈ (0,1)): snap the Y coordinate of P1_target to the nearest other node's Y within `HV_SNAP_DRAG_PX` (~28px screen).
- **Vertical wall** (normal ≈ (1,0)): snap the X coordinate similarly.
- **Diagonal wall**: snap the scalar projection distance along the normal using the same radius.

Implementation: reuse `adjacentAxisSnapForNode` on P1_target, excluding walls connected to the dragged wall's nodes (to avoid self-snap). Apply the same snapped delta to P2_target.

## State & Data Flow

### New state in `WallDrawingCanvas`

```typescript
const [draggingWallId, setDraggingWallId] = useState<string | null>(null);
const wallDragRef = useRef<{
  node1Start: Point;
  node2Start: Point;
  pointerStart: Point;
  normal: Point;
  hasMoved: boolean;
} | null>(null);
```

`wallDragRef` is a ref (not state) to avoid re-renders during drag — same pattern as `dragSnapRef` for node dragging.

### Pointer down on wall body (no node hit)

1. Compute `normal` from wall direction.
2. Store initial positions in `wallDragRef`.
3. `setDraggingWallId(wall.id)` + `setPointerCapture`.

### Pointer move with `draggingWallId` active

1. Compute `delta_perp` from current cursor vs `pointerStart`.
2. If screen distance > 4px: set `wallDragRef.hasMoved = true`.
3. Call `onUpdateNode(wall.node1Id, P1_target)` and `onUpdateNode(wall.node2Id, P2_target)`.

### Pointer up

- If `hasMoved`: call `onPushHistory()`.
- If NOT `hasMoved`: check double-click via `lastClickRef` — if second click within 300ms on same wall → open thickness editor (`setEditingWallId`).
- Clear `draggingWallId`, release pointer capture.

No new props or store actions required — `onUpdateNode` is already called in real time during node drag.

## Visual Feedback

### Cursor on wall body hover (SELECT tool, no active drag)

| Wall orientation | Cursor |
|-----------------|--------|
| Horizontal (|dir.y| < 0.1) | `ns-resize` |
| Vertical (|dir.x| < 0.1) | `ew-resize` |
| Diagonal | `move` |

Cursor is set on the `<svg>` element via its `style` prop. A `hoveredWallId` state (computed in `handlePointerMove` when no drag is active) drives the cursor change in real time.

### During drag

Cursor: `grabbing` (set on `<svg>` style when `draggingWallId` is not null).

### Wall highlight

The dragged wall renders with `WALL_SELECTED_COLOR` (`#e67e22`) via the existing `selectedWallId` mechanism — no new rendering layer needed.

## Files Modified

- `src/components/plan/WallDrawingCanvas.tsx` — all changes are self-contained here

## Out of Scope

- Snapping the segment to another wall's face (merging topology)
- Constraining adjacent walls to remain H/V
- Touch support (follows existing touch architecture if needed later)
