# Wall Engine — SP3 : Outils DOOR + EXCLUDE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les outils DOOR (ouverture dans un mur) et EXCLUDE (zone non carrelée) au moteur de murs, avec persistence, undo/redo, et propagation aux moteurs de calepinage/quantitatif.

**Architecture:** `Wall.isDoor` pour les ouvertures (pas de nouvelle entité), `WallExcludedZone[]` dans `wallEngine` pour les zones. Le bridge `wallsToRooms` assigne les zones aux pièces via `pointInPolygon`. `WallDrawingCanvas` reçoit `excludedZones` et deux callbacks via props depuis `PlanEditor`.

**Tech Stack:** TypeScript, React, Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-06-03-wall-engine-tools-door-exclude-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/types/wall.ts` | Ajouter `isDoor?` sur `Wall` + interface `WallExcludedZone` |
| `src/types/project.ts` | Étendre `wallEngine` avec `excludedZones: WallExcludedZone[]` |
| `src/engine/geometry/wallFaces.ts` | `wallsToRooms` : 3e param + point-in-polygon assignment |
| `src/engine/geometry/wallFaces.test.ts` | 3 nouveaux tests zones exclues |
| `src/store/projectStore.ts` | 2 nouvelles actions + MAJ `initWallEngine` + `restoreSnapshot` + `selectRooms` |
| `src/components/plan/PlanEditor.tsx` | `HistoryEntry` étendu + nouvelles props WallDrawingCanvas |
| `src/components/plan/WallDrawingCanvas.tsx` | Tools DOOR + EXCLUDE, props, rendu |

---

### Task 1 : Types — Wall.isDoor, WallExcludedZone, Project.wallEngine

**Files:**
- Modify: `src/types/wall.ts`
- Modify: `src/types/project.ts`

- [ ] **Step 1.1 : Modifier `src/types/wall.ts`**

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
  thickness: number;
  isDoor?: boolean;  // ← NOUVEAU : true = ouverture (non rendue comme mur épais)
}

export interface WallExcludedZone {  // ← NOUVELLE interface
  id: string;
  points: Point[];
  label?: string;
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv';
  wallId?: string;
  nodeId?: string;
  axis?: 'h' | 'v';
}

export type DrawingChain = {
  nodeIds: string[];
  thickness: number;
} | null;

export interface AutoCotation {
  wallId: string;
  side: 'exterior' | 'interior' | 'isolated';
  anchor1: Point;
  anchor2: Point;
  normal: Point;
  offset: number;
  label: string;
}
```

- [ ] **Step 1.2 : Modifier `src/types/project.ts`**

Localiser la ligne `wallEngine?: { nodes: WallNode[]; walls: Wall[] };` (ligne ~98) et la remplacer.

Ajouter `WallExcludedZone` aux imports depuis `@/types/wall` :

```typescript
import type { Wall, WallNode, WallExcludedZone } from './wall';
```

Remplacer la définition de `wallEngine` :

```typescript
wallEngine?: {
  nodes: WallNode[];
  walls: Wall[];
  excludedZones: WallExcludedZone[];  // ← AJOUTÉ
};
```

- [ ] **Step 1.3 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Résultat attendu : des erreurs TypeScript sur les sites qui créent `wallEngine` sans `excludedZones` (store, PlanEditor). C'est normal — ces sites seront corrigés dans les tâches suivantes. Vérifier qu'il n'y a pas d'autres erreurs inattendues.

- [ ] **Step 1.4 : Commit**

```bash
git add src/types/wall.ts src/types/project.ts
git commit -m "feat(wall-engine): types — Wall.isDoor, WallExcludedZone, wallEngine.excludedZones"
```

---

### Task 2 : wallFaces.ts — wallsToRooms avec excludedZones (TDD)

**Files:**
- Modify: `src/engine/geometry/wallFaces.ts`
- Modify: `src/engine/geometry/wallFaces.test.ts`

- [ ] **Step 2.1 : Écrire les 3 nouveaux tests**

Dans `src/engine/geometry/wallFaces.test.ts`, ajouter un nouveau `describe` après les tests existants :

