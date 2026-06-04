# Wall Split & Room Detection Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre la détection de plusieurs pièces lorsque la 2ème est dessinée en se raccordant (via snap face ou snap endpoint) aux murs ou nœuds de la 1ère.

**Architecture:** Ajouter une fonction pure `splitWallInEngine` (découpe un mur en deux au point de snap), l'utiliser dans une action store `splitWall`, puis modifier le canvas pour appeler `splitWall` quand le snap est de type `face` et ignorer les murs dupliqués à la fermeture d'une chaîne.

**Tech Stack:** Zustand (store), React (canvas), Vitest (tests), TypeScript.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/store/projectStore.ts` | Exporter `splitWallInEngine`, ajouter interface + action `splitWall` |
| `src/store/splitWall.test.ts` | Créer — tests unitaires de `splitWallInEngine` |
| `src/components/plan/WallDrawingCanvas.tsx` | Ajouter prop `onSplitWall`, modifier WALL tool + `tryCloseChain` |
| `src/components/plan/PlanEditor.tsx` | Connecter `splitWall` du store au canvas |

---

### Task 1 : Pure function `splitWallInEngine` + tests

**Files:**
- Modify: `src/store/projectStore.ts` (avant la ligne `export const useProjectStore`)
- Create: `src/store/splitWall.test.ts`

- [ ] **Step 1 : Écrire le test qui doit échouer**

Créer `src/store/splitWall.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { splitWallInEngine } from './projectStore';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

