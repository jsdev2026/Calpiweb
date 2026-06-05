# Mobile Portrait Fixes Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three remaining mobile portrait breakages in the project editor: topbar overflow, tiling controls overflow + bad position, and Plan 2D inaccessible tooling.

**Architecture:** Pure CSS/JSX restructuring — no new stores, no new routes, no new hooks. Single `md:` breakpoint throughout. Tasks are independent and can fail-fast without affecting each other.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react.

---

## File map

| File | Action |
|------|--------|
| `src/app/project/[id]/page.tsx` | Modify — `hidden md:block` on project name input |
| `src/components/tiling/TilingEditor.tsx` | Modify — `bottom-20 md:bottom-4`, split Déc. X / Y into separate rows |
| `src/components/plan/PlanToolbar.tsx` | Modify — add horizontal mobile toolbar variant |
| `src/components/plan/PlanEditor.tsx` | Modify — mobile room strip, hide shortcuts, zoom hint, remove old banner |

---

## Task 1: Topbar — masquer le nom du projet sur mobile

**Files:**
- Modify: `src/app/project/[id]/page.tsx` (~line 374)

The `<input>` for the project name has `minWidth: 120` via inline style. There is no existing `className` on it. Adding `className="hidden md:block"` makes it disappear on mobile while preserving the flex-1 space from its parent div.

- [ ] **Step 1: Add `className="hidden md:block"` to the project name input**

Find this block (~line 374):
```tsx
          <input
            type="text"
            value={activeProject.name}
            onChange={(e) => rename(activeProject.id, e.target.value)}
            readOnly={isReadOnly}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600,
              color: 'var(--text)', minWidth: 120, maxWidth: 260,
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surf2)'; e.target.style.borderRadius = 'var(--rs)'; e.target.style.padding = '2px 6px'; }}
            onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.padding = '0'; }}
          />
```

Replace with:
```tsx
          <input
            type="text"
            value={activeProject.name}
            onChange={(e) => rename(activeProject.id, e.target.value)}
            readOnly={isReadOnly}
            className="hidden md:block"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600,
              color: 'var(--text)', minWidth: 120, maxWidth: 260,
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surf2)'; e.target.style.borderRadius = 'var(--rs)'; e.target.style.padding = '2px 6px'; }}
            onBlur={(e) => { e.target.style.background = 'transparent'; e.target.style.padding = '0'; }}
          />
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "fix(mobile): hide project name input on portrait mobile topbar"
```

---

