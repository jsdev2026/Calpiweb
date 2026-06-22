# Node Lock Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users lock wall nodes (and whole segments) so their positions cannot be accidentally moved; the first node placed in a drawing is auto-locked.

**Architecture:** Add `locked?: boolean` to `WallNode`. All position-mutation paths in `WallDrawingCanvas` check this flag. A new `LOCK` toolbar tool and double-click on a node (SELECT mode) both toggle the flag via `onUpdateNode`. Locked nodes render green with a small lock icon; a wall segment whose both endpoints are locked gets a green stroke on its polygon.

**Tech Stack:** React 18, TypeScript, SVG, Zustand, Vitest + React Testing Library.

---

### Task 1 — Type extensions: WallNode, store, canvas props

**Files:**
- Modify: `src/types/wall.ts`
- Modify: `src/store/projectStore.ts` (line 70)
- Modify: `src/components/plan/WallDrawingCanvas.tsx` (line 41)

The `onUpdateNode` callback currently only allows `{ x?, y? }`. We extend it to also accept `locked`. The store's `updateNode` already uses `{ ...n, ...patch }` spread — extending the type is sufficient.

- [ ] **Step 1: Write the failing type test**

Create `src/store/projectStore.lock.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './projectStore';

const INITIAL_PROJECT = {
  id: 'p1',
  name: 'Test',
  status: 'new' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rooms: [],
  wallEngine: {
    nodes: [{ id: 'n1', x: 0, y: 0 }],
    walls: [],
    excludedZones: [],
  },
};

describe('updateNode — locked field', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [INITIAL_PROJECT],
      activeProjectId: 'p1',
    });
  });

  it('persists locked: true on a node', () => {
    const { updateNode } = useProjectStore.getState();
    updateNode('n1', { locked: true });
    const node = useProjectStore.getState()
      .projects[0]!.wallEngine!.nodes.find((n) => n.id === 'n1');
    expect(node?.locked).toBe(true);
  });

  it('persists locked: false on a node', () => {
    useProjectStore.setState((s) => ({
      projects: s.projects.map((p) =>
        p.id === 'p1'
          ? {
              ...p,
              wallEngine: {
                ...p.wallEngine!,
                nodes: [{ id: 'n1', x: 0, y: 0, locked: true }],
              },
            }
          : p,
      ),
    }));
    const { updateNode } = useProjectStore.getState();
    updateNode('n1', { locked: false });
    const node = useProjectStore.getState()
      .projects[0]!.wallEngine!.nodes.find((n) => n.id === 'n1');
    expect(node?.locked).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing tests**

```
npx vitest run src/store/projectStore.lock.test.ts
```

Expected: TypeScript compile error — `locked` not assignable to `Partial<Pick<WallNode, 'x' | 'y'>>`.

- [ ] **Step 3: Add `locked` to WallNode**

In `src/types/wall.ts`, change `WallNode` to:

```typescript
export interface WallNode {
  id: string;
  x: number;
  y: number;
  locked?: boolean;
}
```

- [ ] **Step 4: Extend the store type**

In `src/store/projectStore.ts`, change line 70 from:

```typescript
updateNode: (id: string, patch: Partial<Pick<WallNode, 'x' | 'y'>>) => void;
```

to:

```typescript
updateNode: (id: string, patch: Partial<Pick<WallNode, 'x' | 'y' | 'locked'>>) => void;
```

- [ ] **Step 5: Extend the canvas prop type**

In `src/components/plan/WallDrawingCanvas.tsx`, change line 41 from:

```typescript
onUpdateNode: (id: string, patch: { x?: number; y?: number }) => void;
```

to:

```typescript
onUpdateNode: (id: string, patch: { x?: number; y?: number; locked?: boolean }) => void;
```

- [ ] **Step 6: Run tests to verify they pass**

```
npx vitest run src/store/projectStore.lock.test.ts
```

Expected: Both tests PASS.

- [ ] **Step 7: Type check**

```
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```
git add src/types/wall.ts src/store/projectStore.ts src/components/plan/WallDrawingCanvas.tsx src/store/projectStore.lock.test.ts
git commit -m "feat(lock): add locked field to WallNode and extend updateNode type"
```

---

