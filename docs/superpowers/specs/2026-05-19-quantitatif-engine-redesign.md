# Refonte du moteur de quantitatif — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactoriser `quantityEngine.ts` en trois fonctions pures testables, corriger les bugs de clipping chevron et d'algorithme de réutilisation des chutes, passer le seuil de chute récupérable à 50 mm.

**Architecture:** Découpage en `buildCutTable → assignOffcuts → groupCuts`, chacune testable indépendamment. L'interface publique `analyzeQuantities` reste inchangée.

**Tech Stack:** TypeScript, Vitest, algorithme greedy descending best-fit.

---

## Contexte et bugs corrigés

### Bug 1 — Ordre de traitement dans `optimizeReuse`

L'algorithme actuel trie les coupes par aire **croissante**. Les petites coupes sont traitées en premier : elles ne génèrent que de petites chutes. Quand les grandes coupes arrivent, le pool ne contient que des petites chutes incapables de les couvrir. Résultat : la réutilisation est quasi nulle.

**Correction :** trier par aire **décroissante**. Les grandes coupes génèrent en premier de grandes chutes qui peuvent couvrir les coupes suivantes (plus petites).

### Bug 2 — Matching first-fit au lieu de best-fit

Le pool est parcouru en FIFO. Une grande chute est gaspillée pour couvrir une petite coupe alors qu'une chute plus petite (mais suffisante) était disponible.

**Correction :** pour chaque coupe à couvrir, chercher la **plus petite** chute du pool qui satisfait encore les contraintes de dimension et de bords.

### Bug 3 — Clipping incorrect pour les tuiles chevron

`computeCutInfo` clip `tile.rect` (bounding box) contre le contour de la pièce. Pour les tuiles chevron, `tile.rect` est la bounding box du parallélogramme, pas sa forme réelle. Le clipping devrait utiliser `tile.points` (les 4 sommets du parallélogramme).

**Correction :** si `tile.points` existe, utiliser ces points comme polygone source pour le clipping. La représentation de la coupe reste une bounding box (choix A validé en brainstorming).

### Bug 4 — Seuil de chute trop bas

Le seuil `MIN_CHUTE = 20 mm` est trop faible pour être utile en pratique.

**Correction :** `MIN_CHUTE_MM = 50` (5 cm × 5 cm minimum).

---

## Modèle de données

### `PieceEdges` — inchangé

```typescript
export type TileEdgeSide = 'factory' | 'cut';

export interface PieceEdges {
  left: TileEdgeSide;
  right: TileEdgeSide;
  top: TileEdgeSide;
  bottom: TileEdgeSide;
}
```

### `CutRecord` — remplace `CutDetail`

```typescript
export interface CutRecord {
  id: string;
  roomId: string;

  // Dimensions réelles de la tuile source
  // (reflète l'orientation en bâton rompu : certaines tuiles sont H×W)
  tileW: number;
  tileH: number;

  // Pièce utilisée (bounding box de l'intersection clippée)
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;

  // Chute récupérable (0×0 si < MIN_CHUTE_MM sur l'un des axes)
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;

  // Position du centre de la pièce coupée (pour annotation sur le plan)
  clipCx: number;
  clipCy: number;

  // Liens de réutilisation (remplis par assignOffcuts)
  coveredById: string | null;  // cette coupe utilise la chute de <id>
  reusedForId: string | null;  // la chute de cette coupe sert pour <id>
}
```

### `CutGroup` — inchangé

```typescript
export interface CutGroup {
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  totalCount: number;
  reuseCount: number;
  netTiles: number;
}
```

### `QuantityResult` — `cuts` passe de `CutDetail[]` à `CutRecord[]`

```typescript
export interface QuantityResult {
  tileW: number;
  tileH: number;
  joint: number;
  wholeCount: number;
  cuts: CutRecord[];          // était CutDetail[]
  cutGroups: CutGroup[];
  totalReuseCount: number;
  tilesForCuts: number;
  totalTiles: number;
  toOrder: number;
  roomArea: number;
  tiles: Tile[];
}
```

---

## Constantes

```typescript
const MIN_CHUTE_MM = 50;    // seuil de récupérabilité (était 20)
const CUT_TOLERANCE_MM = 5; // tolérance bord factory/cut (inchangé)
```

---

## Architecture des fonctions

### `buildCutTable(tiles, roomPolygons, config, roomIds)`

**Entrée :** tableau de `Tile[]`, polygones des pièces en coordonnées tile-space, `TilingConfig`, identifiants des pièces.

**Sortie :** `CutRecord[]` avec tous les champs remplis sauf `coveredById`/`reusedForId` (initialisés à `null`).

**Algorithme pour chaque tuile `CUT` :**

1. Déterminer le polygone source de la tuile :
   - Si `tile.points` existe → utiliser `tile.points` (chevron : parallélogramme réel)
   - Sinon → construire les 4 coins de `tile.rect`
2. Clipper ce polygone contre chaque polygone de pièce (Sutherland-Hodgman, CCW normalisé)
3. Calculer la bounding box de l'intersection → `usedW`, `usedH`, `clipCx`, `clipCy`
4. Détecter les bords coupés avec `CUT_TOLERANCE_MM = 5` :
   - `isCutLeft` si `minX > tile.rect.x + 5`
   - `isCutRight` si `maxX < tile.rect.x + tile.rect.w - 5`
   - `isCutTop` si `minY > tile.rect.y + 5`
   - `isCutBottom` si `maxY < tile.rect.y + tile.rect.h - 5`
