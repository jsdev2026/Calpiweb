# Stat Strip Redesign + Panneau Masquable — Design Spec

## Goal

Trois améliorations au panneau quantitatif : stat strip plus compact avec une 4e boîte "Récupérées", formule du total rendue explicite, et panneau latéral masquable pour voir le plan en plein écran.

## Architecture

Tout dans un seul fichier : `src/components/quantities/QuantitiesPanel.tsx`.

- Un état `sidebarOpen: boolean` contrôle la visibilité du panneau droit.
- La grille passe de `grid-cols-3` à `grid-cols-4` pour accueillir la nouvelle boîte.
- Les paddings et tailles de police sont réduits pour gagner de la hauteur.

---

## 1. Stat strip — compaction + 4e boîte

### Réductions de hauteur

| Élément | Avant | Après |
|---------|-------|-------|
| Conteneur outer du strip | `py-4` | `py-3` |
| Chaque boîte | `py-3` | `py-2` |
| Chiffre principal | `text-2xl` | `text-xl` |
| Grand chiffre Total | `text-3xl` | `text-2xl` |

### Grille

```tsx
<div className="grid grid-cols-4 gap-4">
```

### Boîte 1 — Carreaux entiers (inchangée sauf taille)

```tsx
<div className="rounded-xl border-l-[3px] border-blue-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
  <div className="text-xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.wholeCount}</div>
  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Carreaux entiers</div>
  <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{formatM2(result.wholeCount * result.tileW * result.tileH)}</div>
</div>
```

### Boîte 2 — Carreaux à couper (inchangée sauf taille)

```tsx
<div className="rounded-xl border-l-[3px] border-orange-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
  <div className="text-xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.cuts.length}</div>
  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Carreaux à couper</div>
  <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{formatM2(totalCutArea)} posés</div>
</div>
```

### Boîte 3 — Récupérées (NOUVELLE)

```tsx
<div className="rounded-xl border-l-[3px] border-emerald-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
  <div className={`text-xl font-black tabular-nums ${result.totalReuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-600'}`}>
    {result.totalReuseCount}
  </div>
  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Récupérées</div>
  <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
    {result.totalReuseCount > 0 ? 'dans une chute' : '—'}
  </div>
</div>
```

La boîte est toujours affichée (même à 0) pour garder le layout stable. Quand `totalReuseCount === 0` le chiffre est grisé.

### Boîte 4 — Total à commander (formule mise à jour)

La formule passe de `{wholeCount} + {tilesForCuts} = {totalTiles} × 1.10` à :

```
{wholeCount} + ({cuts.length}−{totalReuseCount}) = {totalTiles} × 1.10
```

Code complet :

```tsx
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
```

---

## 2. Panneau latéral masquable

### État

```tsx
const [sidebarOpen, setSidebarOpen] = useState(true);
```

(`useState` est déjà importé.)

### Layout conditionnel

Quand `sidebarOpen === true` : comportement actuel — panneau droit `w-[360px]` visible.

Quand `sidebarOpen === false` : panneau remplacé par une fine bande `w-8` contenant uniquement le bouton de réouverture.

### Panneau droit — structure complète conditionnelle

```tsx
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

---

## Tests à mettre à jour

`src/components/quantities/QuantitiesPanel.test.tsx` — 4 tests existants inchangés. Ajouter :

```tsx
it('renders "Récupérées" stat box', () => {
  render(<QuantitiesPanel />);
  expect(screen.getByText('Récupérées')).toBeDefined();
});

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

`fireEvent` doit être importé depuis `@testing-library/react` (l'ajouter à l'import existant si absent).
