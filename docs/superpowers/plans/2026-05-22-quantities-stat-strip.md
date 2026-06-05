# Stat Strip Redesign + Panneau Masquable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compacter le stat strip (4 boîtes : Entiers / À couper / Récupérées / Total), clarifier la formule du total, et rendre le panneau latéral de coupes masquable.

**Architecture:** Un seul fichier modifié — `QuantitiesPanel.tsx`. Task 1 : stat strip (grille 3→4, paddings réduits, nouvelle boîte "Récupérées", formule explicite). Task 2 : état `sidebarOpen` + rendu conditionnel du panneau droit.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

---

## Fichiers touchés

- Modify: `src/components/quantities/QuantitiesPanel.tsx`
- Modify: `src/components/quantities/QuantitiesPanel.test.tsx`

---

## Task 1 : Stat strip compact + boîte "Récupérées"

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.test.tsx`
- Modify: `src/components/quantities/QuantitiesPanel.tsx` (stat strip uniquement, lignes 48–77)

### Contexte

Le stat strip actuel a 3 boîtes sur `grid-cols-3` avec `py-3` et `text-2xl`. Il manque une boîte "Récupérées" pour expliquer la formule du total. La nouvelle formule montre `{wholeCount} + ({cuts.length}−{totalReuseCount}) = {totalTiles} × 1.10`.

### Mock dans le test

Le mock `analyzeQuantities` retourne `totalReuseCount: 0`. La boîte "Récupérées" affichera donc `0` avec un chiffre grisé. C'est le comportement attendu.

- [ ] **Step 1 : Ajouter le test qui échoue**

Dans `src/components/quantities/QuantitiesPanel.test.tsx`, ajouter à la fin du `describe` :

```tsx
  it('renders "Récupérées" stat box', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Récupérées')).toBeDefined();
  });
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected : FAIL sur le nouveau test — "Récupérées" n'est pas encore dans le DOM.

- [ ] **Step 3 : Remplacer le bloc stat strip dans QuantitiesPanel.tsx**

Remplacer l'intégralité du div `{/* Stat strip */}` (de la ligne `<div className="shrink-0 border-b...py-4">` jusqu'à son `</div>` fermant) par :

```tsx
      {/* Stat strip */}
      <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-3">
        <div className="grid grid-cols-4 gap-4">
          {/* Carreaux entiers */}
          <div className="rounded-xl border-l-[3px] border-blue-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
            <div className="text-xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.wholeCount}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Carreaux entiers</div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{formatM2(result.wholeCount * result.tileW * result.tileH)}</div>
          </div>
          {/* Carreaux à couper */}
          <div className="rounded-xl border-l-[3px] border-orange-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
            <div className="text-xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.cuts.length}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Carreaux à couper</div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{formatM2(totalCutArea)} posés</div>
          </div>
          {/* Récupérées */}
          <div className="rounded-xl border-l-[3px] border-emerald-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
            <div className={`text-xl font-black tabular-nums ${result.totalReuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-600'}`}>
              {result.totalReuseCount}
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Récupérées</div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
              {result.totalReuseCount > 0 ? 'dans une chute' : '—'}
            </div>
          </div>
          {/* Total à commander */}
          <div className="flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-500/80">Total à commander</div>
              <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
                {result.wholeCount} + ({result.cuts.length}−{result.totalReuseCount}) = {result.totalTiles} × 1.10
              </div>
              <div className="text-[11px] text-orange-400/70">{formatM2(result.toOrder * result.tileW * result.tileH)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-black tabular-nums text-orange-400">{result.toOrder}</div>
              <div className="text-[10px] font-bold text-orange-500/60">carreaux</div>
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected : 5 passed (5)

- [ ] **Step 5 : Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.test.tsx
git commit -m "feat(quantities): compact stat strip + Récupérées box + explicit formula"
```

---

## Task 2 : Panneau latéral masquable

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.test.tsx`
- Modify: `src/components/quantities/QuantitiesPanel.tsx` (body section uniquement)

### Contexte

La section `{/* Two-column body */}` contient deux colonnes : plan (flex-1) et groupes de coupes (w-[360px]). On ajoute un état `sidebarOpen` et on remplace le panneau droit par un rendu conditionnel : quand fermé, une bande `w-8` avec un bouton `‹` pour rouvrir.

- [ ] **Step 1 : Mettre à jour l'import dans le test**

Dans `src/components/quantities/QuantitiesPanel.test.tsx`, ligne 1, ajouter `fireEvent` à l'import :

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```

- [ ] **Step 2 : Ajouter le test qui échoue**

Dans `src/components/quantities/QuantitiesPanel.test.tsx`, ajouter à la fin du `describe` :

```tsx
  it('hides and shows the cut groups sidebar', () => {
    render(<QuantitiesPanel />);
    const closeBtn = screen.getByLabelText('Masquer le panneau');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Groupes de coupes')).toBeNull();
    const openBtn = screen.getByLabelText('Afficher le panneau');
    fireEvent.click(openBtn);
    expect(screen.getByText('Groupes de coupes')).toBeDefined();
  });
```

- [ ] **Step 3 : Vérifier que le test échoue**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected : FAIL — `getByLabelText('Masquer le panneau')` ne trouve rien.

- [ ] **Step 4 : Ajouter l'état sidebarOpen**

Dans `src/components/quantities/QuantitiesPanel.tsx`, dans le corps du composant, après la ligne `const [highlightGroup, setHighlightGroup] = useState<number | null>(null);`, ajouter :

```tsx
  const [sidebarOpen, setSidebarOpen] = useState(true);
```

- [ ] **Step 5 : Remplacer le panneau droit dans le body**

Dans `src/components/quantities/QuantitiesPanel.tsx`, remplacer le commentaire `{/* Right — cut groups */}` et tout son contenu (le `<div className="flex w-[360px] shrink-0...">` jusqu'à son `</div>` fermant) par :

```tsx
        {/* Right — cut groups */}
        {sidebarOpen ? (
          <div className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                Groupes de coupes
              </h3>
              <button
                className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                onClick={() => setSidebarOpen(false)}
                aria-label="Masquer le panneau"
              >
                ›
              </button>
            </div>
            <div className="flex flex-col gap-2">
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
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-zinc-800 pt-3 text-xs">
              <span className="text-gray-400 dark:text-zinc-500">Carreaux nets pour coupes</span>
              <span className="font-mono font-black text-gray-900 dark:text-zinc-100">{result.tilesForCuts} carreaux</span>
            </div>
          </div>
        ) : (
          <div className="flex w-8 shrink-0 items-center justify-center border-l border-gray-200 dark:border-zinc-800">
            <button
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              onClick={() => setSidebarOpen(true)}
              aria-label="Afficher le panneau"
            >
              ‹
            </button>
          </div>
        )}
```

- [ ] **Step 6 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected : 6 passed (6)

- [ ] **Step 7 : Lancer la suite complète**

```bash
npx vitest run src/components/quantities/
```

Expected : 18 passed (18) — aucune régression.

- [ ] **Step 8 : Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.test.tsx
git commit -m "feat(quantities): collapsible cut groups sidebar"
```
