# Mobile Portrait — Éditeur de projet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les trois zones de l'éditeur de projet illisibles en portrait mobile : topbar projet, barre de contrôles du calepinage (Angle/Décal), et la page Quantitatif.

**Architecture:** Pure Tailwind CSS responsive classes (`hidden md:flex`, `flex-col md:flex-row`) pour la topbar et les contrôles de calepinage. State-driven pour la Quantitatif (ajout d'un état `mobileTab` identique au pattern Aperçu/Réglages du TilingEditor). Aucun nouveau composant, aucun nouveau store.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS (`md:` breakpoint 768px), Vitest + @testing-library/react.

---

## File map

| Fichier | Changement |
|---------|------------|
| `src/app/project/[id]/page.tsx` | Masquage/affichage conditionnel dans la topbar |
| `src/components/tiling/TilingEditor.tsx` | Barre de contrôles en 2 lignes sur mobile |
| `src/components/quantities/QuantitiesPanel.tsx` | Grid 2×2, onglets Plan/Coupes, header empilé |

---

### Task 1 : Topbar projet — mobile portrait

**Files:**
- Modify: `src/app/project/[id]/page.tsx`

**Contexte :** La topbar contient en une seule ligne : logo CaléPlan, séparateur, fil d'ariane ("Projets › nom"), séparateur, badge statut, infos client, actions (thème / PDF / settings / avatar). Sur 375px en portrait, tout déborde. On masque les éléments non essentiels et on ajoute un bouton retour icon-only mobile.

Les icônes Lucide déjà importées : `FileDown, LogOut, Moon, Settings, Sun, Trash2, X`. On ajoute `ChevronLeft`.

- [ ] **Step 1 : Ajouter `ChevronLeft` aux imports Lucide**

Ligne actuelle (~ligne 3) :
```tsx
import { FileDown, LogOut, Moon, Settings, Sun, Trash2, X } from 'lucide-react';
```

Remplacer par :
```tsx
import { ChevronLeft, FileDown, LogOut, Moon, Settings, Sun, Trash2, X } from 'lucide-react';
```

- [ ] **Step 2 : Masquer le logo sur mobile**

Trouver :
```tsx
        {/* Logo */}
        <div className="flex items-center gap-2 mr-3">
```

Remplacer par :
```tsx
        {/* Logo */}
        <div className="hidden md:flex items-center gap-2 mr-3">
```

- [ ] **Step 3 : Masquer le premier séparateur sur mobile**

Trouver :
```tsx
        <div className="h-4 w-px mx-3" style={{ background: 'var(--bdr)' }} />

        {/* Breadcrumb */}
```

Remplacer par :
```tsx
        <div className="hidden md:block h-4 w-px mx-3" style={{ background: 'var(--bdr)' }} />

        {/* Mobile-only back button */}
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex md:hidden btn-icon mr-1"
          aria-label="Retour aux projets"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Breadcrumb */}
```

- [ ] **Step 4 : Masquer "Projets" et le chevron dans le fil d'ariane sur mobile**

Trouver :
```tsx
          <button type="button" onClick={() => router.push('/dashboard')} className="hover:underline" style={{ color: 'var(--text2)' }}>
            Projets
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
```

Remplacer par :
```tsx
          <button type="button" onClick={() => router.push('/dashboard')} className="hover:underline hidden md:inline" style={{ color: 'var(--text2)' }}>
            Projets
          </button>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="hidden md:block" style={{ opacity: 0.4 }}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
```

- [ ] **Step 5 : Masquer le second séparateur sur mobile**

Trouver :
```tsx
        <div className="mx-3 h-4 w-px" style={{ background: 'var(--bdr)' }} />

        {/* Status badge */}
```

Remplacer par :
```tsx
        <div className="hidden md:block mx-3 h-4 w-px" style={{ background: 'var(--bdr)' }} />

        {/* Status badge */}
```

- [ ] **Step 6 : Masquer le badge statut sur mobile**

Trouver :
```tsx
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-75 ${STATUS_CLASS[activeProject.status]}`}
```

Remplacer par :
```tsx
          className={`hidden md:inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-75 ${STATUS_CLASS[activeProject.status]}`}
```

- [ ] **Step 7 : Masquer le bloc client sur mobile**

Trouver :
```tsx
          <div className="mx-3 flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
```

Remplacer par :
```tsx
          <div className="hidden md:flex mx-3 items-center gap-1.5 text-[12px]" style={{ color: 'var(--muted)' }}>
```

- [ ] **Step 8 : Masquer le bouton PDF sur mobile**

Trouver :
```tsx
            className="btn-secondary flex items-center gap-1.5 text-[12.5px]"
```

Remplacer par :
```tsx
            className="hidden md:flex btn-secondary items-center gap-1.5 text-[12.5px]"
