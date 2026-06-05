# Merge Similar Cut Groups — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner les groupes de coupes dont les dimensions sont dans un écart ≤ 2%, pour simplifier le tableau affiché dans `QuantitiesPanel` et `QuantitiesPrintView`.

**Architecture:** Fonction pure `mergeSimilarCutGroups(groups, tolerance)` dans le dossier engine ; les deux consommateurs l'appellent avant le rendu. Le moteur (`analyzeQuantities`) reste inchangé. `MergedCutGroup` étend `CutGroup` avec `originalIndices: number[]` pour conserver la traçabilité vers les groupes d'origine.

**Tech Stack:** TypeScript, React 18, Vitest

---

## Fichiers créés/modifiés

| Fichier | Rôle |
|---|---|
| `src/engine/quantities/mergeSimilarCutGroups.ts` | **Créé** — fonction pure + type `MergedCutGroup` |
| `src/engine/quantities/mergeSimilarCutGroups.test.ts` | **Créé** — 10 tests unitaires |
| `src/components/quantities/QuantitiesPanel.tsx` | **Modifié** — appel de `mergeSimilarCutGroups` avant rendu des cartes |
| `src/components/quantities/QuantitiesPrintView.tsx` | **Modifié** — appel de `mergeSimilarCutGroups` dans le tableau des coupes |

---

## Task 1 — `mergeSimilarCutGroups` : fonction pure + tests

**Files:**
- Create: `src/engine/quantities/mergeSimilarCutGroups.ts`
- Create: `src/engine/quantities/mergeSimilarCutGroups.test.ts`

**Contexte :**
- `CutGroup` (dans `src/engine/quantities/types.ts`) a les champs : `usedW`, `usedH`, `pieceEdges`, `chuteW`, `chuteH`, `chuteEdges`, `totalCount`, `reuseCount`, `netTiles`.
- L'algorithme trie par `(usedW, usedH)`, puis clustering glouton en comparant chaque nouveau groupe au **premier** élément du cluster courant (pour bloquer la dérive chaînée).
- Valeurs représentatives : médiane (`sorted[Math.floor(N/2)]`) pour toutes les dimensions numériques. `pieceEdges`/`chuteEdges` du groupe médian. Somme pour les compteurs.

- [ ] **Étape 1 : Écrire les tests**

