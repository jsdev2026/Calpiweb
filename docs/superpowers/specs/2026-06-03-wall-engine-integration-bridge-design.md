# Intégration moteur murs — Sous-projet 1 : Bridge données

**Date :** 2026-06-03
**Périmètre :** Sous-projet 1 de 5 — rendre tiling et quantitatif fonctionnels quand le moteur de murs est actif.

---

## Problème

Quand `project.wallEngine` est défini (moteur de murs actif), les moteurs de calepinage (`tilingEngine`) et de quantitatif (`quantityEngine`) reçoivent `project.rooms` — vide ou obsolète — car le nouveau canvas ne touche pas à `project.rooms`. Les deux outils sont inutilisables en mode murs.

---

## Décision

**Approche A — Dérivation automatique des faces, calculée à la volée (non persistée).**

- Un algorithme de traversal de demi-arêtes planes (`wallsToRooms`) détecte automatiquement tous les espaces fermés du graphe de murs.
- Le résultat est une liste `Room[]` synthétique, calculée à la demande, jamais stockée en base.
- Un sélecteur unifié `selectRooms` abstrait le choix du modèle pour tous les consommateurs.

---

## Architecture

### Sélecteur `selectRooms`

Ajouté dans `src/store/projectStore.ts` (ou `src/store/selectors.ts` si extrait) :

```typescript
export function selectRooms(s: ProjectState): Room[] {
  const project = selectActiveProject(s);
  if (!project) return [];
  const we = project.wallEngine;
  if (we && (we.walls.length > 0 || we.nodes.length > 0)) {
    return wallsToRooms(we.walls, we.nodes);
  }
  return project.rooms;
}
```

- Si `wallEngine` est actif et non vide → retourne `wallsToRooms(...)`.
- Sinon → retourne `project.rooms` (mode legacy inchangé).
- Tous les consommateurs remplacent leurs références directes à `project.rooms` par `selectRooms`.

### Nouvelle fonction pure `wallsToRooms`

Fichier : `src/engine/geometry/wallFaces.ts`

```typescript
export function wallsToRooms(walls: Wall[], nodes: WallNode[]): Room[]
```

Entrée : `Wall[]` + `WallNode[]` (le graphe du moteur de murs).
Sortie : `Room[]` avec pour chaque face intérieure fermée :
- `id` : généré de façon stable depuis les IDs de nœuds de la face — trier les nodeIds lexicographiquement, les joindre par `-`, hacher avec une fonction simple (ex. djb2) → même graphe = mêmes IDs de rooms à chaque appel
- `points` : polygone ordonné passant par les **centres des nœuds** (lignes axiales des murs)
- `edges` : tableau de `'WALL'` (longueur = nombre de côtés)
- `name` : `"Pièce 1"`, `"Pièce 2"` … (ordre : centroïde haut-gauche → bas-droite)
- `partitions` : `[]`
- `excludedZones` : `[]`

#### Précision des polygones

Les polygones retournés utilisent les **axes des murs** (lignes centrales). Les moteurs de calepinage et de quantitatif appliquent déjà `insetRoomPolygon(room, wallThickness)` — comportement inchangé. La valeur `wallThickness` utilisée est `project.wallThickness` (épaisseur globale du projet), identique au mode legacy.

Limitation MVP acceptée : l'inset est uniforme même si les murs ont des épaisseurs individuelles différentes. La précision per-mur est hors périmètre de ce sous-projet.

---

## Algorithme — Half-Edge Planar Traversal

L'algorithme trouve toutes les faces intérieures fermées d'un graphe planaire, y compris les plans multi-pièces avec T-junctions et X-junctions.

### Étapes

1. **Construire les demi-arêtes orientées**
   Chaque mur (u, v) génère deux demi-arêtes : `u→v` et `v→u`.

2. **Calculer le `next` de chaque demi-arête**
   Pour la demi-arête `u→v`, le `next` est la demi-arête qui sort de `v` en faisant le **virage le plus à droite** (angle le plus petit dans le sens horaire) par rapport à la direction d'arrivée `u→v`.
   
   En pratique : lister toutes les arêtes sortantes de `v`, les trier par angle polaire relatif à la direction inverse `v→u`, prendre celle à l'angle le plus faible (sens horaire = coordonnées SVG, Y vers le bas).

3. **Traverser les cycles**
   Partir d'une demi-arête non visitée → suivre `next` successivement → s'arrêter quand on revient à la demi-arête de départ. Chaque cycle = une face.

4. **Éliminer la face extérieure**
   Calculer l'aire non signée (shoelace) de chaque face. La face avec la **plus grande aire** est la face non bornée (l'extérieur du plan) → la supprimer. Dans tout graphe planaire connexe, la face extérieure est toujours la plus grande.

5. **Construire les Room[]**
   Chaque face intérieure restante → un `Room` avec les nœuds dans l'ordre du cycle.

### Hypothèse MVP

Les murs ne se croisent pas sans nœud à leur intersection. Si deux murs se croisent sans jonction, le résultat est indéfini (comportement identique au canvas actuel qui n'insère pas de nœud automatiquement).

---

## Intégration — Consommateurs à modifier

| Fichier | Modification |
|---------|-------------|
| `src/store/projectStore.ts` | Ajouter `selectRooms` (ou `src/store/selectors.ts`) |
| `src/components/quantities/QuantitiesPanel.tsx` | Remplacer `project.rooms` par `selectRooms(s)` |
| `src/components/quantities/QuantityPlanSvg.tsx` | Idem |
| `src/components/quantities/QuantityPlanView.tsx` | Idem si applicable |
| `src/components/tiling/TilingEditor.tsx` | Idem |

| Fichier | Statut |
|---------|--------|
| `src/engine/quantities/quantityEngine.ts` | **Inchangé** |
| `src/engine/tiling/tilingEngine.ts` | **Inchangé** |
| `src/engine/geometry/wallCotation.ts` | **Inchangé** (`detectClosedPolygons` reste dédié aux cotations) |

---

## Tests

- `src/engine/geometry/wallFaces.test.ts` (nouveau) :
  - Plan rectangulaire simple → 1 Room
  - Deux pièces côte à côte (mur partagé, 5 nœuds) → 2 Rooms
  - Plan en L (3 nœuds de degré 2, T-junction) → faces correctes
  - Graphe vide → `[]`
  - Graphe non fermé (chaîne ouverte) → `[]`

- `selectRooms` : test unitaire avec wallEngine vide, wallEngine actif, mode legacy.

---

## Hors périmètre de ce sous-projet

- Nommage persistant des pièces (traité en sous-projet 4 — gestion des pièces)
- Zones exclues dans le moteur de murs (traité en sous-projet 3 — suite d'outils)
- Inset per-mur (précision avec épaisseurs individuelles)
- Migration / suppression du moteur legacy (traité en sous-projet 5)
