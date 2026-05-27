# Dimension Face Snap — Design Spec

**Goal:** Remplacer le système de cotation implicite (toujours intérieur) par un outil DIMENSION de type CAD où l'utilisateur choisit librement la référence de chaque extrémité — face intérieure, axe, ou face extérieure.

**Architecture:** `PointRef` gagne un champ `face` optionnel stockant la référence. Une nouvelle fonction `constraintFaceOffset` remplace `constraintInteriorOffset` et lit cette valeur. Le snap sur face est calculé dans `PlanEditor` et rendu dans `DrawingCanvas`. La logique solver DOF reste inchangée.

**Tech Stack:** React 18, TypeScript, SVG pointer events, Tailwind CSS, Vitest

---

## 1. Contexte & problème

Le système actuel applique automatiquement un offset "intérieur" (halfThickness A + halfThickness B) à toutes les cotes H/V. L'utilisateur ne peut pas choisir de mesurer extérieur→extérieur, axe→axe, ou des combinaisons mixtes. Sur chantier, les trois références sont couramment utilisées selon le contexte.

---

## 2. Modèle de données

### Extension de `PointRef`

```typescript
// src/types/project.ts
export interface PointRef {
  roomId: string;
  vertexIdx: number;
  face?: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  // absent / undefined → 'INSIDE' (rétrocompatibilité totale)
}
```

**Règle de rétrocompatibilité :** toute contrainte existante sans `face` est traitée comme `INSIDE` sur les deux endpoints. Le comportement de toutes les cotes existantes est inchangé.

### Calcul d'offset — `constraintFaceOffset`

Les vertices sont positionnés sur l'**axe** des murs (centre de l'épaisseur). L'offset par endpoint selon la face :