## Task 2: Contrôles calepinage — 3 lignes + position remontée

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx` (~lines 265–318)
- Modify: `src/components/tiling/TilingEditor.test.tsx`

Two changes:
1. `bottom-4` → `bottom-20 md:bottom-4` on the floating bar (80px clears iOS Safari nav bar)
2. The current Row 2 has Déc. X and Déc. Y **side-by-side** — they're cramped on 375px. Split them into two dedicated rows. On desktop (`md:flex-row`), all rows line up horizontally so each becomes an inline segment.

- [ ] **Step 1: Write the failing tests**

In `src/components/tiling/TilingEditor.test.tsx`, add after the existing `describe` block:

```tsx
describe('TilingEditor controls bar', () => {
  it('renders Déc. X and Déc. Y as separate rows', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    expect(screen.getByTestId('dec-x-row')).toBeDefined();
    expect(screen.getByTestId('dec-y-row')).toBeDefined();
  });

  it('controls bar className includes bottom-20', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    const bar = screen.getByTestId('controls-bar');
    expect(bar.className).toContain('bottom-20');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/tiling/TilingEditor.test.tsx
```

Expected: FAIL — `Unable to find an element by: [data-testid="dec-x-row"]`

- [ ] **Step 3: Replace the controls bar in TilingEditor.tsx**

Find the entire bottom controls block (~line 265) starting with:
```tsx
        {/* Bottom controls: angle + offsets — 2 rows on mobile, 1 row on desktop */}
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md w-[calc(100%-2rem)] md:w-auto">
```

Replace the entire block (ends at line 318 `</div>`) with:

```tsx
        {/* Bottom controls: 3 rows on mobile, 1 row on desktop */}
        <div
          data-testid="controls-bar"
          className="absolute bottom-20 md:bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md w-[calc(100%-2rem)] md:w-auto">
          {/* Row 1 : Côtes + Angle */}
          <div className="flex w-full items-center gap-2.5">
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
          {/* Separator Angle | Déc. (desktop only) */}
          <div className="hidden md:block h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          {/* Row 2 : Déc. X */}
          <div data-testid="dec-x-row" className="flex w-full items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Déc. X</span>
            <input
              type="range" min="0" max={config.width + config.joint} step="1"
              value={Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetX: parseInt(e.target.value, 10) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-7 font-mono text-[10px] font-bold text-orange-400">{Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}</span>
          </div>
          {/* Separator X | Y (desktop only) */}
          <div className="hidden md:block h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          {/* Row 3 : Déc. Y */}
          <div data-testid="dec-y-row" className="flex w-full items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Déc. Y</span>
            <input
              type="range" min="0" max={config.height + config.joint} step="1"
              value={Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetY: parseInt(e.target.value, 10) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-7 font-mono text-[10px] font-bold text-orange-400">{Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}</span>
          </div>
        </div>
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npx vitest run src/components/tiling/TilingEditor.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tiling/TilingEditor.tsx src/components/tiling/TilingEditor.test.tsx
git commit -m "fix(mobile): tiling controls 3-row layout and bottom-20 position on mobile"
```

---

## Task 3: PlanToolbar — variante horizontale mobile

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`
- Create: `src/components/plan/PlanToolbar.test.tsx`

The existing toolbar has `hidden md:flex` (desktop only). We add a second horizontal variant with `flex md:hidden` (mobile only) inside a React fragment. It renders as `absolute bottom-0 left-0 right-0 z-20` inside the canvas container, with `overflow-x-auto` for scrolling if needed. `z-20` places it above the touch overlay (`z-10`).

`WallThicknessControl` is omitted from the mobile bar (not essential on touch).

- [ ] **Step 1: Write the failing tests**

Create `src/components/plan/PlanToolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./ToolTooltip', () => ({
  ToolTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./WallThicknessControl', () => ({
  WallThicknessControl: () => <div data-testid="wall-thickness-control" />,
}));

import { PlanToolbar } from './PlanToolbar';

const defaultProps = {
  tool: 'SELECT' as const,
  canUndo: false,
  canRedo: false,
  onChangeTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onClearRoom: vi.fn(),
  wallThickness: 100,
  onWallThicknessChange: vi.fn(),
};

describe('PlanToolbar mobile', () => {
  it('renders the mobile horizontal toolbar', () => {
    render(<PlanToolbar {...defaultProps} />);
    expect(screen.getByTestId('plan-toolbar-mobile')).toBeDefined();
  });

  it('mobile toolbar contains a SELECT tool button', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    // SELECT tool button has aria-label "Sélectionner"
    const selectBtn = toolbar.querySelector('[aria-label="Sélectionner"]');
    expect(selectBtn).not.toBeNull();
  });

  it('clicking SELECT in mobile toolbar calls onChangeTool with SELECT', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const selectBtn = toolbar.querySelector('[aria-label="Sélectionner"]') as HTMLButtonElement;
    fireEvent.click(selectBtn);
    expect(onChangeTool).toHaveBeenCalledWith('SELECT');
  });

  it('clicking WALL in mobile toolbar calls onChangeTool with WALL', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const wallBtn = toolbar.querySelector('[aria-label="Tracer des murs"]') as HTMLButtonElement;
    fireEvent.click(wallBtn);
    expect(onChangeTool).toHaveBeenCalledWith('WALL');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/plan/PlanToolbar.test.tsx
```

Expected: FAIL — `Unable to find an element by: [data-testid="plan-toolbar-mobile"]`

- [ ] **Step 3: Modify PlanToolbar.tsx**

The component currently returns a single `<div>`. Wrap both in a fragment and add the mobile bar. The mobile buttons each need `aria-label` matching the tool label for testability.

Replace the entire `return (...)` in `src/components/plan/PlanToolbar.tsx` with:

```tsx
  return (
    <>
      {/* Desktop: vertical column, left side */}
      <div
        className="absolute left-4 top-4 z-10 hidden md:flex flex-col gap-0.5 overflow-y-auto rounded-2xl p-1.5 shadow-2xl backdrop-blur-md"
        style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: 'calc(100vh - 108px)', scrollbarWidth: 'none' }}>

        {/* ── Drawing tools ── */}
        <ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
          <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
            onClick={() => onChangeTool('SELECT')}>
            <MousePointer2 size={16} />
          </Button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.WALL}>
          <Button variant={tool === 'WALL' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
            onClick={() => onChangeTool('WALL')}>
            <PenTool size={16} />
          </Button>
        </ToolTooltip>

        <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

        {/* ── Openings & zone tools ── */}
        <ToolTooltip {...TOOL_TOOLTIPS.DOOR}>
          <Button variant={tool === 'DOOR' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
            onClick={() => onChangeTool('DOOR')}>
            <DoorOpen size={16} />
          </Button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.PARTITION}>
          <button type="button" onClick={() => onChangeTool('PARTITION')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              tool === 'PARTITION'
                ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
                : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
            }`}
            style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}>
            <SplitSquareVertical size={16} />
          </button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.EXCLUDE}>
          <button type="button" onClick={() => onChangeTool('EXCLUDE')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              tool === 'EXCLUDE'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                : `${TB_CARD} hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300`
            }`}
            style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
            <Square size={16} />
          </button>
        </ToolTooltip>

        <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

        {/* ── Constraint tools ── */}
        <ToolTooltip {...TOOL_TOOLTIPS.APPLY_H}>
          <button type="button" onClick={() => onChangeTool('APPLY_H')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
              tool === 'APPLY_H'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                : `${TB_CARD} hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300`
            }`}
            style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}>
            H
          </button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.APPLY_V}>
          <button type="button" onClick={() => onChangeTool('APPLY_V')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
              tool === 'APPLY_V'
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                : `${TB_CARD} hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300`
            }`}
            style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}>
            V
          </button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.COINCIDE}>
          <button type="button" onClick={() => onChangeTool('COINCIDE')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              tool === 'COINCIDE'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                : `${TB_CARD} hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-300`
            }`}
            style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}>
            <Magnet size={16} />
          </button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.DIMENSION}>
          <button type="button" onClick={() => onChangeTool('DIMENSION')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              tool === 'DIMENSION'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                : `${TB_CARD} hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300`
            }`}
            style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}>
            <Ruler size={15} />
          </button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.THICKNESS}>
          <button type="button" onClick={() => onChangeTool('THICKNESS')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
              tool === 'THICKNESS'
                ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30'
                : `${TB_CARD} hover:bg-slate-100 dark:hover:bg-slate-900/30 hover:text-slate-600 dark:hover:text-slate-300`
            }`}
            style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}>
            E
          </button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.ANCHOR}>
          <button type="button" onClick={() => onChangeTool('ANCHOR')}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              tool === 'ANCHOR'
                ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
                : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
            }`}
            style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}>
            <Pin size={16} />
          </button>
        </ToolTooltip>

        <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

        {/* ── Actions ── */}
        <ToolTooltip {...TOOL_TOOLTIPS.undo}>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo}>
            <Undo size={16} />
          </Button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.redo}>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo}>
            <Redo2 size={16} />
          </Button>
        </ToolTooltip>
        <ToolTooltip {...TOOL_TOOLTIPS.clear}>
          <Button variant="danger" size="icon" className="h-8 w-8" onClick={onClearRoom}>
            <Trash2 size={16} />
          </Button>
        </ToolTooltip>

        <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
        <WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} />
      </div>

      {/* Mobile: horizontal scrollable toolbar at bottom of canvas */}
      <div
        data-testid="plan-toolbar-mobile"
        className="absolute bottom-0 left-0 right-0 z-20 flex md:hidden items-center gap-1 overflow-x-auto border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 px-2 py-2 backdrop-blur-md"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Drawing tools */}
        <button
          type="button"
          aria-label="Sélectionner"
          onClick={() => onChangeTool('SELECT')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'SELECT' ? 'bg-orange-500 text-white shadow-md' : `${TB_CARD}`
          }`}
          style={tool !== 'SELECT' ? { color: 'var(--text2)' } : {}}
        >
          <MousePointer2 size={18} />
        </button>
        <button
          type="button"
          aria-label="Tracer des murs"
          onClick={() => onChangeTool('WALL')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'WALL' ? 'bg-orange-500 text-white shadow-md' : `${TB_CARD}`
          }`}
          style={tool !== 'WALL' ? { color: 'var(--text2)' } : {}}
        >
          <PenTool size={18} />
        </button>
        <button
          type="button"
          aria-label="Placer une porte"
          onClick={() => onChangeTool('DOOR')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'DOOR' ? 'bg-orange-500 text-white shadow-md' : `${TB_CARD}`
          }`}
          style={tool !== 'DOOR' ? { color: 'var(--text2)' } : {}}
        >
          <DoorOpen size={18} />
        </button>
        <button
          type="button"
          aria-label="Cloison (pointillés)"
          onClick={() => onChangeTool('PARTITION')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'PARTITION' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}
        >
          <SplitSquareVertical size={18} />
        </button>
        <button
          type="button"
          aria-label="Zone non carrelée"
          onClick={() => onChangeTool('EXCLUDE')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'EXCLUDE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}
        >
          <Square size={18} />
        </button>

        <div className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />

        {/* Constraint tools */}
        <button
          type="button"
          aria-label="Contrainte horizontale"
          onClick={() => onChangeTool('APPLY_H')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
            tool === 'APPLY_H' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}
        >
          H
        </button>
        <button
          type="button"
          aria-label="Contrainte verticale"
          onClick={() => onChangeTool('APPLY_V')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
            tool === 'APPLY_V' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}
        >
          V
        </button>
        <button
          type="button"
          aria-label="Cotation"
          onClick={() => onChangeTool('DIMENSION')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'DIMENSION' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}
        >
          <Ruler size={18} />
        </button>
        <button
          type="button"
          aria-label="Coïncidence"
          onClick={() => onChangeTool('COINCIDE')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'COINCIDE' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}
        >
          <Magnet size={18} />
        </button>
        <button
          type="button"
          aria-label="Ancrer un nœud"
          onClick={() => onChangeTool('ANCHOR')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            tool === 'ANCHOR' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}
        >
          <Pin size={18} />
        </button>
        <button
          type="button"
          aria-label="Épaisseur"
          onClick={() => onChangeTool('THICKNESS')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
            tool === 'THICKNESS' ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30' : `${TB_CARD}`
          }`}
          style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}
        >
          E
        </button>

        {/* Actions — pinned right */}
        <div className="ml-auto mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onUndo} disabled={!canUndo}>
          <Undo size={18} />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onRedo} disabled={!canRedo}>
          <Redo2 size={18} />
        </Button>
        <Button variant="danger" size="icon" className="h-10 w-10 shrink-0" onClick={onClearRoom}>
          <Trash2 size={18} />
        </Button>
      </div>
    </>
  );
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npx vitest run src/components/plan/PlanToolbar.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanToolbar.test.tsx
git commit -m "fix(mobile): add horizontal mobile toolbar to PlanToolbar"
```

---

## Task 4: PlanEditor — banderole pièces mobile + nettoyage

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

Four changes in this file:
1. **Supprimer** la bannière "La création de plans est disponible sur ordinateur ou tablette" (~line 1365)
2. **Restructurer** le return : outer wrapper `flex flex-col` + banderole pièces mobile + canvas div existant
3. **Masquer** `RoomPanel` sur mobile (wrapper `hidden md:block`)
4. **Masquer** le panneau raccourcis sur mobile (`hidden md:block`)
5. **Ajouter** un hint tactile "2 doigts : zoom" sur le canvas (mobile uniquement)

Also add `import { RoomTabs } from './RoomTabs';` since PlanEditor will render it directly in the mobile strip.

- [ ] **Step 1: Add `RoomTabs` import**

In `src/components/plan/PlanEditor.tsx`, find the existing import line for `RoomPanel`:
```tsx
import { RoomPanel } from './RoomPanel';
```

Add `RoomTabs` on the next line:
```tsx
import { RoomPanel } from './RoomPanel';
import { RoomTabs } from './RoomTabs';
```

- [ ] **Step 2: Remove the old "ordinateur ou tablette" banner**

Find and delete this block (~line 1365):
```tsx
      {/* Mobile: info banner */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center px-4 py-2 md:hidden"
        style={{ background: 'var(--surf)', borderBottom: '1px solid var(--bdr)' }}>
        <p className="text-[12px] font-medium" style={{ color: 'var(--text2)' }}>
          La création de plans est disponible sur ordinateur ou tablette
        </p>
      </div>
```

- [ ] **Step 3: Wrap the return in a column container and add mobile room strip**

The current `return (` opens with:
```tsx
  return (
    <div className="relative flex flex-1 overflow-hidden" style={{ background: 'var(--canvas-bg)' }}>
```

Change to wrap it in a column flex container with a mobile room strip above:
```tsx
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Mobile: room strip (non-draggable, horizontal) */}
      <div
        data-testid="mobile-room-strip"
        className="flex md:hidden shrink-0 items-center overflow-x-auto border-b border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 px-3 py-1.5"
        style={{ scrollbarWidth: 'none' }}
      >
        <RoomTabs
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onAddRoom={handleAddRoom}
          onRemoveRoom={handleRemoveRoom}
          onRenameRoom={renameRoom}
          vertical={false}
        />
      </div>
      {/* Canvas area */}
      <div className="relative flex flex-1 overflow-hidden" style={{ background: 'var(--canvas-bg)' }}>
```

And close with an extra `</div>` at the very end of the return (after the existing closing `</div>`):
```tsx
      </div>
    </div>
  );
```

- [ ] **Step 4: Wrap RoomPanel to hide on mobile**

Find:
```tsx
      <RoomPanel
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
        onAddRoom={handleAddRoom}
        onRemoveRoom={handleRemoveRoom}
        onRenameRoom={renameRoom}
        zone={roomZone}
        isDragging={roomDragging}
        onPointerDown={handleRoomPointerDown}
      />
```

Replace with:
```tsx
      <div className="hidden md:block">
        <RoomPanel
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onAddRoom={handleAddRoom}
          onRemoveRoom={handleRemoveRoom}
          onRenameRoom={renameRoom}
          zone={roomZone}
          isDragging={roomDragging}
          onPointerDown={handleRoomPointerDown}
        />
      </div>
```

- [ ] **Step 5: Hide shortcuts panel on mobile and add zoom hint**

Find the shortcuts panel:
```tsx
      <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
        style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}>
```

Replace with (`hidden md:block` added):
```tsx
      <div className="pointer-events-none absolute bottom-5 right-5 z-10 hidden md:block rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
        style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}>
```

Then add the mobile zoom hint **immediately before** the shortcuts panel div:
```tsx
      {/* Mobile: touch hint */}
      <div className="pointer-events-none absolute bottom-16 right-3 z-10 md:hidden rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
        style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)' }}>
        2 doigts : zoom
      </div>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (163+ tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/plan/PlanEditor.tsx
git commit -m "fix(mobile): Plan 2D — room strip, mobile toolbar visible, shortcuts hidden, zoom hint"
```
