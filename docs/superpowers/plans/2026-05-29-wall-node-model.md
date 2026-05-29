# Wall Node Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the wall engine from `Wall { p1, p2 }` floating-point coordinates to a node-based model `WallNode { id, x, y }` + `Wall { node1Id, node2Id }` with shared vertices, correct corner geometry for any angle, node dragging, and H/V magnetic snapping.

**Architecture:** `WallNode` entities are stored alongside `Wall` entities in a `wallEngine: { nodes, walls }` field on `Project`. Geometry functions receive both arrays and resolve positions via node lookup. `WallDrawingCanvas` handles all node creation, reuse, drag, and snap logic internally.

**Tech Stack:** TypeScript, React 18, Zustand, SVG, Vitest

---

## File map

| File | Change |
|------|--------|
| `src/types/wall.ts` | New `WallNode`; `Wall` uses `node1Id/node2Id`; `SnapResult` gains `'hv'` type + `nodeId`; `DrawingChain` uses `nodeIds` |
| `src/types/project.ts` | `walls?: Wall[]` → `wallEngine?: { nodes: WallNode[]; walls: Wall[] }` |
| `src/lib/supabase/db.ts` | `migrateProject` reads `wallEngine`; detects old format → `undefined` |
| `src/store/projectStore.ts` | New node actions; wall actions operate on `wallEngine`; `initWallEngine` sets `{ nodes:[], walls:[] }`; `restoreSnapshot` takes optional `wallEngine` |
| `src/engine/geometry/wallGeometry.ts` | Signatures take `(walls, nodes)`; extension + joint computed by line-line intersection |
| `src/engine/geometry/wallGeometry.test.ts` | Update all 13 tests; add 45° and 120° angle cases |
| `src/engine/geometry/wallSnap.ts` | New `nodes` param; endpoint snap returns `nodeId`; new H/V snap type `'hv'` |
| `src/engine/geometry/wallSnap.test.ts` | Update existing tests; add H/V snap tests |
| `src/components/plan/WallDrawingCanvas.tsx` | Complete rewrite: node-based drawing chain, node drag, H/V snap rendering, handles |
| `src/components/plan/PlanEditor.tsx` | Subscribe to `wallEngine`; pass nodes+walls; update history; update canvas condition |

---

## Task 1 — Types (`src/types/wall.ts`)

**Files:**
- Modify: `src/types/wall.ts`

- [ ] **Step 1: Write the complete new file**

```typescript
// src/types/wall.ts
import type { Point } from './plan';

export interface WallNode {
  id: string;
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  node1Id: string;
  node2Id: string;
  thickness: number; // cm, default 20
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv';
  wallId?: string;
  nodeId?: string;   // set when type === 'endpoint'
  axis?: 'h' | 'v'; // set when type === 'hv'
}

export type DrawingChain = {
  nodeIds: string[];   // IDs of nodes already placed in the chain
  thickness: number;
} | null;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "types/wall" | head -10
```

Expected: no errors from `src/types/wall.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/wall.ts
git commit -m "refactor(wall-engine): WallNode + Wall{node1Id,node2Id} — types"
```

---

## Task 2 — Project types + DB migration

**Files:**
- Modify: `src/types/project.ts` (line 98)
- Modify: `src/lib/supabase/db.ts` (lines 5, 56)

- [ ] **Step 1: Update `src/types/project.ts`**

Replace line 98:
```typescript
  walls?: Wall[];     // wall-segment engine (Phase 1+)
```
with:
```typescript
  wallEngine?: { nodes: WallNode[]; walls: Wall[] }; // wall-segment engine (node model)
```

Also update the import at line 5:
```typescript
import type { Wall } from './wall';
```
to:
```typescript
import type { Wall, WallNode } from './wall';
```

- [ ] **Step 2: Update `migrateProject` in `src/lib/supabase/db.ts`**

Update line 2 import:
```typescript
import type { Wall, WallNode } from '@/types/wall';
```

Replace line 56:
```typescript
    walls: p.walls as Wall[] | undefined,
```
with:
```typescript
    wallEngine: (() => {
      // New format: { nodes: WallNode[], walls: Wall[] }
      if (p.wallEngine && typeof p.wallEngine === 'object' && !Array.isArray(p.wallEngine)) {
        return p.wallEngine as { nodes: WallNode[]; walls: Wall[] };
      }
      // Old format (p1/p2 arrays) or absent → table rase, treat as not initialized
      return undefined;
    })(),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "project\.ts|db\.ts" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/project.ts src/lib/supabase/db.ts
git commit -m "refactor(wall-engine): Project.wallEngine — types + db migration"
```

---

## Task 3 — Store (`src/store/projectStore.ts`)

**Files:**
- Modify: `src/store/projectStore.ts`

Context: currently the store has `addWall/removeWall/updateWall/setWalls/initWallEngine` operating on `p.walls`. These must now operate on `p.wallEngine.walls` and `p.wallEngine.nodes`.

- [ ] **Step 1: Update imports at top of store**

Replace:
```typescript
import type { Wall } from '@/types/wall';
```
with:
```typescript
import type { Wall, WallNode } from '@/types/wall';
```

- [ ] **Step 2: Update `ProjectState` interface**

Replace the wall engine actions block (lines 62-68):
```typescript
  // Wall engine actions
  addWall: (wall: Wall) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  setWalls: (walls: Wall[]) => void;
  initWallEngine: () => void;
```
with:
```typescript
  // Wall engine — node actions
  addNode: (node: WallNode) => void;
  updateNode: (id: string, patch: Partial<Pick<WallNode, 'x' | 'y'>>) => void;
  removeNode: (id: string) => void;
  setNodes: (nodes: WallNode[]) => void;
  mergeNodes: (keepId: string, dropId: string) => void;
  // Wall engine — wall actions
  addWall: (wall: Wall) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  setWalls: (walls: Wall[]) => void;
  initWallEngine: () => void;
```

- [ ] **Step 3: Update `restoreSnapshot` signature**

