# Correction du calcul de quantités pour la pose CHEVRON (pointe de hongrie)

## Contexte

Le moteur de calcul de quantités (`src/engine/quantities/`) a été conçu pour des
carreaux rectangulaires alignés sur les axes X/Y (`tile.rect`). Pour la pose
CHEVRON, chaque carreau est représenté par un parallélogramme (`tile.points`),
dont les deux côtés ont des longueurs fixes :

- `eW = points[3] - points[0]` → longueur = `config.width` (Largeur, 300mm)
- `eH = points[1] - points[0]` → longueur = `config.height` (Longueur, 600mm)

`buildCutTable.ts` calcule actuellement `usedW/usedH/chuteW/chuteH` et la
classification des bords (`pieceEdges`) à partir de la **bounding box globale**
(axes X/Y du plan) du polygone découpé. Pour un parallélogramme dont
l'orientation dépend de `chevronAngle`, cette bbox globale ne correspond à
aucune des deux longueurs réelles du carreau (300mm / 600mm) — elle varie avec
l'angle. Conséquences observées :

- Dimensions de découpe incohérentes (`usedW`/`usedH` affichés ne
  correspondent pas à la réalité du carreau)
- Chutes non détectées / réutilisation incorrecte (`chuteW/chuteH` calculés
  sur les mauvais axes)
- Comptages totaux faux (`totalTiles`, `toOrder`) car dérivés de
  `tilesForCuts = cuts.length - totalReuseCount`, lui-même faussé par les
  chutes mal calculées
- Affichage non conforme dans `CutGroupCard` (miniatures et dimensions)

## Approche retenue : repère local du carreau

Pour chaque tuile CHEVRON (`tile.points` défini), on construit un repère
affine local propre au carreau, à partir de ses propres sommets :

```
origin = points[0]
eH = points[1] - points[0]   // longueur = config.height (Longueur, 600mm)
eW = points[3] - points[0]   // longueur = config.width  (Largeur, 300mm)
```

Tout point `P` du polygone découpé (intersection avec les pièces) est
transformé en coordonnées locales `(u, v)` :

```
P - origin = α·eH + β·eW
u = α · |eH|   ∈ [0, Hlen]   (axe Longueur)
v = β · |eW|   ∈ [0, Wlen]   (axe Largeur)
```

`(α, β)` s'obtiennent en inversant la matrice 2×2 `[eH | eW]`. Cette matrice
est toujours inversible car `chevronAngle` est borné à `[15°, 75°]` dans l'UI
(jamais 0° ou 90°, donc `eH` et `eW` ne sont jamais colinéaires).

Une fois les points du polygone découpé exprimés en `(u, v)`, le carreau
devient un rectangle local de dimensions `Hlen × Wlen` (= 600 × 300mm,
constantes), et **toute la logique existante de calcul de découpe/chute/bords
s'applique sans changement**, appliquée à `(u, v)` au lieu de `(x, y)`.

### Alternative écartée

Désactiver complètement chutes/réutilisation pour CHEVRON (toujours
`chuteW=chuteH=0`). Plus simple à coder, mais :
- ne corrige pas `usedW/usedH` (toujours faux)
- ne corrige pas `totalTiles/toOrder`
- supprime une fonctionnalité utile (réemploi des chutes)

Écartée : ne résout qu'une partie du problème pour un gain de simplicité
marginal.

## Changements par fichier

### `src/engine/quantities/buildCutTable.ts`

1. **Nouvelle fonction `localFrameFromPoints(points: Point[])`** retournant :
   - `origin: Point`
   - `Hlen: number`, `Wlen: number` (longueurs de `eH`, `eW`)
   - `toLocal(p: Point): Point` — transforme un point global en `(u, v)`
   - `toGlobal(u: number, v: number): Point` — transformation inverse

2. **Extraction de la logique bbox → cut/chute/edges** dans une fonction
   partagée `computeCutFromBBox(width: number, height: number, bbox: {minX,
   minY, maxX, maxY}, refX: number, refY: number)` qui reproduit exactement
   la logique actuelle (lignes ~65-113 de `buildCutTable.ts` :
   `usedW/usedH`, `isCutLeft/Right/Top/Bottom`, `pieceEdges`, calcul de
   `chuteW/chuteH/chuteEdges`, test `viable`).
   - `refX/refY` = coin de référence du rectangle (0,0 en local, `x,y` en
     global) pour les comparaisons `isCutLeft = minX > refX + CUT_TOLERANCE_MM`
     etc.