```typescript
import type { WallExcludedZone } from '@/types/wall';

describe('wallsToRooms — excludedZones', () => {
  // Rectangle réutilisé dans tous les tests
  const rectNodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
  const rectWalls: Wall[] = [
    { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
    { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
    { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
    { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
  ];

  it('returns rooms with empty excludedZones when no zones provided', () => {
    const rooms = wallsToRooms(rectWalls, rectNodes);
    expect(rooms[0]!.excludedZones).toEqual([]);
  });

  it('assigns zone to room when zone centroid is inside the room', () => {
    const zones: WallExcludedZone[] = [{
      id: 'z1',
      points: [{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }],
    }];
    const rooms = wallsToRooms(rectWalls, rectNodes, zones);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.excludedZones).toHaveLength(1);
    expect(rooms[0]!.excludedZones[0]!.id).toBe('z1');
  });

  it('ignores zone whose centroid is outside all rooms', () => {
    const zones: WallExcludedZone[] = [{
      id: 'z2',
      points: [{ x: 200, y: 200 }, { x: 250, y: 200 }, { x: 250, y: 250 }, { x: 200, y: 250 }],
    }];
    const rooms = wallsToRooms(rectWalls, rectNodes, zones);
    expect(rooms[0]!.excludedZones).toHaveLength(0);
  });
});
```

- [ ] **Step 2.2 : Lancer les tests — vérifier qu'ils échouent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Résultat attendu : **FAIL** — les 3 nouveaux tests échouent (signature de `wallsToRooms` ne prend pas de 3e argument).

- [ ] **Step 2.3 : Mettre à jour `wallFaces.ts`**

Ajouter l'import de `pointInPolygon` et `WallExcludedZone` en haut :

```typescript
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import type { Room, EdgeType } from '@/types/project';
import { pointInPolygon } from '@/engine/geometry/polygon';
```

Mettre à jour la signature de `wallsToRooms` :

```typescript
export function wallsToRooms(
  walls: Wall[],
  nodes: WallNode[],
  excludedZones: WallExcludedZone[] = [],
): Room[]
```

Dans le `.map((pts, idx) => ...)` final (qui construit les Room[]), remplacer `excludedZones: []` par :

```typescript
// Assigner les zones dont le centroïde est dans cette face
const facePts = pts.map(p => ({ x: p.x, y: p.y }));
const roomZones = excludedZones.filter(zone => {
  if (zone.points.length < 3) return false;
  const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
  const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
  return pointInPolygon({ x: cx, y: cy }, facePts);
});

return {
  id: faceId(pts.map(p => p.nodeId)),
  name: `Pièce ${idx + 1}`,
  points: pts.map(p => ({ x: p.x, y: p.y })),
  edges: pts.map(() => 'WALL' as EdgeType),
  partitions: [],
  excludedZones: roomZones,  // ← CHANGÉ
};
```

- [ ] **Step 2.4 : Lancer les tests — vérifier 9/9 PASS**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Résultat attendu : **9/9 PASS** (6 anciens + 3 nouveaux).

- [ ] **Step 2.5 : Commit**

```bash
git add src/engine/geometry/wallFaces.ts src/engine/geometry/wallFaces.test.ts
git commit -m "feat(wall-engine): wallsToRooms — assigner excludedZones via pointInPolygon"
```

---

### Task 3 : Store — nouvelles actions + initWallEngine + restoreSnapshot + selectRooms

**Files:**
- Modify: `src/store/projectStore.ts`

- [ ] **Step 3.1 : Ajouter les actions à l'interface `ProjectState`**

Localiser l'interface `ProjectState` dans `src/store/projectStore.ts`. Après `initWallEngine: () => void;`, ajouter :

```typescript
addWallExcludedZone: (points: Point[]) => void;
removeWallExcludedZone: (id: string) => void;
```

Mettre à jour la signature de `restoreSnapshot` pour inclure `excludedZones` dans le type de `wallEngine` :

```typescript
restoreSnapshot: (
  rooms: Room[],
  constraints: Constraint[],
  wallEngine?: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] }
) => void;
```

Ajouter `WallExcludedZone` aux imports en haut du fichier :

```typescript
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
```

- [ ] **Step 3.2 : Mettre à jour `initWallEngine`**

Localiser `initWallEngine` (ligne ~427). Remplacer :

```typescript
initWallEngine: () => {
  get().updateActive((p) => ({ ...p, wallEngine: p.wallEngine ?? { nodes: [], walls: [] } }));
},
```