```

- [ ] **Step 9 : TypeScript + tests**

```bash
npx tsc --noEmit 2>&1 | head -20
npx vitest run 2>&1 | tail -10
```

Expected : aucune erreur TypeScript, tous les tests passent.

- [ ] **Step 10 : Commit**

```bash
git add src/app/project/\[id\]/page.tsx
git commit -m "fix(mobile): simplify project topbar for portrait mode"
```

---

### Task 2 : Barre de contrôles Calepinage — mobile portrait

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx`

**Contexte :** La barre inférieure (`absolute bottom-4`) contient en flex-row : bouton Côtes + Angle slider + Décal.X slider + Décal.Y slider. Déborde sur 375px. On la passe en 2 lignes sur mobile en regroupant Côtes+Angle sur la ligne 1 et Décal.X+Décal.Y sur la ligne 2.

- [ ] **Step 1 : Restructurer le conteneur et les contrôles**

Trouver le bloc complet (~ligne 265–310) :
```tsx
        {/* Bottom controls: angle + offsets */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md">
          {/* Dimensions toggle */}
          <button
            type="button"
            onClick={() => setActiveTool((t) => t === 'dimension' ? 'pan' : 'dimension')}
            title="Placer des côtes (Échap pour quitter)"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
              activeTool === 'dimension'
                ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
                : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500'
            }`}
          >
            <Ruler size={12} /> Côtes
          </button>
          <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Angle</span>
            <input
              type="range" min="0" max="90" step="1"
              value={config.angle}
              onChange={(e) => setConfig({ ...config, angle: parseInt(e.target.value, 10) })}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-10 font-mono text-xs font-bold text-orange-400">{config.angle}°</span>
          </div>
          <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Décal. X</span>
            <input
              type="range" min="0" max={config.width + config.joint} step="1"
              value={Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetX: parseInt(e.target.value, 10) })}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Décal. Y</span>
            <input
              type="range" min="0" max={config.height + config.joint} step="1"
              value={Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetY: parseInt(e.target.value, 10) })}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
          </div>
        </div>
```

Remplacer par :
```tsx
        {/* Bottom controls: angle + offsets — 2 rows on mobile, 1 row on desktop */}
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md w-[calc(100%-2rem)] md:w-auto">
          {/* Row 1 (mobile) : Côtes + Angle */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTool((t) => t === 'dimension' ? 'pan' : 'dimension')}
              title="Placer des côtes (Échap pour quitter)"
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTool === 'dimension'
                  ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
                  : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500'
              }`}
            >
              <Ruler size={12} /> Côtes
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
            <div className="flex flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Angle</span>
              <input
                type="range" min="0" max="90" step="1"
                value={config.angle}
                onChange={(e) => setConfig({ ...config, angle: parseInt(e.target.value, 10) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
              />
              <span className="w-8 font-mono text-xs font-bold text-orange-400">{config.angle}°</span>
            </div>
          </div>
          {/* Separator — desktop only */}
          <div className="hidden md:block h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          {/* Row 2 (mobile) : Décal X + Décal Y */}
          <div className="flex w-full items-center gap-3 md:gap-2.5">
            <div className="flex flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Déc. X</span>
              <input
                type="range" min="0" max={config.width + config.joint} step="1"
                value={Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}
                onChange={(e) => setConfig({ ...config, offsetX: parseInt(e.target.value, 10) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
              />
            </div>
            <div className="flex flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Déc. Y</span>
              <input
                type="range" min="0" max={config.height + config.joint} step="1"
                value={Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}
                onChange={(e) => setConfig({ ...config, offsetY: parseInt(e.target.value, 10) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
              />
            </div>
          </div>
        </div>
```

- [ ] **Step 2 : TypeScript + tests**

```bash
npx tsc --noEmit 2>&1 | head -20
npx vitest run src/components/tiling/TilingEditor.test.tsx 2>&1 | tail -15
```

Expected : aucune erreur TypeScript, tests existants passent.

- [ ] **Step 3 : Commit**

```bash
git add src/components/tiling/TilingEditor.tsx
git commit -m "fix(mobile): tiling controls bar 2-row layout on portrait mobile"
```

---