Créer `src/engine/quantities/mergeSimilarCutGroups.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { mergeSimilarCutGroups } from './mergeSimilarCutGroups';
import type { CutGroup } from './types';

const PE_CUT  = { left: 'cut'     as const, right: 'factory' as const, top: 'factory' as const, bottom: 'factory' as const };
const PE_FACT = { left: 'factory' as const, right: 'cut'     as const, top: 'factory' as const, bottom: 'factory' as const };

const g = (usedW: number, usedH: number, extras: Partial<CutGroup> = {}): CutGroup => ({
  usedW, usedH,
  pieceEdges: PE_CUT, chuteEdges: PE_FACT,
  chuteW: 0, chuteH: 0,
  totalCount: 2, reuseCount: 0, netTiles: 2,
  ...extras,
});

describe('mergeSimilarCutGroups', () => {
  it('tableau vide → []', () => {
    expect(mergeSimilarCutGroups([])).toEqual([]);
  });

  it('un seul groupe → originalIndices: [0]', () => {
    const result = mergeSimilarCutGroups([g(600, 300)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.originalIndices).toEqual([0]);
    expect(result[0]!.usedW).toBe(600);
    expect(result[0]!.usedH).toBe(300);
  });

  it('deux groupes hors tolérance → 2 lignes distinctes', () => {
    // écart H: |300-600|/600 = 50% >> 2%
    const result = mergeSimilarCutGroups([g(600, 300), g(600, 600)]);
    expect(result).toHaveLength(2);
  });

  it('deux groupes dans la tolérance → fusionnés, netTiles sommé', () => {
    // écart H: |306-300|/306 = 1.96% ≤ 2%
    const result = mergeSimilarCutGroups([
      g(600, 300, { netTiles: 3, totalCount: 3 }),
      g(600, 306, { netTiles: 4, totalCount: 4 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.netTiles).toBe(7);
    expect(result[0]!.totalCount).toBe(7);
  });

  it('médiane correcte sur 3 groupes : 600×294, 600×300, 600×306 → usedH = 300', () => {
    const result = mergeSimilarCutGroups([
      g(600, 306),
      g(600, 294),
      g(600, 300),
    ]);
    expect(result).toHaveLength(1);
    // sorted usedH = [294, 300, 306], Math.floor(3/2) = 1 → 300
    expect(result[0]!.usedH).toBe(300);
    expect(result[0]!.usedW).toBe(600);
  });

  it('médiane de la chute correcte', () => {
    const result = mergeSimilarCutGroups([
      g(600, 294, { chuteW: 100, chuteH: 100 }),
      g(600, 300, { chuteW: 200, chuteH: 200 }),
      g(600, 306, { chuteW: 300, chuteH: 300 }),
    ]);
    // sorted chuteW = [100, 200, 300], idx 1 → 200
    expect(result[0]!.chuteW).toBe(200);
    expect(result[0]!.chuteH).toBe(200);
  });

  it('dérive chaînée autorisée : A≈B≈C et A≈C → 1 cluster', () => {
    // A(100) ≈ C(102) : |102-100|/102 = 1.96% ≤ 2%
    const result = mergeSimilarCutGroups([
      g(300, 100),
      g(300, 101),
      g(300, 102),
    ]);
    expect(result).toHaveLength(1);
    // sorted usedH = [100,101,102], idx 1 → 101
    expect(result[0]!.usedH).toBe(101);
  });

  it('dérive chaînée bloquée : A≈B mais A≉C → 2 clusters', () => {
    // A(100)≈B(101) (0.99%), A≉C(103) : |103-100|/103 = 2.91% > 2%
    // comparaison au PREMIER du cluster : C vs A → hors tolérance
    const result = mergeSimilarCutGroups([
      g(300, 100),
      g(300, 101),
      g(300, 103),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.originalIndices).toHaveLength(2); // {A, B}
    expect(result[1]!.originalIndices).toHaveLength(1); // {C}
  });

  it('tolerance = 0 → aucune fusion', () => {
    const result = mergeSimilarCutGroups(
      [g(600, 300), g(600, 301), g(600, 302)],
      0,
    );
    expect(result).toHaveLength(3);
  });

  it('originalIndices reflètent les positions dans le tableau original (avant tri)', () => {
    // Donné dans l'ordre inverse : C=306, B=300, A=294
    // Après tri : A(origIdx=2), B(origIdx=1), C(origIdx=0)
    const result = mergeSimilarCutGroups([
      g(600, 306), // origIdx 0
      g(600, 300), // origIdx 1
      g(600, 294), // origIdx 2
    ]);
    expect(result).toHaveLength(1);
    // originalIndices dans l'ordre après tri : [2, 1, 0]
    expect(result[0]!.originalIndices).toEqual([2, 1, 0]);
  });

  it('reuseCount sommé correctement', () => {
    const result = mergeSimilarCutGroups([
      g(600, 300, { totalCount: 4, reuseCount: 1, netTiles: 3 }),
      g(600, 304, { totalCount: 6, reuseCount: 2, netTiles: 4 }),
    ]);
    expect(result[0]!.reuseCount).toBe(3);
    expect(result[0]!.totalCount).toBe(10);
    expect(result[0]!.netTiles).toBe(7);
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/mergeSimilarCutGroups.test.ts
```

Expected: FAIL — module not found.

- [ ] **Étape 3 : Créer `mergeSimilarCutGroups.ts`**

Créer `src/engine/quantities/mergeSimilarCutGroups.ts` :

