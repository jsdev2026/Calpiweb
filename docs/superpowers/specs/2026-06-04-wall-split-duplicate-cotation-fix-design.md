# Wall Split — Doublon de mur + Cotations T-junction Fix

**Date :** 2026-06-04

## Problèmes

### Bug 1 — Doublon de mur quand les deux nœuds sont sur la même cloison

Quand la chaîne est en `[M]` (M créé par face-snap sur A-B) et que l'utilisateur face-snappe sur le mur M-B pour créer N :

```
alreadyConnected = walls.some(...)   // ← walls STALE (avant onSplitWall)
onSplitWall('MB', N)                 // ← crée M-N et N-B
if (!alreadyConnected) onAddWall(M→N) // ← DOUBLON : M-N existe déjà via le split
```

Le graphe se retrouve avec deux murs M-N → `wallsToRooms` produit des demi-arêtes en double, les faces détectées sont incorrectes.

### Bug 2 — Cotations cassées dès le premier face-snap

`detectClosedPolygons` dans `wallCotation.ts` abandonne dès qu'un nœud a plus d'une arête disponible (condition `edges.length !== 1`). Tout face-snap crée une T-junction. Résultat : zéro cotation dès le premier split.

## Solutions

### Bug 1 — Pré-vérification avant onAddWall

Dans le bloc chain-extension de `WallDrawingCanvas.tsx`, avant d'appeler `onAddWall`, vérifier si le split va créer lui-même le lien `prevNodeId → targetNodeId` :

```ts
const snapWallObj = splitWallId !== null ? walls.find(w => w.id === splitWallId) : null;
const splitWillCreateLink =
  snapWallObj !== null &&
  (snapWallObj.node1Id === prevNodeId || snapWallObj.node2Id === prevNodeId);

// ...

if (!alreadyConnected && !splitWillCreateLink) {
  onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });
}
```

**Pourquoi ça marche** : `splitWallInEngine` crée toujours `wall.node1Id → newNode`. Si `prevNodeId === wall.node1Id`, ce mur est exactement `prevNodeId → newNode` → pas besoin de l'ajouter. Si `prevNodeId === wall.node2Id`, le split crée `newNode → prevNodeId` (même arête, sens inverse) → idem.

### Bug 2 — Remplacer `detectClosedPolygons` par l'algorithme half-edge

#### Extraction de `wallFaceCycles` dans `wallFaces.ts`

Nouvelle fonction exportée réutilisant exactement le même algorithme half-edge que `wallsToRooms` :

```ts
export interface FaceCycle {
  nodeIds: string[];
  wallIds: string[];  // wallId[i] = mur entre nodeIds[i] et nodeIds[(i+1) % n]
}

export function wallFaceCycles(
  walls: Wall[],
  nodes: WallNode[],
): FaceCycle[]
```

Pour chaque demi-arête du cycle, retrouver le wallId via :
```ts
walls.find(w =>
  (w.node1Id === he.from && w.node2Id === he.to) ||
  (w.node1Id === he.to   && w.node2Id === he.from)
)
```

`wallsToRooms` est refactoré pour appeler `wallFaceCycles` :
```ts
export function wallsToRooms(walls, nodes, excludedZones): Room[] {
  const cycles = wallFaceCycles(walls, nodes);
  return cycles.map((cycle, idx) => { ... });
}
```

#### Mise à jour de `computeAutoCotations` dans `wallCotation.ts`

Remplace l'appel interne à `detectClosedPolygons` par `wallFaceCycles`. Pour chaque face, `wallIds` dans l'ordre permet de retrouver l'épaisseur de chaque segment directement sans recherche par coordonnées.

`detectClosedPolygons` est supprimée.

## Fichiers

| Fichier | Changement |
|---------|-----------|
| `src/components/plan/WallDrawingCanvas.tsx` | `splitWillCreateLink` + condition `onAddWall` |
| `src/engine/geometry/wallFaces.ts` | Extraire `wallFaceCycles`, refactorer `wallsToRooms` |
| `src/engine/geometry/wallCotation.ts` | Remplacer `detectClosedPolygons` par `wallFaceCycles` |
| `src/engine/geometry/wallCotation.test.ts` | Supprimer tests `detectClosedPolygons`, ajouter tests cotations multi-pièces |

## Tests

- Graphe avec T-junction (deux pièces partageant un mur) → `wallFaceCycles` retourne 2 cycles corrects
- Split M sur A-B puis face-snap sur M-B en N → pas de mur dupliqué M-N dans le graphe
- `computeAutoCotations` sur deux pièces adjacentes → cotations sur chaque face
- `wallsToRooms` : aucune régression (9 tests existants passent)