5. Calculer la chute : la plus grande bande rectangle issue de la partie non utilisée
   - Si coupe horizontale seule → bande latérale : `chuteW = trim, chuteH = tileH`
   - Si coupe verticale seule → bande haute/basse : `chuteW = tileW, chuteH = trim`
   - Si coupe en coin → choisir la bande la plus grande en aire
   - Forcer à `0×0` si `chuteW < MIN_CHUTE_MM` ou `chuteH < MIN_CHUTE_MM`
6. Attribuer `tileW = tile.rect.w`, `tileH = tile.rect.h` (orientation réelle)
7. Attribuer `roomId` par proximité centre-tuile ↔ centre-pièce (logique actuelle conservée)

### `assignOffcuts(records)`

**Entrée/Sortie :** `CutRecord[]` (mutation in-place de `coveredById`/`reusedForId`).

**Algorithme :**

```
pool = []   // { w, h, edges, fromId, used }

records triés par (usedW × usedH) DÉCROISSANT

pour chaque record dans records:
  candidats = pool filtrés (non utilisés) où canReuseFor(chute, record)
  si candidats non vide:
    best = candidat avec la plus petite aire (w × h)  // best-fit
    best.used = true
    record.coveredById = best.fromId
    records.find(r => r.id === best.fromId).reusedForId = record.id
  sinon si record.chuteW >= MIN_CHUTE_MM ET record.chuteH >= MIN_CHUTE_MM:
    pool.push({ w: record.chuteW, h: record.chuteH,
                edges: record.chuteEdges, fromId: record.id, used: false })
```

`canReuseFor(chute, target)` — inchangé, essaie les 4 rotations (0°/90°/180°/270°) :
- La chute doit avoir `w ≥ target.usedW - 5` et `h ≥ target.usedH - 5`
- Pour chaque bord `factory` requis par `target.pieceEdges`, la chute doit aussi avoir `factory` sur ce bord (après rotation)

### `groupCuts(records)`

**Entrée :** `CutRecord[]`. **Sortie :** `CutGroup[]` triés par `netTiles × usedW × usedH` décroissant.

Clé de groupe : `${usedW}×${usedH}|${edgeKey(pieceEdges)}`

Pour chaque groupe :
- `totalCount` = nombre de records avec cette clé
- `reuseCount` = nombre de records avec `coveredById !== null`
- `netTiles = totalCount - reuseCount`
- `chuteW/H/Edges` = valeurs du premier record du groupe (représentatif)

### `analyzeQuantities(rooms, config)` — point d'entrée public (inchangé)

```
computeTilingMultiRoom(rooms, config) → { tiles, stats }
tileSpaceRooms(rooms, config.angle, cx, cy) → roomPolygons
buildCutTable(tiles, roomPolygons, config, roomIds) → cuts
assignOffcuts(cuts)
cutGroups = groupCuts(cuts)
```

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `src/engine/quantities/quantityEngine.ts` | Réécrire : extraire les 3 fonctions, corriger les bugs |
| `src/engine/quantities/buildCutTable.ts` | Créer : fonction `buildCutTable` |
| `src/engine/quantities/assignOffcuts.ts` | Créer : fonction `assignOffcuts` + `canReuseFor` |
| `src/engine/quantities/groupCuts.ts` | Créer : fonction `groupCuts` |
| `src/engine/quantities/buildCutTable.test.ts` | Créer : tests unitaires |
| `src/engine/quantities/assignOffcuts.test.ts` | Créer : tests unitaires |
| `src/engine/quantities/groupCuts.test.ts` | Créer : tests unitaires |
| `src/components/quantities/QuantitiesPanel.tsx` | Mettre à jour les imports (`CutDetail` → `CutRecord`) |

`cutCalculator.ts` (stats de base) — non touché.

---

## Plan de tests

### `buildCutTable.test.ts`

- Tuile STRAIGHT coupée à droite → `usedW < tileW`, bord droit `cut`, 3 autres bords `factory`
- Tuile STRAIGHT coupée en haut à gauche (coin) → bords gauche et haut `cut`, chute = bande la plus grande
- Tuile dont la chute mesure 40 mm × 200 mm → `chuteW = 0, chuteH = 0` (sous MIN_CHUTE_MM)
- Tuile CHEVRON avec `tile.points` (parallélogramme) → clipping sur les points réels, pas la bounding box
- Tuile HERRINGBONE en orientation H×W → `tileW = config.height`, `tileH = config.width`

### `assignOffcuts.test.ts`

- Grande coupe (chute 80×80) puis petite coupe (40×40) → petite couverte par chute de la grande
- Deux coupes sans chute suffisante → `coveredById = null` pour toutes
- Trois coupes identiques → 1ère génère chute, 2ème couverte, 3ème génère chute → 2 tuiles nettes
- Best-fit : deux chutes disponibles (60×60 et 150×150), coupe besoin 55×55 → utilise 60×60
- Rotation 90° : chute 80×40, coupe besoin 35×70 → couverte par rotation

### `groupCuts.test.ts`

- Deux records identiques (mêmes usedW/usedH/edges) → 1 groupe, `totalCount = 2`
- Un record avec `coveredById !== null` → `reuseCount = 1`, `netTiles = 1`
- Records 30×45 et 45×30 (même dimensions, orientations différentes) → 2 groupes distincts

---

## Ce qui ne change pas

- `PieceEdges`, `TileEdgeSide` — inchangés
- `tileSpaceRooms`, `ensureCCW` — conservés dans `quantityEngine.ts`
- `clipPolygon` (Sutherland-Hodgman) — inchangé
- `computeStats` dans `cutCalculator.ts` — inchangé
- Interface publique `analyzeQuantities` — même signature
- `QuantitiesPanel.tsx` — seul changement : `CutDetail` → `CutRecord` dans les imports