Replace:
```typescript
  restoreSnapshot: (rooms: Room[], constraints: Constraint[], walls?: Wall[]) => void;
```
with:
```typescript
  restoreSnapshot: (rooms: Room[], constraints: Constraint[], wallEngine?: { nodes: WallNode[]; walls: Wall[] }) => void;
```

- [ ] **Step 4: Replace wall engine action implementations**

Replace the `addWall`, `removeWall`, `updateWall`, `setWalls`, `initWallEngine` implementations (lines 334–355) and the `restoreSnapshot` implementation (lines 232–239) with:

```typescript
  restoreSnapshot: (rooms, constraints, wallEngine) => {
    get().updateActive((p) => ({
      ...p,
      rooms,
      constraints,
      ...(wallEngine !== undefined ? { wallEngine } : {}),
    }));
  },
```

```typescript
  addNode: (node) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, nodes: [...p.wallEngine.nodes, node] } };
    });
  },

  updateNode: (id, patch) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        wallEngine: {
          ...p.wallEngine,
          nodes: p.wallEngine.nodes.map((n) => n.id === id ? { ...n, ...patch } : n),
        },
      };
    });
  },

  removeNode: (id) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, nodes: p.wallEngine.nodes.filter((n) => n.id !== id) } };
    });
  },

  setNodes: (nodes) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, nodes } };
    });
  },

  mergeNodes: (keepId, dropId) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      const walls = p.wallEngine.walls
        .map((w) => ({
          ...w,
          node1Id: w.node1Id === dropId ? keepId : w.node1Id,
          node2Id: w.node2Id === dropId ? keepId : w.node2Id,
        }))
        .filter((w) => w.node1Id !== w.node2Id);
      const nodes = p.wallEngine.nodes.filter((n) => n.id !== dropId);
      return { ...p, wallEngine: { nodes, walls } };
    });
  },

  addWall: (wall) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, walls: [...p.wallEngine.walls, wall] } };
    });
  },

  removeWall: (id) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      const walls = p.wallEngine.walls.filter((w) => w.id !== id);
      const referencedIds = new Set(walls.flatMap((w) => [w.node1Id, w.node2Id]));
      const nodes = p.wallEngine.nodes.filter((n) => referencedIds.has(n.id));
      return { ...p, wallEngine: { nodes, walls } };
    });
  },

  updateWall: (id, patch) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return {
        ...p,
        wallEngine: {
          ...p.wallEngine,
          walls: p.wallEngine.walls.map((w) => w.id === id ? { ...w, ...patch } : w),
        },
      };
    });
  },

  setWalls: (walls) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: { ...p.wallEngine, walls } };
    });
  },

  initWallEngine: () => {
    get().updateActive((p) => ({ ...p, wallEngine: p.wallEngine ?? { nodes: [], walls: [] } }));
  },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "projectStore" | head -10
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass (previous count ~313).

- [ ] **Step 7: Commit**

```bash
git add src/store/projectStore.ts
git commit -m "refactor(wall-engine): store — nodes slice + wallEngine actions"
```

---

## Task 4 — Geometry engine

**Files:**
- Modify: `src/engine/geometry/wallGeometry.ts`
- Modify: `src/engine/geometry/wallGeometry.test.ts`

Context: `computeCornerGeometry` and `computeJointLines` currently take only `walls: Wall[]` and access `wall.p1/wall.p2`. They need to take `(walls: Wall[], nodes: WallNode[])` and use node lookup. The extension + joint formulas are replaced with the correct line-line intersection formula.

- [ ] **Step 1: Write the failing tests first**

Replace the full content of `src/engine/geometry/wallGeometry.test.ts`:

```typescript
// src/engine/geometry/wallGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { computeCornerGeometry, computeJointLines } from './wallGeometry';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function near(a: { x: number; y: number } | undefined, b: { x: number; y: number }, eps = 0.1): boolean {
  if (!a) return false;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

// ── computeCornerGeometry ──────────────────────────────────────────────────

describe('computeCornerGeometry', () => {
  it('preserves wallId', () => {
    const nodes = [nd('a', 0,0), nd('b', 100,0)];
    const walls: Wall[] = [{ id: 'abc', node1Id:'a', node2Id:'b', thickness:10 }];
    expect(computeCornerGeometry(walls, nodes)[0]!.wallId).toBe('abc');
  });

  it('returns empty points for zero-length wall (same node)', () => {
    const nodes = [nd('a', 0,0)];
    const walls: Wall[] = [{ id: 'z', node1Id:'a', node2Id:'a', thickness:10 }];
    expect(computeCornerGeometry(walls, nodes)[0]!.points).toHaveLength(0);
  });

  it('single horizontal wall — flat caps at both ends', () => {
    const nodes = [nd('a', 0,0), nd('b', 100,0)];
    const walls: Wall[] = [{ id: 'h', node1Id:'a', node2Id:'b', thickness:10 }];
    const pts = computeCornerGeometry(walls, nodes)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], { x:0,   y:5  })).toBe(true);
    expect(near(pts[1], { x:100, y:5  })).toBe(true);
    expect(near(pts[2], { x:100, y:-5 })).toBe(true);
    expect(near(pts[3], { x:0,   y:-5 })).toBe(true);
  });

  it('single vertical wall — flat caps', () => {
    const nodes = [nd('a', 0,0), nd('b', 0,100)];
    const walls: Wall[] = [{ id: 'v', node1Id:'a', node2Id:'b', thickness:10 }];
    const pts = computeCornerGeometry(walls, nodes)[0]!.points;
    expect(near(pts[0], { x:-5, y:0   })).toBe(true);
    expect(near(pts[1], { x:-5, y:100 })).toBe(true);
    expect(near(pts[2], { x:5,  y:100 })).toBe(true);
    expect(near(pts[3], { x:5,  y:0   })).toBe(true);
  });

  it('two walls at 90° — correct extensions', () => {
    // W1 horizontal (0,0)→(100,0) h=5; W2 vertical (100,0)→(100,100) h=5
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find(p => p.wallId==='w1')!;
    const p2 = polys.find(p => p.wallId==='w2')!;
    expect(near(p1.points[0]!, { x:0,   y:5  })).toBe(true);
    expect(near(p1.points[3]!, { x:0,   y:-5 })).toBe(true);
    expect(near(p1.points[1]!, { x:105, y:5  })).toBe(true);
    expect(near(p1.points[2]!, { x:105, y:-5 })).toBe(true);
    expect(near(p2.points[0]!, { x:95,  y:-5 })).toBe(true);
    expect(near(p2.points[3]!, { x:105, y:-5 })).toBe(true);
  });

  it('45° corner — correct extension (not T/2)', () => {
    // W1 horizontal (0,0)→(100,0) h=5; W2 at 45° from (100,0) h=5
    // correct ext = approx 2.07 (not 5)
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',170,70)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find(p => p.wallId==='w1')!;
    // Extension of w1 at n2: must be approx 2.07, not 5
    // Check that p1.points[1] is NOT at x=105 (which is the old wrong formula)
    const extX = p1.points[1]!.x - 100;
    expect(extX).toBeGreaterThan(0);
    expect(extX).toBeLessThan(5); // must be less than T/2=5
  });

  it('120° corner — extension greater than T/2', () => {
    // W1 horizontal, W2 at 60° from negative-X (obtuse corner)
    const angle = (120 * Math.PI) / 180;
    const nodes = [
      nd('n1', 0, 0),
      nd('n2', 100, 0),
      nd('n3', 100 + Math.cos(angle)*80, Math.sin(angle)*80),
    ];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find(p => p.wallId==='w1')!;
    const extX = p1.points[1]!.x - 100;
    expect(extX).toBeGreaterThan(5); // must be greater than T/2=5
  });
});