### Task 2 — First node auto-lock

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`
- Test: `src/components/plan/WallDrawingCanvas.test.tsx` (add test)

When the very first node is created (no existing nodes), it must be created with `locked: true`.

- [ ] **Step 1: Write the failing test**

In `src/components/plan/WallDrawingCanvas.test.tsx`, add after the existing `describe` block:

```typescript
describe('WallDrawingCanvas — first node auto-lock', () => {
  it('creates the first node with locked: true', () => {
    const onAddNode = vi.fn();
    render(
      <WallDrawingCanvas
        walls={[]}
        nodes={[]}
        tool="WALL"
        onAddWall={() => {}}
        onRemoveWall={() => {}}
        onUpdateWall={() => {}}
        onAddNode={onAddNode}
        onUpdateNode={() => {}}
        onMergeNodes={() => {}}
        onPushHistory={() => {}}
        scale={1}
        pan={{ x: 0, y: 0 }}
        onScaleChange={() => {}}
        onPanChange={() => {}}
        wallThickness={100}
        excludedZones={[]}
        onAddExcludedZone={() => {}}
        onRemoveExcludedZone={() => {}}
        onUpdateExcludeZoneNode={() => {}}
        onSplitWall={() => {}}
        onConnectNodeToWall={() => {}}
      />,
    );
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });
    expect(onAddNode).toHaveBeenCalledWith(
      expect.objectContaining({ locked: true }),
    );
  });

  it('does NOT auto-lock subsequent nodes', () => {
    const onAddNode = vi.fn();
    const existingNode = { id: 'existing', x: 0, y: 0 };
    render(
      <WallDrawingCanvas
        walls={[]}
        nodes={[existingNode]}
        tool="WALL"
        onAddWall={() => {}}
        onRemoveWall={() => {}}
        onUpdateWall={() => {}}
        onAddNode={onAddNode}
        onUpdateNode={() => {}}
        onMergeNodes={() => {}}
        onPushHistory={() => {}}
        scale={1}
        pan={{ x: 0, y: 0 }}
        onScaleChange={() => {}}
        onPanChange={() => {}}
        wallThickness={100}
        excludedZones={[]}
        onAddExcludedZone={() => {}}
        onRemoveExcludedZone={() => {}}
        onUpdateExcludeZoneNode={() => {}}
        onSplitWall={() => {}}
        onConnectNodeToWall={() => {}}
      />,
    );
    const svg = document.querySelector('svg')!;
    // Start chain at existing node (snap)
    fireEvent.pointerDown(svg, { button: 0, clientX: 0, clientY: 0 });
    // Place second point
    fireEvent.pointerDown(svg, { button: 0, clientX: 300, clientY: 0 });
    // onAddNode should have been called without locked:true (or with locked:false/undefined)
    const calls = onAddNode.mock.calls;
    if (calls.length > 0) {
      calls.forEach((call) => {
        expect(call[0]).not.toMatchObject({ locked: true });
      });
    }
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```
npx vitest run src/components/plan/WallDrawingCanvas.test.tsx --reporter=verbose
```

Expected: "creates the first node with locked: true" FAILS — `locked` not present.

- [ ] **Step 3: Implement auto-lock for first node**

In `src/components/plan/WallDrawingCanvas.tsx`, in `handlePointerDown`, find the WALL tool branch where a brand-new node is created (the final `else` inside `if (!chain)`):

Current code (around line 324):
```typescript
} else {
  nodeId = generateId();
  onAddNode({ id: nodeId, x: pt.x, y: pt.y });
}
```

Replace with:
```typescript
} else {
  nodeId = generateId();
  const isFirstNode = nodes.length === 0;
  onAddNode({ id: nodeId, x: pt.x, y: pt.y, ...(isFirstNode ? { locked: true } : {}) });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npx vitest run src/components/plan/WallDrawingCanvas.test.tsx --reporter=verbose
```

Expected: All 4 tests (2 existing + 2 new) PASS.

- [ ] **Step 5: Type check + commit**

```
npx tsc --noEmit
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/WallDrawingCanvas.test.tsx
git commit -m "feat(lock): premier nœud tracé automatiquement verrouillé"
```

---

### Task 3 — LOCK tool in PlanToolbar

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`
- Modify: `src/components/plan/PlanEditor.tsx` (line 203 — extend cast)
- Modify: `src/components/plan/WallDrawingCanvas.tsx` (line 18 — local PlanTool type)

- [ ] **Step 1: Write the failing test**

Create `src/components/plan/PlanToolbar.lock.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PlanToolbar } from './PlanToolbar';

const BASE_PROPS = {
  tool: 'SELECT' as const,
  canUndo: false,
  canRedo: false,
  onChangeTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  wallThickness: 100,
  onWallThicknessChange: vi.fn(),
  tutorialMode: false,
  onToggleTutorial: vi.fn(),
};

describe('PlanToolbar — LOCK tool', () => {
  it('renders the LOCK button', () => {
    render(<PlanToolbar {...BASE_PROPS} />);
    expect(screen.getByRole('button', { name: /Verrouiller/i })).toBeInTheDocument();
  });

  it('calls onChangeTool("LOCK") on click', async () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...BASE_PROPS} onChangeTool={onChangeTool} />);
    await userEvent.click(screen.getByRole('button', { name: /Verrouiller/i }));
    expect(onChangeTool).toHaveBeenCalledWith('LOCK');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```
npx vitest run src/components/plan/PlanToolbar.lock.test.tsx
```

Expected: FAIL — button not found.

- [ ] **Step 3: Add LOCK to PlanTool type and add the button**

In `src/components/plan/PlanToolbar.tsx`:

**3a.** Change the type export (line 8):
```typescript
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'EXCLUDE' | 'DELETE' | 'LOCK';
```

**3b.** Add to `TOOL_TOOLTIPS` (after the `DELETE` entry):
```typescript
LOCK: { label: 'Verrouiller', description: 'Cliquer un nœud ou un mur pour verrouiller / libérer sa position' },
```

**3c.** Import the Lock icon. At the top of the file, add `Lock` to the lucide-react import:
```typescript
import { DoorOpen, HelpCircle, Lock, MousePointer2, PenTool, Redo2, Square, Trash2, Undo } from 'lucide-react';
```

**3d.** In the desktop toolbar, add the LOCK button right before the `<div className="mx-auto h-px w-6" .../>` separator before Undo/Redo/DELETE. Insert after the EXCLUDE button block (after its closing `</div>`):

```tsx
<div className="flex items-center">
  <ToolTooltip {...TOOL_TOOLTIPS.LOCK}>
    <button type="button" onClick={() => onChangeTool('LOCK')}
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${tool === 'LOCK' ? 'text-white shadow-md' : `${TB_CARD} hover:text-green-600 dark:hover:text-green-300`}`}
      style={tool === 'LOCK' ? { background: '#27ae60', boxShadow: '0 4px 10px rgba(39,174,96,0.3)' } : { color: 'var(--text2)' }}
      aria-label="Verrouiller">
      <Lock size={16} />
    </button>
  </ToolTooltip>
  {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Verrouiller</span>}
</div>
```

**3e.** In the mobile toolbar (inside the bottom strip), add after the EXCLUDE button:
```tsx
<button type="button" aria-label="Verrouiller" onClick={() => onChangeTool('LOCK')}
  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'LOCK' ? 'text-white shadow-md' : TB_CARD}`}
  style={tool === 'LOCK' ? { background: '#27ae60' } : { color: 'var(--text2)' }}>
  <Lock size={18} />
</button>
```