```ts
import type { CutGroup } from './types';

export interface MergedCutGroup extends CutGroup {
  /**
   * Indices des groupes originaux (positions dans le tableau cutGroups du moteur,
   * avant toute fusion) qui composent cette entrée. Toujours ≥ 1 élément.
   */
  originalIndices: number[];
}

function withinTolerance(a: CutGroup, b: CutGroup, tol: number): boolean {
  const maxW = Math.max(a.usedW, b.usedW);
  const maxH = Math.max(a.usedH, b.usedH);
  const wOk = maxW === 0 ? a.usedW === b.usedW : Math.abs(a.usedW - b.usedW) / maxW <= tol;
  const hOk = maxH === 0 ? a.usedH === b.usedH : Math.abs(a.usedH - b.usedH) / maxH <= tol;
  return wOk && hOk;
}

function median(sorted: number[]): number {
  // sorted doit déjà être trié croissant
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * Regroupe les CutGroups dont usedW et usedH sont tous deux dans un écart
 * ≤ tolerance (défaut 2%) par rapport au premier élément du cluster courant.
 *
 * Valeurs représentatives : médiane pour les dimensions numériques,
 * somme pour les compteurs, pieceEdges/chuteEdges du groupe médian.
 */
export function mergeSimilarCutGroups(
  groups: CutGroup[],
  tolerance = 0.02,
): MergedCutGroup[] {
  if (groups.length === 0) return [];

  // Associer chaque groupe à son index original avant le tri
  const tagged = groups.map((g, i) => ({ g, origIdx: i }));

  // Trier par usedW croissant, puis usedH croissant
  tagged.sort((a, b) => a.g.usedW - b.g.usedW || a.g.usedH - b.g.usedH);

  // Clustering glouton : comparaison au PREMIER du cluster courant
  const clusters: Array<{ items: typeof tagged }> = [];
  let current: typeof tagged = [];

  for (const item of tagged) {
    if (current.length === 0 || withinTolerance(current[0]!.g, item.g, tolerance)) {
      current.push(item);
    } else {
      clusters.push({ items: current });
      current = [item];
    }
  }
  clusters.push({ items: current });

  // Réduire chaque cluster en un MergedCutGroup
  return clusters.map(({ items }) => {
    const n = items.length;
    const medianIdx = Math.floor(n / 2);
    const representative = items[medianIdx]!;

    const usedWs  = [...items].sort((a, b) => a.g.usedW  - b.g.usedW ).map(x => x.g.usedW);
    const usedHs  = [...items].sort((a, b) => a.g.usedH  - b.g.usedH ).map(x => x.g.usedH);
    const chuteWs = [...items].sort((a, b) => a.g.chuteW - b.g.chuteW).map(x => x.g.chuteW);
    const chuteHs = [...items].sort((a, b) => a.g.chuteH - b.g.chuteH).map(x => x.g.chuteH);

    return {
      usedW:      median(usedWs),
      usedH:      median(usedHs),
      chuteW:     median(chuteWs),
      chuteH:     median(chuteHs),
      pieceEdges: representative.g.pieceEdges,
      chuteEdges: representative.g.chuteEdges,
      totalCount: items.reduce((s, x) => s + x.g.totalCount, 0),
      reuseCount: items.reduce((s, x) => s + x.g.reuseCount, 0),
      netTiles:   items.reduce((s, x) => s + x.g.netTiles,   0),
      originalIndices: items.map(x => x.origIdx),
    };
  });
}
```

- [ ] **Étape 4 : Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/mergeSimilarCutGroups.test.ts
```

Expected: PASS — 10/10 tests.

- [ ] **Étape 5 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/engine/quantities/mergeSimilarCutGroups.ts src/engine/quantities/mergeSimilarCutGroups.test.ts && git commit -m "feat(quantities): add mergeSimilarCutGroups — greedy clustering with 2% tolerance"
```

---