| `face` | offset |
|--------|--------|
| `'INSIDE'`  | `−halfThickness` (vers l'intérieur de la pièce) |
| `'AXIS'`    | `0` |
| `'OUTSIDE'` | `+halfThickness` (vers l'extérieur du bâtiment) |

```
displayed = stored_constraint_value + offset(face_A) + offset(face_B)
stored    = displayed − offset(face_A) − offset(face_B)
```

Exemples pour deux murs d'épaisseur 10 cm chacun (halfThick = 5 cm), axe-à-axe = 300 cm :

| Référence | displayed |
|-----------|-----------|
| I → I | 300 − 5 − 5 = 290 cm |
| A → A | 300 cm |
| E → E | 300 + 5 + 5 = 310 cm |
| I → E | 300 − 5 + 5 = 300 cm |

### Fichier remplacé

`src/engine/constraints/interiorOffset.ts` → `src/engine/constraints/faceOffset.ts`

```typescript
// src/engine/constraints/faceOffset.ts
export function constraintFaceOffset(
  constraint: Constraint,
  rooms: Room[],
  defaultThickness: number,
): number
```

Signature identique à `constraintInteriorOffset` pour faciliter la migration. Lit `constraint.pts[i].face` pour chaque endpoint ; `undefined` → `'INSIDE'`.

---

## 3. Nouveau type `FaceSnapPoint`

Défini et exporté depuis `DrawingCanvas.tsx` :

```typescript
export interface FaceSnapPoint {
  roomId: string;
  vertexIdx: number;                       // vertex de référence (pour le solver)
  face: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  worldPos: Point;                         // position réelle du snap (pour dessin + clic)
  wallNormal: Point;                       // vecteur unitaire perpendiculaire au segment
}
```

---

## 4. Système de snap — `findNearestFaceSnap`

Fonction dans `PlanEditor.tsx`, appelée dans `handlePointerMove` quand `tool === 'DIMENSION'`.

### Algorithme

Pour chaque segment de mur/porte/cloison/zone :
1. Calculer `proj` = projection du curseur sur le segment
2. Si `distance(cursor, proj) > 80/scale` → ignorer
3. Calculer `normal` = vecteur unitaire perpendiculaire au segment (rotated 90°), orienté vers l'intérieur de la pièce
4. Générer 3 candidats :
   - `INSIDE`  : `worldPos = proj + normal × halfThickness`
   - `AXIS`    : `worldPos = proj`
   - `OUTSIDE` : `worldPos = proj − normal × halfThickness`
5. Retenir le candidat dont `distance(cursor, worldPos)` est minimal

Parmi tous les segments scannés, retourner le `FaceSnapPoint` global le plus proche du curseur.

### `halfThickness` par segment

- Mur / porte : `room.edgeThicknesses?.[edgeIndex] ?? wallThickness`
- Cloison : `partition.thickness`
- Zone : `0` (pas d'épaisseur — seul snap `AXIS`)

---

## 5. DrawingCanvas — rendu des snaps

### Nouveaux props

```typescript
faceSnapHover:   FaceSnapPoint | null;   // snap sous le curseur (non confirmé)
dimensionSource: {                        // 1er point confirmé
  ref:      PointRef;
  worldPos: Point;
} | null;
```

### Rendu en mode DIMENSION

**Dots snap sur le hover (`faceSnapHover` non null) :**

Pour le segment survolé, afficher 3 cercles perpendiculaires au mur :
- `OUTSIDE` : `r=120`, `fill='#3b82f6'` (bleu)
- `AXIS`    : `r=100`, `fill='#a855f7'` (violet)
- `INSIDE`  : `r=120`, `fill='#22c55e'` (vert)

Le dot correspondant à `faceSnapHover.face` est agrandi (`r×1.6`) et opaque ; les deux autres sont à `opacity=0.5`.

**Point source confirmé (`dimensionSource` non null) :**

Cercle orange `r=180`, `fill='#f97316'`, avec lettre `I` / `A` / `E` en blanc centré.

**Ligne de preview :**

Comportement existant conservé : ligne H ou V en tirets oranges de `dimensionSource.worldPos` vers `mousePos`, label distance live.

### Curseur SVG

`tool === 'DIMENSION'` → `cursor-crosshair` (déjà le cas).

---

## 6. PlanEditor — logique DIMENSION refactorisée

### State

```typescript
const [faceSnapHover, setFaceSnapHover]   = useState<FaceSnapPoint | null>(null);
const [dimensionSource, setDimensionSource] = useState<{
  ref:      PointRef;
  worldPos: Point;
} | null>(null);
// Les états existants editingEdgeConstraintType, etc. restent pour SELECT/thickness
```

### `handlePointerMove` — branche DIMENSION

```typescript
if (tool === 'DIMENSION') {
  setFaceSnapHover(findNearestFaceSnap(raw));
  return;
}
```

### `handlePointerDown` — branche DIMENSION

```typescript
if (tool === 'DIMENSION') {
  if (!dimensionSource) {
    if (faceSnapHover) {
      setDimensionSource({ ref: { roomId: faceSnapHover.roomId, vertexIdx: faceSnapHover.vertexIdx, face: faceSnapHover.face }, worldPos: faceSnapHover.worldPos });
    }
    // clic dans le vide → ignorer
    return;
  }
  // 2e clic
  if (faceSnapHover) {
    openDimensionPopup(dimensionSource.ref, {
      roomId: faceSnapHover.roomId,
      vertexIdx: faceSnapHover.vertexIdx,
      face: faceSnapHover.face,
    }, faceSnapHover.worldPos);
    setDimensionSource(null);
  } else {
    // clic dans le vide → annuler
    setDimensionSource(null);
  }
  return;
}
```

### Ouverture du popup — state `dimensionPopup`

```typescript
const [dimensionPopup, setDimensionPopup] = useState<{
  fromRef:  PointRef;
  toRef:    PointRef;
  dimType:  'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';
  value:    string; // valeur affichée en cm
} | null>(null);
```

Calcul à l'ouverture :
1. Auto-détecter `dimType` : H si `|Δx| ≥ |Δy|`, sinon V (comportement existant)
2. Calculer `rawValue = dimType === 'H_DISTANCE' ? |Δx| : |Δy|`
3. Calculer `displayed = (rawValue + faceOffset(fromRef, from_room) + faceOffset(toRef, to_room)) / 10` (en cm)
4. Si contrainte existante entre ces deux vertices → pré-remplir la valeur actuelle
5. `setDimensionPopup({ fromRef, toRef, dimType, value: displayed.toFixed(1) })`

### Édition d'une contrainte existante

Cliquer sur une **ligne de cote annotée** (zone de clic élargie autour du trait) en mode DIMENSION → rouvre `DimensionPopup` avec `fromRef.face`, `toRef.face` et la valeur actuelle.

### Escape / changement d'outil

`setDimensionSource(null)` + `setFaceSnapHover(null)`.

---

## 7. Nouveau composant `DimensionPopup`

**Fichier :** `src/components/plan/DimensionPopup.tsx`

```typescript
interface DimensionPopupProps {
  screenX?: number;
  screenY?: number;
  above?: boolean;
  fromFace: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  toFace:   'INSIDE' | 'AXIS' | 'OUTSIDE';
  dimType: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';
  onDimTypeChange: (t: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH') => void;
  value: string;
  onValueChange: (v: string) => void;
  hasExisting: boolean;
  onRelease: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}
```

**Affichage du label de référence :**

```typescript
const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' };
const refLabel = `${FACE_LABEL[fromFace]}→${FACE_LABEL[toFace]}`; // ex. "I→E"
```

Le label est affiché en lecture seule à côté du type H/V/L — la face est fixée au moment du snap, non modifiable dans la popup.

---

## 8. WallEdgeEditor simplifié — épaisseur uniquement

En mode SELECT, cliquer sur un mur ouvre toujours `WallEdgeEditor`, mais la popup ne gère plus que l'épaisseur.

**Props supprimées :**
- `dimValue`, `onDimChange`
- `constraintType`, `onConstraintTypeChange`

**Props conservées :**
- `thicknessValue`, `onThicknessChange`
- `hasExistingConstraint` (pour afficher un indicateur "cote posée" en lecture seule)
- `onSubmit`, `onCancel`, `onRelease`, `screenX/Y`, `above`

Les contraintes existantes sur le mur restent visibles sous forme d'annotation sur le canvas (ligne de cote avec valeur). Pour les modifier → outil DIMENSION.

---

## 9. Mode SELECT — épaisseur seulement

Dans `tapActivateEdge`, supprimer tout le code qui :
- Cherche des contraintes H/V/L existantes (`edgeDimConstraintIds`, `hDist`, `vDist`, `lenC`)
- Calcule `displayOffset`
- Remplit `editValue` avec la valeur de cote
- Positionne `editingEdgeConstraintType`

Conserver :
- `setEditingEdge({ roomId, edgeIndex })`
- `setEditingEdgeThicknessValue(...)`

Dans `submitDimension` → renommer `submitThickness` et supprimer la logique de cote.

---

## 10. Positionnement automatique de la ligne de cote

Après validation de la `DimensionPopup`, la ligne de cote annotée est positionnée **automatiquement** perpendiculairement à l'axe de mesure, à un offset fixe de `400` unités monde (comportement existant conservé). Pas de 3e clic de positionnement.

---

## 11. Cas limites

- **Mur très fin (< 2 cm)** : les 3 snap dots peuvent se chevaucher. Tolérance min : afficher quand même les 3, le plus proche l'emporte.
- **Cloison** : `face = 'INSIDE'` et `'OUTSIDE'` font référence aux deux faces de la cloison. `'AXIS'` = axe de la cloison. Épaisseur = `partition.thickness`.
- **Zone exclue** : pas d'épaisseur → seulement le snap `AXIS` sur les bords.
- **Contraintes croisées (deux rooms différentes)** : `constraintFaceOffset` ne peut calculer l'offset que si les deux points sont dans la même room (comportement `constraintInteriorOffset` conservé). Si rooms différentes → offset = 0 (axe-à-axe, valeur brute).
- **Undo** : `pushHistory()` avant chaque `addConstraint` / `removeConstraint` — comportement existant conservé.

---

## 12. Fichiers touchés

| Fichier | Action |
|---------|--------|
| `src/types/project.ts` | Modifier — ajouter `face?` à `PointRef` |
| `src/engine/constraints/interiorOffset.ts` | Remplacer par `faceOffset.ts` |
| `src/components/plan/DimensionPopup.tsx` | Créer |
| `src/components/plan/DrawingCanvas.tsx` | Modifier — `FaceSnapPoint`, props snap, rendu dots |
| `src/components/plan/PlanEditor.tsx` | Modifier — `findNearestFaceSnap`, DIMENSION flow, SELECT thickness only |
| `src/components/plan/WallEdgeEditor.tsx` | Modifier — supprimer props dimension |
| `src/components/plan/PlanEditor.toolbar.test.ts` | Modifier — adapter |
| `src/components/plan/PlanToolbar.test.tsx` | Modifier — adapter si nécessaire |