- [ ] **Step 4: Update WallDrawingCanvas local PlanTool type**

In `src/components/plan/WallDrawingCanvas.tsx` line 18:
```typescript
type PlanTool = 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE' | 'LOCK';
```

- [ ] **Step 5: Update PlanEditor cast**

In `src/components/plan/PlanEditor.tsx` line 203, change:
```typescript
tool={tool as 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE'}
```
to:
```typescript
tool={tool as 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE' | 'LOCK'}
```

- [ ] **Step 6: Run tests + type check**

```
npx vitest run src/components/plan/PlanToolbar.lock.test.tsx
npx tsc --noEmit
```

Expected: Both toolbar tests PASS, no type errors.

- [ ] **Step 7: Commit**

```
git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanToolbar.lock.test.tsx src/components/plan/PlanEditor.tsx src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(lock): outil LOCK dans la barre d'outils"
```

---

### Task 4 — LOCK tool interaction + double-click on node

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`
- Test: `src/components/plan/WallDrawingCanvas.test.tsx` (add tests)

Two interactions:
1. With `tool='LOCK'`: single click on a node → toggle `locked`; single click on a wall → toggle both endpoint nodes.
2. With `tool='SELECT'`: double-click on a node → toggle `locked`.

Double-click on a **segment** in SELECT mode already opens the thickness editor — that behavior is unchanged. Segment lock toggling is done via the LOCK tool only.

- [ ] **Step 1: Write the failing tests**

In `src/components/plan/WallDrawingCanvas.test.tsx`, add:

```typescript
import type { Wall } from '@/types/wall';