// ── computeJointLines ──────────────────────────────────────────────────────

describe('computeJointLines', () => {
  it('returns no lines for isolated walls', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0), nd('d',300,0)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'c', node2Id:'d', thickness:10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(0);
  });

  it('returns one line for two connected walls', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(1);
  });

  it('does not duplicate lines', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',100,100), nd('d',0,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(2);
  });

  it('90° equal-thickness — joint at (95,5) and (105,-5)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const lines = computeJointLines(walls, nodes);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    const a = near(l.p1, {x:95,y:5}) && near(l.p2, {x:105,y:-5});
    const b = near(l.p1, {x:105,y:-5}) && near(l.p2, {x:95,y:5});
    expect(a || b).toBe(true);
  });

  it('45° — joint endpoints stay within wall boundaries (|y|≤5)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',170,70)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
    ];
    const lines = computeJointLines(walls, nodes);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    // Both endpoints must be within the half-thickness of wall A (y in [-5,5] for horizontal wall)
    expect(Math.abs(l.p1.y)).toBeLessThanOrEqual(5.01);
    expect(Math.abs(l.p2.y)).toBeLessThanOrEqual(5.01);
  });

  it('different thicknesses — angle = arctan(h1/h2)', () => {
    const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
      { id:'w2', node1Id:'n2', node2Id:'n3', thickness:20 },
    ];
    const lines = computeJointLines(walls, nodes);
    const l = lines[0]!;
    const dx = Math.abs(l.p2.x - l.p1.x);
    const dy = Math.abs(l.p2.y - l.p1.y);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    expect(angle).toBeCloseTo(Math.atan2(5, 10) * 180 / Math.PI, 1);
  });
});
```

- [ ] **Step 2: Run tests — confirm failures**

```bash
npm test src/engine/geometry/wallGeometry.test.ts 2>&1 | tail -10
```

Expected: many failures (functions don't accept `nodes` parameter yet).

- [ ] **Step 3: Rewrite `src/engine/geometry/wallGeometry.ts`**

```typescript
// src/engine/geometry/wallGeometry.ts
import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points: [+n-node1, +n-node2, -n-node2, -n-node1] */
  points: Point[];
}

