# Snap Free-End Node to Wall on Drop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user drags a free-end node (SELECT tool, degree-1 node) and releases it on a wall face, the wall is split at the snap point and the dragged node is inserted at the junction.

**Architecture:** A new pure helper `connectNodeToWallInEngine` mirrors `splitWallInEngine` but reuses an existing node instead of creating one. The store exposes it as `connectNodeToWall`. `WallDrawingCanvas` detects `snap.type === 'face'` on pointer up for degree-1 dragged nodes and calls the action.

**Tech Stack:** TypeScript, React, Zustand (`src/store/projectStore.ts`), Vitest (`src/store/splitWall.test.ts`).

---

### Task 1: Pure helper `connectNodeToWallInEngine` + tests (TDD)

**Files:**
- Modify: `src/store/projectStore.ts` (after `splitWallInEngine`, ~line 106)
- Modify: `src/store/splitWall.test.ts` (append new describe block)

Context: `splitWallInEngine` (lines 92–106 in `projectStore.ts`) is a pure function that takes the wallEngine state, a `wallId`, and a new `WallNode`, removes the wall, creates two sub-walls via the new node. Study it first.

`connectNodeToWallInEngine` does the same but the node already exists in `we.nodes` — it just needs its position updated and inserted into the split wall topology.

- [ ] **Step 1: Write the failing tests**

First, update the existing import at the top of `src/store/splitWall.test.ts` (line 2):

```typescript
// Before:
import { splitWallInEngine } from './projectStore';
// After:
import { splitWallInEngine, connectNodeToWallInEngine } from './projectStore';
```

Then append this describe block to the file:

```typescript
describe('connectNodeToWallInEngine', () => {
  const nodes = [nd('a', 0, 0), nd('b', 200, 0), nd('free', 100, 500)];
  const wall: Wall = { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 100 };
  const we = { nodes, walls: [wall], excludedZones: [] };

  it('déplace le nœud existant vers newPos', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    const moved = result.nodes.find(n => n.id === 'free');
    expect(moved).toEqual({ id: 'free', x: 100, y: 0 });
  });

  it('ne crée pas de nouveau nœud — le nombre reste identique', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    expect(result.nodes).toHaveLength(3);
  });

  it('supprime le mur original et crée deux sous-murs', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    expect(result.walls).toHaveLength(2);
    expect(result.walls.find(w => w.id === 'w1')).toBeUndefined();
  });

  it('les deux sous-murs relient a → free et free → b', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    const w1 = result.walls.find(w => w.node1Id === 'a');
    const w2 = result.walls.find(w => w.node1Id === 'free');
    expect(w1?.node2Id).toBe('free');
    expect(w2?.node2Id).toBe('b');
  });

  it('préserve l\'épaisseur sur les deux sous-murs', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'free', { x: 100, y: 0 });
    result.walls.forEach(w => expect(w.thickness).toBe(100));
  });

  it('retourne le même objet si wallId introuvable', () => {
    const result = connectNodeToWallInEngine(we, 'missing', 'free', { x: 100, y: 0 });
    expect(result).toBe(we);
  });

  it('retourne le même objet si nodeId introuvable', () => {
    const result = connectNodeToWallInEngine(we, 'w1', 'ghost', { x: 100, y: 0 });
    expect(result).toBe(we);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/store/splitWall.test.ts
```

Expected: `connectNodeToWallInEngine is not a function` or similar import error. 7 new tests failing.

- [ ] **Step 3: Implement `connectNodeToWallInEngine` in `projectStore.ts`**

Insert this function immediately after `splitWallInEngine` (after line 106):

```typescript
/** Pure helper — moves an existing node to newPos and inserts it into wallId, splitting it. */
export function connectNodeToWallInEngine(
  we: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] },
  wallId: string,
  nodeId: string,
  newPos: Point,
): { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] } {
  const wall = we.walls.find(w => w.id === wallId);
  const node = we.nodes.find(n => n.id === nodeId);
  if (!wall || !node) return we;
  const movedNode: WallNode = { ...node, x: newPos.x, y: newPos.y };
  const wall1: Wall = { ...wall, id: generateId(), node1Id: wall.node1Id, node2Id: nodeId };
  const wall2: Wall = { ...wall, id: generateId(), node1Id: nodeId,       node2Id: wall.node2Id };
  return {
    ...we,
    nodes: we.nodes.map(n => n.id === nodeId ? movedNode : n),
    walls: [...we.walls.filter(w => w.id !== wallId), wall1, wall2],
  };
}
```

Note: `Point` is already imported at the top of the file (`import type { Point } from '@/types/plan'`). `WallNode`, `Wall`, `WallExcludedZone` are imported from `'@/types/wall'`. `generateId` is imported from `'@/utils/id'`. Verify these imports exist before adding — do not duplicate.

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/store/splitWall.test.ts
```

Expected: All tests pass (existing + 7 new).

- [ ] **Step 5: Commit**

```
git add src/store/projectStore.ts src/store/splitWall.test.ts
git commit -m "feat: pure helper connectNodeToWallInEngine + tests"
```

---

### Task 2: Store interface + action `connectNodeToWall`

**Files:**
- Modify: `src/store/projectStore.ts`

Two edits: (1) add to the `ProjectState` interface, (2) add the implementation.

- [ ] **Step 1: Add to `ProjectState` interface**

In `src/store/projectStore.ts`, find the interface block around line 82:
```typescript
  splitWall: (wallId: string, newNode: WallNode) => void;
