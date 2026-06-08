# Zone non carrelée — Refonte interaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la zone non carrelée pour qu'elle fonctionne comme les murs : aimantation au dessin, noeuds déplaçables en SELECT, suppression en DELETE, Ctrl+Z.

**Architecture:** En 6 tâches séquentielles — data model d'abord (type + store), puis moteur (wallFaces.ts), puis interactions canvas (dessin, SELECT, DELETE). Chaque tâche produit un état compilable et testable.

**Tech Stack:** TypeScript strict, React 18, Zustand, Vitest, SVG canvas (WallDrawingCanvas.tsx).

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/types/wall.ts` | Ajouter `ExcludeNode`, mettre à jour `WallExcludedZone` |
| `src/lib/supabase/db.ts` | Migration rétrocompatible zones legacy |
| `src/store/projectStore.ts` | Interface + actions store |
| `src/store/splitWall.test.ts` | Tests pure helper |
| `src/engine/geometry/wallFaces.ts` | Remplacer `zone.points` → `zone.nodes.map(...)` |
| `src/components/plan/WallDrawingCanvas.tsx` | Dessin + SELECT + DELETE |
| `src/components/plan/PlanEditor.tsx` | Wiring nouvel action |

---

## Task 1 : ExcludeNode type + migration legacy

**Files:**
- Modify: `src/types/wall.ts`
- Modify: `src/lib/supabase/db.ts`

### Contexte

`WallExcludedZone` est actuellement `{ id: string; points: Point[]; label?: string }`.
On remplace `points` par `nodes: ExcludeNode[]`. `migrateProject` dans `db.ts` (ligne 56-64) doit convertir les anciens projets.

- [ ] **Étape 1 : Modifier `src/types/wall.ts`**

Remplacer :
```typescript
export interface WallExcludedZone {
  id: string;
  points: Point[];
  label?: string;
}
```
Par :
```typescript
export interface ExcludeNode {
  id: string;
  x: number;
  y: number;
}

export interface WallExcludedZone {
  id: string;
  nodes: ExcludeNode[];
  label?: string;
}
```

Supprimer l'import `Point` de `types/wall.ts` si il n'est plus utilisé nulle part dans ce fichier (vérifier d'abord avec un grep).

- [ ] **Étape 2 : Modifier `migrateProject` dans `src/lib/supabase/db.ts`**

Ajouter l'import de `ExcludeNode` :
```typescript
import type { Wall, WallNode, WallExcludedZone, ExcludeNode } from '@/types/wall';
```

Remplacer le bloc `wallEngine:` (lignes 56-64) :
```typescript
wallEngine: (() => {
  if (p.wallEngine && typeof p.wallEngine === 'object' && !Array.isArray(p.wallEngine)) {
    const we = p.wallEngine as {
      nodes: WallNode[];
      walls: Wall[];
      excludedZones?: (WallExcludedZone | { id: string; points: Point[]; label?: string })[];
      wallRoomNames?: Record<string, string>;
    };
    const migratedZones: WallExcludedZone[] = (we.excludedZones ?? []).map((z) => {
      if ('nodes' in z && Array.isArray((z as WallExcludedZone).nodes)) {
        return z as WallExcludedZone;
      }
      const legacy = z as { id: string; points: Point[]; label?: string };
      return {
        id: legacy.id,
        label: legacy.label,
        nodes: (legacy.points ?? []).map(
          (pt): ExcludeNode => ({ id: generateId(), x: pt.x, y: pt.y }),
        ),
      };
    });
    return {
      nodes: we.nodes,
      walls: we.walls,
      excludedZones: migratedZones,
      wallRoomNames: we.wallRoomNames,
    };
  }
  return undefined;
})(),
```

- [ ] **Étape 3 : Vérifier la compilation TypeScript**

```
cd "c:\Users\JasonSALINAS\OneDrive - VOLTALIA MOBILITY\Documents\00. Perso\Calpiweb-fresh"
npx tsc --noEmit 2>&1 | head -30
```

Il y aura des erreurs TypeScript sur les consommateurs de `zone.points` — c'est attendu, elles seront corrigées dans les tâches suivantes. S'il y a des erreurs DANS `types/wall.ts` ou `db.ts`, les corriger maintenant.

- [ ] **Étape 4 : Commit**

```
git add src/types/wall.ts src/lib/supabase/db.ts
git commit -m "feat: ExcludeNode type + migration legacy zones"
```

---

## Task 2 : Store — interface + actions

**Files:**
- Modify: `src/store/projectStore.ts`
- Test: `src/store/splitWall.test.ts`

### Contexte

L'interface `ProjectStore` déclare `addWallExcludedZone: (points: Point[]) => void` (ligne 80). Il faut :
1. Mettre à jour la signature vers `ExcludeNode[]`
2. Ajouter `updateExcludeZoneNode`
3. Exporter un pure helper `updateExcludeZoneNodeInEngine` (testable)
4. Mettre à jour l'implémentation de `addWallExcludedZone`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Ajouter à la fin de `src/store/splitWall.test.ts` :

```typescript
import type { ExcludeNode, WallExcludedZone } from '@/types/wall';
import { updateExcludeZoneNodeInEngine } from './projectStore';