Par :

```typescript
initWallEngine: () => {
  get().updateActive((p) => ({
    ...p,
    wallEngine: p.wallEngine ?? { nodes: [], walls: [], excludedZones: [] },
  }));
},
```

- [ ] **Step 3.3 : Ajouter les implémentations des nouvelles actions**

Après `initWallEngine`, ajouter :

```typescript
addWallExcludedZone: (points) => {
  get().updateActive((p) => {
    if (!p.wallEngine) return p;
    return {
      ...p,
      updatedAt: Date.now(),
      wallEngine: {
        ...p.wallEngine,
        excludedZones: [
          ...(p.wallEngine.excludedZones ?? []),
          { id: generateId(), points },
        ],
      },
    };
  });
},

removeWallExcludedZone: (id) => {
  get().updateActive((p) => {
    if (!p.wallEngine) return p;
    return {
      ...p,
      updatedAt: Date.now(),
      wallEngine: {
        ...p.wallEngine,
        excludedZones: (p.wallEngine.excludedZones ?? []).filter(z => z.id !== id),
      },
    };
  });
},
```

- [ ] **Step 3.4 : Mettre à jour `selectRooms`**

Localiser `selectRooms` (ligne ~452). Remplacer :

```typescript
if (we !== undefined) return wallsToRooms(we.walls, we.nodes);
```

Par :

```typescript
if (we !== undefined) return wallsToRooms(we.walls, we.nodes, we.excludedZones ?? []);
```

- [ ] **Step 3.5 : Corriger `removeWall` et `mergeNodes` qui reconstruisent `wallEngine` sans `excludedZones`**

Deux actions reconstruisent l'objet wallEngine explicitement sans spread — elles perdront `excludedZones` :

**`removeWall`** — localiser le `return { ...p, wallEngine: { nodes, walls } }` et le remplacer :

```typescript
return { ...p, wallEngine: { nodes, walls, excludedZones: p.wallEngine.excludedZones ?? [] } };
```

**`mergeNodes`** — localiser le `return { ...p, wallEngine: { nodes, walls } }` (dans mergeNodes) et le remplacer :

```typescript
return { ...p, wallEngine: { nodes, walls, excludedZones: p.wallEngine.excludedZones ?? [] } };
```

Les autres actions (`addWall`, `addNode`, `updateNode`, `updateWall`, `setWalls`, `setNodes`) utilisent `{ ...p.wallEngine, ... }` — elles préservent `excludedZones` automatiquement via spread.

- [ ] **Step 3.6 : Lancer la suite complète**

```
npx vitest run
```

