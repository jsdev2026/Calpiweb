# Quantities Panel — Bandeaux repliables + Zoom/Pan du plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le repli automatique des bandeaux au scroll dans QuantitiesPanel, et le zoom/pan du plan SVG dans QuantityPlanView.

**Architecture:** Task 1 modifie QuantitiesPanel (état `collapsed`/`pinned`, handler scroll, bandeau résiduel). Task 2 modifie QuantityPlanView (state viewBox, listeners `wheel`/`touchmove` passifs, handlers souris, bouton reset). Aucune librairie externe, aucun changement de moteur.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, SVG natif, événements DOM natifs

---

### Task 1 : Bandeaux repliables dans `QuantitiesPanel`

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx`
- Modify: `src/components/quantities/QuantitiesPanel.test.tsx`

---

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `src/components/quantities/QuantitiesPanel.test.tsx`, ajouter ces 5 tests à la fin du `describe` existant (après le dernier `it`) :

```tsx
  it('collapsed-bar is absent by default', () => {
    render(<QuantitiesPanel />);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('coupes scroll > 20px shows collapsed-bar', () => {
    render(<QuantitiesPanel />);
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.getByTestId('collapsed-bar')).toBeDefined();
  });

  it('"▲ Afficher" button restores bandeaux', () => {
    render(<QuantitiesPanel />);
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    fireEvent.click(screen.getByLabelText('Afficher les statistiques'));
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('scroll back to top auto-restores when not pinned', () => {
    render(<QuantitiesPanel />);
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    Object.defineProperty(coupes, 'scrollTop', { value: 0, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('pin prevents auto-collapse on scroll', () => {
    render(<QuantitiesPanel />);
    fireEvent.click(screen.getByLabelText('Épingler les statistiques'));
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx --reporter=verbose 2>&1 | tail -20
```

Attendu : 5 nouveaux tests FAIL (collapsed-bar absent by default, etc.) + les 9 existants PASS.

- [ ] **Step 3 : Réécrire `QuantitiesPanel.tsx` avec le collapse**

Remplacer intégralement le contenu de `src/components/quantities/QuantitiesPanel.tsx` par :

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
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);

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

  const handleCoupesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (pinned) return;
    setCollapsed(e.currentTarget.scrollTop > 20);
  };

  const handlePin = () => {
    const next = !pinned;
    setPinned(next);
    if (next) setCollapsed(false); // épingler = toujours montrer
  };

  const PinButton = ({ inBar }: { inBar: boolean }) => (
    <button
      type="button"
      aria-label={pinned ? 'Désépingler les statistiques' : 'Épingler les statistiques'}
      title={pinned ? 'Statistiques épinglées — cliquer pour désépingler' : 'Épingler pour garder les statistiques visibles'}
      onClick={handlePin}
      className={`shrink-0 rounded p-1 text-sm leading-none transition-colors ${
        inBar ? '' : 'mt-0.5'
      } ${
        pinned
          ? 'text-orange-500 hover:text-orange-600'
          : 'text-gray-300 hover:text-gray-500 dark:text-zinc-600 dark:hover:text-zinc-400'
      }`}
    >
      📌
    </button>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">

      {/* ── Bandeaux repliables ── */}
      <div
        data-testid="bandeaux-wrapper"
        style={{
          maxHeight: collapsed ? 0 : 400,
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'max-height 0.25s ease, opacity 0.2s ease',
        }}
      >
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 md:px-8 py-4 md:py-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">Tableau des quantités</h2>
              <div className="mt-0.5 flex flex-col gap-0.5 md:flex-row text-xs text-gray-400 dark:text-zinc-500">
                <span>Format&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{tileLabel}</span></span>
                <span className="hidden md:inline mx-1">—</span>
                <span>Joint&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{result.joint}&nbsp;mm</span></span>
                <span className="hidden md:inline mx-1">—</span>
                <span>Surface&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{formatM2(result.roomArea)}</span></span>
              </div>
            </div>
            <PinButton inBar={false} />
          </div>
        </div>

        {/* Stat strip */}
        <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 md:px-8 py-3">
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
      </div>

      {/* ── Bandeau résiduel (visible uniquement quand collapsed) ── */}
      {collapsed && (
        <div
          data-testid="collapsed-bar"
          className="flex shrink-0 items-center gap-2 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-1.5"
        >
          <span className="flex-1 truncate text-xs font-semibold text-gray-400 dark:text-zinc-500">
            Tableau des quantités
          </span>
          <button
            type="button"
            aria-label="Afficher les statistiques"
            onClick={() => setCollapsed(false)}
            className="shrink-0 rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            ▲ Afficher
          </button>
          <PinButton inBar={true} />
        </div>
      )}

      {/* ── Mobile tab bar ── */}
      <div role="tablist" className="flex shrink-0 border-b border-gray-200 dark:border-zinc-800 md:hidden" style={{ background: 'var(--surf, #fff)' }}>
        {(['plan', 'coupes'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab}
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

      {/* ── Corps deux colonnes ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Gauche — plan annoté */}
        <div
          data-testid="plan-section"
          className={`flex-1 border-r border-gray-200 dark:border-zinc-800 ${mobileTab === 'coupes' ? 'hidden md:block' : 'block'}`}
        >
          <div className="flex h-full flex-col gap-3 overflow-hidden p-5">
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
        </div>

        {/* Droite — groupes de coupes */}
        {sidebarOpen ? (
          <div
            data-testid="coupes-section"
            onScroll={handleCoupesScroll}
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
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx --reporter=verbose 2>&1 | tail -20
```

Attendu : 14 tests PASS (9 existants + 5 nouveaux).

- [ ] **Step 5 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error|warning" | head -10
```

Attendu : aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.test.tsx
git commit -m "feat(quantities): collapsible bandeaux with auto-hide on scroll and pin lock"
```

---

### Task 2 : Zoom et panoramique dans `QuantityPlanView`

**Files:**
- Modify: `src/components/quantities/QuantityPlanView.tsx`
- Modify: `src/components/quantities/QuantityPlanView.test.tsx`

**Contexte :** Le SVG actuel utilise un `viewBox` calculé depuis les pièces (fit-to-view statique). On va stocker ce viewBox en state et le modifier dynamiquement via wheel/drag/pinch. Le bouton "⊙ Ajuster" réinitialise au viewBox d'origine.

---

- [ ] **Step 7 : Écrire les tests qui échouent**

Dans `src/components/quantities/QuantityPlanView.test.tsx`, ajouter ces 4 tests à la suite des existants :

```tsx
  it('plan-wrapper has data-testid and cursor-grab class', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    const wrapper = container.querySelector('[data-testid="plan-wrapper"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain('cursor-grab');
  });

  it('⊙ Ajuster button is absent by default', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { queryByLabelText } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    expect(queryByLabelText('Ajuster la vue')).toBeNull();
  });

  it('⊙ Ajuster button appears after wheel event changes viewBox', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container, getByLabelText } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    const wrapper = container.querySelector('[data-testid="plan-wrapper"]')!;
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    fireEvent.wheel(wrapper, { deltaY: 100 });
    expect(getByLabelText('Ajuster la vue')).toBeDefined();
  });

  it('clicking ⊙ Ajuster resets viewBox (button disappears)', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container, getByLabelText, queryByLabelText } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    const wrapper = container.querySelector('[data-testid="plan-wrapper"]')!;
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    fireEvent.wheel(wrapper, { deltaY: 100 });
    fireEvent.click(getByLabelText('Ajuster la vue'));
    expect(queryByLabelText('Ajuster la vue')).toBeNull();
  });
```

Note : le fichier doit déjà importer `fireEvent` depuis `@testing-library/react`. Ajouter l'import si manquant :

```tsx
import { render, fireEvent } from '@testing-library/react';
```

- [ ] **Step 8 : Vérifier que les tests échouent**

```bash
npx vitest run src/components/quantities/QuantityPlanView.test.tsx --reporter=verbose 2>&1 | tail -20
```

Attendu : 4 nouveaux tests FAIL, 4 existants PASS.

- [ ] **Step 9 : Réécrire `QuantityPlanView.tsx` avec zoom/pan**

Remplacer intégralement le contenu de `src/components/quantities/QuantityPlanView.tsx` par :

```tsx
'use client';
import { useId, useRef, useState, useEffect } from 'react';
import type { QuantityResult, CutRecord } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { GROUP_COLORS } from './CutGroupCard';

export interface QuantityPlanViewProps {
  result: QuantityResult;
  config: TilingConfig;
  rooms: Room[];
  highlightGroup: number | null;
}

export const QuantityPlanView = ({ result, config, rooms, highlightGroup }: QuantityPlanViewProps) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `qty-plan-clip-${uid}`;

  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const allPoints = validRooms.flatMap((r) => r.points);

  // Bounding box (fallback si pas de pièces valides)
  const bbox = allPoints.length > 0
    ? getBoundingBox(allPoints)
    : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const pad = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.1;
  const initX = bbox.minX - pad;
  const initY = bbox.minY - pad;
  const initW = bbox.maxX - bbox.minX + pad * 2;
  const initH = bbox.maxY - bbox.minY + pad * 2;

  // ── Tous les hooks avant le return conditionnel ──
  const [vb, setVb] = useState({ x: initX, y: initY, w: initW, h: initH });
  const [dragging, setDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Ref miroir de vb pour les handlers natifs (évite les stale closures)
  const vbRef = useRef(vb);
  vbRef.current = vb;
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const touchRef = useRef<{ dist: number; midX: number; midY: number; vb: typeof vb } | null>(null);

  const isDirty =
    vb.x !== initX || vb.y !== initY || vb.w !== initW || vb.h !== initH;

  // ── Wheel (passive: false) + touchmove (passive: false) via useEffect ──
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const minW = initW * 0.1;
    const maxW = initW * 5;

    const clampAndApply = (uncW: number, uncH: number, svgMx: number, svgMy: number, mx: number, my: number, rectW: number, rectH: number) => {
      const nw = Math.max(minW, Math.min(maxW, uncW));
      const nh = uncH * (nw / uncW);
      return { x: svgMx - mx * (nw / rectW), y: svgMy - my * (nh / rectH), w: nw, h: nh };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setVb((prev) => {
        const svgMx = prev.x + mx * (prev.w / rect.width);
        const svgMy = prev.y + my * (prev.h / rect.height);
        return clampAndApply(prev.w * factor, prev.h * factor, svgMx, svgMy, mx, my, rect.width, rect.height);
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      if (e.touches.length === 1 && dragRef.current) {
        const touch = e.touches[0]!;
        const dx = touch.clientX - dragRef.current.x;
        const dy = touch.clientY - dragRef.current.y;
        dragRef.current = { x: touch.clientX, y: touch.clientY };
        setVb((prev) => ({
          ...prev,
          x: prev.x - dx * (prev.w / rect.width),
          y: prev.y - dy * (prev.h / rect.height),
        }));
      } else if (e.touches.length === 2 && touchRef.current) {
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        if (!newDist) return;
        const factor = touchRef.current.dist / newDist;
        const { midX, midY, vb: startVb } = touchRef.current;
        const mx = midX - rect.left;
        const my = midY - rect.top;
        const svgMx = startVb.x + mx * (startVb.w / rect.width);
        const svgMy = startVb.y + my * (startVb.h / rect.height);
        setVb(clampAndApply(startVb.w * factor, startVb.h * factor, svgMx, svgMy, mx, my, rect.width, rect.height));
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [initW, initH]);

  // ── Handlers souris (React synthetic events) ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const movX = e.movementX;
    const movY = e.movementY;
    setVb((prev) => ({
      ...prev,
      x: prev.x - movX * (prev.w / rect.width),
      y: prev.y - movY * (prev.h / rect.height),
    }));
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // ── Handlers touch start/end (React — pas besoin de preventDefault ici) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      touchRef.current = null;
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      touchRef.current = {
        dist,
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
        vb: vbRef.current,
      };
      dragRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    dragRef.current = null;
    touchRef.current = null;
  };

  const resetVb = () => setVb({ x: initX, y: initY, w: initW, h: initH });

  // ── Return conditionnel APRÈS tous les hooks ──
  if (validRooms.length === 0 || result.tiles.length === 0) return null;

  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const cutMap = new Map<string, CutRecord>(result.cuts.map((c) => [c.id, c]));
  const groupMap = new Map(
    result.cutGroups.map((g, i) => [
      `${g.usedW}×${g.usedH}|${g.pieceEdges.left}|${g.pieceEdges.right}|${g.pieceEdges.top}|${g.pieceEdges.bottom}`,
      { index: i, color: GROUP_COLORS[i % GROUP_COLORS.length]! },
    ]),
  );
  const labelSize = Math.min(config.width, config.height) * 0.15;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={wrapperRef}
        data-testid="plan-wrapper"
        className={`relative flex flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-950 select-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="h-full w-full"
          style={{ display: 'block' }}
        >
          <defs>
            <clipPath id={clipId}>
              {validRooms.map((room) => (
                <polygon
                  key={room.id}
                  points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </clipPath>
          </defs>

          {validRooms.map((room) => (
            <polygon
              key={`bg-${room.id}`}
              points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="var(--tile-joint)"
            />
          ))}

          <g clipPath={`url(#${clipId})`}>
            <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
              {result.tiles.map((tile) => {
                const cut = cutMap.get(tile.id);
                const isWhole = tile.type === 'WHOLE';
                const isReused = cut ? cut.coveredById !== null : false;

                const groupInfo = cut
                  ? groupMap.get(`${cut.usedW}×${cut.usedH}|${cut.pieceEdges.left}|${cut.pieceEdges.right}|${cut.pieceEdges.top}|${cut.pieceEdges.bottom}`)
                  : undefined;
                const groupColor = groupInfo?.color;
                const groupNumber = groupInfo ? groupInfo.index + 1 : null;

                let dimOpacity = 1;
                if (highlightGroup !== null) {
                  dimOpacity = !isWhole && groupNumber === highlightGroup ? 1 : 0.12;
                }
                const isHighlighted = highlightGroup !== null && !isWhole && groupNumber === highlightGroup;

                const fill = isWhole
                  ? config.color
                  : isReused && groupColor
                    ? groupColor
                    : 'var(--tile-cut-bg)';
                const fillOpacity = isWhole ? 0.7 : isReused ? 0.28 : 1;

                return (
                  <g
                    key={tile.id}
                    style={{
                      opacity: dimOpacity,
                      transition: 'opacity 0.15s ease, filter 0.15s ease',
                      filter: isHighlighted && groupColor ? `drop-shadow(0 0 8px ${groupColor}88)` : undefined,
                    }}
                  >
                    <rect
                      x={tile.rect.x}
                      y={tile.rect.y}
                      width={tile.rect.w}
                      height={tile.rect.h}
                      fill={fill}
                      fillOpacity={fillOpacity}
                    />
                    {cut && groupInfo && (
                      <>
                        <circle cx={cut.clipCx} cy={cut.clipCy} r={labelSize * 0.62} fill="rgba(0,0,0,0.50)" />
                        <text
                          x={cut.clipCx}
                          y={cut.clipCy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={labelSize}
                          fontWeight="600"
                          fontFamily="system-ui, -apple-system, sans-serif"
                          fill={groupColor ?? '#a1a1aa'}
                        >
                          {isReused ? '↩' : groupInfo.index + 1}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </g>

          {validRooms.map((room) =>
            room.points.map((p, i) => {
              const nextP = room.points[(i + 1) % room.points.length]!;
              const isDoor = (room.edges[i] ?? 'WALL') === 'DOOR';
              return (
                <line
                  key={`edge-${room.id}-${i}`}
                  x1={p.x} y1={p.y}
                  x2={nextP.x} y2={nextP.y}
                  stroke={isDoor ? '#f97316' : '#ea580c'}
                  strokeWidth={isDoor ? 50 : 80}
                  strokeLinecap="round"
                  strokeDasharray={isDoor ? '120,80' : undefined}
                />
              );
            }),
          )}
        </svg>

        {/* ── Bouton reset zoom (visible seulement si zoom/pan actif) ── */}
        {isDirty && (
          <button
            type="button"
            aria-label="Ajuster la vue"
            onClick={resetVb}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white hover:text-gray-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span aria-hidden>⊙</span> Ajuster
          </button>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 10 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/quantities/QuantityPlanView.test.tsx --reporter=verbose 2>&1 | tail -20
```

Attendu : 8 tests PASS (4 existants + 4 nouveaux).

- [ ] **Step 11 : Vérifier la suite complète**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -10
```

Attendu : 31 fichiers, 178 tests (169 + 5 + 4) PASS.

- [ ] **Step 12 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error" | head -10
```

Attendu : aucune erreur.

- [ ] **Step 13 : Commit**

```bash
git add src/components/quantities/QuantityPlanView.tsx src/components/quantities/QuantityPlanView.test.tsx
git commit -m "feat(quantities): SVG viewBox zoom/pan with wheel, drag, pinch and reset button"
```