describe('splitWallInEngine', () => {
  const nodes = [nd('a', 0, 0), nd('b', 200, 0)];
  const wall: Wall = { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 100 };
  const we = { nodes, walls: [wall], excludedZones: [] };

  it('ajoute le nœud de split', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.find(n => n.id === 'm')).toEqual({ id: 'm', x: 100, y: 0 });
  });

  it('supprime le mur original et ajoute deux murs', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    expect(result.walls).toHaveLength(2);
    expect(result.walls.find(w => w.id === 'w1')).toBeUndefined();
  });

  it('les deux nouveaux murs relient les extrémités via le nœud de split', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    const first  = result.walls.find(w => w.node1Id === 'a');
    const second = result.walls.find(w => w.node1Id === 'm');
    expect(first?.node2Id).toBe('m');
    expect(second?.node2Id).toBe('b');
  });

  it('préserve l\'épaisseur sur les deux murs', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    result.walls.forEach(w => expect(w.thickness).toBe(100));
  });

  it('préserve excludedZones inchangé', () => {
    const result = splitWallInEngine(we, 'w1', nd('m', 100, 0));
    expect(result.excludedZones).toEqual([]);
  });

  it('retourne le même objet si wallId introuvable', () => {
    const result = splitWallInEngine(we, 'missing', nd('m', 100, 0));
    expect(result).toBe(we);
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```
npx vitest run src/store/splitWall.test.ts
```

Attendu : FAIL — `splitWallInEngine is not exported from './projectStore'`

- [ ] **Step 3 : Implémenter `splitWallInEngine` dans le store**

Dans `src/store/projectStore.ts`, ajouter juste **avant** la ligne `const sortByUpdatedDesc` (ligne 88 actuelle) :

```ts
/** Pure helper — splits a wall at newNode, returns new wallEngine state. */
export function splitWallInEngine(
  we: { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] },
  wallId: string,
  newNode: WallNode,
): { nodes: WallNode[]; walls: Wall[]; excludedZones: WallExcludedZone[] } {
  const wall = we.walls.find(w => w.id === wallId);
  if (!wall) return we;
  const wall1: Wall = { id: generateId(), node1Id: wall.node1Id, node2Id: newNode.id, thickness: wall.thickness };
  const wall2: Wall = { id: generateId(), node1Id: newNode.id,  node2Id: wall.node2Id, thickness: wall.thickness };
  return {
    ...we,
    nodes: [...we.nodes, newNode],
    walls:  [...we.walls.filter(w => w.id !== wallId), wall1, wall2],
  };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```
npx vitest run src/store/splitWall.test.ts
```

Attendu : 6 tests PASS

- [ ] **Step 5 : Commit**

```
git add src/store/projectStore.ts src/store/splitWall.test.ts
git commit -m "feat(store): splitWallInEngine — pure helper + tests"
```

---

### Task 2 : Action `splitWall` dans le store

**Files:**
- Modify: `src/store/projectStore.ts`

- [ ] **Step 1 : Ajouter `splitWall` à l'interface `ProjectState`**

Dans `src/store/projectStore.ts`, dans le bloc `// Wall engine — wall actions` (lignes 73-80), ajouter après `removeWallExcludedZone`:

```ts
  splitWall: (wallId: string, newNode: WallNode) => void;
```

Le bloc doit ressembler à :

```ts
  // Wall engine — wall actions
  addWall: (wall: Wall) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  setWalls: (walls: Wall[]) => void;
  initWallEngine: () => void;
  addWallExcludedZone: (points: Point[]) => void;
  removeWallExcludedZone: (id: string) => void;
  splitWall: (wallId: string, newNode: WallNode) => void;
```

- [ ] **Step 2 : Ajouter l'implémentation dans le store**

Dans `src/store/projectStore.ts`, dans le corps du store `create<ProjectState>`, ajouter après l'action `removeWallExcludedZone` (vers la ligne 470) :

```ts
  splitWall: (wallId, newNode) => {
    get().updateActive((p) => {
      if (!p.wallEngine) return p;
      return { ...p, wallEngine: splitWallInEngine(p.wallEngine, wallId, newNode) };
    });
  },
```

- [ ] **Step 3 : Vérifier que le build TypeScript est propre**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Vérifier que les tests existants passent toujours**

```
npx vitest run src/store/splitWall.test.ts src/engine/geometry/wallFaces.test.ts
```

Attendu : tous PASS.

- [ ] **Step 5 : Commit**

```
git add src/store/projectStore.ts
git commit -m "feat(store): action splitWall — découpe un mur au point de snap"
```

---

### Task 3 : Canvas — prop `onSplitWall` + face snap → split + déduplication

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 1 : Ajouter le prop `onSplitWall` à l'interface**

Dans `src/components/plan/WallDrawingCanvas.tsx`, dans `interface WallDrawingCanvasProps` (ligne 28), ajouter après `onRemoveExcludedZone` :

```ts
  onSplitWall: (wallId: string, newNode: WallNode) => void;
```

Et dans le destructuring du composant (ligne 57), ajouter `onSplitWall` :

```ts
export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
  scale, pan, onScaleChange, onPanChange,
  wallThickness,
  excludedZones, onAddExcludedZone, onRemoveExcludedZone: _onRemoveExcludedZone,
  onSplitWall,
}: WallDrawingCanvasProps) => {
```

- [ ] **Step 2 : Ajouter `walls` comme dépendance de `tryCloseChain` et déduplication**

Remplacer le `tryCloseChain` actuel (lignes 108-116) :

```ts
// Avant
const tryCloseChain = useCallback(() => {
  if (!chain || chain.nodeIds.length < 2) return;
  const firstId = chain.nodeIds[0]!;
  const lastId  = chain.nodeIds[chain.nodeIds.length - 1]!;
  if (firstId === lastId) return;
  onPushHistory();
  onAddWall({ id: generateId(), node1Id: lastId, node2Id: firstId, thickness: chain.thickness });
  setChain(null);
}, [chain, onAddWall, onPushHistory]);
```

Par :

```ts
// Après
const tryCloseChain = useCallback(() => {
  if (!chain || chain.nodeIds.length < 2) return;
  const firstId = chain.nodeIds[0]!;
  const lastId  = chain.nodeIds[chain.nodeIds.length - 1]!;
  if (firstId === lastId) return;
  const alreadyConnected = walls.some(w =>
    (w.node1Id === lastId && w.node2Id === firstId) ||
    (w.node1Id === firstId && w.node2Id === lastId)
  );
  onPushHistory();
  if (!alreadyConnected) {
    onAddWall({ id: generateId(), node1Id: lastId, node2Id: firstId, thickness: chain.thickness });
  }
  setChain(null);
}, [chain, walls, onAddWall, onPushHistory]);
```

- [ ] **Step 3 : Modifier le bloc WALL tool — démarrage de chaîne sur un mur**

Dans `handlePointerDown`, le bloc `if (!chain)` (lignes 248-282), remplacer :

```ts
if (!chain) {
  let nodeId: string;
  if (snap?.type === 'endpoint' && snap.nodeId) {
    nodeId = snap.nodeId;
  } else {
    nodeId = generateId();
    onAddNode({ id: nodeId, x: pt.x, y: pt.y });
  }
  setChain({ nodeIds: [nodeId], thickness: wallThickness });
```

Par :

```ts
if (!chain) {
  let nodeId: string;
  if (snap?.type === 'endpoint' && snap.nodeId) {
    nodeId = snap.nodeId;
  } else if (snap?.type === 'face' && snap.wallId) {
    nodeId = generateId();
    onPushHistory();
    onSplitWall(snap.wallId, { id: nodeId, x: pt.x, y: pt.y });
  } else {
    nodeId = generateId();
    onAddNode({ id: nodeId, x: pt.x, y: pt.y });
  }
  setChain({ nodeIds: [nodeId], thickness: wallThickness });
```

- [ ] **Step 4 : Modifier le bloc WALL tool — extension de chaîne sur un mur + déduplication**

Dans le même `handlePointerDown`, le bloc `else` (extension de chaîne), remplacer :

```ts
} else {
  const prevNodeId = chain.nodeIds[chain.nodeIds.length - 1]!;
  const prevNode = nodes.find((n) => n.id === prevNodeId);
  if (!prevNode) return;
  if (dist({ x: prevNode.x, y: prevNode.y }, pt) < 1) return;

  let targetNodeId: string;
  if (snap?.type === 'endpoint' && snap.nodeId) {
    targetNodeId = snap.nodeId;
  } else {
    targetNodeId = generateId();
    onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
  }

  onPushHistory();
  onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });

  const startId = chain.nodeIds[0]!;
  if (targetNodeId === startId) {
    setChain(null);
  } else {
    setChain({ ...chain, nodeIds: [...chain.nodeIds, targetNodeId] });
  }
}
```

Par :

```ts
} else {
  const prevNodeId = chain.nodeIds[chain.nodeIds.length - 1]!;
  const prevNode = nodes.find((n) => n.id === prevNodeId);
  if (!prevNode) return;
  if (dist({ x: prevNode.x, y: prevNode.y }, pt) < 1) return;

  let targetNodeId: string;
  if (snap?.type === 'endpoint' && snap.nodeId) {
    targetNodeId = snap.nodeId;
  } else if (snap?.type === 'face' && snap.wallId) {
    targetNodeId = generateId();
    onSplitWall(snap.wallId, { id: targetNodeId, x: pt.x, y: pt.y });
  } else {
    targetNodeId = generateId();
    onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
  }

  const alreadyConnected = walls.some(w =>
    (w.node1Id === prevNodeId && w.node2Id === targetNodeId) ||
    (w.node1Id === targetNodeId && w.node2Id === prevNodeId)
  );

  onPushHistory();
  if (!alreadyConnected) {
    onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });
  }

  const startId = chain.nodeIds[0]!;
  if (targetNodeId === startId) {
    setChain(null);
  } else {
    setChain({ ...chain, nodeIds: [...chain.nodeIds, targetNodeId] });
  }
}
```

- [ ] **Step 5 : Vérifier le build TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 6 : Lancer les tests**

```
npx vitest run
```

Attendu : tous les tests existants passent.

- [ ] **Step 7 : Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-canvas): face snap → splitWall + déduplication murs fermeture"
```

---

### Task 4 : PlanEditor — wiring `onSplitWall`

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

- [ ] **Step 1 : Sélectionner `splitWall` depuis le store**

Dans `src/components/plan/PlanEditor.tsx`, dans le bloc des sélecteurs (lignes 64-76), ajouter après `mergeNodes` :

```ts
  const splitWall = useProjectStore((s) => s.splitWall);
```

- [ ] **Step 2 : Passer `onSplitWall` au canvas**

Dans le rendu de `<WallDrawingCanvas>` (lignes 194-213), ajouter la prop après `onMergeNodes` :

```tsx
<WallDrawingCanvas
  walls={wallEngine?.walls ?? []}
  nodes={wallEngine?.nodes ?? []}
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
  onSplitWall={splitWall}
  onPushHistory={pushHistory}
  wallThickness={wallThickness}
  excludedZones={wallEngine?.excludedZones ?? []}
  onAddExcludedZone={addWallExcludedZone}
  onRemoveExcludedZone={removeWallExcludedZone}
/>
```

- [ ] **Step 3 : Vérifier le build TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Lancer toute la suite de tests**

```
npx vitest run
```

Attendu : tous les tests passent, aucune régression.

- [ ] **Step 5 : Commit**

```
git add src/components/plan/PlanEditor.tsx
git commit -m "feat(plan-editor): connecter splitWall au canvas — détection 2ème pièce"
```

---

### Task 5 : Vérification manuelle

- [ ] **Démarrer le serveur de développement**

```
npm run dev
```

- [ ] **Scénario 1 — Face snap : 2ème pièce sur corps de mur**
  1. Dessiner une 1ère pièce rectangulaire (4 murs fermés)
  2. Cliquer sur le **corps** d'un mur existant (pas sur un nœud) → vérifier que le mur se découpe (apparaît en deux segments)
  3. Tracer des murs supplémentaires et fermer la 2ème pièce
  4. Vérifier que **2 pièces** apparaissent dans le WallRoomPanel avec la bonne surface

- [ ] **Scénario 2 — Endpoint snap : 2ème pièce partageant une arête**
  1. Dessiner une 1ère pièce A-B-C-D
  2. Démarrer une chaîne depuis B, ajouter E, F, snapper sur A (nœud existant)
  3. Appuyer sur **Entrée** pour fermer (mur A→B existe déjà → pas de doublon)
  4. Vérifier que **2 pièces** sont détectées

- [ ] **Scénario 3 — Régression : 1ère pièce seule**
  1. Dessiner une seule pièce rectangulaire
  2. Vérifier que **1 pièce** est détectée avec la surface correcte

- [ ] **Scénario 4 — Régression : annulation (Ctrl+Z)**
  1. Dessiner 2 pièces
  2. Ctrl+Z plusieurs fois → vérifier que l'état revient correctement
