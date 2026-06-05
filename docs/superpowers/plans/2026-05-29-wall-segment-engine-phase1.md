# Wall Segment Engine — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le moteur de dessin wall-segment Phase 1 — types, store, snap, composant WallDrawingCanvas, intégration PlanEditor avec undo/redo.

**Architecture:** Nouveau slice `walls: Wall[]` dans `useProjectStore`. Nouveau composant `WallDrawingCanvas` (SVG autonome, pan/zoom inclus) monté à la place de `DrawingCanvas` quand `project.walls !== undefined`. Historique undo/redo géré par PlanEditor (extension de `HistoryEntry`).

**Tech Stack:** React 18, TypeScript, Zustand, SVG, vitest

---

## Structure de fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/types/wall.ts` | Créer | Types `Wall`, `SnapResult`, `DrawingChain` |
| `src/types/project.ts` | Modifier | Ajouter `walls?: Wall[]` à `Project` |
| `src/store/projectStore.ts` | Modifier | Actions wall + extension `restoreSnapshot` |
| `src/store/projectStore.test.ts` | Modifier | Tests des actions wall |
| `src/engine/geometry/wallSnap.ts` | Créer | Fonctions snap (endpoint, face, libre) |
| `src/engine/geometry/wallSnap.test.ts` | Créer | Tests snap |
| `src/components/plan/WallDrawingCanvas.tsx` | Créer | Composant SVG complet (draw/select/delete) |
| `src/components/plan/PlanEditor.tsx` | Modifier | Montage conditionnel + undo/redo walls |

---

## Task 1: Types Wall

**Files:**
- Create: `src/types/wall.ts`
- Modify: `src/types/project.ts`

- [ ] **Step 1 — Créer `src/types/wall.ts`**

```typescript
// src/types/wall.ts
import type { Point } from './plan';

export interface Wall {
  id: string;
  p1: Point;
  p2: Point;
  thickness: number;  // cm, défaut 20
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'free';
  wallId?: string;
}

export type DrawingChain = {
  points: Point[];
  thickness: number;
} | null;
```

- [ ] **Step 2 — Ajouter `walls?: Wall[]` à `Project` dans `src/types/project.ts`**

Trouver `interface Project {` (ligne ~88) et ajouter après `rooms: Room[];` :

```typescript
  walls?: Wall[];     // wall-segment engine (Phase 1+)
```

Ajouter l'import en tête de fichier :

```typescript
import type { Wall } from './wall';
```

- [ ] **Step 3 — Vérifier TypeScript compile**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -20
```

Expected: zéro erreur dans les fichiers modifiés (il peut y avoir des erreurs préexistantes, ignorer).

- [ ] **Step 4 — Commit**

```bash
git add src/types/wall.ts src/types/project.ts
git commit -m "feat(wall-engine): types Wall + extension Project"
```

---

## Task 2: Store — actions wall

**Files:**
- Modify: `src/store/projectStore.ts`
- Modify: `src/store/projectStore.test.ts`

- [ ] **Step 1 — Écrire les tests (failing)**

Dans `src/store/projectStore.test.ts`, ajouter après les imports existants :

```typescript
import type { Wall } from '@/types/wall';
import { selectActiveProject } from './projectStore';
```

Ajouter à la fin du fichier :

```typescript
describe('projectStore — wall actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [], activeProjectId: null, hydrated: false });
  });

  it('addWall appends a wall to the active project', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const wall: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    useProjectStore.getState().addWall(wall);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls).toHaveLength(1);
    expect(active?.walls?.[0]).toEqual(wall);
  });

  it('removeWall removes a wall by id', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const wall: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    useProjectStore.getState().addWall(wall);
    useProjectStore.getState().removeWall('w1');

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls ?? []).toHaveLength(0);
  });

  it('updateWall patches a wall by id', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const wall: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    useProjectStore.getState().addWall(wall);
    useProjectStore.getState().updateWall('w1', { thickness: 30 });

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls?.[0].thickness).toBe(30);
  });

  it('setWalls replaces the full walls list', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    const w1: Wall = { id: 'w1', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, thickness: 20 };
    const w2: Wall = { id: 'w2', p1: { x: 100, y: 0 }, p2: { x: 100, y: 100 }, thickness: 20 };
    useProjectStore.getState().addWall(w1);
    useProjectStore.getState().setWalls([w2]);

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls).toHaveLength(1);
    expect(active?.walls?.[0].id).toBe('w2');
  });

  it('initWallEngine sets walls to empty array', async () => {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();

    useProjectStore.getState().initWallEngine();

    const active = selectActiveProject(useProjectStore.getState());
    expect(active?.walls).toEqual([]);
  });
});
```

- [ ] **Step 2 — Vérifier que les tests échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/store/projectStore.test.ts 2>&1 | tail -20
```

