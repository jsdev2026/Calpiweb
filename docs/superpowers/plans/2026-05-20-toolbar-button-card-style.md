# Toolbar Button Card Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all inactive tool buttons in the plan toolbar share the same subtle card style (bg + border) currently only applied to SELECT / WALL / DOOR.

**Architecture:** Pure CSS class changes — no logic, no types, no new files. A shared `TB_CARD` constant is extracted in `PlanToolbar.tsx` and applied to the 8 raw `<button>` elements' inactive branches. `WallThicknessControl.tsx` gets the same card classes replacing its inline background, plus a bug-fix for the non-existent `--text1` CSS variable.

**Tech Stack:** React, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `src/components/plan/PlanToolbar.tsx` | Add `TB_CARD` constant; add it to inactive className of 8 raw buttons |
| `src/components/plan/WallThicknessControl.tsx` | Replace `background: 'var(--surf)'` inline style with Tailwind card classes; fix `--text1` → `--text2` |

---

### Task 1: Uniform card style on PlanToolbar raw buttons

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`

This change is purely additive to classNames — no behaviour changes. There is no new logic to unit-test; the existing test suite verifies nothing broke.

- [ ] **Step 1: Add the `TB_CARD` constant and update all 8 raw buttons**

Open `src/components/plan/PlanToolbar.tsx`. Insert the constant immediately before the `export const PlanToolbar` line, then update the 8 raw `<button>` elements exactly as shown below.

**Add constant (before `export const PlanToolbar`):**

```tsx
const TB_CARD = 'bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800';
```

**PARTITION button — replace existing className ternary inactive branch:**

```tsx
<button type="button" onClick={() => onChangeTool('PARTITION')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
    tool === 'PARTITION'
      ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
      : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
  }`}
  style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}>
  <SplitSquareVertical size={16} />
</button>
```

**EXCLUDE button:**

```tsx
<button type="button" onClick={() => onChangeTool('EXCLUDE')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
    tool === 'EXCLUDE'
      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
      : `${TB_CARD} hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300`
  }`}
  style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
  <Square size={16} />
</button>
```

**APPLY_H button:**

```tsx
<button type="button" onClick={() => onChangeTool('APPLY_H')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
    tool === 'APPLY_H'
      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
      : `${TB_CARD} hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300`
  }`}
  style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}>
  H
</button>
```

**APPLY_V button:**

```tsx
<button type="button" onClick={() => onChangeTool('APPLY_V')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
    tool === 'APPLY_V'
      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
      : `${TB_CARD} hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300`
  }`}
  style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}>
  V
</button>
```

**COINCIDE button:**

```tsx
<button type="button" onClick={() => onChangeTool('COINCIDE')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
    tool === 'COINCIDE'
      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
      : `${TB_CARD} hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-300`
  }`}
  style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}>
  <Magnet size={16} />
</button>
```

**DIMENSION button:**

```tsx
<button type="button" onClick={() => onChangeTool('DIMENSION')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
    tool === 'DIMENSION'
      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
      : `${TB_CARD} hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300`
  }`}
  style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}>
  <Ruler size={15} />
</button>
```

**THICKNESS button:**

```tsx
<button type="button" onClick={() => onChangeTool('THICKNESS')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
    tool === 'THICKNESS'
      ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30'
      : `${TB_CARD} hover:bg-slate-100 dark:hover:bg-slate-900/30 hover:text-slate-600 dark:hover:text-slate-300`
  }`}
  style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}>
  E
</button>
```

**ANCHOR button:**

```tsx
<button type="button" onClick={() => onChangeTool('ANCHOR')}
  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
    tool === 'ANCHOR'
      ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
      : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
  }`}
  style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}>
  <Pin size={16} />
</button>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm run test -- --run
```

Expected: all tests pass (92 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/plan/PlanToolbar.tsx
git commit -m "fix(toolbar): uniform card style on all inactive tool buttons"
```

---

### Task 2: Fix WallThicknessControl card style

**Files:**
- Modify: `src/components/plan/WallThicknessControl.tsx`

- [ ] **Step 1: Replace the input's inline background with Tailwind card classes**

In `src/components/plan/WallThicknessControl.tsx`, update the `<input>` element (currently lines 21–31):

```tsx
<input
  key={wallThickness}
  type="number"
  step="0.5"
  min="5"
  defaultValue={defaultCm}
  onBlur={(e) => commit(e.target.value)}
  onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
  className="h-8 w-8 rounded-xl text-center text-[11px] font-bold outline-none transition-colors bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
  style={{ color: 'var(--text2)' }}
/>
```

Changes from the current version:
- `background: 'var(--surf)'` removed from `style` (replaced by `bg-gray-50 dark:bg-zinc-900` Tailwind classes)
- `color: 'var(--text1)'` → `color: 'var(--text2)'` (fixes non-existent CSS variable `--text1`)
- Added `border border-gray-200 dark:border-zinc-800` to className

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm run test -- --run
```

Expected: all tests pass (92 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/plan/WallThicknessControl.tsx
git commit -m "fix(toolbar): card style on WallThicknessControl input, fix --text1 typo"
```
