# Wall Split & Room Detection Fix — Design

**Date :** 2026-06-04

## Problème

Lors du dessin d'une 2ème pièce qui se raccorde à la 1ère, le moteur ne détecte pas la nouvelle pièce dans deux cas :

1. **Face snap sans découpe** : le curseur clique sur le corps d'un mur existant (snap `face`). Un nœud est créé géométriquement sur le mur mais pas topologiquement connecté — le mur n'est pas découpé. `wallsToRooms` ne peut pas détecter de face fermée.

2. **Mur dupliqué à la fermeture** : la pièce 2 partage une arête avec la pièce 1 (ex. pièce 1 = A-B-C-D, pièce 2 = A-G-H-B-A). `tryCloseChain` ajoute le mur B→A alors que A→B existe déjà. Le graphe a des half-edges en double, `nextHE` produit des cycles aberrants.

L'algorithme `wallsToRooms` (traversée half-edge) est correct — seule la topologie du graphe est en cause.

## Solution

Comportement cible (style Kozikaza) : tout clic sur le corps d'un mur le découpe automatiquement au point de contact, créant un nœud de jonction (T-junction). La fermeture de chaîne ne crée jamais de mur dupliqué.

## Architecture

### Nouvelle action store : `splitWall`

Fichier : `src/store/projectStore.ts`

```ts
splitWall: (wallId: string, newNode: WallNode): void => {
  const we = get().project?.wallEngine;
  if (!we) return;
  const wall = we.walls.find(w => w.id === wallId);
  if (!wall) return;
  const wall1: Wall = { id: generateId(), node1Id: wall.node1Id, node2Id: newNode.id, thickness: wall.thickness };
  const wall2: Wall = { id: generateId(), node1Id: newNode.id,  node2Id: wall.node2Id, thickness: wall.thickness };
  set({ project: { ...get().project!, wallEngine: {
    ...we,
    nodes: [...we.nodes, newNode],
    walls:  [...we.walls.filter(w => w.id !== wallId), wall1, wall2],
  }}});
},
```

L'ID du nouveau nœud est généré dans le canvas (qui possède déjà `generateId`), puis passé en paramètre — pas de valeur de retour nécessaire.

### Canvas : `WallDrawingCanvas.tsx`

**Nouveau prop :**
```ts
onSplitWall: (wallId: string, newNode: WallNode) => void;
```

**Démarrage de chaîne sur un mur (`!chain`) :**
```ts
if (snap?.type === 'endpoint' && snap.nodeId) {
  nodeId = snap.nodeId;
} else if (snap?.type === 'face' && snap.wallId) {
  nodeId = generateId();
  onSplitWall(snap.wallId, { id: nodeId, x: pt.x, y: pt.y });
} else {
  nodeId = generateId();
  onAddNode({ id: nodeId, x: pt.x, y: pt.y });
}
```

**Point intermédiaire / fermeture sur un mur :**
```ts
if (snap?.type === 'endpoint' && snap.nodeId) {
  targetNodeId = snap.nodeId;
} else if (snap?.type === 'face' && snap.wallId) {
  targetNodeId = generateId();
  onSplitWall(snap.wallId, { id: targetNodeId, x: pt.x, y: pt.y });
} else {
  targetNodeId = generateId();
  onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
}
```

**Déduplication avant `onAddWall` (point intermédiaire et fermeture) :**
```ts
const alreadyConnected = walls.some(w =>
  (w.node1Id === prevNodeId && w.node2Id === targetNodeId) ||
  (w.node1Id === targetNodeId && w.node2Id === prevNodeId)
);
if (!alreadyConnected) {
  onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });
}
```

**`tryCloseChain` avec déduplication :**
```ts
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

Note : `walls` ajouté comme dépendance de `tryCloseChain`.

### PlanEditor.tsx

```tsx
<WallDrawingCanvas
  ...
  onSplitWall={(wallId, newNode) => useProjectStore.getState().splitWall(wallId, newNode)}
/>
```

## Fichiers

| Fichier | Changement |
|---------|-----------|
| `src/store/projectStore.ts` | Ajouter action `splitWall` |
| `src/components/plan/WallDrawingCanvas.tsx` | Face snap → split, déduplication intermédiaire + `tryCloseChain` |
| `src/components/plan/PlanEditor.tsx` | Passer `onSplitWall` |
| `src/engine/geometry/wallFaces.ts` | **Aucun changement** |

## Tests

- Pièce 1 fermée (4 murs A-B-C-D) + pièce 2 démarrée depuis un nœud existant (B), fermée sur un nœud existant (C) → 2 pièces détectées
- Pièce 1 + pièce 2 démarrée par clic sur le corps d'un mur → mur découpé, 2 pièces détectées
- Fermeture sur un mur partagé (arête commune) → pas de mur dupliqué, 2 pièces détectées
- `npx vitest run` — aucune régression sur les tests snap/wallFaces existants
