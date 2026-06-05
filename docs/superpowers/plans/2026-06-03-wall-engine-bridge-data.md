# Wall Engine — Bridge données Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les moteurs de calepinage et de quantitatif fonctionnels quand le moteur de murs (`wallEngine`) est actif, via une fonction pure `wallsToRooms()` et un sélecteur unifié `selectRooms`.

**Architecture:** La fonction `wallsToRooms` détecte les faces fermées du graphe de murs par traversal planaire de demi-arêtes (half-edge planar traversal) et retourne des `Room[]` synthétiques. Le sélecteur `selectRooms` expose soit ces rooms dérivées (mode wall engine), soit `project.rooms` (mode legacy), de façon transparente pour tous les consommateurs. Aucun moteur downstream (tilingEngine, quantityEngine) n'est modifié.

**Tech Stack:** TypeScript, Vitest, Zustand (projectStore)

**Spec:** `docs/superpowers/specs/2026-06-03-wall-engine-integration-bridge-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/engine/geometry/wallFaces.ts` | **Créer** — `wallsToRooms()` |
| `src/engine/geometry/wallFaces.test.ts` | **Créer** — tests TDD |
| `src/store/projectStore.ts` | **Modifier** — ajouter `selectRooms` |
| `src/store/projectStore.test.ts` | **Modifier** — tests `selectRooms` |
| `src/components/quantities/QuantitiesPanel.tsx` | **Modifier** — utiliser `selectRooms` (2 lignes) |
| `src/app/project/[id]/page.tsx` | **Modifier** — utiliser `selectRooms` (3 endroits) |

---

### Task 1 : `wallsToRooms()` — TDD half-edge planar traversal

**Files:**
- Create: `src/engine/geometry/wallFaces.test.ts`
- Create: `src/engine/geometry/wallFaces.ts`

- [ ] **Step 1.1 : Créer le fichier de tests**

```typescript
// src/engine/geometry/wallFaces.test.ts
import { describe, it, expect } from 'vitest';
import { wallsToRooms } from './wallFaces';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
```

- [ ] **Step 1.2 : Écrire le test — graphe vide**

```typescript
describe('wallsToRooms', () => {
  it('returns [] for empty walls', () => {
    expect(wallsToRooms([], [])).toEqual([]);
  });

  it('returns [] for a single wall (no closed cycle)', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0)];
    const walls: Wall[] = [{ id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 }];
    expect(wallsToRooms(walls, nodes)).toEqual([]);
  });

  it('returns [] for an open chain of 3 nodes', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
    ];
    expect(wallsToRooms(walls, nodes)).toEqual([]);
  });
```

- [ ] **Step 1.3 : Écrire le test — rectangle simple**

```typescript
  it('returns 1 Room for a simple rectangle', () => {
    // Nodes in SVG coords (Y down): a(0,0) b(100,0) c(100,100) d(0,100)
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.points).toHaveLength(4);
    expect(rooms[0]!.edges).toEqual(['WALL', 'WALL', 'WALL', 'WALL']);
    expect(rooms[0]!.name).toBe('Pièce 1');
    expect(rooms[0]!.partitions).toEqual([]);
    expect(rooms[0]!.excludedZones).toEqual([]);
  });
```

- [ ] **Step 1.4 : Écrire le test — deux pièces (T-junction)**

```typescript
  it('returns 2 Rooms for two rectangles sharing a wall', () => {
    // 6 nodes: a(0,0) b(100,0) c(200,0) d(200,100) e(100,100) f(0,100)
    // Room L: a-b-e-f   Room R: b-c-d-e
    const nodes = [
      nd('a', 0, 0), nd('b', 100, 0), nd('c', 200, 0),
      nd('d', 200, 100), nd('e', 100, 100), nd('f', 0, 100),
    ];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'e', thickness: 20 },
      { id: 'w5', node1Id: 'e', node2Id: 'b', thickness: 20 }, // mur partagé
      { id: 'w6', node1Id: 'e', node2Id: 'f', thickness: 20 },
      { id: 'w7', node1Id: 'f', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(2);
    rooms.forEach(r => expect(r.points).toHaveLength(4));
  });

  it('generates stable IDs — same graph always produces same room IDs', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    const r1 = wallsToRooms(walls, nodes);
    const r2 = wallsToRooms(walls, nodes);
    expect(r1[0]!.id).toBe(r2[0]!.id);
    expect(r1[0]!.id).toMatch(/^wf-/);
  });
});
```