## Task 2 — Intégration dans `QuantitiesPanel`

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx`

**Contexte :** `QuantitiesPanel` mappe actuellement `result.cutGroups` directement vers des `CutGroupCard`. Le `onHighlight` appelle `setHighlightGroup(groupIndex + 1)` via `CutGroupCard` (comportement interne de la card). Après fusion, on intercepte ce callback pour passer l'index original (1-based) du premier groupe représentatif, afin que le highlight sur le plan SVG reste cohérent avec les données du moteur.

- [ ] **Étape 1 : Vérifier que les tests existants passent avant modification**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected: PASS.

- [ ] **Étape 2 : Modifier `QuantitiesPanel.tsx`**

Localiser l'import existant en haut du fichier et ajouter :

```tsx
import { mergeSimilarCutGroups } from '@/engine/quantities/mergeSimilarCutGroups';
```

Localiser le bloc de rendu des `CutGroupCard` (actuellement `result.cutGroups.map(...)`) et le remplacer :

```tsx
// AVANT
{result.cutGroups.map((group, i) => (
  <CutGroupCard
    key={`${group.usedW}×${group.usedH}|${group.pieceEdges.left}|${group.pieceEdges.right}|${group.pieceEdges.top}|${group.pieceEdges.bottom}`}
    group={group}
    groupIndex={i}
    groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
    tileW={result.tileW}
    tileH={result.tileH}
    tileColor={color}
    onHighlight={setHighlightGroup}
  />
))}
```

```tsx
// APRÈS
{mergeSimilarCutGroups(result.cutGroups).map((group, i) => (
  <CutGroupCard
    key={group.originalIndices.join(',')}
    group={group}
    groupIndex={i}
    groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
    tileW={result.tileW}
    tileH={result.tileH}
    tileColor={color}
    onHighlight={(n) => setHighlightGroup(
      n === null ? null : group.originalIndices[0]! + 1,
    )}
  />
))}
```

**Pourquoi `originalIndices[0]! + 1` :** le plan SVG utilise des indices 1-based dérivés des groupes bruts du moteur. `originalIndices[0]` est l'index 0-based du premier groupe représentatif dans `result.cutGroups`. Le `+1` aligne sur la convention du plan.

- [ ] **Étape 3 : Vérifier que les tests existants passent toujours**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected: PASS.

- [ ] **Étape 4 : Vérifier la suite complète**

```bash
cd /workspaces/Calpiweb && npx vitest run
```

Expected: PASS — tous les tests.

- [ ] **Étape 5 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/quantities/QuantitiesPanel.tsx && git commit -m "feat(quantities): QuantitiesPanel uses mergeSimilarCutGroups for cut card display"
```

---

## Task 3 — Intégration dans `QuantitiesPrintView`

**Files:**
- Modify: `src/components/quantities/QuantitiesPrintView.tsx`

**Contexte :** Le tableau des coupes dans `QuantitiesPrintView` mappe actuellement `result.cutGroups` ligne par ligne. On insère `mergeSimilarCutGroups` avant ce mapping. La structure du tableau (colonnes, styles) reste identique — seule la source de données change.

- [ ] **Étape 1 : Modifier `QuantitiesPrintView.tsx`**

Ajouter l'import en haut du fichier avec les autres imports engine :

```tsx
import { mergeSimilarCutGroups } from '@/engine/quantities/mergeSimilarCutGroups';
```

Localiser la section ⑥ (tableau des coupes) et remplacer `result.cutGroups.map(...)` :

```tsx
// AVANT
{result.cutGroups.length > 0 && (
  <div style={{ padding: '12px 24px 0' }}>
    ...
    <tbody>
      {result.cutGroups.map((group, i) => {
        const color = GROUP_COLORS[i % GROUP_COLORS.length]!;
        const hasBigChute = group.chuteW > 20 && group.chuteH > 20;
        const rowKey = `${group.usedW}×${group.usedH}|${group.pieceEdges.left}|${group.pieceEdges.right}`;
        return (
          <tr key={rowKey} ...>
```

```tsx
// APRÈS
{result.cutGroups.length > 0 && (
  <div style={{ padding: '12px 24px 0' }}>
    ...
    <tbody>
      {mergeSimilarCutGroups(result.cutGroups).map((group, i) => {
        const color = GROUP_COLORS[i % GROUP_COLORS.length]!;
        const hasBigChute = group.chuteW > 20 && group.chuteH > 20;
        const rowKey = group.originalIndices.join(',');
        return (
          <tr key={rowKey} ...>
```

Le reste du contenu de chaque `<tr>` reste identique (les champs `usedW`, `usedH`, `netTiles`, `chuteW`, `chuteH` sont présents sur `MergedCutGroup` avec les valeurs médianes/sommées).

- [ ] **Étape 2 : Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/quantities/QuantitiesPrintView.test.tsx
```

Expected: PASS — 10/10 tests.

- [ ] **Étape 3 : Vérifier la suite complète + TypeScript**

```bash
cd /workspaces/Calpiweb && npx vitest run && npx tsc --noEmit
```

Expected: PASS, no TypeScript errors.

- [ ] **Étape 4 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/quantities/QuantitiesPrintView.tsx && git commit -m "feat(print): QuantitiesPrintView uses mergeSimilarCutGroups for cut table"
```
