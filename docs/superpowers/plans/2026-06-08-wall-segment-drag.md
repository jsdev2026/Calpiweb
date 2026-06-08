# Wall Segment Perpendicular Drag — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In SELECT mode, dragging a wall segment body moves both endpoint nodes perpendicular to the wall axis; double-clicking opens the thickness editor.

**Architecture:** A new pure geometry module (`wallDrag.ts`) handles the math (normal computation + perpendicular delta with snap). `WallDrawingCanvas` adds wall drag state/refs, modifies the three pointer handlers (down/move/up), and drives a dynamic SVG cursor. All changes are in one file except the new geometry module.

**Tech Stack:** TypeScript, React, Vitest. No new props, store actions, or dependencies.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/engine/geometry/wallDrag.ts` | Create | Pure math: `computeWallNormal`, `computeWallPerpMove` |
| `src/engine/geometry/wallDrag.test.ts` | Create | Unit tests for the above |
| `src/components/plan/WallDrawingCanvas.tsx` | Modify | State, pointer handlers, cursor CSS |

---

### Task 1: Pure geometry helpers + tests (TDD)

**Files:**
- Create: `src/engine/geometry/wallDrag.ts`
- Create: `src/engine/geometry/wallDrag.test.ts`

Study `src/engine/geometry/wallSnap.ts` for conventions (types, dot product patterns, scale/radius usage).

#### What to implement

**`computeWallNormal(wall, nodes): Point | null`**
Returns the unit left-hand normal of the wall direction.
- Find n1 = node with id === wall.node1Id, n2 = wall.node2Id.
- If either missing, return null.
- dir = (n2 - n1). If |dir| < 1e-10, return null (zero-length wall).
- Return `{ x: -dy/len, y: dx/len }`.

**`computeWallPerpMove(n1Start, n2Start, pointerStart, cursor, normal, otherNodes, scale, snapPx): { node1Target, node2Target }`**
- `n1Start`, `n2Start`: original node positions at drag start (from ref — NOT current node props)
- `pointerStart`: world position where drag started
- `cursor`: current world position
- `normal`: pre-computed unit normal (from `computeWallNormal` stored in ref)
- `otherNodes`: all nodes except node1/node2 of the dragged wall (for snap)
- `scale`, `snapPx`: snap threshold in screen pixels

Computation:
```
delta = cursor - pointerStart
t = dot(delta, normal)           // scalar projection onto normal (world units)
snapRadius = snapPx / scale      // in world units

// Snap: find nearest otherNode whose perpendicular projection from n1Start
// is within snapRadius of t
for each on in otherNodes:
  t_on = dot(on - n1Start, normal)   // other node's level along normal
  if |t - t_on| < snapRadius and closer than current best: best = t_on
if best found: t = best

delta_perp = t × normal
return {
  node1Target: n1Start + delta_perp,
  node2Target: n2Start + delta_perp,
}
```

- [ ] **Step 1: Write failing tests**

Create `src/engine/geometry/wallDrag.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeWallNormal, computeWallPerpMove } from './wallDrag';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

describe('computeWallNormal', () => {
  it('mur horizontal → normale (0, 1)', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)];
    const n = computeWallNormal(wall, nodes);
    expect(n).not.toBeNull();
    expect(n!.x).toBeCloseTo(0);
    expect(n!.y).toBeCloseTo(1);
  });

  it('mur vertical → |normale.x| = 1, normale.y = 0', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    const nodes = [nd('a', 0, 0), nd('b', 0, 200)];
    const n = computeWallNormal(wall, nodes);
    expect(n).not.toBeNull();
    expect(Math.abs(n!.x)).toBeCloseTo(1);
    expect(n!.y).toBeCloseTo(0);
  });

  it('mur de longueur nulle → null', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    const nodes = [nd('a', 100, 100), nd('b', 100, 100)];
    expect(computeWallNormal(wall, nodes)).toBeNull();
  });

  it('nœud introuvable → null', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    expect(computeWallNormal(wall, [nd('a', 0, 0)])).toBeNull();
  });
});