- [ ] **Step 1.5 : Lancer les tests — vérifier qu'ils échouent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Résultat attendu : **FAIL** — `wallFaces` module not found.

- [ ] **Step 1.6 : Créer l'implémentation**

```typescript
// src/engine/geometry/wallFaces.ts
import type { Wall, WallNode } from '@/types/wall';
import type { Room, EdgeType } from '@/types/project';

function pos(id: string, nodes: WallNode[]): { x: number; y: number } {
  return nodes.find(n => n.id === id) ?? { x: 0, y: 0 };
}

function shoelaceArea(pts: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i]!.x * pts[j]!.y - pts[j]!.x * pts[i]!.y;
  }
  return s / 2;
}

/** djb2 hash — stable room ID from sorted node IDs. */
function faceId(nodeIds: string[]): string {
  const s = [...nodeIds].sort().join('\0');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `wf-${h.toString(36)}`;
}

/**
 * Derive Room[] from a wall/node graph using planar half-edge face traversal.
 *
 * Algorithm: for each directed half-edge (u→v), the next edge in the face cycle
 * is the outgoing edge from v with the smallest clockwise angle from the reversed
 * incoming direction (v→u). Interior faces (positive shoelace area in SVG coords)
 * become Room objects. The outer unbounded face (negative area) is discarded.
 *
 * Rooms are computed on the fly and never persisted.
 */
export function wallsToRooms(walls: Wall[], nodes: WallNode[]): Room[] {
  if (walls.length === 0 || nodes.length === 0) return [];

  type HE = { from: string; to: string };
  const halfEdges: HE[] = walls.flatMap(w => [
    { from: w.node1Id, to: w.node2Id },
    { from: w.node2Id, to: w.node1Id },
  ]);

  const out = new Map<string, HE[]>();
  for (const he of halfEdges) {
    if (!out.has(he.from)) out.set(he.from, []);
    out.get(he.from)!.push(he);
  }

  const nextHE = (he: HE): HE | null => {
    const u = pos(he.from, nodes);
    const v = pos(he.to, nodes);
    const θRev = Math.atan2(u.y - v.y, u.x - v.x);
    let best: HE | null = null;
    let bestCw = Infinity;
    for (const e of (out.get(he.to) ?? [])) {
      if (e.to === he.from) continue;
      const w = pos(e.to, nodes);
      const θOut = Math.atan2(w.y - v.y, w.x - v.x);
      const cw = ((θRev - θOut) + 2 * Math.PI) % (2 * Math.PI);
      if (cw < bestCw) { bestCw = cw; best = e; }
    }
    return best;
  };

  const visited = new Set<string>();
  const key = (he: HE) => `${he.from}→${he.to}`;
  type FacePt = { nodeId: string; x: number; y: number };
  const faces: FacePt[][] = [];

  for (const start of halfEdges) {
    if (visited.has(key(start))) continue;
    const cycle: HE[] = [];
    let cur: HE | null = start;
    while (cur && !visited.has(key(cur))) {
      visited.add(key(cur));
      cycle.push(cur);
      cur = nextHE(cur);
    }
    if (cur && key(cur) === key(start) && cycle.length >= 3) {
      faces.push(cycle.map(he => { const p = pos(he.from, nodes); return { nodeId: he.from, x: p.x, y: p.y }; }));
    }
  }

  // Interior faces: positive shoelace area (SVG Y-down: CW winding = positive)
  const interior = faces.filter(pts => shoelaceArea(pts) > 0);

  // Sort top-left → bottom-right for stable naming
  interior.sort((a, b) => {
    const cya = a.reduce((s, p) => s + p.y, 0) / a.length;
    const cyb = b.reduce((s, p) => s + p.y, 0) / b.length;
    if (Math.abs(cya - cyb) > 1) return cya - cyb;
    return (a.reduce((s, p) => s + p.x, 0) / a.length) - (b.reduce((s, p) => s + p.x, 0) / b.length);
  });

  return interior.map((pts, idx) => ({
    id: faceId(pts.map(p => p.nodeId)),
    name: `Pièce ${idx + 1}`,
    points: pts.map(p => ({ x: p.x, y: p.y })),
    edges: pts.map(() => 'WALL' as EdgeType),
    partitions: [],
    excludedZones: [],
  }));
}
```

- [ ] **Step 1.7 : Lancer les tests — vérifier qu'ils passent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Résultat attendu : **5/5 PASS**.

- [ ] **Step 1.8 : Commit**