Expected: 5 tests FAIL avec "addWall is not a function" ou similaire.

- [ ] **Step 3 — Implémenter les actions dans `src/store/projectStore.ts`**

**3a.** Ajouter l'import Wall en tête :

```typescript
import type { Wall } from '@/types/wall';
```

**3b.** Ajouter les signatures dans `interface ProjectState` (après `clearPartitionsAndZones`) :

```typescript
  // Wall engine actions
  addWall: (wall: Wall) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  setWalls: (walls: Wall[]) => void;
  initWallEngine: () => void;
```

**3c.** Ajouter les implémentations dans `create<ProjectState>((set, get) => ({` (après `clearPartitionsAndZones`) :

```typescript
  addWall: (wall) => {
    get().updateActive((p) => ({ ...p, walls: [...(p.walls ?? []), wall] }));
  },
  removeWall: (id) => {
    get().updateActive((p) => ({ ...p, walls: (p.walls ?? []).filter((w) => w.id !== id) }));
  },
  updateWall: (id, patch) => {
    get().updateActive((p) => ({
      ...p,
      walls: (p.walls ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  },
  setWalls: (walls) => {
    get().updateActive((p) => ({ ...p, walls }));
  },
  initWallEngine: () => {
    get().updateActive((p) => ({ ...p, walls: p.walls ?? [] }));
  },
```

**3d.** Étendre `restoreSnapshot` pour inclure `walls` — remplacer la définition existante :

Signature dans l'interface (remplacer `restoreSnapshot: (rooms: Room[], constraints: Constraint[]) => void;`) :

```typescript
  restoreSnapshot: (rooms: Room[], constraints: Constraint[], walls?: Wall[]) => void;
```

Implémentation (remplacer l'existante) :

```typescript
  restoreSnapshot: (rooms, constraints, walls) => {
    get().updateActive((p) => ({
      ...p,
      rooms,
      constraints,
      ...(walls !== undefined ? { walls } : {}),
    }));
  },
```

- [ ] **Step 4 — Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/store/projectStore.test.ts 2>&1 | tail -20
```

Expected: tous les tests PASS (les anciens + les 5 nouveaux).

- [ ] **Step 5 — Commit**

```bash
git add src/store/projectStore.ts src/store/projectStore.test.ts
git commit -m "feat(wall-engine): actions addWall/removeWall/updateWall/setWalls/initWallEngine"
```

---

## Task 3: Snap utilities

**Files:**
- Create: `src/engine/geometry/wallSnap.ts`
- Create: `src/engine/geometry/wallSnap.test.ts`

- [ ] **Step 1 — Écrire les tests (failing)**

```typescript
// src/engine/geometry/wallSnap.test.ts
import { describe, it, expect } from 'vitest';
import { snapToWalls } from './wallSnap';
import type { Wall } from '@/types/wall';

const SCALE = 1;
const EP_R = 12;  // endpoint radius px
const FA_R = 8;   // face radius px

const horizontal: Wall = { id: 'h', p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, thickness: 20 };
const vertical: Wall   = { id: 'v', p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 }, thickness: 20 };