3. **Branche CHEVRON** (`tile.points` défini) :
   - Calculer le repère local via `localFrameFromPoints(tile.points)`
   - Clipper `tile.points` contre les polygones de pièce (inchangé,
     `clipPolygon` fonctionne déjà sur des polygones quelconques)
   - Transformer chaque point du résultat clippé via `toLocal()`
   - Calculer la bbox locale `(minU, minV, maxU, maxV)`
   - `tileW = Wlen`, `tileH = Hlen`
   - Appeler `computeCutFromBBox(Wlen, Hlen, {minX:minU, minY:minV, maxX:maxU,
     maxY:maxV}, 0, 0)` (référence = origine du repère local)
   - `clipCx, clipCy` : calculer le centre de la bbox locale `(uc, vc)`, puis
     `toGlobal(uc, vc)` pour l'annotation sur le plan
   - `roomId` : centroïde global = `origin + 0.5·eH + 0.5·eW`
   - Cas "aucune intersection" (clip vide) : fallback avec `tileW=Wlen,
     tileH=Hlen, usedW=Wlen, usedH=Hlen` (au lieu de `w,h` actuels)

4. **Branche STRAIGHT/HERRINGBONE** (`tile.points` undefined) : comportement
   **inchangé**, ré-exprimé via `computeCutFromBBox(w, h, clippedBboxGlobal,
   x, y)` pour partager le code (refactor pur, aucun changement de résultat).

### `src/engine/quantities/assignOffcuts.ts`, `groupCuts.ts`,
### `src/components/quantities/CutGroupCard.tsx`

Aucun changement. Ces modules manipulent uniquement des champs numériques
(`usedW`, `chuteW`, `pieceEdges`, etc.) indépendants du repère de coordonnées.
Une fois ces valeurs correctes pour CHEVRON, le réemploi de chutes, le
groupement et l'affichage des miniatures fonctionnent de la même manière que
pour la pose droite.

### `src/engine/quantities/quantityEngine.ts`

Aucun changement. `result.tileW = config.width` (300mm) et `result.tileH =
config.height` (600mm) correspondent déjà à `Wlen`/`Hlen` du repère local —
cohérence garantie par le fix géométrique CHEVRON précédent
(`tilingEngine.ts`).

## Tests

### `buildCutTable.test.ts`

Cas CHEVRON construit à partir de l'exemple validé visuellement
(Largeur=300mm, Longueur=600mm, angle=45°) :
- `tile.points` = parallélogramme avec `eW=(0,300)`, `eH≈(424.26,424.26)`
- Polygone de pièce coupant le carreau à `x=300` (mur vertical)
- Assertions attendues :
  - `tileW = 300`, `tileH = 600`
  - `usedW ≈ 300`, `usedH ≈ 424` (≈ `600·cos(45°)`)
  - `chuteW ≈ 300`, `chuteH ≈ 176` (≈ `600 - usedH`), `chuteEdges` cohérents
  - `pieceEdges` reflète la coupe sur l'axe `u` (Longueur) uniquement

Cas STRAIGHT existant : vérifier non-régression (résultats identiques avant/
après refactor de `computeCutFromBBox`).

### `quantityEngine.integration.test.ts`

Nouveau test avec une pièce rectangulaire et `layout: 'CHEVRON'` :
- `totalTiles`, `toOrder`, `cutGroups` ne contiennent pas de `NaN`/valeurs
  négatives
- Au moins un groupe de découpe a un `chuteW/chuteH` non nul et plausible
  (cohérent avec les dimensions 300×600)
- `totalReuseCount >= 0` et `tilesForCuts = cuts.length - totalReuseCount`

## Hors scope

- Le rendu visuel des miniatures de découpe (`CutGroupCard`) reste un
  rectangle simple (pas de parallélogramme dessiné) — cohérent avec le repère
  local où le carreau CHEVRON *est* un rectangle 300×600.
- Pas de nesting/bin-packing avancé pour les chutes : la logique de réemploi
  reste celle existante (correspondance dimensionnelle simple via
  `REUSE_TOLERANCE_MM`).