// Helper to render canvas with pre-existing nodes and walls
function renderWithState(nodes: WallNode[], walls: Wall[], tool: string = 'SELECT') {
  const onUpdateNode = vi.fn();
  render(
    <WallDrawingCanvas
      walls={walls}
      nodes={nodes}
      tool={tool as 'LOCK' | 'SELECT'}
      onAddWall={() => {}}
      onRemoveWall={() => {}}
      onUpdateWall={() => {}}
      onAddNode={() => {}}
      onUpdateNode={onUpdateNode}
      onMergeNodes={() => {}}
      onPushHistory={() => {}}
      scale={1}
      pan={{ x: 0, y: 0 }}
      onScaleChange={() => {}}
      onPanChange={() => {}}
      wallThickness={100}
      excludedZones={[]}
      onAddExcludedZone={() => {}}
      onRemoveExcludedZone={() => {}}
      onUpdateExcludeZoneNode={() => {}}
      onSplitWall={() => {}}
      onConnectNodeToWall={() => {}}
    />,
  );
  return { onUpdateNode };
}

describe('WallDrawingCanvas — LOCK tool', () => {
  it('LOCK tool click on a node toggles its locked state (free → locked)', () => {
    const node: WallNode = { id: 'n1', x: 200, y: 200 };
    const { onUpdateNode } = renderWithState([node], [], 'LOCK');
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { locked: true });
  });

  it('LOCK tool click on a node toggles (locked → free)', () => {
    const node: WallNode = { id: 'n1', x: 200, y: 200, locked: true };
    const { onUpdateNode } = renderWithState([node], [], 'LOCK');
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { locked: false });
  });

  it('LOCK tool click on a wall segment locks both endpoint nodes', () => {
    const n1: WallNode = { id: 'n1', x: 100, y: 200 };
    const n2: WallNode = { id: 'n2', x: 300, y: 200 };
    const wall: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 100 };
    const { onUpdateNode } = renderWithState([n1, n2], [wall], 'LOCK');
    const svg = document.querySelector('svg')!;
    // Click midpoint of wall at (200, 200)
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { locked: true });
    expect(onUpdateNode).toHaveBeenCalledWith('n2', { locked: true });
  });
});

