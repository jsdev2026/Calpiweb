# Zone non carrelée — Refonte interaction — Design Spec

## Objectif

Aligner l'expérience de dessin et d'édition des zones non carrelées sur celle des murs : aimantation, noeuds éditables, suppression et Ctrl+Z.

---

## Section 1 — Modèle de données

### Nouveau type `ExcludeNode`

```typescript
// src/types/wall.ts
interface ExcludeNode {
  id: string;
  x: number;
  y: number;
}
```

### `WallExcludedZone` mis à jour

```typescript
interface WallExcludedZone {
  id: string;
  nodes: ExcludeNode[];   // source de vérité — remplace points: Point[]
}
```

`points: Point[]` est supprimé du type. Les consommateurs remplacent `zone.points` par `zone.nodes.map(n => ({ x: n.x, y: n.y }))`.

### Consommateurs à mettre à jour

| Fichier | Usage à migrer |
|---|---|
| `src/engine/geometry/wallFaces.ts` | `zone.points` → `zone.nodes.map(...)` |
| `src/components/quantities/QuantityPlanSvg.tsx` | idem |
| `src/components/plan/WallDrawingCanvas.tsx` | idem (rendu + hit test) |
| `src/store/projectStore.ts` | actions store |

### Migration rétrocompatible

Dans `migrateProject` (ou à l'initialisation du store), si une zone a `points` mais pas `nodes`, générer des `ExcludeNode` avec `generateId()` pour chaque point.

### Actions store

| Action | Signature | Notes |
|---|---|---|
| `addWallExcludedZone` | `(nodes: ExcludeNode[]) => void` | Remplace l'actuelle `(points: Point[])` |
| `updateExcludeZoneNode` | `(zoneId: string, nodeId: string, pos: Point) => void` | Nouveau |
| `removeWallExcludedZone` | `(id: string) => void` | Inchangée |

---

## Section 2 — Dessin (outil EXCLUDE)

### Interactions

| Action | Résultat |
|---|---|
| Clic | Pose un nœud de zone |
| Clic sur le 1er nœud (rayon `ENDPOINT_RADIUS_PX`) | Ferme la zone |
| Double-clic | Ferme la zone si ≥ 3 nœuds |
| Backspace | Supprime le dernier nœud posé |
| Échap | Annule le tracé en cours (inchangé) |
| Shift | Orthogonalité sur le segment en cours |
| Ctrl | Désactive le snap |

### Aimantation

Utilise `snapToWalls` (déjà importé dans `WallDrawingCanvas`) :
- Endpoint snap sur les nœuds de murs + nœuds des autres zones existantes
- Face snap sur les segments de murs
- H/V snap sur tous les nœuds (murs + zones)

Les nœuds des autres zones sont passés à `snapToWalls` via le paramètre `nodes` : construire une liste `[...wallNodes, ...allZoneNodes]` pour le snap.

### Fermeture

- Condition : ≥ 3 nœuds posés
- À la fermeture : `onPushHistory()` puis `addWallExcludedZone(nodes)`
- La zone en cours de tracé est stockée dans `excludeChain: ExcludeNode[]` (renommage de l'actuel `excludePoints: Point[]`)

### Aperçu visuel

- Ligne pointillée orange de l'avant-dernier nœud au curseur (comportement actuel conservé)
- Indicateur de snap : cercle (endpoint), carré (face), croix H/V (identiques au dessin de murs)
- Petit cercle sur le 1er nœud de la zone en cours (indicateur de fermeture) quand le curseur est dans le rayon endpoint

---

## Section 3 — Édition en mode SELECT

### Hit test

Ordre de priorité (pointer down) :
1. Nœud de mur dans le rayon → drag nœud de mur (comportement actuel)
2. Nœud de zone dans le rayon → drag nœud de zone (nouveau)
3. Mur → drag segment de mur (comportement actuel)
4. Zone vide → pan

Rayon de hit test pour les nœuds de zone : `NODE_HANDLE_RADIUS_PX` (identique aux nœuds de murs).

### Drag d'un nœud de zone

- Pointer down sur nœud de zone → `setDraggingZoneNodeId({ zoneId, nodeId })` + pointer capture
- Pointer move → snap (`snapToWalls` avec les mêmes règles que le dessin) → `updateExcludeZoneNode(zoneId, nodeId, snappedPos)` en temps réel
- Pointer up → `onPushHistory()` + clear state

### Visuel

- Petits cercles orange creux sur tous les nœuds de zone (même style que les nœuds de murs : `r=5`, `stroke="#e67e22"`, `fill="none"`)
- `cursor: grab` sur survol d'un nœud de zone
- `cursor: grabbing` pendant le drag

---

## Section 4 — Suppression (mode DELETE)

### Hit test

En mode DELETE, clic sur :
- **Corps de la zone** (`pointInPolygon(world, zone.nodes.map(...))`) → supprime la zone
- **Contour de la zone** (distance au segment < `4/scale`) → supprime la zone

Un seul test par clic, première zone correspondante gagnante.

### Action

`onPushHistory()` puis `removeWallExcludedZone(zone.id)`.

---

## Section 5 — Historique (Ctrl+Z)

Aucun changement requis. L'historique capture le `wallEngine` complet à chaque `onPushHistory()`. Toutes les mutations (ajout de zone, déplacement de nœud, suppression) appelant `onPushHistory()`, le Ctrl+Z est fonctionnel gratuitement.

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/types/wall.ts` | Ajouter `ExcludeNode`, modifier `WallExcludedZone` |
| `src/store/projectStore.ts` | Mettre à jour actions + migration |
| `src/components/plan/WallDrawingCanvas.tsx` | Dessin + SELECT + DELETE |
| `src/engine/geometry/wallFaces.ts` | `zone.points` → `zone.nodes.map(...)` |
| `src/components/quantities/QuantityPlanSvg.tsx` | `zone.points` → `zone.nodes.map(...)` |

---

## Hors périmètre

- Déplacement de la zone entière (drag du polygone)
- Ajout/suppression de nœuds individuels sur une zone existante
- Zone non carrelée sur mobile (suit l'architecture existante si nécessaire plus tard)