Résultat attendu : tous les tests passent (les tests existants du store peuvent signaler des erreurs TypeScript si `restoreSnapshot` est appelé avec l'ancien type — corriger au besoin).

- [ ] **Step 3.7 : Commit**

```bash
git add src/store/projectStore.ts
git commit -m "feat(wall-engine): store — addWallExcludedZone, removeWallExcludedZone, excludedZones dans initWallEngine"
```

---

### Task 4 : PlanEditor — HistoryEntry + nouvelles props WallDrawingCanvas

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

- [ ] **Step 4.1 : Mettre à jour `HistoryEntry`**

Localiser `interface HistoryEntry` (ligne ~37). Remplacer :

```typescript
interface HistoryEntry {
  rooms: Room[];
  constraints: Constraint[];
  wallEngine?: { nodes: WallNode[]; walls: Wall[] };
}
```

Par :

```typescript
interface HistoryEntry {
  rooms: Room[];
  constraints: Constraint[];
  wallEngine?: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] };
}
```

Ajouter `WallExcludedZone` à l'import depuis `@/types/wall` (ligne ~33) :

```typescript
import type { Wall, WallNode } from '@/types/wall';
// devient :
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
```

- [ ] **Step 4.2 : Mettre à jour les créations d'entrées d'historique**

Chercher toutes les occurrences de `wallEngine: wallEngineRef.current ?` dans PlanEditor (lignes ~534 et ~1603, ~1619). Les remplacer — example :

```typescript
// AVANT
wallEngine: wallEngineRef.current
  ? { nodes: [...wallEngineRef.current.nodes], walls: [...wallEngineRef.current.walls] }
  : undefined,

// APRÈS
wallEngine: wallEngineRef.current
  ? {
      nodes: [...wallEngineRef.current.nodes],
      walls: [...wallEngineRef.current.walls],
      excludedZones: [...(wallEngineRef.current.excludedZones ?? [])],
    }
  : undefined,
```

Il y a exactement 3 occurrences (dans `pushHistory`, `handleUndo`, `handleRedo`). Corriger les 3.

- [ ] **Step 4.3 : Ajouter les hooks store et les nouvelles props**

Après les hooks existants `const addWall = useProjectStore(s => s.addWall);` etc., ajouter :

```typescript
const addWallExcludedZone    = useProjectStore((s) => s.addWallExcludedZone);
const removeWallExcludedZone = useProjectStore((s) => s.removeWallExcludedZone);
```

- [ ] **Step 4.4 : Mettre à jour le JSX `<WallDrawingCanvas>`**

Localiser `<WallDrawingCanvas` (ligne ~1872). Ajouter :

```typescript
{wallEngine !== undefined ? (
  <WallDrawingCanvas
    walls={wallEngine.walls}
    nodes={wallEngine.nodes}
    tool={tool as 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE'}
    scale={scale}
    pan={pan}
    onScaleChange={setScale}
    onPanChange={setPan}
    onAddWall={addWall}
    onRemoveWall={removeWall}
    onUpdateWall={updateWall}
    onAddNode={addNode}
    onUpdateNode={updateNode}
    onMergeNodes={mergeNodes}
    onPushHistory={pushHistory}
    excludedZones={wallEngine.excludedZones ?? []}
    onAddExcludedZone={addWallExcludedZone}
    onRemoveExcludedZone={removeWallExcludedZone}
  />
) : (
```

- [ ] **Step 4.5 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : tous les tests passent. TypeScript ne doit signaler aucune erreur sur PlanEditor.

- [ ] **Step 4.6 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx
git commit -m "feat(wall-engine): PlanEditor — HistoryEntry étend wallEngine.excludedZones + props DOOR/EXCLUDE"
```

---

### Task 5 : WallDrawingCanvas — outil DOOR

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 5.1 : Mettre à jour `PlanTool` et l'interface des props**

En haut du fichier, remplacer :

```typescript
type PlanTool = 'WALL' | 'SELECT' | 'DELETE';
```

Par :

```typescript
type PlanTool = 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE';
```

Ajouter `WallExcludedZone` aux imports :

```typescript
import type { Wall, WallNode, DrawingChain, SnapResult, WallExcludedZone } from '@/types/wall';
```

Ajouter les 3 nouvelles props à l'interface `WallDrawingCanvasProps` :

```typescript
excludedZones: WallExcludedZone[];
onAddExcludedZone: (points: Point[]) => void;
onRemoveExcludedZone: (id: string) => void;
```

Mettre à jour la destructuration du composant :

```typescript
export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
  scale, pan, onScaleChange, onPanChange,
  excludedZones, onAddExcludedZone, onRemoveExcludedZone,
}: WallDrawingCanvasProps) => {
```

- [ ] **Step 5.2 : Ajouter les constantes DOOR**

Après les constantes existantes (`SNAP_INDICATOR_R` etc.), ajouter :

```typescript
const DOOR_DEFAULT_WIDTH_MM = 900;
const DOOR_MIN_WALL_MM      = 600; // longueur minimale du mur pour y insérer une porte
```

- [ ] **Step 5.3 : Filtrer les murs isDoor pour la géométrie épaisse**

Localiser les `useMemo` de géométrie (lignes ~278-280). Les mettre à jour :

```typescript
const nonDoorWalls = useMemo(() => walls.filter(w => !w.isDoor), [walls]);
const wallPolygons = useMemo(() => computeCornerGeometry(nonDoorWalls, nodes), [nonDoorWalls, nodes]);
const jointLines   = useMemo(() => computeJointLines(nonDoorWalls, nodes),     [nonDoorWalls, nodes]);
const autoCotations = useMemo(() => computeAutoCotations(walls, nodes), [walls, nodes]); // inclut les portes
```

- [ ] **Step 5.4 : Ajouter le handler DOOR dans `handlePointerDown`**

Avant le bloc `if (tool === 'SELECT')`, ajouter :

```typescript
if (tool === 'DOOR') {
  const hit = hitTestWall(world);
  if (!hit) return;
  const n1 = nodes.find((n) => n.id === hit.node1Id);
  const n2 = nodes.find((n) => n.id === hit.node2Id);
  if (!n1 || !n2) return;

  // Clic sur une porte existante → la supprimer
  if (hit.isDoor) {
    onPushHistory();
    onRemoveWall(hit.id);
    return;
  }

  const dx = n2.x - n1.x, dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy);
  if (len < DOOR_MIN_WALL_MM) return;

  const halfW = Math.min(DOOR_DEFAULT_WIDTH_MM / 2, len * 0.4);
  const t = Math.max(0, Math.min(1,
    ((world.x - n1.x) * dx + (world.y - n1.y) * dy) / (len * len),
  ));
  const tCenter = Math.max(halfW / len, Math.min(1 - halfW / len, t));

  const d1: Point = {
    x: n1.x + (dx / len) * (tCenter * len - halfW),
    y: n1.y + (dy / len) * (tCenter * len - halfW),
  };
  const d2: Point = {
    x: n1.x + (dx / len) * (tCenter * len + halfW),
    y: n1.y + (dy / len) * (tCenter * len + halfW),
  };

  const id1 = generateId(), id2 = generateId();

  // Ordre critique : ajouter d1/d2 et les 3 nouveaux murs AVANT de supprimer
  // l'original — sinon removeWall élaguerait n1/n2 comme orphelins.
  onPushHistory();
  onAddNode({ id: id1, x: d1.x, y: d1.y });
  onAddNode({ id: id2, x: d2.x, y: d2.y });
  onAddWall({ id: generateId(), node1Id: hit.node1Id, node2Id: id1,         thickness: hit.thickness });
  onAddWall({ id: generateId(), node1Id: id1,          node2Id: id2,         thickness: hit.thickness, isDoor: true });
  onAddWall({ id: generateId(), node1Id: id2,          node2Id: hit.node2Id, thickness: hit.thickness });
  onRemoveWall(hit.id); // n1/n2 sont toujours référencés → non élagués
  return;
}
```

- [ ] **Step 5.5 : Ajouter le rendu des murs `isDoor`**

Dans le JSX, après le rendu des `wallPolygons`, ajouter le rendu des portes :

```typescript
{/* Ouvertures (murs isDoor) — ligne dashed orange */}
{walls.filter(w => w.isDoor).map(w => {
  const n1 = nodes.find((n) => n.id === w.node1Id);
  const n2 = nodes.find((n) => n.id === w.node2Id);
  if (!n1 || !n2) return null;
  const s1 = worldToScreen({ x: n1.x, y: n1.y });
  const s2 = worldToScreen({ x: n2.x, y: n2.y });
  return (
    <line key={`door-${w.id}`}
      x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}
      stroke="#e67e22" strokeWidth={2} strokeDasharray="8,4"
    />
  );
})}
```

- [ ] **Step 5.6 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : tous les tests passent.

- [ ] **Step 5.7 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — outil DOOR (ouverture, rendu dashed)"
```

