# Merge Similar Cut Groups — Design Spec

## Goal

Simplifier le tableau des groupes de coupes en fusionnant les entrées dont les dimensions `usedW` et `usedH` sont toutes les deux dans un écart ≤ 2% l'une de l'autre. La fusion s'applique à la fois dans la vue interactive (`QuantitiesPanel`) et dans le document imprimé (`QuantitiesPrintView`). Le moteur (`analyzeQuantities`) reste inchangé.

## Architecture

Une fonction pure `mergeSimilarCutGroups(groups, tolerance)` transforme `CutGroup[]` en `MergedCutGroup[]`. Elle est appelée au moment du rendu dans les deux consommateurs. Aucun changement du contrat `QuantityResult`.

**Tech Stack :** TypeScript, Vitest

---

## Feature 1 — `mergeSimilarCutGroups`

### Fichier

`src/engine/quantities/mergeSimilarCutGroups.ts`

### Types

```ts
import type { CutGroup } from './types';

export interface MergedCutGroup extends CutGroup {
  /**
   * Indices des groupes originaux (dans le tableau cutGroups du moteur)
   * qui ont été fusionnés pour produire cette entrée.
   * Toujours au moins 1 élément.
   */
  originalIndices: number[];
}
```

### Signature

```ts
/**
 * Regroupe les CutGroups dont usedW et usedH sont tous deux dans
 * un écart ≤ tolerance (défaut 2%) l'un de l'autre.
 *
 * Algorithme : tri par (usedW, usedH) puis clustering glouton.
 * Valeurs représentatives : médiane de chaque dimension numérique.
 * Quantités : somme de netTiles, totalCount, reuseCount.
 */
export function mergeSimilarCutGroups(
  groups: CutGroup[],
  tolerance = 0.02,
): MergedCutGroup[];
```

### Algorithme détaillé

**Étape 1 — Tri**
Trier les groupes par `usedW` croissant, puis par `usedH` croissant (tri stable).
Conserver l'index original de chaque groupe avant le tri.

**Étape 2 — Clustering glouton**
Initialiser `clusters: { items: CutGroup[]; originalIndices: number[] }[] = []`.
Pour chaque groupe trié :
- Comparer avec le dernier cluster ouvert via la fonction `withinTolerance`.
- Si compatible → ajouter au cluster courant.
- Sinon → ouvrir un nouveau cluster.

**Fonction `withinTolerance`**
```ts
function withinTolerance(a: CutGroup, b: CutGroup, tol: number): boolean {
  const wOk = Math.abs(a.usedW - b.usedW) / Math.max(a.usedW, b.usedW) <= tol;
  const hOk = Math.abs(a.usedH - b.usedH) / Math.max(a.usedH, b.usedH) <= tol;
  return wOk && hOk;
}
```

Comparaison avec le **premier élément du cluster courant** (pas le dernier ajouté) — évite la dérive chaînée : si A≈B et B≈C mais A≉C, un seul cluster contenant A, B, C n'est pas formé.

**Étape 3 — Réduction de chaque cluster**

Pour un cluster de N groupes :
- `usedW` = médiane des `usedW`
- `usedH` = médiane des `usedH`
- `chuteW` = médiane des `chuteW`
- `chuteH` = médiane des `chuteH`
- `netTiles` = somme des `netTiles`
- `totalCount` = somme des `totalCount`
- `reuseCount` = somme des `reuseCount`
- `pieceEdges` = `pieceEdges` du groupe médian (index `Math.floor(N / 2)` dans le cluster trié)
- `chuteEdges` = `chuteEdges` du groupe médian
- `tileW`, `tileH` = valeurs du groupe médian (identiques dans un cluster cohérent)
- `originalIndices` = indices originaux des groupes fusionnés, dans leur ordre d'origine

**Calcul de la médiane**
```ts
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
```
Pour N pair : on prend l'élément en position `N/2` (arrondi bas) — pas de moyenne, pour rester sur une valeur réelle.

### Cas limites

- Tableau vide → retourne `[]`
- Un seul groupe → retourne `[{ ...group, originalIndices: [0] }]`
- `tolerance = 0` → aucune fusion, chaque groupe devient un `MergedCutGroup` avec `originalIndices: [i]`
- Groupes avec `usedW` ou `usedH` à 0 → traités normalement (Math.max = 0 → division par 0). Protection : si `max(a, b) === 0`, considérer compatibles uniquement si les deux valeurs sont 0.