export interface JointLine {
  p1: Point;
  p2: Point;
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function nodePos(id: string, nodes: WallNode[]): Point {
  const n = nodes.find((n) => n.id === id);
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

function wallDir(wall: Wall, nodes: WallNode[]): Point {
  const p1 = nodePos(wall.node1Id, nodes);
  const p2 = nodePos(wall.node2Id, nodes);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

/**
 * Find walls (other than wallId) that share nodeId.
 */
function findNeighborsByNode(wallId: string, nodeId: string, walls: Wall[]): Wall[] {
  return walls.filter(
    (w) => w.id !== wallId && (w.node1Id === nodeId || w.node2Id === nodeId),
  );
}

/**
 * Compute the line-line intersection parameter t such that:
 *   vertex_interior = P + nA*hA + t*dA
 *   vertex_exterior = P - nA*hA - t*dA
 *
 * Returns null if walls are nearly parallel (|cross(dA,dB)| < 1e-6).
 */
function jointParam(
  nA: Point, hA: number, dA: Point,
  nB: Point, hB: number, dB: Point,
): number | null {
  const denom = cross(dA, dB);
  if (Math.abs(denom) < 1e-6) return null;
  const diff: Point = { x: nB.x * hB - nA.x * hA, y: nB.y * hB - nA.y * hA };
  return cross(diff, dB) / denom;
}

/**
 * Compute SVG polygon points for each wall.
 *
 * Each wall is a rectangle extended at connected endpoints by the amount
 * computed via line-line intersection (exact for any angle).
 * Zero-length walls return empty points.
 */
export function computeCornerGeometry(walls: Wall[], nodes: WallNode[]): WallPolygon[] {
  return walls.map((wall) => {
    const p1 = nodePos(wall.node1Id, nodes);
    const p2 = nodePos(wall.node2Id, nodes);
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return { wallId: wall.id, points: [] };

    const dir: Point = { x: dx / len, y: dy / len };
    const n: Point = { x: -dir.y, y: dir.x };
    const h = wall.thickness / 2;

    // Extension at node1 (wall approaches from the node1 end)
    // At node1, the wall goes in +dir direction away from node1.
    // Extension is in -dir direction (behind node1).
    const nbsN1 = findNeighborsByNode(wall.id, wall.node1Id, walls);
    let extN1 = 0;
    if (nbsN1.length > 0) {
      const nb = nbsN1[0]!;
      const nbDir = wallDir(nb, nodes);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };
      const t = jointParam(n, h, dir, nbN, nb.thickness / 2, nbDir);
      if (t !== null) extN1 = t; // positive t → extend in +dir (behind node1 in -dir convention)
    }

    // Extension at node2 (wall approaches toward node2)
    const nbsN2 = findNeighborsByNode(wall.id, wall.node2Id, walls);
    let extN2 = 0;
    if (nbsN2.length > 0) {
      const nb = nbsN2[0]!;
      const nbDir = wallDir(nb, nodes);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };
      const t = jointParam(n, h, dir, nbN, nb.thickness / 2, nbDir);
      if (t !== null) extN2 = -t; // negate: extension past node2 in +dir
    }

    return {
      wallId: wall.id,
      points: [
        { x: p1.x - dir.x * extN1 + n.x * h, y: p1.y - dir.y * extN1 + n.y * h },
        { x: p2.x + dir.x * extN2 + n.x * h, y: p2.y + dir.y * extN2 + n.y * h },
        { x: p2.x + dir.x * extN2 - n.x * h, y: p2.y + dir.y * extN2 - n.y * h },
        { x: p1.x - dir.x * extN1 - n.x * h, y: p1.y - dir.y * extN1 - n.y * h },
      ],
    };
  });
}

/**
 * Compute joint lines at each shared node between connected walls.
 *
 * Joint line endpoints are computed by line-line intersection of wall edge lines.
 * Deduplication: each shared node produces exactly one line.
 */
export function computeJointLines(walls: Wall[], nodes: WallNode[]): JointLine[] {
  const lines: JointLine[] = [];
  const seen = new Set<string>();

  for (const wall of walls) {
    const dir = wallDir(wall, nodes);
    const n: Point = { x: -dir.y, y: dir.x };
    const h = wall.thickness / 2;

    for (const nodeId of [wall.node1Id, wall.node2Id]) {
      const nbs = findNeighborsByNode(wall.id, nodeId, walls);
      if (nbs.length === 0) continue;

      const nb = nbs[0]!;
      const key = [wall.id, nb.id].sort().join('~') + '~' + nodeId;
      if (seen.has(key)) continue;
      seen.add(key);

      const nbDir = wallDir(nb, nodes);
      const nbN: Point = { x: -nbDir.y, y: nbDir.x };

      const t = jointParam(n, h, dir, nbN, nb.thickness / 2, nbDir);
      if (t === null) continue;

      const P = nodePos(nodeId, nodes);
      lines.push({
        p1: { x: P.x + n.x * h + t * dir.x, y: P.y + n.y * h + t * dir.y },
        p2: { x: P.x - n.x * h - t * dir.x, y: P.y - n.y * h - t * dir.y },
      });
    }
  }

  return lines;
}
```

- [ ] **Step 4: Run geometry tests**

```bash
npm test src/engine/geometry/wallGeometry.test.ts 2>&1 | tail -15
```

Expected: all tests pass. Debug any failures using the test output.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/geometry/wallGeometry.ts src/engine/geometry/wallGeometry.test.ts
git commit -m "refactor(wall-engine): wallGeometry — node lookup + line-line intersection formula"
```

---

## Task 5 — Snap engine

**Files:**
- Modify: `src/engine/geometry/wallSnap.ts`
- Modify: `src/engine/geometry/wallSnap.test.ts`

Context: `snapToWalls` currently takes `walls: Wall[]` and accesses `wall.p1/wall.p2`. It needs to take `nodes: WallNode[]` for endpoint positions. A new H/V snap type is added.

- [ ] **Step 1: Write failing H/V snap tests**

Replace full content of `src/engine/geometry/wallSnap.test.ts`:

```typescript
// src/engine/geometry/wallSnap.test.ts
import { describe, it, expect } from 'vitest';
import { snapToWalls } from './wallSnap';
import type { Wall, WallNode } from '@/types/wall';

const SCALE = 1;
const EP_R = 12;
const FA_R = 8;
const HV_R = 8;

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

// Two walls sharing node 'n2' at (100,0)
const nodes: WallNode[] = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,200)];
const horizontal: Wall = { id:'h', node1Id:'n1', node2Id:'n2', thickness:20 };
const vertical:   Wall = { id:'v', node1Id:'n2', node2Id:'n3', thickness:20 };

describe('snapToWalls — endpoint', () => {
  it('snaps to node1 position within radius', () => {
    const r = snapToWalls({ x:5, y:3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x:0, y:0 });
    expect(r?.nodeId).toBe('n1');
  });

  it('snaps to node2 position within radius', () => {
    const r = snapToWalls({ x:197, y:-2 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x:100, y:0 });
    expect(r?.nodeId).toBe('n2');
  });

  it('returns null far from all walls', () => {
    const r = snapToWalls({ x:500, y:500 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over face snap', () => {
    const r = snapToWalls({ x:100, y:5 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
  });
});

describe('snapToWalls — face', () => {
  it('snaps to projected point on centerline within face radius', () => {
    const r = snapToWalls({ x:50, y:5 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('face');
    expect(r?.point.x).toBeCloseTo(50);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('does not snap to face beyond wall bounds', () => {
    const r = snapToWalls({ x:300, y:2 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });
});

describe('snapToWalls — H/V snap', () => {
  it('snaps horizontally when cursor is near same Y as a node', () => {
    // cursor at (150, 3) — near y=0 of n1/n2 but far from endpoint and face
    const r = snapToWalls({ x:150, y:3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
    expect(r?.point.y).toBeCloseTo(0);
    expect(r?.point.x).toBeCloseTo(150);
  });

  it('snaps vertically when cursor is near same X as a node', () => {
    // cursor at (3, 150) — near x=0 of n1
    const r = snapToWalls({ x:3, y:150 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('v');
    expect(r?.point.x).toBeCloseTo(0);
    expect(r?.point.y).toBeCloseTo(150);
  });

  it('H/V snap does not activate when cursor is beyond snap radius', () => {
    const r = snapToWalls({ x:150, y:20 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over H/V snap', () => {
    // near n2=(100,0) but also near y=0 axis
    const r = snapToWalls({ x:100, y:3 }, [horizontal, vertical], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
  });
});
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
npm test src/engine/geometry/wallSnap.test.ts 2>&1 | tail -10
```

Expected: failures (wrong function signature).

- [ ] **Step 3: Rewrite `src/engine/geometry/wallSnap.ts`**

```typescript
// src/engine/geometry/wallSnap.ts
import type { Wall, WallNode, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function projectOntoSegment(cursor: Point, p1: Point, p2: Point) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return null;
  const t = ((cursor.x - p1.x) * dx + (cursor.y - p1.y) * dy) / lenSq;
  return { t, projected: { x: p1.x + t * dx, y: p1.y + t * dy } };
}

/**
 * Find the best snap target for `cursor` among `walls` and `nodes`.
 *
 * Priority:
 *  1. Endpoint snap — cursor within endpointRadiusPx of a node used by any wall
 *  2. Face snap — cursor projected onto wall centerline within segment bounds
 *  3. H/V snap — cursor within hvSnapPx on the H or V axis of any node
 *  4. null
 */
export function snapToWalls(
  cursor: Point,
  walls: Wall[],
  nodes: WallNode[],
  scale: number,
  endpointRadiusPx: number,
  faceRadiusPx: number,
  hvSnapPx: number,
): SnapResult | null {
  const epR  = endpointRadiusPx / scale;
  const faR  = faceRadiusPx / scale;
  const hvR  = hvSnapPx / scale;

  // Collect node IDs actually used by walls
  const usedNodeIds = new Set(walls.flatMap((w) => [w.node1Id, w.node2Id]));
  const activeNodes = nodes.filter((n) => usedNodeIds.has(n.id));

  // 1. Endpoint snap
  let bestEpDist = epR;
  let bestEp: SnapResult | null = null;
  for (const n of activeNodes) {
    const d = dist(cursor, { x: n.x, y: n.y });
    if (d < bestEpDist) {
      bestEpDist = d;
      bestEp = { point: { x: n.x, y: n.y }, type: 'endpoint', nodeId: n.id };
    }
  }
  if (bestEp) return bestEp;

  // 2. Face snap
  let bestFaDist = faR;
  let bestFa: SnapResult | null = null;
  for (const wall of walls) {
    const p1n = nodes.find((n) => n.id === wall.node1Id);
    const p2n = nodes.find((n) => n.id === wall.node2Id);
    if (!p1n || !p2n) continue;
    const p1: Point = { x: p1n.x, y: p1n.y };
    const p2: Point = { x: p2n.x, y: p2n.y };
    const proj = projectOntoSegment(cursor, p1, p2);
    if (!proj || proj.t < 0 || proj.t > 1) continue;
    const d = dist(cursor, proj.projected);
    if (d < bestFaDist) {
      bestFaDist = d;
      bestFa = { point: proj.projected, type: 'face', wallId: wall.id };
    }
  }
  if (bestFa) return bestFa;

  // 3. H/V snap — check alignment with any active node
  let bestHvDist = hvR;
  let bestHv: SnapResult | null = null;
  for (const n of activeNodes) {
    // Horizontal: same Y
    const dy = Math.abs(cursor.y - n.y);
    if (dy < bestHvDist) {
      bestHvDist = dy;
      bestHv = { point: { x: cursor.x, y: n.y }, type: 'hv', axis: 'h' };
    }
    // Vertical: same X
    const dx = Math.abs(cursor.x - n.x);
    if (dx < bestHvDist) {
      bestHvDist = dx;
      bestHv = { point: { x: n.x, y: cursor.y }, type: 'hv', axis: 'v' };
    }
  }
  if (bestHv) return bestHv;

  return null;
}
```

- [ ] **Step 4: Run snap tests**

```bash
npm test src/engine/geometry/wallSnap.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/geometry/wallSnap.ts src/engine/geometry/wallSnap.test.ts
git commit -m "refactor(wall-engine): wallSnap — nodes param + H/V snap type"
```

---

## Task 6 — WallDrawingCanvas

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

Context: Full rewrite. Props now receive `nodes: WallNode[]` and `walls: Wall[]` separately, plus node actions. Drawing chain uses `nodeIds`. SELECT mode adds node drag handles. H/V snap gets guide-line rendering.

- [ ] **Step 1: Rewrite `src/components/plan/WallDrawingCanvas.tsx`**

```typescript
'use client';

import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Wall, WallNode, DrawingChain, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';
import { snapToWalls } from '@/engine/geometry/wallSnap';
import { computeCornerGeometry, computeJointLines } from '@/engine/geometry/wallGeometry';
import { generateId } from '@/utils/id';
import { WallEdgeEditor } from './WallEdgeEditor';

type PlanTool = 'WALL' | 'SELECT' | 'DELETE';

const DEFAULT_THICKNESS   = 20;
const ENDPOINT_RADIUS_PX  = 12;
const FACE_RADIUS_PX      = 8;
const HV_SNAP_PX          = 8;
const NODE_HANDLE_RADIUS_PX = 10;
const WALL_COLOR          = '#6b6056';
const WALL_SELECTED_COLOR = '#e67e22';
const SNAP_INDICATOR_R    = 8;

interface WallDrawingCanvasProps {
  walls: Wall[];
  nodes: WallNode[];
  tool: PlanTool;
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
  onAddNode: (node: WallNode) => void;
  onUpdateNode: (id: string, patch: { x?: number; y?: number }) => void;
  onMergeNodes: (keepId: string, dropId: string) => void;
  onPushHistory: () => void;
}

function screenToWorld(pt: Point, pan: Point, scale: number): Point {
  return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
}: WallDrawingCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [pan,   setPan]   = useState<Point>({ x: 200, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ panX:number; panY:number; clientX:number; clientY:number } | null>(null);

  const [chain,        setChain]        = useState<DrawingChain>(null);
  const [cursor,       setCursor]       = useState<Point | null>(null);
  const [snapResult,   setSnapResult]   = useState<SnapResult | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editingWallId,  setEditingWallId]  = useState<string | null>(null);
  const [editThickness,  setEditThickness]  = useState('');

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragSnapRef = useRef<SnapResult | null>(null);

  useEffect(() => {
    setSelectedWallId(null);
    setEditingWallId(null);
    setChain(null);
  }, [tool]);

  const getSvgPos = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const getWorldPos = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    return screenToWorld(getSvgPos(e), pan, scale);
  }, [pan, scale, getSvgPos]);

  const worldToScreen = useCallback((pt: Point): Point => ({
    x: pt.x * scale + pan.x,
    y: pt.y * scale + pan.y,
  }), [pan, scale]);

  // Wheel zoom — non-passive
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      setScale((s) => {
        const ns = Math.max(0.05, Math.min(5, s * factor));
        setPan((p) => ({ x: ox - (ox - p.x) * (ns / s), y: oy - (oy - p.y) * (ns / s) }));
        return ns;
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // ── Hit test helpers ───────────────────────────────────────────────────────

  const hitTestNode = useCallback((world: Point): WallNode | null => {
    const r = NODE_HANDLE_RADIUS_PX / scale;
    for (const n of nodes) {
      if (dist(world, { x: n.x, y: n.y }) < r) return n;
    }
    return null;
  }, [nodes, scale]);

  const hitTestWall = useCallback((world: Point): Wall | null => {
    for (const wall of walls) {
      const n1 = nodes.find((n) => n.id === wall.node1Id);
      const n2 = nodes.find((n) => n.id === wall.node2Id);
      if (!n1 || !n2) continue;
      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1,
        ((world.x - n1.x) * dx + (world.y - n1.y) * dy) / lenSq,
      ));
      const proj = { x: n1.x + t * dx, y: n1.y + t * dy };
      if (dist(world, proj) <= wall.thickness / 2 + 4 / scale) return wall;
    }
    return null;
  }, [walls, nodes, scale]);

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      const sp = getSvgPos(e);
      panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const world = getWorldPos(e);
    const snap  = snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    const pt    = snap?.point ?? world;

    if (tool === 'WALL') {
      if (!chain) {
        // Start chain: create first node
        let nodeId: string;
        if (snap?.type === 'endpoint' && snap.nodeId) {
          nodeId = snap.nodeId;
        } else {
          nodeId = generateId();
          onAddNode({ id: nodeId, x: pt.x, y: pt.y });
        }
        setChain({ nodeIds: [nodeId], thickness: DEFAULT_THICKNESS });
      } else {
        const prevNodeId = chain.nodeIds[chain.nodeIds.length - 1]!;
        const prevNode = nodes.find((n) => n.id === prevNodeId);
        if (!prevNode) return;
        if (dist({ x: prevNode.x, y: prevNode.y }, pt) < 1) return;

        // Find or create target node
        let targetNodeId: string;
        if (snap?.type === 'endpoint' && snap.nodeId) {
          targetNodeId = snap.nodeId;
        } else {
          targetNodeId = generateId();
          onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
        }

        onPushHistory();
        onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });

        // Close chain if snapped back to start
        const startId = chain.nodeIds[0]!;
        if (targetNodeId === startId) {
          setChain(null);
        } else {
          setChain({ ...chain, nodeIds: [...chain.nodeIds, targetNodeId] });
        }
      }
      return;
    }

    if (tool === 'SELECT') {
      // Node drag takes priority over wall selection
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
        setEditThickness(hit.thickness.toFixed(1));
      } else {
        setEditingWallId(null);
      }
      return;
    }

    if (tool === 'DELETE') {
      const hit = hitTestWall(world);
      if (hit) { onPushHistory(); onRemoveWall(hit.id); }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning && panStart.current) {
      const sp = getSvgPos(e);
      setPan({
        x: panStart.current.panX + (sp.x - panStart.current.clientX),
        y: panStart.current.panY + (sp.y - panStart.current.clientY),
      });
      return;
    }

    const world = getWorldPos(e);

    // Node drag
    if (draggingNodeId) {
      // Snap excluding the dragged node itself
      const otherNodes = nodes.filter((n) => n.id !== draggingNodeId);
      const snapWalls  = walls.filter((w) => w.node1Id !== draggingNodeId && w.node2Id !== draggingNodeId);
      const snap = snapToWalls(world, snapWalls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
      const pt = snap?.point ?? world;
      dragSnapRef.current = snap;
      onUpdateNode(draggingNodeId, { x: pt.x, y: pt.y });
      setCursor(pt);
      return;
    }

    const snap = snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    setCursor(snap?.point ?? world);
    setSnapResult(snap);
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      return;
    }

    if (draggingNodeId) {
      // Check for node merge
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
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') setChain(null);
  };

  // ── WallEdgeEditor ─────────────────────────────────────────────────────────

  const submitThickness = () => {
    if (!editingWallId) return;
    const v = parseFloat(editThickness);
    if (!isNaN(v) && v > 0) { onPushHistory(); onUpdateWall(editingWallId, { thickness: v }); }
    setEditingWallId(null);
  };

  // ── Geometry ───────────────────────────────────────────────────────────────

  const wallPolygons = useMemo(() => computeCornerGeometry(walls, nodes), [walls, nodes]);
  const jointLines   = useMemo(() => computeJointLines(walls, nodes),     [walls, nodes]);

  const editingWall = editingWallId ? walls.find((w) => w.id === editingWallId) : null;
  const editingWallN1 = editingWall ? nodes.find((n) => n.id === editingWall.node1Id) : null;
  const editingWallN2 = editingWall ? nodes.find((n) => n.id === editingWall.node2Id) : null;
  const editingScreen = (editingWallN1 && editingWallN2) ? worldToScreen({
    x: (editingWallN1.x + editingWallN2.x) / 2,
    y: (editingWallN1.y + editingWallN2.y) / 2,
  }) : null;

  // ── Chain preview ──────────────────────────────────────────────────────────

  const chainPreview = (() => {
    if (!chain || !cursor) return null;
    const lastId = chain.nodeIds[chain.nodeIds.length - 1]!;
    const lastNode = nodes.find((n) => n.id === lastId);
    if (!lastNode) return null;
    const sl = worldToScreen({ x: lastNode.x, y: lastNode.y });
    const sc = worldToScreen(cursor);
    const dx = sc.x - sl.x, dy = sc.y - sl.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return null;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const halfT = (DEFAULT_THICKNESS / 2) * scale;
    return { sl, angle, len, halfT };
  })();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1c24]" tabIndex={0}>
      <svg
        ref={svgRef}
        className="h-full w-full cursor-crosshair select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Grid */}
        <defs>
          <pattern id="wdc-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse"
            x={pan.x % (20 * scale)} y={pan.y % (20 * scale)}>
            <circle cx={10 * scale} cy={10 * scale} r="0.8" fill="#272b38" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wdc-grid)" />

        {/* Wall polygons */}
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

        {/* Joint lines */}
        {jointLines.map((line, i) => {
          const sp1 = worldToScreen(line.p1);
          const sp2 = worldToScreen(line.p2);
          return (
            <line key={`joint-${i}`}
              x1={sp1.x} y1={sp1.y} x2={sp2.x} y2={sp2.y}
              stroke="#3d3830" strokeWidth={1.5} />
          );
        })}

        {/* Chain preview */}
        {chainPreview && (
          <g transform={`translate(${chainPreview.sl.x},${chainPreview.sl.y}) rotate(${chainPreview.angle})`} opacity={0.5}>
            <rect x={0} y={-chainPreview.halfT} width={chainPreview.len} height={chainPreview.halfT * 2}
              fill={WALL_COLOR} stroke="#e67e22" strokeWidth={1} strokeDasharray="6,3" rx={1} />
          </g>
        )}

        {/* H/V snap guide lines */}
        {tool === 'WALL' && snapResult?.type === 'hv' && cursor && (() => {
          const sc = worldToScreen(cursor);
          if (snapResult.axis === 'h') {
            return <line x1={0} y1={sc.y} x2="100%" y2={sc.y}
              stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />;
          }
          return <line x1={sc.x} y1={0} x2={sc.x} y2="100%"
            stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />;
        })()}

        {/* Snap indicator */}
        {tool === 'WALL' && cursor && (() => {
          const sc = worldToScreen(cursor);
          if (snapResult?.type === 'endpoint') {
            return <circle cx={sc.x} cy={sc.y} r={SNAP_INDICATOR_R}
              fill="none" stroke="#e67e22" strokeWidth={2} />;
          }
          if (snapResult?.type === 'face') {
            return <rect x={sc.x - SNAP_INDICATOR_R / 2} y={sc.y - SNAP_INDICATOR_R / 2}
              width={SNAP_INDICATOR_R} height={SNAP_INDICATOR_R}
              fill="none" stroke="#e67e22" strokeWidth={1.5} />;
          }
          if (snapResult?.type === 'hv') {
            return <circle cx={sc.x} cy={sc.y} r={SNAP_INDICATOR_R}
              fill="none" stroke="#27ae60" strokeWidth={1.5} strokeDasharray="3,2" />;
          }
          return null;
        })()}

        {/* Chain start ring (close indicator) */}
        {tool === 'WALL' && chain && chain.nodeIds.length > 0 && (() => {
          const startId = chain.nodeIds[0]!;
          const startNode = nodes.find((n) => n.id === startId);
          if (!startNode) return null;
          const ss = worldToScreen({ x: startNode.x, y: startNode.y });
          return <circle cx={ss.x} cy={ss.y} r={ENDPOINT_RADIUS_PX + 4}
            fill="none" stroke="#27ae60" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7} />;
        })()}

        {/* Node handles (SELECT mode) */}
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
      </svg>

      {/* WallEdgeEditor popup */}
      {editingWall && editingScreen && (
        <WallEdgeEditor
          screenX={editingScreen.x}
          screenY={editingScreen.y}
          above
          thicknessValue={editThickness}
          onThicknessChange={setEditThickness}
          hasExistingConstraint={false}
          onRelease={() => setEditingWallId(null)}
          onSubmit={submitThickness}
          onCancel={() => setEditingWallId(null)}
        />
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "WallDrawingCanvas" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "refactor(wall-engine): WallDrawingCanvas — node model, drag, H/V snap"
```

---

## Task 7 — PlanEditor

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

Context: PlanEditor subscribes to `project.walls` (line ~234) and passes `walls` to `WallDrawingCanvas` (line ~1860). History uses `wallsRef` (line ~473). All must be updated to use `wallEngine`.

- [ ] **Step 1: Update imports (line 33)**

Replace:
```typescript
import type { Wall } from '@/types/wall';
```
with:
```typescript
import type { Wall, WallNode } from '@/types/wall';
```

- [ ] **Step 2: Update `HistoryEntry` (line 37)**

Replace:
```typescript
interface HistoryEntry { rooms: Room[]; constraints: Constraint[]; walls: Wall[]; }
```
with:
```typescript
interface HistoryEntry {
  rooms: Room[];
  constraints: Constraint[];
  wallEngine?: { nodes: WallNode[]; walls: Wall[] };
}
```

- [ ] **Step 3: Update store subscriptions (lines ~234–238)**

Replace:
```typescript
  const walls          = useProjectStore((s) => selectActiveProject(s)?.walls);
  const addWall        = useProjectStore((s) => s.addWall);
  const removeWall     = useProjectStore((s) => s.removeWall);
  const updateWall     = useProjectStore((s) => s.updateWall);
  const initWallEngine = useProjectStore((s) => s.initWallEngine);
```
with:
```typescript
  const wallEngine     = useProjectStore((s) => selectActiveProject(s)?.wallEngine);
  const addNode        = useProjectStore((s) => s.addNode);
  const updateNode     = useProjectStore((s) => s.updateNode);
  const mergeNodes     = useProjectStore((s) => s.mergeNodes);
  const addWall        = useProjectStore((s) => s.addWall);
  const removeWall     = useProjectStore((s) => s.removeWall);
  const updateWall     = useProjectStore((s) => s.updateWall);
  const initWallEngine = useProjectStore((s) => s.initWallEngine);
```

- [ ] **Step 4: Replace `wallsRef` with `wallEngineRef` (lines ~473, 480)**

Replace:
```typescript
  const wallsRef = useRef(walls);
```
with:
```typescript
  const wallEngineRef = useRef(wallEngine);
```

Replace:
```typescript
  useEffect(() => { wallsRef.current = walls; }, [walls]);
```
with:
```typescript
  useEffect(() => { wallEngineRef.current = wallEngine; }, [wallEngine]);
```

- [ ] **Step 5: Update `pushHistory` (lines ~523–530)**

Replace:
```typescript
  const pushHistory = useCallback(() => {
    setPast((prev) => [{
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
      walls: wallsRef.current ? [...wallsRef.current] : [],
    }, ...prev.slice(0, 49)]);
    setFuture([]);
  }, []);
```
with:
```typescript
  const pushHistory = useCallback(() => {
    setPast((prev) => [{
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
      wallEngine: wallEngineRef.current
        ? { nodes: [...wallEngineRef.current.nodes], walls: [...wallEngineRef.current.walls] }
        : undefined,
    }, ...prev.slice(0, 49)]);
    setFuture([]);
  }, []);
```

- [ ] **Step 6: Update `handleUndo` (lines ~1587–1599)**

Replace:
```typescript
  const handleUndo = () => {
    const p = pastRef.current;
    if (!p.length) return;
    const [entry, ...rest] = p;
    const current: HistoryEntry = {
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
      walls: wallsRef.current ? [...wallsRef.current] : [],
    };
    setFuture((f) => [current, ...f.slice(0, 49)]);
    setPast(rest);
    restoreSnapshot(entry!.rooms, entry!.constraints, entry!.walls);
  };
```
with:
```typescript
  const handleUndo = () => {
    const p = pastRef.current;
    if (!p.length) return;
    const [entry, ...rest] = p;
    const current: HistoryEntry = {
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
      wallEngine: wallEngineRef.current
        ? { nodes: [...wallEngineRef.current.nodes], walls: [...wallEngineRef.current.walls] }
        : undefined,
    };
    setFuture((f) => [current, ...f.slice(0, 49)]);
    setPast(rest);
    restoreSnapshot(entry!.rooms, entry!.constraints, entry!.wallEngine);
  };
```

- [ ] **Step 7: Update `handleRedo` (lines ~1601–1613)**

Replace:
```typescript
  const handleRedo = () => {
    const f = futureRef.current;
    if (!f.length) return;
    const [entry, ...rest] = f;
    const current: HistoryEntry = {
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
      walls: wallsRef.current ? [...wallsRef.current] : [],
    };
    setPast((p) => [current, ...p.slice(0, 49)]);
    setFuture(rest);
    restoreSnapshot(entry!.rooms, entry!.constraints, entry!.walls);
  };
```
with:
```typescript
  const handleRedo = () => {
    const f = futureRef.current;
    if (!f.length) return;
    const [entry, ...rest] = f;
    const current: HistoryEntry = {
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
      wallEngine: wallEngineRef.current
        ? { nodes: [...wallEngineRef.current.nodes], walls: [...wallEngineRef.current.walls] }
        : undefined,
    };
    setPast((p) => [current, ...p.slice(0, 49)]);
    setFuture(rest);
    restoreSnapshot(entry!.rooms, entry!.constraints, entry!.wallEngine);
  };
```

- [ ] **Step 8: Update "Nouveau moteur" button (line ~1750)**

Replace:
```typescript
      {walls === undefined && (
```
with:
```typescript
      {wallEngine === undefined && (
```

- [ ] **Step 9: Update `WallDrawingCanvas` render (lines ~1859–1867)**

Replace:
```typescript
      {walls !== undefined ? (
        <WallDrawingCanvas
          walls={walls}
          tool={tool as 'WALL' | 'SELECT' | 'DELETE'}
          onAddWall={addWall}
          onRemoveWall={removeWall}
          onUpdateWall={updateWall}
          onPushHistory={pushHistory}
        />
```
with:
```typescript
      {wallEngine !== undefined ? (
        <WallDrawingCanvas
          walls={wallEngine.walls}
          nodes={wallEngine.nodes}
          tool={tool as 'WALL' | 'SELECT' | 'DELETE'}
          onAddWall={addWall}
          onRemoveWall={removeWall}
          onUpdateWall={updateWall}
          onAddNode={addNode}
          onUpdateNode={updateNode}
          onMergeNodes={mergeNodes}
          onPushHistory={pushHistory}
        />
```

- [ ] **Step 10: Verify TypeScript compiles with zero errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 11: Run full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add src/components/plan/PlanEditor.tsx
git commit -m "refactor(wall-engine): PlanEditor — wallEngine subscription + node actions"
```

---

## Final verification

- [ ] **Start dev server and manual smoke test**

```bash
npm run dev
```

Open `https://<codespace>-3000.app.github.dev` in browser.

1. Open or create a project
2. Click "Nouveau moteur ✦" to activate the wall engine
3. Draw walls in WALL mode — verify chain drawing works, snap indicators appear
4. Draw walls at non-90° angles — verify corners render correctly (no gap, no overlap)
5. Switch to SELECT mode — verify node handles appear as circles
6. Drag a node — verify all connected walls follow
7. Drag node near another node — verify they merge
8. Move cursor near horizontal/vertical alignment with existing node — verify dashed guide line appears
9. Switch to DELETE mode — click a wall to remove it

- [ ] **Cleanup temporary viz page**

```bash
rm -rf src/app/corner-viz
git add -A
git commit -m "chore: remove corner-viz debug page"
```
