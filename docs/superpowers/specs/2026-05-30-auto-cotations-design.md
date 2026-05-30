# Auto-cotations wall-engine — Design Spec

**Date:** 2026-05-30
**Statut:** approuvé

---

## Objectif

Afficher automatiquement des lignes de cote sur le canvas lorsque le `wallEngine` contient des murs. Aucune interaction utilisateur requise, aucune persistence en base. Les côtes apparaissent toujours en mode édition.

---

## Décisions de design

| Question | Réponse |
|----------|---------|
| Mode | Affichage pur — pas de persistence, pas de contrainte |
| Positionnement | Extérieur (hors-tout) **et** intérieur (vide utile) |
| Granularité | Par pièce fermée + par mur isolé |
| Déclenchement | Toujours visible dès qu'il y a des murs |

---

## Modèle de données

### `AutoCotation` (à ajouter dans `src/types/wall.ts`)

```typescript
export interface AutoCotation {
  wallId: string;
  side: 'exterior' | 'interior' | 'isolated';
  anchor1: Point;   // coin face-mur côté node1 (face extérieure ou intérieure selon side)
                    // pour side='isolated' : position du nœud (axe)
  anchor2: Point;   // coin face-mur côté node2 (idem)
  normal: Point;    // vecteur unitaire pointant vers la ligne de cote
  offset: number;   // distance anchor → ligne de cote (mm)
  label: string;    // "X.X cm" (formatCm depuis src/utils/formatters.ts)
}
```

### Constantes (dans `wallCotation.ts`)

```typescript
const COTE_OFFSET_EXT = 400; // mm — offset depuis la face extérieure
const COTE_OFFSET_INT = 200; // mm — offset vers l'intérieur depuis la face intérieure
const COTE_OFFSET_ISO = 300; // mm — offset depuis l'axe du mur (mur isolé)
```

---

## Architecture

### Nouveaux fichiers

| Fichier | Rôle |
|---------|------|
| `src/engine/geometry/wallCotation.ts` | Fonctions pures : détection polygones + calcul côtes |
| `src/engine/geometry/wallCotation.test.ts` | Tests unitaires |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/types/wall.ts` | Ajouter `AutoCotation` |
| `src/components/plan/WallDrawingCanvas.tsx` | `useMemo` + rendu SVG des côtes |

---

## Module `wallCotation.ts`

### `detectClosedPolygons(walls, nodes)`

**Algorithme DFS :**

1. Construire l'adjacence : `Map<nodeId, { wallId, otherNodeId }[]>`
2. Pour chaque mur non visité, tenter de suivre la chaîne depuis `node1Id`
3. À chaque nœud : filtrer les arêtes disponibles en excluant l'arête d'arrivée
4. Si le nœud suivant a ≥ 2 arêtes disponibles (T-junction) → abandonner ce polygone
5. Si on revient au nœud de départ → cycle fermé détecté, enregistrer `{ wallIds, nodeIds }`
6. Marquer tous les murs du cycle comme visités

**Limitation MVP :** polygones avec T-junctions non détectés (les murs tombent en mode `isolated`).

**Retour :** `Array<{ wallIds: string[]; nodeIds: string[] }>`

### `computeAutoCotations(walls, nodes): AutoCotation[]`

1. Appeler `computeCornerGeometry(walls, nodes)` → `WallPolygon[]`
2. Appeler `detectClosedPolygons(walls, nodes)` → liste des pièces fermées
3. Construire `wallsInRooms = new Set<string>()` pour tracker les murs utilisés

**Pour chaque pièce fermée :**
- Calculer le centroïde : moyenne des positions des nœuds du cycle
- Pour chaque mur de la pièce :
  - Récupérer son `WallPolygon` (4 points)
  - `points[0..1]` = côté +normal, `points[2..3]` = côté −normal
  - Comparer la distance milieu-segment → centroïde des deux côtés
  - Côté le plus **éloigné** = extérieur, côté le plus **proche** = intérieur
  - Créer 2 `AutoCotation` :
    - `exterior` : anchors = coins extérieurs, normal sortant, `offset = COTE_OFFSET_EXT`
    - `interior` : anchors = coins intérieurs, normal entrant, `offset = COTE_OFFSET_INT`
  - Label = `formatCm(distance entre les deux anchors)`

**Pour les murs non inclus dans une pièce (`isolated`) :**
- `anchor1 = nodePos(wall.node1Id)`, `anchor2 = nodePos(wall.node2Id)`
- `normal` = perpendiculaire gauche du vecteur directeur du mur
- `offset = COTE_OFFSET_ISO`
- Label = `formatCm(distance node1 → node2)`

---

## Rendu SVG dans `WallDrawingCanvas.tsx`

```typescript
const autoCotations = useMemo(
  () => computeAutoCotations(walls, nodes),
  [walls, nodes]
);
```

**Pour chaque `AutoCotation`**, inséré après le bloc joint lines (avant les poignées) :

```
lineA = anchor1 + normal * offset
lineB = anchor2 + normal * offset
mid   = (lineA + lineB) / 2
```

Éléments SVG :
- Ligne témoin pointillée : `anchor1 → lineA` et `anchor2 → lineB`
- Ligne de cote pleine : `lineA → lineB`
- Ticks perpendiculaires aux deux extrémités
- Label centré sur `mid + normal * (8/scale)`
- Tout le groupe : `pointer-events-none`
- Épaisseur des traits : `1/scale` (reste lisible à tout niveau de zoom)

**Couleurs :**
- `exterior` → `#22c55e` (vert)
- `interior` → `#3b82f6` (bleu)
- `isolated` → `#f97316` (orange)

---

## Tests `wallCotation.test.ts`

### `detectClosedPolygons`

| Test | Attendu |
|------|---------|
| Pièce rectangulaire 4 murs | 1 polygone, 4 wallIds |
| 4 murs fermés + 1 mur isolé | 1 polygone, mur isolé non inclus |
| T-junction (3 murs dont un interne) | 0 polygone détecté |
| 2 murs seulement (segment ouvert) | 0 polygone |

### `computeAutoCotations`

| Test | Attendu |
|------|---------|
| Pièce 4 murs égaux | 8 côtes (2 par mur) |
| Côte ext top > côte int top | `distExt > distInt` (hors-tout > vide utile) |
| Label de la côte ext top | `formatCm(distExtFaceToFace)` |
| Mur isolé horizontal | 1 côte `isolated`, label = longueur node-à-node |
| Mur longueur 0 (node1 === node2 pos) | Ignoré, 0 côte |
| Côte isolated : normal = perpendiculaire gauche | `normal.x ≈ 0, normal.y ≈ 1` pour mur horizontal |

---

## Rendu visuel attendu

- **Vert** = hors-tout (face ext → face ext, inclut les épaisseurs de murs aux coins)
- **Bleu** = vide utile (face int → face int)
- **Orange** = mur isolé (axe nœud → nœud)

Pour une pièce rectangulaire 200mm × 140mm, épaisseur 20mm :
- Ext width = 220mm → "22.0 cm"
- Ext height = 160mm → "16.0 cm"
- Int width = 180mm → "18.0 cm"
- Int height = 120mm → "12.0 cm"