---

## Feature 2 — Intégration dans `QuantitiesPanel`

### Fichier

`src/components/quantities/QuantitiesPanel.tsx`

### Changement

```tsx
// Avant
{result.cutGroups.map((group, i) => (
  <CutGroupCard
    group={group}
    groupIndex={i}
    groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
    onHighlight={setHighlightGroup}
    ...
  />
))}
```

```tsx
// Après
const mergedGroups = mergeSimilarCutGroups(result.cutGroups);

{mergedGroups.map((group, i) => (
  <CutGroupCard
    group={group}
    groupIndex={i}
    groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
    onHighlight={(n) => setHighlightGroup(
      n === null ? null : group.originalIndices[0]! + 1
    )}
    ...
  />
))}
```

Le plan SVG continue d'utiliser les indices originaux du moteur — `originalIndices[0]` cible le premier groupe représentatif du cluster pour le highlight.

**Aucun changement à `CutGroupCard`** : il reçoit un `MergedCutGroup` (qui étend `CutGroup`) — compatibilité totale.

---

## Feature 3 — Intégration dans `QuantitiesPrintView`

### Fichier

`src/components/quantities/QuantitiesPrintView.tsx`

### Changement

Dans la section ⑥ (tableau des coupes) :

```tsx
const mergedGroups = mergeSimilarCutGroups(result.cutGroups);

{mergedGroups.map((group, i) => {
  const color = GROUP_COLORS[i % GROUP_COLORS.length]!;
  const hasBigChute = group.chuteW > 20 && group.chuteH > 20;
  // ...
})}
```

Les colonnes affichent :
- **Dimension** : `formatCm(group.usedW) × formatCm(group.usedH)` (valeurs médianes)
- **Qté** : `×{group.netTiles}` (somme)
- **Chute récupérable** : `formatCm(group.chuteW) × formatCm(group.chuteH)` (médiane) ou `—`
- **Carreaux source** : `{group.netTiles}` (somme)

---

## Tests

### `mergeSimilarCutGroups.test.ts`

Cas à couvrir :

1. **Tableau vide** → `[]`
2. **Un seul groupe** → `[{ ...group, originalIndices: [0] }]`
3. **Deux groupes hors tolérance** (ex. 300×300 et 600×300) → 2 lignes distinctes
4. **Deux groupes dans la tolérance** (ex. 600×300 et 600×306, écart H = 2%) → fusionnés, `usedH` médian = 300 ou 306, `netTiles` = somme
5. **Trois groupes dans la tolérance** (ex. 600×294, 600×300, 600×306) → 1 ligne, `usedH` médian = 300
6. **Dérive chaînée bloquée** : A (300×100), B (300×101), C (300×102) où A≈B et B≈C — avec comparaison au premier du cluster, vérifier que A≈C aussi (1% < 2%), donc 1 cluster
7. **Dérive chaînée bloquée 2** : A (300×100), B (300×101), C (300×103) où A≉C (3% > 2%) — vérifier 2 clusters : {A,B} et {C} — *Note : avec comparaison au premier, si A≉C alors C ouvre un nouveau cluster même si B≈C*
8. **Tolerance = 0** → aucune fusion
9. **`originalIndices` corrects** : vérifier que les indices référencent bien les positions dans le tableau original (avant tri)
10. **Somme des quantités** : `netTiles`, `totalCount`, `reuseCount` correctement sommés

---

## Fichiers modifiés/créés

| Fichier | Changement |
|---|---|
| `src/engine/quantities/mergeSimilarCutGroups.ts` | **Créé** — fonction pure + type `MergedCutGroup` |
| `src/engine/quantities/mergeSimilarCutGroups.test.ts` | **Créé** — 10 tests unitaires |
| `src/components/quantities/QuantitiesPanel.tsx` | **Modifié** — appel de `mergeSimilarCutGroups` avant le rendu des cartes |
| `src/components/quantities/QuantitiesPrintView.tsx` | **Modifié** — appel de `mergeSimilarCutGroups` dans le tableau des coupes |