describe('snapToWalls — endpoint', () => {
  it('snaps to p1 within radius', () => {
    const r = snapToWalls({ x: 5, y: 3 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x: 0, y: 0 });
    expect(r?.wallId).toBe('h');
  });

  it('snaps to p2 within radius', () => {
    const r = snapToWalls({ x: 197, y: -2 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x: 200, y: 0 });
  });

  it('returns null far from all walls', () => {
    const r = snapToWalls({ x: 500, y: 500 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over face snap', () => {
    // cursor near p2 of horizontal AND near the face — should be endpoint
    const r = snapToWalls({ x: 200, y: 5 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('endpoint');
  });
});

describe('snapToWalls — face (T-junction)', () => {
  it('snaps to projected point on centerline within face radius', () => {
    // cursor at (100, 5) — near centerline of horizontal wall at (100, 0)
    const r = snapToWalls({ x: 100, y: 5 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('face');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
    expect(r?.wallId).toBe('h');
  });

  it('does not snap to face when projection is outside wall bounds', () => {
    // cursor at (300, 2) — projection at (300, 0) is beyond p2=(200, 0)
    const r = snapToWalls({ x: 300, y: 2 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r).toBeNull();
  });

  it('does not snap to face when distance exceeds face radius', () => {
    // cursor at (100, 50) — far from wall
    const r = snapToWalls({ x: 100, y: 50 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r).toBeNull();
  });
});

describe('snapToWalls — multiple walls', () => {
  it('picks the closest endpoint when two walls have nearby endpoints', () => {
    const r = snapToWalls({ x: 100, y: 3 }, [horizontal, vertical], SCALE, EP_R, FA_R);
    // (100, 0) is p2 of horizontal AND p1 of vertical — both equidistant
    // either is acceptable, but must be type 'endpoint'
    expect(r?.type).toBe('endpoint');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2 — Vérifier que les tests échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallSnap.test.ts 2>&1 | tail -10
```

Expected: FAIL "Cannot find module './wallSnap'".

- [ ] **Step 3 — Implémenter `src/engine/geometry/wallSnap.ts`**

```typescript
// src/engine/geometry/wallSnap.ts
import type { Wall, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';

/** Euclidean distance in world units. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Project `cursor` onto the segment [p1, p2].
 * Returns { t, projected } where t ∈ [0,1] is the parameter along the segment
 * and `projected` is the closest point on the infinite line.
 * Returns null if the segment has zero length.
 */
function projectOntoSegment(
  cursor: Point,
  p1: Point,
  p2: Point,
): { t: number; projected: Point } | null {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return null;
  const t = ((cursor.x - p1.x) * dx + (cursor.y - p1.y) * dy) / lenSq;
  const projected: Point = { x: p1.x + t * dx, y: p1.y + t * dy };
  return { t, projected };
}

/**
 * Find the best snap target for `cursor` among `walls`.
 *
 * Priority:
 *  1. Endpoint snap (radius = endpointRadiusPx / scale)
 *  2. Face snap — cursor projected onto wall centerline within segment bounds
 *     (radius = faceRadiusPx / scale)
 *  3. null (free placement)
 */
export function snapToWalls(
  cursor: Point,
  walls: Wall[],
  scale: number,
  endpointRadiusPx: number,
  faceRadiusPx: number,
): SnapResult | null {
  const epRadius = endpointRadiusPx / scale;
  const faceRadius = faceRadiusPx / scale;

  // 1. Endpoint snap
  let bestEpDist = epRadius;
  let bestEp: SnapResult | null = null;
  for (const wall of walls) {
    for (const pt of [wall.p1, wall.p2]) {
      const d = dist(cursor, pt);
      if (d < bestEpDist) {
        bestEpDist = d;
        bestEp = { point: pt, type: 'endpoint', wallId: wall.id };
      }
    }
  }
  if (bestEp) return bestEp;

  // 2. Face snap (project onto centerline)
  let bestFaceDist = faceRadius;
  let bestFace: SnapResult | null = null;
  for (const wall of walls) {
    const proj = projectOntoSegment(cursor, wall.p1, wall.p2);
    if (!proj) continue;
    if (proj.t < 0 || proj.t > 1) continue;  // outside segment bounds
    const d = dist(cursor, proj.projected);
    if (d < bestFaceDist) {
      bestFaceDist = d;
      bestFace = { point: proj.projected, type: 'face', wallId: wall.id };
    }
  }
  if (bestFace) return bestFace;

  return null;
}
```

- [ ] **Step 4 — Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallSnap.test.ts 2>&1 | tail -10
```

Expected: tous les tests PASS.

- [ ] **Step 5 — Commit**

```bash
git add src/engine/geometry/wallSnap.ts src/engine/geometry/wallSnap.test.ts
git commit -m "feat(wall-engine): snapToWalls — endpoint + face snap"
```

---

## Task 4: WallDrawingCanvas

**Files:**
- Create: `src/components/plan/WallDrawingCanvas.tsx`

Le composant gère son propre SVG (pan/zoom autonome), le mode dessin WALL (chaîne continue), SELECT (sélection + WallEdgeEditor), DELETE (clic = suppression).

- [ ] **Step 1 — Créer `src/components/plan/WallDrawingCanvas.tsx`**

```typescript
'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import type { Wall, DrawingChain, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';
import { snapToWalls } from '@/engine/geometry/wallSnap';
import { generateId } from '@/utils/id';
import { WallEdgeEditor } from './WallEdgeEditor';

type PlanTool = 'WALL' | 'SELECT' | 'DELETE';

const DEFAULT_THICKNESS = 20;   // cm
const ENDPOINT_RADIUS_PX = 12;
const FACE_RADIUS_PX = 8;
const WALL_COLOR = '#6b6056';
const WALL_SELECTED_COLOR = '#e67e22';
const SNAP_INDICATOR_R = 8;

interface WallDrawingCanvasProps {
  walls: Wall[];
  tool: PlanTool;
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
  onPushHistory: () => void;
}

/** Convert SVG/screen coordinate to world coordinate given pan + scale. */
function screenToWorld(pt: Point, pan: Point, scale: number): Point {
  return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
}

/** World half-thickness in px. */
function halfThickPx(wall: Wall, scale: number): number {
  return (wall.thickness / 2) * scale;
}

export const WallDrawingCanvas = ({
  walls,
  tool,
  onAddWall,
  onRemoveWall,
  onUpdateWall,
  onPushHistory,
}: WallDrawingCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(0.5);    // px per cm
  const [pan, setPan] = useState<Point>({ x: 200, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ panX: number; panY: number; clientX: number; clientY: number } | null>(null);

  const [chain, setChain] = useState<DrawingChain>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editingWallId, setEditingWallId] = useState<string | null>(null);
  const [editThickness, setEditThickness] = useState('');

  // ── World coordinate from SVG pointer event ──────────────────────────────

  const getWorldPos = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const screen: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return screenToWorld(screen, pan, scale);
  }, [pan, scale]);

  const getWorldScreen = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── Pan / Zoom ────────────────────────────────────────────────────────────

  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    setScale((s) => {
      const ns = Math.max(0.05, Math.min(5, s * factor));
      setPan((p) => ({ x: ox - (ox - p.x) * (ns / s), y: oy - (oy - p.y) * (ns / s) }));
      return ns;
    });
  };

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle button or Alt+left = pan
      setIsPanning(true);
      const screen = getWorldScreen(e);
      panStart.current = { panX: pan.x, panY: pan.y, clientX: screen.x, clientY: screen.y };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const world = getWorldPos(e);
    const snap = snapToWalls(world, walls, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX);
    const pt = snap?.point ?? world;

    if (tool === 'WALL') {
      if (!chain) {
        setChain({ points: [pt], thickness: DEFAULT_THICKNESS });
      } else {
        const prev = chain.points[chain.points.length - 1]!;
        // Avoid zero-length walls
        const dx = pt.x - prev.x, dy = pt.y - prev.y;
        if (Math.sqrt(dx * dx + dy * dy) < 1) return;

        onPushHistory();
        onAddWall({ id: generateId(), p1: prev, p2: pt, thickness: chain.thickness });

        // Check if we closed the chain (snapped back to start)
        const start = chain.points[0]!;
        const ddx = pt.x - start.x, ddy = pt.y - start.y;
        const closed = Math.sqrt(ddx * ddx + ddy * ddy) < ENDPOINT_RADIUS_PX / scale;

        if (closed) {
          setChain(null);
        } else {
          setChain({ ...chain, points: [...chain.points, pt] });
        }
      }
    } else if (tool === 'SELECT') {
      const hit = hitTestWall(world, walls, scale);
      setSelectedWallId(hit?.id ?? null);
      if (hit) {
        setEditingWallId(hit.id);
        setEditThickness((hit.thickness).toFixed(1));
      } else {
        setEditingWallId(null);
      }
    } else if (tool === 'DELETE') {
      const hit = hitTestWall(world, walls, scale);
      if (hit) { onPushHistory(); onRemoveWall(hit.id); }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning && panStart.current) {
      const screen = getWorldScreen(e);
      setPan({
        x: panStart.current.panX + (screen.x - panStart.current.clientX),
        y: panStart.current.panY + (screen.y - panStart.current.clientY),
      });
      return;
    }
    const world = getWorldPos(e);
    const snap = snapToWalls(world, walls, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX);
    setCursor(snap?.point ?? world);
    setSnapResult(snap);
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') setChain(null);
  };

  // ── WallEdgeEditor submit ─────────────────────────────────────────────────

  const submitThickness = () => {
    if (!editingWallId) return;
    const v = parseFloat(editThickness);
    if (!isNaN(v) && v > 0) { onPushHistory(); onUpdateWall(editingWallId, { thickness: v }); }
    setEditingWallId(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Convert a wall's centerline to screen coordinates for rendering.
   */
  const worldToScreen = (pt: Point): Point => ({
    x: pt.x * scale + pan.x,
    y: pt.y * scale + pan.y,
  });

  /**
   * Build a rect SVG element for a wall (Phase 1: simple rectangle).
   * The rectangle is axis-aligned around the wall's screen-space centerline.
   */
  const wallToRect = (wall: Wall) => {
    const sp1 = worldToScreen(wall.p1);
    const sp2 = worldToScreen(wall.p2);
    const dx = sp2.x - sp1.x;
    const dy = sp2.y - sp1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return null;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const halfT = halfThickPx(wall, scale);
    return { sp1, sp2, len, angle, halfT };
  };

  const editingWall = editingWallId ? walls.find((w) => w.id === editingWallId) : null;
  const editingScreen = editingWall ? worldToScreen({
    x: (editingWall.p1.x + editingWall.p2.x) / 2,
    y: (editingWall.p1.y + editingWall.p2.y) / 2,
  }) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1c24]" tabIndex={0}>
      <svg
        ref={svgRef}
        className="h-full w-full cursor-crosshair select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Grid dots */}
        <defs>
          <pattern id="wdc-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse"
            x={pan.x % (20 * scale)} y={pan.y % (20 * scale)}>
            <circle cx={10 * scale} cy={10 * scale} r="0.8" fill="#272b38" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wdc-grid)" />

        {/* Rendered walls */}
        {walls.map((wall) => {
          const r = wallToRect(wall);
          if (!r) return null;
          const isSelected = wall.id === selectedWallId;
          const color = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
          return (
            <g key={wall.id} transform={`translate(${r.sp1.x},${r.sp1.y}) rotate(${r.angle})`}>
              <rect
                x={0} y={-r.halfT}
                width={r.len} height={r.halfT * 2}
                fill={color}
                rx={1}
              />
            </g>
          );
        })}

        {/* Drawing chain preview */}
        {chain && chain.points.length > 0 && cursor && (() => {
          const last = chain.points[chain.points.length - 1]!;
          const sl = worldToScreen(last);
          const sc = worldToScreen(cursor);
          const dx = sc.x - sl.x, dy = sc.y - sl.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) return null;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const halfT = (DEFAULT_THICKNESS / 2) * scale;
          return (
            <g transform={`translate(${sl.x},${sl.y}) rotate(${angle})`} opacity={0.5}>
              <rect x={0} y={-halfT} width={len} height={halfT * 2}
                fill={WALL_COLOR} stroke="#e67e22" strokeWidth={1} strokeDasharray="6,3" rx={1} />
            </g>
          );
        })()}

        {/* Snap indicator */}
        {cursor && (() => {
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
          return null;
        })()}

        {/* Chain start snap ring (close indicator) */}
        {chain && chain.points.length > 0 && (() => {
          const start = chain.points[0]!;
          const ss = worldToScreen(start);
          return <circle cx={ss.x} cy={ss.y} r={ENDPOINT_RADIUS_PX + 4}
            fill="none" stroke="#27ae60" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7} />;
        })()}
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

// ── Hit test helper ─────────────────────────────────────────────────────────

/**
 * Return the first wall whose rendered body contains `world`.
 * Uses a point-to-segment distance check with half-thickness tolerance.
 */
function hitTestWall(world: Point, walls: Wall[], scale: number): Wall | null {
  for (const wall of walls) {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1,
      ((world.x - wall.p1.x) * dx + (world.y - wall.p1.y) * dy) / lenSq
    ));
    const proj = { x: wall.p1.x + t * dx, y: wall.p1.y + t * dy };
    const dist = Math.sqrt((world.x - proj.x) ** 2 + (world.y - proj.y) ** 2);
    // Tolerance = half-thickness + 4px screen slack
    const tolerance = wall.thickness / 2 + 4 / scale;
    if (dist <= tolerance) return wall;
  }
  return null;
}
```

- [ ] **Step 2 — Vérifier TypeScript compile**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | grep "WallDrawingCanvas" | head -10
```

Expected: aucune erreur sur `WallDrawingCanvas.tsx`.

- [ ] **Step 3 — Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — draw/select/delete"
```

---

## Task 5: Intégration PlanEditor

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

Objectif : monter `WallDrawingCanvas` à la place de `DrawingCanvas` quand le projet est en mode wall-engine. Étendre `HistoryEntry` pour inclure `walls`. Ajouter le bouton "Activer Wall Engine" dans la toolbar.

- [ ] **Step 1 — Ajouter les sélecteurs wall depuis le store**

Dans `PlanEditor.tsx`, ajouter l'import `Wall` en tête de fichier :

```typescript
import type { Wall } from '@/types/wall';
```

Dans la section des `useProjectStore` selectors (vers ligne 230), ajouter :

```typescript
const walls          = useProjectStore((s) => selectActiveProject(s)?.walls);
const addWall        = useProjectStore((s) => s.addWall);
const removeWall     = useProjectStore((s) => s.removeWall);
const updateWall     = useProjectStore((s) => s.updateWall);
const initWallEngine = useProjectStore((s) => s.initWallEngine);
```

- [ ] **Step 2 — Étendre HistoryEntry et pushHistory**

Trouver l'interface `HistoryEntry` (ligne ~35) et ajouter `walls` :

```typescript
interface HistoryEntry {
  rooms: Room[];
  constraints: Constraint[];
  walls: Wall[];
}
```

Ajouter `wallsRef` dans le bloc des refs (après `futureRef`, vers ligne 463) :

```typescript
const wallsRef = useRef(walls);
useEffect(() => { wallsRef.current = walls; }, [walls]);
```

Modifier `pushHistory` (ligne ~514) pour capturer les walls :

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

Modifier `handleUndo` et `handleRedo` pour passer walls à `restoreSnapshot` :

```typescript
// Dans handleUndo (ligne ~1587) :
restoreSnapshot(entry!.rooms, entry!.constraints, entry!.walls);

// Dans handleRedo (ligne ~1600) :
restoreSnapshot(entry!.rooms, entry!.constraints, entry!.walls);
```

- [ ] **Step 3 — Montage conditionnel de WallDrawingCanvas**

Ajouter l'import :

```typescript
import { WallDrawingCanvas } from './WallDrawingCanvas';
```

Dans le JSX de PlanEditor, trouver `<DrawingCanvas` (ligne ~1836) et ajouter la condition AVANT :

```tsx
{walls !== undefined ? (
  <WallDrawingCanvas
    walls={walls}
    tool={tool as 'WALL' | 'SELECT' | 'DELETE'}
    onAddWall={addWall}
    onRemoveWall={removeWall}
    onUpdateWall={updateWall}
    onPushHistory={pushHistory}
  />
) : (
  <DrawingCanvas
    svgRef={svgRef} rooms={rooms} activeRoomId={activeRoomId}
    scale={scale} pan={pan} snapGrid={SNAP_GRID_MM}
    tool={tool} isPanning={isPanning} mousePos={mousePos}
    editingEdge={editingEdge} hoveredEdge={hoveredEdge}
    snapPreview={snapPreview} originPoint={originPoint}
    wallThickness={wallThickness}
    constraints={constraints} coincideSource={coincideSource}
    dofMap={dofMap} canCloseActiveRoom={canCloseActiveRoom}
    partitionOrigin={partitionOrigin} excludePoints={excludePoints}
    editingPartition={editingPartition}
    hoveredZoneEdge={hoveredZoneEdge} editingZoneEdge={editingZoneEdge}
    hoveredPartitionEdge={hoveredPartitionEdge}
    partitionDimLines={partitionDimLines}
    editingPartitionDimension={editingPartitionDimension}
    faceSnapHover={faceSnapHover}
    dimensionSource={dimensionSource}
    deleteHover={deleteHover}
    onPartitionDimensionPointerDown={handlePartitionDimensionPointerDown}
    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp} onEdgePointerDown={handleEdgePointerDown}
    onVertexPointerDown={handleVertexPointerDown}
    onConstraintRemove={(id) => { pushHistory(); removeConstraint(id); runSolver(); }}
    onDeletePartition={(roomId, partitionId) => { pushHistory(); removePartition(roomId, partitionId); }}
    onDeleteExcludedZone={(roomId, zoneId) => { pushHistory(); removeExcludedZone(roomId, zoneId); }}
    onPartitionLabelPointerDown={handlePartitionLabelPointerDown}
    onPartitionVertexPointerDown={handlePartitionVertexPointerDown}
    onZoneVertexPointerDown={handleZoneVertexPointerDown}
    onZoneEdgePointerDown={handleZoneEdgePointerDown}
    onDimensionClick={handleDimensionClick}
    onDimOffsetChange={handleDimOffsetChange}
    dimTypeSelection={dimTypeSelection}
    onDimTypeSelect={handleDimTypeSelect}
  />
)}
```

Note : supprimer l'ancien `<DrawingCanvas .../>` seul car il est maintenant inclus dans le else.

- [ ] **Step 4 — Ajouter le bouton "Wall Engine" dans la toolbar**

Trouver dans le JSX de PlanEditor le bloc de la toolbar (chercher `onChangeTool` ou le composant toolbar). Ajouter un bouton qui appelle `initWallEngine()` pour activer le mode wall-engine sur le projet courant :

Le bouton doit apparaître seulement si `walls === undefined` (ancien mode) :

```tsx
{walls === undefined && (
  <button
    type="button"
    title="Basculer vers le nouveau moteur de dessin (murs épais)"
    onClick={() => initWallEngine()}
    className="rounded border border-orange-600/40 bg-orange-600/10 px-2 py-1 text-[10px] font-semibold text-orange-400 hover:bg-orange-600/20"
  >
    Nouveau moteur ✦
  </button>
)}
```

Placer ce bouton dans la zone toolbar — chercher le `<div` contenant les boutons d'outils principaux (WALL, SELECT, DELETE).

- [ ] **Step 5 — Vérifier TypeScript compile**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: aucune nouvelle erreur.

- [ ] **Step 6 — Lancer le dev server et tester manuellement**

```bash
cd /workspaces/Calpiweb && npm run dev 2>&1 &
```

Test manuel (golden path) :
1. Ouvrir un projet existant → vérifier que `<DrawingCanvas>` est toujours monté (aucune régression)
2. Cliquer "Nouveau moteur ✦" → vérifier que `<WallDrawingCanvas>` apparaît (fond sombre + grille de points)
3. Outil WALL actif → cliquer 4 points pour former un rectangle → vérifier que 4 murs orange apparaissent
4. Esc → vérifier que la chaîne est abandonnée (preview disparaît)
5. Outil SELECT → cliquer sur un mur → vérifier que `WallEdgeEditor` apparaît avec l'épaisseur
6. Outil DELETE → cliquer sur un mur → vérifier qu'il disparaît
7. Ctrl+Z → vérifier que le mur supprimé réapparaît
8. Ctrl+Y → vérifier que la suppression est ré-appliquée

- [ ] **Step 7 — Commit**

```bash
git add src/components/plan/PlanEditor.tsx
git commit -m "feat(wall-engine): intégration PlanEditor — montage conditionnel + undo/redo walls"
```

---

## Tests de régression

Après toutes les tâches, vérifier que les tests existants passent toujours :

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -20
```

Expected: tous les tests préexistants PASS.

---

## Hors périmètre Phase 1

Les éléments suivants sont traités dans des plans ultérieurs :
- Coins en onglet (Phase 2 — `computeCornerGeometry`)
- T-jonctions correctes (Phase 2)
- Cotations automatiques (Phase 3 — `computeAutoCotations`)
- Migration des projets existants