describe('updateExcludeZoneNodeInEngine', () => {
  const zone: WallExcludedZone = {
    id: 'z1',
    nodes: [
      { id: 'n1', x: 0, y: 0 },
      { id: 'n2', x: 100, y: 0 },
      { id: 'n3', x: 100, y: 100 },
    ],
  };
  const we = { nodes: [], walls: [], excludedZones: [zone] };

  it('met à jour la position du nœud ciblé', () => {
    const result = updateExcludeZoneNodeInEngine(we, 'z1', 'n2', { x: 150, y: 50 });
    const updated = result.excludedZones.find(z => z.id === 'z1')!;
    const n2 = updated.nodes.find(n => n.id === 'n2')!;
    expect(n2.x).toBe(150);
    expect(n2.y).toBe(50);
  });

  it('ne modifie pas les autres nœuds', () => {
    const result = updateExcludeZoneNodeInEngine(we, 'z1', 'n2', { x: 150, y: 50 });
    const updated = result.excludedZones.find(z => z.id === 'z1')!;
    expect(updated.nodes.find(n => n.id === 'n1')).toMatchObject({ x: 0, y: 0 });
    expect(updated.nodes.find(n => n.id === 'n3')).toMatchObject({ x: 100, y: 100 });
  });

  it('ne modifie pas les autres zones', () => {
    const zone2: WallExcludedZone = { id: 'z2', nodes: [{ id: 'a', x: 0, y: 0 }] };
    const we2 = { nodes: [], walls: [], excludedZones: [zone, zone2] };
    const result = updateExcludeZoneNodeInEngine(we2, 'z1', 'n1', { x: 99, y: 99 });
    expect(result.excludedZones.find(z => z.id === 'z2')).toBe(zone2);
  });

  it('retourne we inchangé si zoneId introuvable', () => {
    const result = updateExcludeZoneNodeInEngine(we, 'MISSING', 'n1', { x: 1, y: 1 });
    expect(result).toBe(we);
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```
npx vitest run src/store/splitWall.test.ts
```

Attendu : les 4 nouveaux tests FAIL avec "updateExcludeZoneNodeInEngine is not exported".

- [ ] **Étape 3 : Mettre à jour l'interface ProjectStore**

Dans `src/store/projectStore.ts`, remplacer les lignes 80-81 :
```typescript
addWallExcludedZone: (points: Point[]) => void;
removeWallExcludedZone: (id: string) => void;
```
Par :
```typescript
addWallExcludedZone: (nodes: ExcludeNode[]) => void;
updateExcludeZoneNode: (zoneId: string, nodeId: string, pos: Point) => void;
removeWallExcludedZone: (id: string) => void;
```

Ajouter `ExcludeNode` à l'import de `@/types/wall` en tête du fichier.

- [ ] **Étape 4 : Ajouter le pure helper `updateExcludeZoneNodeInEngine`**

Juste après `connectNodeToWallInEngine` (vers la ligne 130), ajouter :

```typescript
/** Pure helper — met à jour la position d'un nœud dans une zone exclue. */
export function updateExcludeZoneNodeInEngine(
  we: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] },
  zoneId: string,
  nodeId: string,
  pos: Point,
): { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] } {
  const zone = we.excludedZones.find(z => z.id === zoneId);
  if (!zone) return we;
  return {
    ...we,
    excludedZones: we.excludedZones.map(z =>
      z.id !== zoneId ? z : {
        ...z,
        nodes: z.nodes.map(n => n.id === nodeId ? { ...n, x: pos.x, y: pos.y } : n),
      },
    ),
  };
}
```

- [ ] **Étape 5 : Mettre à jour l'implémentation des actions store**

Remplacer l'action `addWallExcludedZone` (lignes ~499-514) :
```typescript
addWallExcludedZone: (nodes) => {
  get().updateActive((p) => {
    if (!p.wallEngine) return p;
    return {
      ...p,
      updatedAt: Date.now(),
      wallEngine: {
        ...p.wallEngine,
        excludedZones: [
          ...(p.wallEngine.excludedZones ?? []),
          { id: generateId(), nodes },
        ],
      },
    };
  });
},
```

Ajouter l'action `updateExcludeZoneNode` juste après `addWallExcludedZone` :
```typescript
updateExcludeZoneNode: (zoneId, nodeId, pos) => {
  get().updateActive((p) => {
    if (!p.wallEngine) return p;
    return {
      ...p,
      updatedAt: Date.now(),
      wallEngine: updateExcludeZoneNodeInEngine(p.wallEngine, zoneId, nodeId, pos),
    };
  });
},
```

- [ ] **Étape 6 : Vérifier que tous les tests passent**

```
npx vitest run src/store/splitWall.test.ts
```

Attendu : tous les tests PASS (anciens + 4 nouveaux).

```
npx vitest run
```

Attendu : 430 tests PASS (ou plus), 0 failing.

- [ ] **Étape 7 : Commit**

```
git add src/store/projectStore.ts src/store/splitWall.test.ts
git commit -m "feat: store — addWallExcludedZone(ExcludeNode[]) + updateExcludeZoneNode"
```

---

## Task 3 : Mettre à jour wallFaces.ts

**Files:**
- Modify: `src/engine/geometry/wallFaces.ts`

### Contexte

`wallFaces.ts` ligne 131-135 dans `wallsToRooms` utilise `zone.points`. Remplacer par `zone.nodes.map(n => ({x:n.x, y:n.y}))`.

- [ ] **Étape 1 : Vérifier les lignes à modifier**

```
npx tsc --noEmit 2>&1 | grep wallFaces
```

Ou lire le fichier autour de la ligne 130 pour confirmer l'emplacement exact.

- [ ] **Étape 2 : Corriger `wallFaces.ts`**

Localiser ce bloc (dans `wallsToRooms`) :
```typescript
const roomZones = excludedZones.filter(zone => {
  if (zone.points.length < 3) return false;
  const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
  const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
  return pointInPolygon({ x: cx, y: cy }, facePts);
});
```

Remplacer par :
```typescript
const roomZones = excludedZones.filter(zone => {
  if (zone.nodes.length < 3) return false;
  const cx = zone.nodes.reduce((s, n) => s + n.x, 0) / zone.nodes.length;
  const cy = zone.nodes.reduce((s, n) => s + n.y, 0) / zone.nodes.length;
  return pointInPolygon({ x: cx, y: cy }, facePts);
});
```

- [ ] **Étape 3 : Vérifier tous les tests**

```
npx vitest run
```

Attendu : même nombre de tests PASS, 0 failing.

- [ ] **Étape 4 : Commit**

```
git add src/engine/geometry/wallFaces.ts
git commit -m "fix: wallFaces.ts — zone.nodes.map au lieu de zone.points"
```

---

## Task 4 : WallDrawingCanvas — Dessin avec snap

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

### Contexte

Actuellement, l'outil EXCLUDE dessine sans snap (`excludePoints: Point[]`), ferme sur double-clic ou Enter, et n'a pas de Backspace. Cette tâche :
1. Renomme `excludePoints` → `excludeChain: ExcludeNode[]`
2. Ajoute snap dans `handlePointerMove` (EXCLUDE)
3. Ferme sur clic du 1er nœud ou double-clic
4. Ajoute Backspace
5. Ajoute Shift ortho
6. Affiche l'indicateur de fermeture (ring) sur le 1er nœud
7. Corrige l'affichage des zones existantes (`zone.nodes` → `worldToScreen`)
8. Met à jour la prop `onAddExcludedZone` (signature `ExcludeNode[]` au lieu de `Point[]`)

Il y a des erreurs TypeScript résiduelles des tâches précédentes qui seront aussi corrigées ici.

- [ ] **Étape 1 : Mettre à jour les imports dans `WallDrawingCanvas.tsx`**

Ligne 5, ajouter `ExcludeNode` :
```typescript
import type { Wall, WallNode, DrawingChain, SnapResult, WallExcludedZone, AutoCotation, ExcludeNode } from '@/types/wall';
```

Ajouter `pointInPolygon` à l'import de `wallFaces` ou geometry :
```typescript
import { pointInPolygon } from '@/engine/geometry/polygon';
```

- [ ] **Étape 2 : Mettre à jour la prop `onAddExcludedZone` dans l'interface**

Dans l'interface `WallDrawingCanvasProps` (vers la ligne 48), modifier :
```typescript
onAddExcludedZone: (nodes: ExcludeNode[]) => void;
onRemoveExcludedZone: (id: string) => void;
onUpdateExcludeZoneNode: (zoneId: string, nodeId: string, pos: Point) => void;
```

Et dans la déstructuration des props (vers la ligne 87), remplacer `onRemoveExcludedZone: _onRemoveExcludedZone` par `onRemoveExcludedZone` (enlever le `_`).

- [ ] **Étape 3 : Remplacer l'état `excludePoints` par `excludeChain`**

Remplacer les lignes 135-137 :
```typescript
const [excludePoints, setExcludePoints] = useState<Point[]>([]);
const excludePointsRef = useRef<Point[]>([]);
excludePointsRef.current = excludePoints;
```
Par :
```typescript
const [excludeChain, setExcludeChain] = useState<ExcludeNode[]>([]);
const excludeChainRef = useRef<ExcludeNode[]>([]);
excludeChainRef.current = excludeChain;
```

- [ ] **Étape 4 : Mettre à jour le reset dans l'effet `tool`**

Localiser `setExcludePoints([])` dans l'`useEffect([tool])` (ligne ~130) et remplacer par `setExcludeChain([])`.

- [ ] **Étape 5 : Mettre à jour `handlePointerMove` pour le snap EXCLUDE**

Dans `handlePointerMove`, l'actuel bloc EXCLUDE est absent (la gestion est dans `handlePointerDown`). Le snap est calculé pour `WALL` mais pas pour `EXCLUDE`. Ajouter juste avant la ligne `setHoveredWallId(...)` (à la fin de `handlePointerMove`) :

Le snap général `baseSnap` est déjà calculé dans `handlePointerMove` quand `!draggingNodeId`. Le curseur est mis à jour pour les outils de dessin. Pour l'outil EXCLUDE, ajouter le snap en incluant les nœuds des autres zones :

Remplacer (vers la fin de `handlePointerMove`, bloc non-drag) :
```typescript
const baseSnap = isCtrlPressed
  ? null
  : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
```
Par :
```typescript
const snapNodePool: WallNode[] = tool === 'EXCLUDE'
  ? [
      ...nodes,
      ...excludedZones.flatMap(z => z.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))),
    ]
  : nodes;
const baseSnap = isCtrlPressed
  ? null
  : snapToWalls(world, walls, snapNodePool, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
```

- [ ] **Étape 6 : Ajouter l'orthogonalité Shift pour EXCLUDE**

Localiser le bloc Shift dans `handlePointerMove` pour WALL (vers la ligne 291-294). Juste après, ajouter :
```typescript
if (isShiftPressed && tool === 'EXCLUDE' && excludeChainRef.current.length > 0) {
  const last = excludeChainRef.current[excludeChainRef.current.length - 1]!;
  world = applyOrtho(world, { x: last.x, y: last.y });
}
```

- [ ] **Étape 7 : Réécrire le handler `handlePointerDown` EXCLUDE**

Remplacer le bloc EXCLUDE dans `handlePointerDown` (lignes 378-395) :
```typescript
if (tool === 'EXCLUDE') {
  const pt = snapResult?.point ?? world;

  // Clic sur le 1er nœud → fermer la zone
  if (excludeChain.length >= 3) {
    const first = excludeChain[0]!;
    const firstS = worldToScreen({ x: first.x, y: first.y });
    const ptS = worldToScreen(pt);
    if (Math.hypot(ptS.x - firstS.x, ptS.y - firstS.y) < ENDPOINT_RADIUS_PX) {
      onPushHistory();
      onAddExcludedZone([...excludeChain]);
      setExcludeChain([]);
      return;
    }
  }

  // Double-clic → fermer si ≥ 3 nœuds
  const now = Date.now();
  const last = lastClickRef.current;
  const isDouble = now - last.time < 350 && dist(world, { x: last.x, y: last.y }) < 30 / scale;
  lastClickRef.current = { time: now, x: world.x, y: world.y };
  if (isDouble) {
    if (excludeChain.length >= 3) {
      onPushHistory();
      onAddExcludedZone([...excludeChain]);
      setExcludeChain([]);
    }
    return;
  }

  setExcludeChain((prev) => [...prev, { id: generateId(), x: pt.x, y: pt.y }]);
  return;
}
```

- [ ] **Étape 8 : Ajouter Backspace dans le keydown handler**

Localiser l'`useEffect` qui écoute `keydown` (vers la ligne 154). Dans la fonction `down`, ajouter après le bloc `Escape` :
```typescript
if (e.key === 'Backspace' && tool === 'EXCLUDE') {
  setExcludeChain((prev) => prev.slice(0, -1));
  return;
}
```

Et dans le `Enter` block, remplacer `excludePointsRef.current` → `excludeChainRef.current` et `setExcludePoints([])` → `setExcludeChain([])` :
```typescript
if (e.key === 'Enter') {
  tryCloseChain();
  if (excludeChainRef.current.length >= 3) {
    onPushHistory();
    onAddExcludedZone([...excludeChainRef.current]);
    setExcludeChain([]);
  }
}
```

- [ ] **Étape 9 : Mettre à jour le rendu des zones existantes**

Localiser le bloc `{/* Zones exclues existantes */}` (vers la ligne 888) :
```typescript
{excludedZones.map(zone => {
  if (zone.points.length < 3) return null;
  const pts = zone.points.map(p => worldToScreen(p));
```

Remplacer par :
```typescript
{excludedZones.map(zone => {
  if (zone.nodes.length < 3) return null;
  const pts = zone.nodes.map(n => worldToScreen({ x: n.x, y: n.y }));
```

- [ ] **Étape 10 : Mettre à jour le rendu de la zone en cours de tracé**

Localiser `{/* Zone en cours de tracé */}` (vers la ligne 901) :
```typescript
{tool === 'EXCLUDE' && excludePoints.length >= 1 && cursor && (() => {
  const pts = [...excludePoints, cursor].map(p => worldToScreen(p));
```

Remplacer par :
```typescript
{tool === 'EXCLUDE' && excludeChain.length >= 1 && cursor && (() => {
  const pts = [...excludeChain.map(n => ({ x: n.x, y: n.y })), cursor].map(p => worldToScreen(p));
```

- [ ] **Étape 11 : Ajouter l'indicateur de fermeture (ring sur 1er nœud)**

Juste après le bloc "Zone en cours de tracé", ajouter :
```typescript
{/* Indicateur de fermeture zone — ring sur le 1er nœud quand curseur proche */}
{tool === 'EXCLUDE' && excludeChain.length >= 3 && cursor && (() => {
  const first = excludeChain[0]!;
  const firstS = worldToScreen({ x: first.x, y: first.y });
  const curS = worldToScreen(cursor);
  if (Math.hypot(curS.x - firstS.x, curS.y - firstS.y) >= ENDPOINT_RADIUS_PX) return null;
  return (
    <circle cx={firstS.x} cy={firstS.y} r={ENDPOINT_RADIUS_PX + 4}
      fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7} />
  );
})()}
```

- [ ] **Étape 12 : Vérifier la compilation et les tests**

```
npx tsc --noEmit 2>&1 | head -20
npx vitest run
```

Attendu : 0 erreur TypeScript dans les fichiers modifiés, même nombre de tests PASS.

- [ ] **Étape 13 : Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat: zone exclue — snap au dessin, Backspace, fermeture sur 1er nœud, Shift ortho"
```

---

## Task 5 : WallDrawingCanvas — SELECT : poignées de nœuds + drag

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

### Contexte

En mode SELECT, les nœuds de zone doivent être affichés comme poignées et être draggables, exactement comme les nœuds de murs. On réutilise la même logique (pointer capture, snap, `onUpdateExcludeZoneNode`).

- [ ] **Étape 1 : Ajouter l'état `draggingZoneNode`**

Juste après la déclaration `const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);`, ajouter :
```typescript
const [draggingZoneNode, setDraggingZoneNode] = useState<{ zoneId: string; nodeId: string } | null>(null);
```

Dans l'`useEffect([tool])`, ajouter `setDraggingZoneNode(null);`.

- [ ] **Étape 2 : Hit test des nœuds de zone dans `handlePointerDown` SELECT**

Dans le bloc `if (tool === 'SELECT')`, AVANT le hit test des nœuds de mur (`hitTestNode`), ajouter :
```typescript
// Hit test nœuds de zone (priorité = nœuds de murs)
const r = NODE_HANDLE_RADIUS_PX / scale;
for (const zone of excludedZones) {
  for (const zn of zone.nodes) {
    if (dist(world, { x: zn.x, y: zn.y }) < r) {
      setDraggingZoneNode({ zoneId: zone.id, nodeId: zn.id });
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
  }
}
```

- [ ] **Étape 3 : Drag dans `handlePointerMove`**

Dans `handlePointerMove`, juste AVANT le bloc `if (draggingNodeId)`, ajouter :
```typescript
if (draggingZoneNode) {
  const allNodes = [...nodes, ...excludedZones.flatMap(z => z.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })))];
  const otherNodes = allNodes.filter(n => n.id !== draggingZoneNode.nodeId);
  const snap = isCtrlPressed
    ? null
    : snapToWalls(world, walls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_DRAG_PX);
  const pt = snap?.point ?? world;
  dragSnapRef.current = snap;
  setSnapResult(snap);
  onUpdateExcludeZoneNode(draggingZoneNode.zoneId, draggingZoneNode.nodeId, pt);
  return;
}
```

- [ ] **Étape 4 : Fin de drag dans `handlePointerUp`**

Dans `handlePointerUp`, juste AVANT le bloc `if (draggingNodeId)`, ajouter :
```typescript
if (draggingZoneNode) {
  onPushHistory();
  setDraggingZoneNode(null);
  dragSnapRef.current = null;
  (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
  return;
}
```

- [ ] **Étape 5 : Afficher les poignées de nœuds de zone**

Juste après le bloc `{/* Node handles (SELECT mode) */}` (vers la fin du JSX), ajouter :
```typescript
{/* Zone node handles (SELECT mode) */}
{tool === 'SELECT' && excludedZones.flatMap(zone =>
  zone.nodes.map(zn => {
    const sp = worldToScreen({ x: zn.x, y: zn.y });
    const isDragging = draggingZoneNode?.nodeId === zn.id && draggingZoneNode?.zoneId === zone.id;
    return (
      <circle key={`zn-${zone.id}-${zn.id}`}
        cx={sp.x} cy={sp.y} r={5}
        fill={isDragging ? '#f59e0b' : 'none'}
        stroke="#f59e0b"
        strokeWidth={isDragging ? 2 : 1.5}
        style={{ cursor: 'grab' }}
      />
    );
  }),
)}
```

- [ ] **Étape 6 : Vérifier la compilation et les tests**

```
npx tsc --noEmit 2>&1 | head -20
npx vitest run
```

Attendu : 0 erreur TypeScript, même nombre de tests PASS.

- [ ] **Étape 7 : Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat: zone exclue — poignées de nœuds déplaçables en SELECT"
```

---

## Task 6 : WallDrawingCanvas — DELETE + PlanEditor wiring

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`
- Modify: `src/components/plan/PlanEditor.tsx`

### Contexte

En DELETE mode, un clic dans le corps ou sur le contour d'une zone la supprime. `onRemoveExcludedZone` existe déjà comme prop mais était préfixé `_` (inutilisé). `PlanEditor.tsx` doit passer `onUpdateExcludeZoneNode`.

- [ ] **Étape 1 : Ajouter le hit test de zone dans DELETE**

Dans `handlePointerDown`, localiser le bloc `if (tool === 'DELETE')` (vers la ligne 477) :
```typescript
if (tool === 'DELETE') {
  const hit = hitTestWall(world);
  if (hit) { onPushHistory(); onRemoveWall(hit.id); }
}
```

Remplacer par :
```typescript
if (tool === 'DELETE') {
  const hit = hitTestWall(world);
  if (hit) { onPushHistory(); onRemoveWall(hit.id); return; }

  // Hit test zones exclues — corps ou contour
  for (const zone of excludedZones) {
    if (zone.nodes.length < 3) continue;
    const pts = zone.nodes.map(n => ({ x: n.x, y: n.y }));
    let isHit = pointInPolygon(world, pts);
    if (!isHit) {
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i]!;
        const p2 = pts[(i + 1) % pts.length]!;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((world.x - p1.x) * dx + (world.y - p1.y) * dy) / lenSq));
        const proj = { x: p1.x + t * dx, y: p1.y + t * dy };
        if (dist(world, proj) < 8 / scale) { isHit = true; break; }
      }
    }
    if (isHit) { onPushHistory(); onRemoveExcludedZone(zone.id); return; }
  }
}
```

- [ ] **Étape 2 : Mettre à jour PlanEditor.tsx**

Dans `src/components/plan/PlanEditor.tsx`, ajouter la subscription au store :
```typescript
const updateExcludeZoneNode = useProjectStore((s) => s.updateExcludeZoneNode);
```

Dans le JSX `<WallDrawingCanvas ... />`, ajouter la prop :
```tsx
onUpdateExcludeZoneNode={updateExcludeZoneNode}
```

- [ ] **Étape 3 : Vérifier la compilation TypeScript**

```
npx tsc --noEmit 2>&1 | head -30
```

Attendu : 0 erreur.

- [ ] **Étape 4 : Vérifier tous les tests**

```
npx vitest run
```

Attendu : 430+ tests PASS, 0 failing.

- [ ] **Étape 5 : Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat: zone exclue — suppression en DELETE + wiring PlanEditor"
```

---

## Vérification finale

```
npx tsc --noEmit
npx vitest run
git log --oneline -6
```

Les 6 commits doivent être présents, TypeScript propre, tous les tests verts.