```

Add immediately after it:
```typescript
  connectNodeToWall: (wallId: string, nodeId: string, newPos: Point) => void;
```

- [ ] **Step 2: Add implementation**

Find the `splitWall` action implementation (~line 507):
```typescript
  splitWall: (wallId, newNode) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: splitWallInEngine(p.wallEngine, wallId, newNode) };
    });
  },
```

Add immediately after it:
```typescript
  connectNodeToWall: (wallId, nodeId, newPos) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: connectNodeToWallInEngine(p.wallEngine, wallId, nodeId, newPos) };
    });
  },
```

- [ ] **Step 3: Run full test suite**

```
npx vitest run
```

Expected: All tests pass. TypeScript compilation clean (no `tsc --noEmit` errors).

- [ ] **Step 4: Commit**

```
git add src/store/projectStore.ts
git commit -m "feat: store action connectNodeToWall"
```

---

### Task 3: Canvas prop + pointer up handler + PlanEditor wiring

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`
- Modify: `src/components/plan/PlanEditor.tsx`

No unit tests for this task — it's wiring. Verify visually that the snap works.

- [ ] **Step 1: Add prop to `WallDrawingCanvasProps` interface**

In `src/components/plan/WallDrawingCanvas.tsx`, find the interface (line ~30):
```typescript
  onSplitWall: (wallId: string, newNode: WallNode) => void;
  wallRoomNames?: Record<string, string>;
```

Add after `onSplitWall`:
```typescript
  onConnectNodeToWall: (wallId: string, nodeId: string, newPos: Point) => void;
```

Note: `Point` is already imported (`import type { Point } from '@/types/plan'`).

- [ ] **Step 2: Add to destructuring**

Find the component function destructuring (~line 62):
```typescript
export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
  scale, pan, onScaleChange, onPanChange,
  wallThickness,
  excludedZones, onAddExcludedZone, onRemoveExcludedZone: _onRemoveExcludedZone,
  onSplitWall,
  wallRoomNames, onRenameRoom,
}: WallDrawingCanvasProps) => {
```

Add `onConnectNodeToWall,` after `onSplitWall,`:
```typescript
export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
  scale, pan, onScaleChange, onPanChange,
  wallThickness,
  excludedZones, onAddExcludedZone, onRemoveExcludedZone: _onRemoveExcludedZone,
  onSplitWall,
  onConnectNodeToWall,
  wallRoomNames, onRenameRoom,
}: WallDrawingCanvasProps) => {
```

- [ ] **Step 3: Update `handlePointerUp`**

Find the current `handlePointerUp` handler (lines ~518–529):
```typescript
    if (draggingNodeId) {
      const snap = dragSnapRef.current;
      if (snap?.type === 'endpoint' && snap.nodeId && snap.nodeId !== draggingNodeId) {
        onPushHistory();
        onMergeNodes(snap.nodeId, draggingNodeId);
      } else {
        onPushHistory();
      }
      setDraggingNodeId(null);
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    }
```

Replace with:
```typescript
    if (draggingNodeId) {
      const snap = dragSnapRef.current;
      if (snap?.type === 'endpoint' && snap.nodeId && snap.nodeId !== draggingNodeId) {
        onPushHistory();
        onMergeNodes(snap.nodeId, draggingNodeId);
      } else if (snap?.type === 'face' && snap.wallId) {
        const degree = walls.filter(w => w.node1Id === draggingNodeId || w.node2Id === draggingNodeId).length;
        if (degree === 1) {
          onPushHistory();
          onConnectNodeToWall(snap.wallId, draggingNodeId, snap.point);
        } else {
          onPushHistory();
        }
      } else {
        onPushHistory();
      }
      setDraggingNodeId(null);
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    }
```

- [ ] **Step 4: Wire in `PlanEditor.tsx`**

In `src/components/plan/PlanEditor.tsx`, find the `connectNodeToWall` action (it needs to be read from the store first):

After line 78 (after `splitWall`):
```typescript
  const splitWall              = useProjectStore((s) => s.splitWall);
```

Add:
```typescript
  const connectNodeToWall      = useProjectStore((s) => s.connectNodeToWall);
```

Then find the `<WallDrawingCanvas` props block and add after `onSplitWall={splitWall}`:
```tsx
          onConnectNodeToWall={connectNodeToWall}
```

- [ ] **Step 5: Run full test suite + TypeScript check**

```
npx vitest run
```

Then verify TypeScript compiles clean:
```
npx tsc --noEmit
```

Expected: All tests pass, no TypeScript errors.

- [ ] **Step 6: Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat: snap free-end node to wall on drag-release in SELECT mode"
```
