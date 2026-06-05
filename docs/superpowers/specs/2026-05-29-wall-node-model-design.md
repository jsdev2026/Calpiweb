# Wall Node Model — Design Spec

**Date:** 2026-05-29  
**Status:** Approved  
**Scope:** Refactoring du moteur mur vers un modèle à nœuds partagés

---

## Objectif

Remplacer le modèle `Wall { p1, p2 }` (coordonnées flottantes) par un modèle à nœuds
`WallNode + Wall { node1Id, node2Id }` qui garantit un sommet commun exact entre murs
connectés, corrige la géométrie des coins pour tout angle, et permet le déplacement
cohérent des nœuds.

---

## Section 1 — Modèle de données

### Types (`src/types/wall.ts`)

```typescript
export interface WallNode {
  id: string;
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  node1Id: string;
  node2Id: string;
  thickness: number; // cm, défaut 20
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv';
  wallId?: string;
  nodeId?: string;   // renseigné pour type 'endpoint'
  axis?: 'h' | 'v'; // renseigné pour type 'hv'
}

export type DrawingChain = {
  nodeIds: string[];   // IDs des nœuds déjà posés
  thickness: number;
} | null;
```

### Store Zustand (`src/store/projectStore.ts`)

Deux slices dans le wall engine :

```
nodes: WallNode[]
walls: Wall[]
```

Actions :
- `addNode(node)`, `updateNode(id, patch)`, `removeNode(id)`
- `addWall(wall)`, `removeWall(id)`, `updateWall(id, patch)`
- `setNodes(nodes)`, `setWalls(walls)`
- `initWallEngine()` → crée `wallEngine: { nodes: [], walls: [] }` dans le projet courant
- `restoreSnapshot(snapshot)` → reçoit `wallEngine?: { nodes, walls }` pour undo/redo

**Suppression automatique des nœuds orphelins** : `removeWall` supprime les nœuds
dont le compte de références tombe à 0 après la suppression.

**Fusion de nœuds** : `mergeNodes(keepId, dropId)` réassigne tous les murs référençant
`dropId` vers `keepId`, puis supprime `dropId`.

### Persistance Supabase (`src/lib/supabase/db.ts`)

Le champ `walls` en base est renommé/restructuré. Dans `src/types/project.ts` :

```typescript
// Avant : walls?: Wall[]   (Wall avec p1/p2)
// Après :
interface Project {
  // ...
  wallEngine?: { nodes: WallNode[]; walls: Wall[] };
}
```

`PlanEditor` décide du canvas selon `project.wallEngine !== undefined`
(au lieu de `walls !== undefined` actuellement).

`migrateProject` (db.ts) : si `p.wall_engine` est présent en base → le désérialise.
Si absent ou dans l'ancien format `p.walls` (tableau avec `p1/p2`) → retourne `wallEngine: undefined`.
Table rase — aucune migration des données existantes.

---

## Section 2 — Géométrie des coins

### `computeCornerGeometry(walls, nodes): WallPolygon[]`

Chaque mur est un rectangle étendu aux extrémités connectées. L'extension est calculée
par intersection des lignes de bord (formule exacte pour tout angle) :

```
cross(a, b) = a.x·b.y − a.y·b.x
dA = normalize(nodeB - nodeA)   // direction mur A
nA = { x: -dA.y, y: dA.x }     // normale gauche

À chaque nœud commun P avec mur voisin B :
  diff = nB·hB − nA·hA
  t    = cross(diff, dB) / cross(dA, dB)
  ext  = −t
```

- 90° → résultat identique à l'ancienne formule (T_voisin/2)
- Autres angles → extension exacte, ni trop courte ni trop longue
- `|cross(dA, dB)| < 1e-6` (murs quasi-parallèles) → ext = 0, pas de ligne de joint

### `computeJointLines(walls, nodes): JointLine[]`

```
vertex_int = P + nA·hA + t·dA
vertex_ext = P − nA·hA − t·dA
```

Déduplication inchangée (Set de clés triées par IDs de nœud).

### Tests

Les 13 tests existants sont mis à jour pour la nouvelle signature.  
Nouveaux tests ajoutés : 45°, 120°, épaisseurs différentes + angle non-droit.

---

## Section 3 — Dessin en chaîne avec nœuds

### Logique de click (mode WALL)