---

### Task 6 : WallDrawingCanvas — outil EXCLUDE

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 6.1 : Ajouter les états et refs pour EXCLUDE**

Après `const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);`, ajouter :

```typescript
const [excludePoints, setExcludePoints] = useState<Point[]>([]);
const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
```

- [ ] **Step 6.2 : Mettre à jour le reset du tool dans useEffect**

Localiser `useEffect(() => { setSelectedWallId(null); ... }, [tool])`. Ajouter `setExcludePoints([])` :

```typescript
useEffect(() => {
  setSelectedWallId(null);
  setEditingWallId(null);
  setChain(null);
  setExcludePoints([]);  // ← AJOUTÉ
}, [tool]);
```

- [ ] **Step 6.3 : Ajouter le handler EXCLUDE dans `handlePointerDown`**

Avant le bloc `if (tool === 'DOOR')`, ajouter :

```typescript
if (tool === 'EXCLUDE') {
  const now = Date.now();
  const last = lastClickRef.current;
  const isDouble = now - last.time < 350 && dist(world, { x: last.x, y: last.y }) < 30 / scale;
  lastClickRef.current = { time: now, x: world.x, y: world.y };

  if (isDouble) {
    if (excludePoints.length >= 3) {
      onPushHistory();
      onAddExcludedZone([...excludePoints]);
      setExcludePoints([]);
    }
    return;
  }

  setExcludePoints((prev) => [...prev, world]);
  return;
}
```