```bash
git add src/engine/geometry/wallFaces.ts src/engine/geometry/wallFaces.test.ts
git commit -m "feat(wall-engine): wallsToRooms — half-edge planar face detection"
```

---

### Task 2 : `selectRooms` — sélecteur unifié dans le store

**Files:**
- Modify: `src/store/projectStore.ts`
- Modify: `src/store/projectStore.test.ts`

- [ ] **Step 2.1 : Écrire les tests de `selectRooms`**

Dans `src/store/projectStore.test.ts`, ajouter après les imports existants :

```typescript
import { useProjectStore, selectActiveProject, selectRooms } from './projectStore';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
```

Puis ajouter un nouveau bloc `describe` à la fin du fichier :

```typescript
describe('selectRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [], hydrated: false, activeProjectId: null });
  });

  it('returns [] when no active project', () => {
    expect(selectRooms(useProjectStore.getState())).toEqual([]);
  });

  it('returns project.rooms when wallEngine is undefined', () => {
    const rooms = [{ id: 'r1', name: 'R1', points: [{ x: 0, y: 0 }], edges: [] as never, partitions: [], excludedZones: [] }];
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'test', status: 'new' as const,
        createdAt: 0, updatedAt: 0,
        rooms, wallEngine: undefined,
        config: {} as never, wallThickness: 100, constraints: [], notes: [],
      }],
      activeProjectId: 'p1',
    });
    expect(selectRooms(useProjectStore.getState())).toBe(rooms);
  });

  it('returns [] from wallsToRooms when wallEngine has no walls', () => {
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'test', status: 'new' as const,
        createdAt: 0, updatedAt: 0,
        rooms: [{ id: 'legacy', name: 'L', points: [], edges: [] as never, partitions: [], excludedZones: [] }],
        wallEngine: { walls: [], nodes: [] },
        config: {} as never, wallThickness: 100, constraints: [], notes: [],
      }],
      activeProjectId: 'p1',
    });
    expect(selectRooms(useProjectStore.getState())).toEqual([]);
  });

  it('returns 1 room from wallsToRooms when wallEngine has a closed rectangle', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    useProjectStore.setState({
      projects: [{
        id: 'p1', name: 'test', status: 'new' as const,
        createdAt: 0, updatedAt: 0,
        rooms: [],
        wallEngine: { walls, nodes },
        config: {} as never, wallThickness: 100, constraints: [], notes: [],
      }],
      activeProjectId: 'p1',
    });
    const result = selectRooms(useProjectStore.getState());
    expect(result).toHaveLength(1);
    expect(result[0]!.points).toHaveLength(4);
  });
});
```

- [ ] **Step 2.2 : Lancer les tests — vérifier qu'ils échouent**

```
npx vitest run src/store/projectStore.test.ts
```

Résultat attendu : **FAIL** — `selectRooms` is not exported.

- [ ] **Step 2.3 : Ajouter `selectRooms` dans `projectStore.ts`**

En haut de `src/store/projectStore.ts`, ajouter l'import manquant juste après les imports existants :

```typescript
import { wallsToRooms } from '@/engine/geometry/wallFaces';
```

Puis, juste après la déclaration existante de `selectActiveProject` (chercher `export function selectActiveProject` ou `export const selectActiveProject`), ajouter :

```typescript
export function selectRooms(s: ProjectState): Room[] {
  const project = selectActiveProject(s);
  if (!project) return [];
  const we = project.wallEngine;
  if (we && we.walls.length > 0) return wallsToRooms(we.walls, we.nodes);
  return project.rooms;
}
```

Note : `Room` est déjà importé dans le fichier via `import type { Project, Room, ... } from '@/types/project'`.

- [ ] **Step 2.4 : Lancer les tests — vérifier qu'ils passent**

```
npx vitest run src/store/projectStore.test.ts
```

Résultat attendu : tous les tests **PASS** (anciens + nouveaux).

- [ ] **Step 2.5 : Commit**

```bash
git add src/store/projectStore.ts src/store/projectStore.test.ts
git commit -m "feat(wall-engine): selectRooms — sélecteur unifié legacy/wall-engine"
```

---