| Situation | Action |
|-----------|--------|
| Snap `endpoint` sur nœud existant | Réutilise ce nœud (pas de doublon) |
| Snap `endpoint` = nœud de départ de la chaîne | Ferme la boucle, termine la chaîne |
| Snap `hv` | Crée un nouveau nœud aux coordonnées contraintes |
| Snap `face` | Crée un nouveau nœud sur la face, sans split du mur hôte |
| Espace libre | Crée un nouveau nœud aux coordonnées brutes |

À chaque click (sauf premier) : `addNode(nouveau)` + `addWall({ node1Id: précédent, node2Id: nouveau, thickness })`.

### Aimantation (`wallSnap.ts`) — priorité décroissante

1. **Nœud** (`'endpoint'`) : distance écran < `ENDPOINT_RADIUS_PX=12` → snap exact + `nodeId`
2. **H/V** (`'hv'`) : distance écran sur axe < `HV_SNAP_PX=8` avec un nœud existant → contrainte sur l'axe + indicateur ligne pointillée verte
3. **Face** (`'face'`) : distance écran < `FACE_RADIUS_PX=8` d'une face → snap sur la face
4. **Libre** : position brute (retourne `null`)

### DrawingChain

```typescript
DrawingChain = { nodeIds: string[]; thickness: number } | null
```

`nodeIds` liste les IDs des nœuds déjà posés dans la chaîne courante.  
La preview du prochain segment utilise `nodes.find(n => n.id === last(nodeIds))` comme point d'ancrage.

---

## Section 4 — Déplacement de nœuds (mode SELECT)

### Détection du hit (`pointerdown`)

Priorité :
1. **Handle nœud** : distance écran < `NODE_HANDLE_RADIUS_PX=10` → entre en drag nœud
2. **Corps de mur** : hit-test existant → sélection + WallEdgeEditor

### Drag nœud (`pointermove`)

- `updateNode(id, { x, y })` à chaque frame → `useMemo` recalcule la géométrie → tous les murs connectés suivent
- **Aimantation H/V** active (même logique que dessin) : si le nœud dragué s'aligne avec un autre nœud à < `HV_SNAP_PX` → verrouillage sur l'axe
- **Snap nœud** : si le nœud dragué entre dans `NODE_HANDLE_RADIUS_PX` d'un autre nœud → fusion automatique via `mergeNodes`

### Fin de drag (`pointerup`)

- `onPushHistory()` appelé une seule fois
- Si fusion → les murs en double (node1Id = node2Id après fusion) sont supprimés via `removeWall`

### Rendu des handles (mode SELECT)

- Tous les nœuds sont affichés comme cercles creux `r=5, stroke=#e67e22` en mode SELECT
- Curseur change en `cursor-grab` au survol d'un handle, `cursor-grabbing` pendant le drag

---

## Architecture — fichiers concernés

| Fichier | Changement |
|---------|-----------|
| `src/types/wall.ts` | Nouveau `WallNode`, `Wall` avec `node1Id/node2Id`, `SnapResult.hv`, `DrawingChain.nodeIds` |
| `src/store/projectStore.ts` | Slice `nodes[]` + actions `addNode/updateNode/removeNode/mergeNodes/setNodes` |
| `src/engine/geometry/wallGeometry.ts` | Signature `(walls, nodes)`, formule d'extension et joint par intersection |
| `src/engine/geometry/wallGeometry.test.ts` | Mise à jour 13 tests + nouveaux cas angles non-droits |
| `src/engine/geometry/wallSnap.ts` | Ajout snap `'hv'`, signature avec `nodes` |
| `src/engine/geometry/wallSnap.test.ts` | Tests snap H/V |
| `src/components/plan/WallDrawingCanvas.tsx` | DrawingChain → nodeIds, drag nœud, handles SELECT, aimantation H/V |
| `src/components/plan/PlanEditor.tsx` | Passe `nodes` + `walls` au canvas, actions store étendues |
| `src/lib/supabase/db.ts` | `migrateProject` — détection ancien/nouveau format |
| `src/types/project.ts` | Remplace `walls?: Wall[]` par `wallEngine?: { nodes: WallNode[]; walls: Wall[] }` |

---

## Hors scope

- Migration des projets existants avec l'ancien moteur polygones
- Migration des projets "nouveau moteur" avec l'ancien format `{ p1, p2 }`
- Split de mur hôte lors d'un T-junction (face snap sans modification du mur hôte)
- Cotations automatiques (Phase 3, spec séparée)