- [ ] **Step 6.4 : Mettre à jour le useEffect clavier pour EXCLUDE**

Localiser le `useEffect` clavier (window keydown/keyup). Mettre à jour le handler Escape et Enter :

```typescript
if (e.key === 'Escape') {
  setChain(null);
  setSelectedWallId(null);
  setEditingWallId(null);
  setExcludePoints([]);  // ← AJOUTÉ
}
if (e.key === 'Enter') {
  tryCloseChain();
  if (excludePoints.length >= 3) {  // ← AJOUTÉ
    onPushHistory();
    onAddExcludedZone([...excludePoints]);
    setExcludePoints([]);
  }
}
```

Note : `excludePoints` est une dépendance de `tryCloseChain` via le useEffect, mais pas directement. Ajouter `excludePoints`, `onAddExcludedZone` aux dépendances du useEffect clavier si TypeScript le signale.

Pour éviter les problèmes de closure, utiliser une ref pour `excludePoints` :

```typescript
const excludePointsRef = useRef<Point[]>([]);
// Ajouter après la déclaration de excludePoints :
excludePointsRef.current = excludePoints;
```

Et dans le useEffect clavier :
```typescript
if (e.key === 'Enter') {
  tryCloseChain();
  if (excludePointsRef.current.length >= 3) {
    onPushHistory();
    onAddExcludedZone([...excludePointsRef.current]);
    setExcludePoints([]);
  }
}
if (e.key === 'Escape') {
  setChain(null); setSelectedWallId(null); setEditingWallId(null); setExcludePoints([]);
}
```

- [ ] **Step 6.5 : Ajouter le rendu des zones exclues et de la zone en cours**

Dans le JSX, après le rendu des portes (murs isDoor), ajouter :

```typescript
{/* Zones exclues existantes */}
{excludedZones.map(zone => {
  if (zone.points.length < 3) return null;
  const pts = zone.points.map(p => worldToScreen(p));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  return (
    <path key={zone.id} d={d}
      fill="#f59e0b" fillOpacity={0.25}
      stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3"
    />
  );
})}

{/* Zone en cours de tracé */}
{tool === 'EXCLUDE' && excludePoints.length >= 1 && (() => {
  const pts = [...excludePoints, cursor ?? excludePoints[excludePoints.length - 1]!].map(p => worldToScreen(p));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <path d={d}
      fill="none"
      stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3"
    />
  );
})()}
```

- [ ] **Step 6.6 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6.7 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — outil EXCLUDE (zone non carrelée)"
```

---

### Task 7 : Régression + vérification TypeScript

**Files:** aucun nouveau fichier

- [ ] **Step 7.1 : Suite complète**

```
npx vitest run
```

Résultat attendu : **≥ 341 tests PASS, 0 failures** (les nouveaux tests portent le total à 344+).

- [ ] **Step 7.2 : TypeScript strict**

```
npx tsc --noEmit
```

Résultat attendu : **aucune erreur de type**.

- [ ] **Step 7.3 : Checklist de validation manuelle**

Activer le moteur de murs, dessiner 4 murs formant un rectangle fermé, puis :

1. **DOOR** : outil DOOR, cliquer sur un segment de mur → le segment se divise en 3, le segment central s'affiche en orange dashed. ✓
2. **DOOR suppression** : cliquer sur le segment orange dashed → le segment est supprimé. ✓
3. **EXCLUDE** : outil EXCLUDE, cliquer 3+ fois pour tracer un polygone, double-cliquer pour fermer → zone ambrée semi-transparente visible. ✓
4. **Calepinage** : ouvrir l'onglet Calepinage → les tuiles respectent la zone exclue (pas de tuiles dans la zone). ✓
5. **Quantitatif** : ouvrir l'onglet Quantitatif → la surface exclue est soustraite. ✓
6. **Undo** : Ctrl+Z après ajout d'une porte ou zone → retour à l'état précédent. ✓

- [ ] **Step 7.4 : Commit si ajustements mineurs**

```bash
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "fix(wall-engine): ajustements SP3 après validation manuelle"
```