describe('computeWallPerpMove', () => {
  const n1Start = { x: 0,   y: 0 };
  const n2Start = { x: 200, y: 0 };
  const normal  = { x: 0,   y: 1 }; // horizontal wall normal = up
  const pStart  = { x: 100, y: 0 };
  const noSnap: WallNode[] = [];
  const scale = 1;
  const snapPx = 28;

  it('déplace les deux nœuds de la même valeur perpendiculaire', () => {
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 100, y: 50 }, normal, noSnap, scale, snapPx);
    expect(r.node1Target).toEqual({ x: 0,   y: 50 });
    expect(r.node2Target).toEqual({ x: 200, y: 50 });
  });

  it('ignore la composante parallèle au mur', () => {
    // moved 100 along wall axis, 30 perpendicular
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 200, y: 30 }, normal, noSnap, scale, snapPx);
    expect(r.node1Target.x).toBeCloseTo(0);   // x unchanged
    expect(r.node1Target.y).toBeCloseTo(30);
    expect(r.node2Target.x).toBeCloseTo(200);
    expect(r.node2Target.y).toBeCloseTo(30);
  });

  it('snappe vers un nœud proche dans la direction normale', () => {
    const snapNode = nd('s', 50, 48); // 48mm in y, target is 50 → diff=2 < snapRadius=28
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 100, y: 50 }, normal, [snapNode], scale, snapPx);
    expect(r.node1Target.y).toBeCloseTo(48);
    expect(r.node2Target.y).toBeCloseTo(48);
  });

  it('ne snappe pas si le nœud est trop loin', () => {
    const farNode = nd('f', 50, 100); // 100mm in y, target is 50 → diff=50 > snapRadius=28
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 100, y: 50 }, normal, [farNode], scale, snapPx);
    expect(r.node1Target.y).toBeCloseTo(50); // no snap
  });

  it('mouvement nul → nœuds restent à leurs positions initiales', () => {
    const r = computeWallPerpMove(n1Start, n2Start, pStart, pStart, normal, noSnap, scale, snapPx);
    expect(r.node1Target).toEqual(n1Start);
    expect(r.node2Target).toEqual(n2Start);
  });

  it('mur diagonal — déplace dans la direction normale', () => {
    // 45° wall: dir=(1,1)/√2, normal=(-1,1)/√2
    const diag_n1  = { x: 0,   y: 0   };
    const diag_n2  = { x: 100, y: 100 };
    const diag_nor = { x: -1 / Math.SQRT2, y: 1 / Math.SQRT2 };
    const diag_ps  = { x: 50,  y: 50  };
    // move 10√2 along normal = (-10, 10) displacement
    const cursor   = { x: 40,  y: 60  };
    const r = computeWallPerpMove(diag_n1, diag_n2, diag_ps, cursor, diag_nor, noSnap, scale, snapPx);
    expect(r.node1Target.x).toBeCloseTo(-10);
    expect(r.node1Target.y).toBeCloseTo(10);
    expect(r.node2Target.x).toBeCloseTo(90);
    expect(r.node2Target.y).toBeCloseTo(110);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/engine/geometry/wallDrag.test.ts
```

Expected: module not found or function not exported (all 10 tests fail).

- [ ] **Step 3: Implement `src/engine/geometry/wallDrag.ts`**

```typescript
import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function computeWallNormal(wall: Wall, nodes: WallNode[]): Point | null {
  const n1 = nodes.find((n) => n.id === wall.node1Id);
  const n2 = nodes.find((n) => n.id === wall.node2Id);
  if (!n1 || !n2) return null;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return null;
  return { x: -dy / len, y: dx / len };
}

export function computeWallPerpMove(
  n1Start: Point,
  n2Start: Point,
  pointerStart: Point,
  cursor: Point,
  normal: Point,
  otherNodes: WallNode[],
  scale: number,
  snapPx: number,
): { node1Target: Point; node2Target: Point } {
  const delta = { x: cursor.x - pointerStart.x, y: cursor.y - pointerStart.y };
  let t = dot(delta, normal);

  const snapRadius = snapPx / scale;
  let best: { val: number; dist: number } | null = null;
  for (const on of otherNodes) {
    const tOn = dot({ x: on.x - n1Start.x, y: on.y - n1Start.y }, normal);
    const d = Math.abs(t - tOn);
    if (d < snapRadius && (!best || d < best.dist)) {
      best = { val: tOn, dist: d };
    }
  }
  if (best) t = best.val;

  return {
    node1Target: { x: n1Start.x + t * normal.x, y: n1Start.y + t * normal.y },
    node2Target: { x: n2Start.x + t * normal.x, y: n2Start.y + t * normal.y },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/engine/geometry/wallDrag.test.ts
```

Expected: 10/10 tests pass.

- [ ] **Step 5: Commit**

```
git add src/engine/geometry/wallDrag.ts src/engine/geometry/wallDrag.test.ts
git commit -m "feat: pure helpers computeWallNormal + computeWallPerpMove + tests"
```

---

### Task 2: WallDrawingCanvas — wall segment drag interaction

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

Read the file carefully before editing. All edits are in this one file.

#### Overview of changes

1. Import `computeWallNormal` and `computeWallPerpMove` from the new module.
2. Add two new state variables and one new ref.
3. Add `lastWallClickRef` for double-click detection.
4. Modify the `tool` change `useEffect` to clear wall drag state.
5. Modify `handlePointerDown` SELECT branch: wall hit → start drag (not open editor).
6. Modify `handlePointerMove`: add wall drag branch after isPanning, before draggingNodeId.
7. Modify `handlePointerUp`: add wall drag branch after isPanning, before draggingNodeId.
8. Add hover detection in `handlePointerMove` (when no drag active, SELECT tool).
9. Make SVG cursor dynamic.

There are no unit tests for this task — verify via the full test suite and manual testing.

- [ ] **Step 1: Add import**

At the top of `src/components/plan/WallDrawingCanvas.tsx`, after line 7 (the existing geometry imports):
```typescript
import { computeWallNormal, computeWallPerpMove } from '@/engine/geometry/wallDrag';
```

- [ ] **Step 2: Add new state and refs**

After line 103 (after `const dragSnapRef = useRef...`), add:

```typescript
  // Wall segment drag state
  const [draggingWallId, setDraggingWallId] = useState<string | null>(null);
  const wallDragRef = useRef<{
    node1Start: Point;
    node2Start: Point;
    pointerStart: Point;
    normal: Point;
    hasMoved: boolean;
  } | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const lastWallClickRef = useRef<{ time: number; wallId: string } | null>(null);
```

- [ ] **Step 3: Clear wall drag state on tool change**

Find the `useEffect` at line ~113:
```typescript
  useEffect(() => {
    setSelectedWallId(null);
    setEditingWallId(null);
    setChain(null);
    setExcludePoints([]);
    setSelectedCot(null);
    setRenamingRoom(null);
  }, [tool]);
```

Replace with:
```typescript
  useEffect(() => {
    setSelectedWallId(null);
    setEditingWallId(null);
    setChain(null);
    setExcludePoints([]);
    setSelectedCot(null);
    setRenamingRoom(null);
    setDraggingWallId(null);
    wallDragRef.current = null;
    setHoveredWallId(null);
  }, [tool]);
```

- [ ] **Step 4: Modify `handlePointerDown` SELECT branch**

Find the SELECT branch in `handlePointerDown` (~line 408):
```typescript
    if (tool === 'SELECT') {
      const hitNode = hitTestNode(world);
      if (hitNode) {
        setDraggingNodeId(hitNode.id);
        dragSnapRef.current = null;
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        return;
      }
      const hit = hitTestWall(world);
      setSelectedWallId(hit?.id ?? null);
      if (hit) {
        setEditingWallId(hit.id);
        setEditThickness((hit.thickness / 10).toFixed(0)); // afficher en cm
      } else {
        setEditingWallId(null);
        // Clic gauche sur zone vide → pan
        setIsPanning(true);
        const sp = getSvgPos(e);
        panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      }
      return;
    }
```

Replace with:
```typescript
    if (tool === 'SELECT') {
      const hitNode = hitTestNode(world);
      if (hitNode) {
        setDraggingNodeId(hitNode.id);
        dragSnapRef.current = null;
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        return;
      }
      const hit = hitTestWall(world);
      setSelectedWallId(hit?.id ?? null);
      if (hit) {
        const n1 = nodes.find((n) => n.id === hit.node1Id);
        const n2 = nodes.find((n) => n.id === hit.node2Id);
        const normal = computeWallNormal(hit, nodes);
        if (n1 && n2 && normal) {
          wallDragRef.current = {
            node1Start:   { x: n1.x, y: n1.y },
            node2Start:   { x: n2.x, y: n2.y },
            pointerStart: world,
            normal,
            hasMoved: false,
          };
          setDraggingWallId(hit.id);
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }
      } else {
        setEditingWallId(null);
        // Clic gauche sur zone vide → pan
        setIsPanning(true);
        const sp = getSvgPos(e);
        panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      }
      return;
    }
```

- [ ] **Step 5: Add wall drag branch in `handlePointerMove`**

Find `handlePointerMove`. After `let world = getWorldPos(e)` (line ~448) and BEFORE `if (draggingNodeId)`, insert:

```typescript
    if (draggingWallId && wallDragRef.current) {
      const ref = wallDragRef.current;
      const wall = walls.find((w) => w.id === draggingWallId);
      if (wall) {
        const otherNodes = nodes.filter((n) => n.id !== wall.node1Id && n.id !== wall.node2Id);
        const result = computeWallPerpMove(
          ref.node1Start, ref.node2Start, ref.pointerStart, world,
          ref.normal, otherNodes, scale, HV_SNAP_DRAG_PX,
        );
        const dx = (world.x - ref.pointerStart.x) * scale;
        const dy = (world.y - ref.pointerStart.y) * scale;
        if (Math.sqrt(dx * dx + dy * dy) > 4) ref.hasMoved = true;
        onUpdateNode(wall.node1Id, result.node1Target);
        onUpdateNode(wall.node2Id, result.node2Target);
      }
      return;
    }
```

Also, at the END of `handlePointerMove` (before the final closing `}`), after all the existing snap computation, add hover detection:

```typescript
    if (tool === 'SELECT' && !draggingNodeId && !draggingWallId) {
      const hitNode = hitTestNode(world);
      setHoveredWallId(hitNode ? null : (hitTestWall(world)?.id ?? null));
    }
```

- [ ] **Step 6: Add wall drag branch in `handlePointerUp`**

Find `handlePointerUp`. After the `isPanning` block and BEFORE `if (draggingNodeId)`, insert:

```typescript
    if (draggingWallId) {
      const ref = wallDragRef.current;
      if (ref?.hasMoved) {
        onPushHistory();
      } else {
        // No movement — check for double-click to open thickness editor
        const now = Date.now();
        const last = lastWallClickRef.current;
        if (last && last.wallId === draggingWallId && now - last.time < 300) {
          const wall = walls.find((w) => w.id === draggingWallId);
          if (wall) {
            setEditingWallId(wall.id);
            setEditThickness((wall.thickness / 10).toFixed(0));
          }
          lastWallClickRef.current = null;
        } else {
          lastWallClickRef.current = { time: now, wallId: draggingWallId };
        }
      }
      setDraggingWallId(null);
      wallDragRef.current = null;
      setHoveredWallId(null);
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      return;
    }
```

- [ ] **Step 7: Dynamic SVG cursor**

Before the `return (` in the component (just above the JSX), add the cursor computation:

```typescript
  const svgCursor = (() => {
    if (tool !== 'SELECT') return 'crosshair';
    if (draggingWallId) return 'grabbing';
    if (hoveredWallId) {
      const w = walls.find((wl) => wl.id === hoveredWallId);
      if (w) {
        const n1 = nodes.find((n) => n.id === w.node1Id);
        const n2 = nodes.find((n) => n.id === w.node2Id);
        if (n1 && n2) {
          const dx = Math.abs(n2.x - n1.x);
          const dy = Math.abs(n2.y - n1.y);
          if (dy < dx * 0.1) return 'ns-resize';   // ~horizontal wall → drag vertically
          if (dx < dy * 0.1) return 'ew-resize';   // ~vertical wall → drag horizontally
          return 'move';
        }
      }
    }
    return 'crosshair';
  })();
```

Then find the `<svg` element and change its className from:
```tsx
        className="h-full w-full cursor-crosshair select-none"
```
to:
```tsx
        className="h-full w-full select-none"
        style={{ cursor: svgCursor }}
```

- [ ] **Step 8: Run full test suite**

```
npx vitest run
```

Expected: all tests pass (408+).

Also check TypeScript:
```
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9: Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat: wall segment perpendicular drag in SELECT mode"
```