### Task 3 : QuantitiesPanel — mobile portrait

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx`
- Modify: `src/components/quantities/QuantitiesPanel.test.tsx`

**Contexte :** Trois zones à corriger : (1) header infos sur une ligne → flex-col, (2) stat strip `grid-cols-4` → `grid-cols-2 md:grid-cols-4`, (3) corps 2 colonnes → onglets internes "Plan" / "Coupes" sur mobile. Pattern identique à TilingEditor (état `mobileTab`, barre d'onglets `md:hidden`).

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `src/components/quantities/QuantitiesPanel.test.tsx`, avant la dernière `});` fermante :

```tsx
  it('renders Plan and Coupes mobile tab buttons', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByRole('button', { name: 'Plan' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Coupes' })).toBeDefined();
  });

  it('plan section is visible by default (no hidden class)', () => {
    render(<QuantitiesPanel />);
    const planSection = screen.getByTestId('plan-section');
    expect(planSection.className).not.toContain('hidden');
  });

  it('clicking Coupes tab adds hidden class to plan section', () => {
    render(<QuantitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Coupes' }));
    const planSection = screen.getByTestId('plan-section');
    expect(planSection.className).toContain('hidden');
  });

  it('clicking Plan tab removes hidden class from plan section', () => {
    render(<QuantitiesPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Coupes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    const planSection = screen.getByTestId('plan-section');
    expect(planSection.className).not.toContain('hidden');
  });
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx 2>&1 | tail -20
```

Expected : FAIL — les 4 nouveaux tests échouent (boutons Plan/Coupes introuvables, data-testid manquant).

- [ ] **Step 3 : Implémenter les changements dans QuantitiesPanel.tsx**

Remplacer le contenu complet de `src/components/quantities/QuantitiesPanel.tsx` par :

```tsx
'use client';

import { useMemo, useState } from 'react';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { formatCm, formatM2 } from '@/utils/formatters';
import { QuantityPlanView } from './QuantityPlanView';
import { CutGroupCard, GROUP_COLORS } from './CutGroupCard';

export const QuantitiesPanel = () => {
  const project = useProjectStore(selectActiveProject);
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<'plan' | 'coupes'>('plan');

  const result = useMemo(() => {
    if (!project) return null;
    return analyzeQuantities(project.rooms, project.config, project.wallThickness);
  }, [project]);

  if (!project || !result) return null;

  if (result.totalTiles === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-400 dark:text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project.config.color;
  const totalCutArea = result.cuts.reduce((sum, c) => sum + c.usedW * c.usedH, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 md:px-8 py-4 md:py-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">Tableau des quantités</h2>
        <div className="mt-0.5 flex flex-col gap-0.5 md:flex-row text-xs text-gray-400 dark:text-zinc-500">
          <span>Format&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{tileLabel}</span></span>
          <span className="hidden md:inline mx-1">—</span>
          <span>Joint&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{result.joint}&nbsp;mm</span></span>
          <span className="hidden md:inline mx-1">—</span>
          <span>Surface&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{formatM2(result.roomArea)}</span></span>
        </div>
      </div>

      {/* Stat strip */}
      <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 md:px-8 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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

      {/* Mobile tab bar */}
      <div className="flex shrink-0 border-b border-gray-200 dark:border-zinc-800 md:hidden" style={{ background: 'var(--surf, #fff)' }}>
        {(['plan', 'coupes'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className="flex-1 py-2.5 text-[13px] font-semibold transition-colors"
            style={mobileTab === tab
              ? { borderBottom: '2px solid var(--accent, #f97316)', color: 'var(--accent, #f97316)' }
              : { borderBottom: '2px solid transparent', color: 'var(--text2, #6b7280)' }
            }
          >
            {tab === 'plan' ? 'Plan' : 'Coupes'}
          </button>
        ))}
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — annotated plan */}
        <div
          data-testid="plan-section"
          className={`flex flex-1 flex-col gap-3 overflow-hidden border-r border-gray-200 dark:border-zinc-800 p-5 ${mobileTab === 'coupes' ? 'hidden md:flex' : 'flex'}`}
        >
          <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
            Plan de calepinage annoté
          </h3>
          <QuantityPlanView
            result={result}
            config={project.config}
            rooms={project.rooms}
            highlightGroup={highlightGroup}
          />
        </div>

        {/* Right — cut groups */}
        {sidebarOpen ? (
          <div
            data-testid="coupes-section"
            className={`${mobileTab === 'plan' ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] shrink-0 flex-col gap-4 overflow-y-auto p-5`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                Groupes de coupes
              </h3>
              <button
                className="hidden md:flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
          <div className="hidden md:flex w-8 shrink-0 items-center justify-center border-l border-gray-200 dark:border-zinc-800">
            <button
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              onClick={() => setSidebarOpen(true)}
              aria-label="Afficher le panneau"
            >
              ‹
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx 2>&1 | tail -20
```

Expected : 9/9 tests PASS (5 existants + 4 nouveaux).

- [ ] **Step 5 : TypeScript + suite complète**

```bash
npx tsc --noEmit 2>&1 | head -20
npx vitest run 2>&1 | tail -10
```

Expected : aucune erreur TypeScript, tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.test.tsx
git commit -m "fix(mobile): quantities panel — 2x2 stat grid and Plan/Coupes tabs on portrait mobile"
```