### Task 3 : QuantitiesPanel — brancher `selectRooms`

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx:35-46` et ligne ~208

- [ ] **Step 3.1 : Ajouter le hook `rooms` et mettre à jour les usages**

Dans `src/components/quantities/QuantitiesPanel.tsx` :

**Ligne 4** — ajouter `selectRooms` à l'import du store :

```typescript
// AVANT
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
// APRÈS
import { selectActiveProject, selectRooms, useProjectStore } from '@/store/projectStore';
```

**Ligne ~36** — ajouter le hook `rooms` juste après `const project = ...` :

```typescript
export const QuantitiesPanel = () => {
  const project = useProjectStore(selectActiveProject);
  const rooms = useProjectStore(selectRooms);         // ← AJOUTER
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);
```

**Ligne ~43-46** — remplacer `project.rooms` par `rooms` dans `useMemo` :

```typescript
  const result = useMemo(() => {
    if (!project) return null;
    return analyzeQuantities(rooms, project.config, project.wallThickness); // ← rooms au lieu de project.rooms
  }, [project, rooms]);                                                       // ← ajouter rooms
```

**Ligne ~208** — remplacer `rooms={project.rooms}` par `rooms={rooms}` :

```typescript
// Chercher dans le JSX : rooms={project.rooms}
// Remplacer par :
rooms={rooms}
```

- [ ] **Step 3.2 : Lancer la suite complète**

```
npx vitest run
```

Résultat attendu : **tous les tests PASS**.

- [ ] **Step 3.3 : Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx
git commit -m "feat(wall-engine): QuantitiesPanel — utiliser selectRooms"
```

---

### Task 4 : page.tsx — brancher `selectRooms` pour TilingEditor

**Files:**
- Modify: `src/app/project/[id]/page.tsx` (lignes ~227, ~330-331, ~520)

- [ ] **Step 4.1 : Ajouter l'import `selectRooms`**

Dans `src/app/project/[id]/page.tsx`, ligne 11 :

```typescript
// AVANT
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
// APRÈS
import { selectActiveProject, selectRooms, useProjectStore } from '@/store/projectStore';
```

- [ ] **Step 4.2 : Ajouter le hook `rooms` dans le composant**

Après la ligne `const activeProject = useProjectStore(selectActiveProject);` (ligne ~226), ajouter :

```typescript
const activeProject = useProjectStore(selectActiveProject);
const rooms = useProjectStore(selectRooms);              // ← AJOUTER
```

- [ ] **Step 4.3 : Remplacer `activeProject.rooms` par `rooms` (3 endroits)**

Chercher et remplacer dans le corps du composant :

```typescript
// AVANT (~ligne 330)
const canGoTiling = activeProject.rooms.some((r) => r.points.length >= 3);
// APRÈS
const canGoTiling = rooms.some((r) => r.points.length >= 3);

// AVANT (~ligne 331)
const roomCount = activeProject.rooms.filter(r => r.points.length >= 3).length;
// APRÈS
const roomCount = rooms.filter(r => r.points.length >= 3).length;

// AVANT (~ligne 520) — dans le JSX
<TilingEditor
  rooms={activeProject.rooms}
// APRÈS
<TilingEditor
  rooms={rooms}
```

- [ ] **Step 4.4 : Lancer la suite complète**

```
npx vitest run
```

Résultat attendu : **tous les tests PASS**.

- [ ] **Step 4.5 : Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "feat(wall-engine): page.tsx — TilingEditor et canGoTiling utilisent selectRooms"
```

---

### Task 5 : Régression complète et vérification finale

**Files:** aucun nouveau fichier

- [ ] **Step 5.1 : Lancer la suite complète**

```
npx vitest run
```

Résultat attendu : tous les tests passent. Si des tests échouent hors des fichiers modifiés, analyser si c'est lié à l'import de `wallsToRooms` (circular deps, module resolution).

- [ ] **Step 5.2 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Résultat attendu : aucune erreur de type.

- [ ] **Step 5.3 : Validation manuelle**

1. Ouvrir un projet avec des murs dans le moteur legacy (DrawingCanvas) → aller dans Calepinage → vérifier que le calepinage fonctionne normalement.
2. Activer le moteur de murs (bouton "Nouveau moteur ✦") → dessiner un rectangle fermé → aller dans Calepinage → **vérifier que le calepinage affiche les tuiles**.
3. Dessiner deux rectangles contigus → aller dans Quantitatif → **vérifier que les deux pièces sont comptabilisées**.

- [ ] **Step 5.4 : Commit final de vérification**

Si des ajustements mineurs ont été nécessaires lors de la validation manuelle :

```bash
git add -p   # staging sélectif si besoin
git commit -m "fix(wall-engine): ajustements bridge après validation manuelle"
```