describe('WallDrawingCanvas — double-click node to toggle lock', () => {
  it('double-click on a free node in SELECT mode locks it', () => {
    const node: WallNode = { id: 'n1', x: 200, y: 200 };
    const { onUpdateNode } = renderWithState([node], [], 'SELECT');
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { locked: true });
  });

  it('double-click on a locked node in SELECT mode unlocks it', () => {
    const node: WallNode = { id: 'n1', x: 200, y: 200, locked: true };
    const { onUpdateNode } = renderWithState([node], [], 'SELECT');
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    expect(onUpdateNode).toHaveBeenCalledWith('n1', { locked: false });
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```
npx vitest run src/components/plan/WallDrawingCanvas.test.tsx --reporter=verbose
```

Expected: 5 new tests all FAIL.

- [ ] **Step 3: Add `lastNodeClickRef` ref**

In `src/components/plan/WallDrawingCanvas.tsx`, add this ref alongside the existing refs (after `lastWallClickRef`):

```typescript
const lastNodeClickRef = useRef<{ nodeId: string; time: number } | null>(null);
```

- [ ] **Step 4: Add LOCK tool branch in `handlePointerDown`**

In `src/components/plan/WallDrawingCanvas.tsx`, inside `handlePointerDown`, add a new branch **before** the `if (tool === 'WALL')` block:

```typescript
if (tool === 'LOCK') {
  const hitNode = hitTestNode(world);
  if (hitNode) {
    onPushHistory();
    onUpdateNode(hitNode.id, { locked: !hitNode.locked });
    return;
  }
  const hitWall = hitTestWall(world);
  if (hitWall) {
    const wn1 = nodes.find((n) => n.id === hitWall.node1Id);
    const wn2 = nodes.find((n) => n.id === hitWall.node2Id);
    if (wn1 && wn2) {
      const newLocked = !(wn1.locked && wn2.locked);
      onPushHistory();
      onUpdateNode(hitWall.node1Id, { locked: newLocked });
      onUpdateNode(hitWall.node2Id, { locked: newLocked });
    }
  }
  return;
}
```

- [ ] **Step 5: Add double-click detection for nodes in SELECT mode**

In `handlePointerDown`, inside the `if (tool === 'SELECT')` branch, **before** the existing `hitTestNode` block, add:

```typescript
const hitNode = hitTestNode(world);
if (hitNode) {
  const now = Date.now();
  const last = lastNodeClickRef.current;
  if (last && last.nodeId === hitNode.id && now - last.time < 300) {
    // Double-click: toggle lock
    onPushHistory();
    onUpdateNode(hitNode.id, { locked: !hitNode.locked });
    lastNodeClickRef.current = null;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    return;
  }
  lastNodeClickRef.current = { nodeId: hitNode.id, time: now };
  if (!hitNode.locked) {
    setDraggingNodeId(hitNode.id);
    dragSnapRef.current = null;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }
  return;
}
```

Then **remove** the original hitNode block that follows (the one that was `const hitNode = hitTestNode(world); if (hitNode) { setDraggingNodeId(hitNode.id); ... }`). Make sure not to remove the `hitTestWall` block that comes after it.

Also, in `handlePointerMove` inside the `if (draggingNodeId)` block, clear the last-click ref to prevent false double-click detection after a real drag:

```typescript
if (draggingNodeId) {
  lastNodeClickRef.current = null; // drag invalidates double-click window
  // ... rest of existing drag code unchanged
```

- [ ] **Step 6: Run all canvas tests**

```
npx vitest run src/components/plan/WallDrawingCanvas.test.tsx --reporter=verbose
```

Expected: All tests PASS (2 existing + 2 auto-lock + 3 LOCK tool + 2 double-click = 9 tests).

- [ ] **Step 7: Type check + commit**

```
npx tsc --noEmit
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/WallDrawingCanvas.test.tsx
git commit -m "feat(lock): outil LOCK et double-clic nœud pour verrouiller/libérer"
```

---

### Task 5 — Drag guards: prevent moving locked nodes

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`
- Test: `src/components/plan/WallDrawingCanvas.test.tsx` (add tests)

- [ ] **Step 1: Write the failing tests**

In `src/components/plan/WallDrawingCanvas.test.tsx`, add:

```typescript
describe('WallDrawingCanvas — drag guards for locked nodes', () => {
  it('a locked node cannot be dragged (onUpdateNode not called with position)', () => {
    const node: WallNode = { id: 'n1', x: 200, y: 200, locked: true };
    const { onUpdateNode } = renderWithState([node], [], 'SELECT');
    const svg = document.querySelector('svg')!;
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 300 });
    // onUpdateNode may be called for locked toggle (not for position)
    const positionCalls = onUpdateNode.mock.calls.filter(
      ([, patch]) => 'x' in patch || 'y' in patch,
    );
    expect(positionCalls).toHaveLength(0);
  });

  it('a wall segment with a locked endpoint cannot be slid', () => {
    const n1: WallNode = { id: 'n1', x: 100, y: 200, locked: true };
    const n2: WallNode = { id: 'n2', x: 300, y: 200 };
    const wall: Wall = { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 100 };
    const { onUpdateNode } = renderWithState([n1, n2], [wall], 'SELECT');
    const svg = document.querySelector('svg')!;
    // Click midpoint to start wall drag
    fireEvent.pointerDown(svg, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(svg, { clientX: 200, clientY: 250 });
    const positionCalls = onUpdateNode.mock.calls.filter(
      ([, patch]) => 'x' in patch || 'y' in patch,
    );
    expect(positionCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```
npx vitest run src/components/plan/WallDrawingCanvas.test.tsx --reporter=verbose
```

Expected: 2 new guard tests FAIL.

- [ ] **Step 3: Guard wall drag start**

In `handlePointerDown`, in the SELECT branch, inside the `if (hit)` block where `setDraggingWallId` is called (around line 500):

Before `wallDragRef.current = { ... }; setDraggingWallId(hit.id)`, add:

```typescript
const wn1 = nodes.find((n) => n.id === hit.node1Id);
const wn2 = nodes.find((n) => n.id === hit.node2Id);
if (wn1?.locked || wn2?.locked) {
  // Locked endpoint — do not start wall drag
  return;
}
```

- [ ] **Step 4: Guard wall drag move**

In `handlePointerMove`, inside the `if (draggingWallId && wallDragRef.current)` block, at the very start (before computing `result`):

```typescript
if (draggingWallId && wallDragRef.current) {
  const ref = wallDragRef.current;
  const wall = walls.find((w) => w.id === draggingWallId);
  if (wall) {
    const wn1 = nodes.find((n) => n.id === wall.node1Id);
    const wn2 = nodes.find((n) => n.id === wall.node2Id);
    if (wn1?.locked || wn2?.locked) return; // guard
    // ... rest of existing code unchanged
```

- [ ] **Step 5: Guard merge in handlePointerUp**

In `handlePointerUp`, inside `if (draggingNodeId)`, before calling `onMergeNodes`:

```typescript
if (snap?.type === 'endpoint' && snap.nodeId && snap.nodeId !== draggingNodeId) {
  const keepNode = nodes.find((n) => n.id === snap.nodeId);
  const dropNode = nodes.find((n) => n.id === draggingNodeId);
  if (keepNode?.locked || dropNode?.locked) {
    onPushHistory();
    // skip merge — just commit position
  } else {
    onPushHistory();
    onMergeNodes(snap.nodeId, draggingNodeId);
  }
}
```

- [ ] **Step 6: Update svgCursor for locked nodes + LOCK tool**

In `src/components/plan/WallDrawingCanvas.tsx`, update the `svgCursor` IIFE:

```typescript
const svgCursor = (() => {
  if (tool === 'LOCK') return 'pointer';
  if (tool !== 'SELECT') return 'crosshair';
  if (draggingWallId) return 'grabbing';
  if (hoveredWallId) {
    const w = walls.find((wl) => wl.id === hoveredWallId);
    if (w) {
      const n1 = nodes.find((n) => n.id === w.node1Id);
      const n2 = nodes.find((n) => n.id === w.node2Id);
      if (n1 && n2) {
        if (n1.locked || n2.locked) return 'not-allowed';
        const adx = Math.abs(n2.x - n1.x);
        const ady = Math.abs(n2.y - n1.y);
        if (ady < adx * 0.1) return 'ns-resize';
        if (adx < ady * 0.1) return 'ew-resize';
        return 'move';
      }
    }
  }
  return 'crosshair';
})();
```

- [ ] **Step 7: Run all canvas tests**

```
npx vitest run src/components/plan/WallDrawingCanvas.test.tsx --reporter=verbose
```

Expected: All 11 tests PASS.

- [ ] **Step 8: Full test suite + type check + commit**

```
npx vitest run
npx tsc --noEmit
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/WallDrawingCanvas.test.tsx
git commit -m "feat(lock): gardes de drag pour les nœuds verrouillés"
```

---

### Task 6 — Visual rendering: green nodes, lock icon, green segment stroke

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx` (SVG render section)

No new tests needed — visual rendering is confirmed in the browser. The implementation follows precisely from the spec.

- [ ] **Step 1: Add green rendering for locked node handles**

In `src/components/plan/WallDrawingCanvas.tsx`, find the `{/* Node handles (SELECT mode) */}` block (around line 1231):

Replace:
```tsx
{tool === 'SELECT' && nodes.map((n) => {
  const sp = worldToScreen({ x: n.x, y: n.y });
  const isDragging = n.id === draggingNodeId;
  return (
    <circle key={n.id}
      cx={sp.x} cy={sp.y} r={5}
      fill={isDragging ? '#e67e22' : 'none'}
      stroke="#e67e22"
      strokeWidth={isDragging ? 2 : 1.5}
      style={{ cursor: 'grab' }}
    />
  );
})}
```

With:
```tsx
{(tool === 'SELECT' || tool === 'LOCK') && nodes.map((n) => {
  const sp = worldToScreen({ x: n.x, y: n.y });
  const isDragging = n.id === draggingNodeId;
  const isLocked = n.locked === true;
  const nodeColor = isLocked ? '#27ae60' : '#e67e22';
  return (
    <g key={n.id}>
      <circle
        cx={sp.x} cy={sp.y} r={5}
        fill={isDragging ? nodeColor : (isLocked ? '#eafaf1' : 'none')}
        stroke={nodeColor}
        strokeWidth={isDragging ? 2 : 1.5}
        style={{ cursor: isLocked ? 'default' : 'grab' }}
      />
      {isLocked && (
        <g transform={`translate(${sp.x - 4.5}, ${sp.y - 17})`} className="pointer-events-none">
          <rect x="0.5" y="4.5" width="8" height="6" rx="1.2" fill="#27ae60" />
          <path d="M2 4.5 V3 a2.5 2.5 0 0 1 5 0 V4.5" fill="none" stroke="#27ae60" strokeWidth="1.3" />
        </g>
      )}
    </g>
  );
})}
```

- [ ] **Step 2: Add green stroke to wall polygons when both nodes are locked**

Find the `{/* Wall polygons */}` block (around line 986):

Replace:
```tsx
{wallPolygons.map((poly) => {
  if (!poly.points.length) return null;
  const isSelected = poly.wallId === selectedWallId;
  const color = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
  const screenPts = poly.points
    .map((p) => worldToScreen(p))
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  return <polygon key={poly.wallId} points={screenPts} fill={color} />;
})}
```

With:
```tsx
{wallPolygons.map((poly) => {
  if (!poly.points.length) return null;
  const isSelected = poly.wallId === selectedWallId;
  const color = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
  const wall = walls.find((w) => w.id === poly.wallId);
  const isWallLocked = wall
    ? nodes.find((n) => n.id === wall.node1Id)?.locked === true &&
      nodes.find((n) => n.id === wall.node2Id)?.locked === true
    : false;
  const screenPts = poly.points
    .map((p) => worldToScreen(p))
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  return (
    <polygon
      key={poly.wallId}
      points={screenPts}
      fill={color}
      stroke={isWallLocked ? '#27ae60' : undefined}
      strokeWidth={isWallLocked ? 1.5 : undefined}
    />
  );
})}
```

- [ ] **Step 3: Type check + full test suite**

```
npx tsc --noEmit
npx vitest run
```

Expected: All tests pass, no type errors.

- [ ] **Step 4: Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(lock): rendu visuel vert pour nœuds et segments verrouillés"
```

---

## Self-Review

**Spec coverage:**
- `locked?: boolean` on `WallNode` → Task 1 ✅
- First node auto-locked → Task 2 ✅
- LOCK tool in toolbar → Task 3 ✅
- LOCK tool single-click toggles node / both segment endpoints → Task 4 ✅
- Double-click node in SELECT → toggle lock → Task 4 ✅
- Double-click segment → keeps existing thickness-editor behavior (not overridden) ✅
- Drag blocked if node locked → Task 5 ✅
- Wall slide blocked if endpoint locked → Task 5 ✅
- Merge blocked if node locked → Task 5 ✅
- Cursor `not-allowed` on locked wall → Task 5 ✅
- Green node (stroke + fill) + lock icon → Task 6 ✅
- Green segment stroke when both nodes locked → Task 6 ✅
- Undo/redo via `onPushHistory` before each toggle → all tasks ✅

**Placeholder scan:** All steps contain complete code — no TBDs or "similar to" references. ✅

**Type consistency:** `onUpdateNode` extended with `locked?` in Task 1 and used in Tasks 4 & 5. `PlanTool` extended with `'LOCK'` in Task 3 and used in Task 4 & 5 local type. ✅
