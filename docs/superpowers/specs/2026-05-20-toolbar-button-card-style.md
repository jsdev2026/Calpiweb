# Toolbar Button Card Style — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

## Problem

In the plan toolbar, SELECT / WALL / DOOR use `<Button variant="tool">` which applies a subtle card background + border at rest (`bg-gray-50 border border-gray-200` / `dark:bg-zinc-900 dark:border-zinc-800`). The other eight tool buttons (PARTITION, EXCLUDE, H, V, COINCIDE, DIMENSION, THICKNESS, ANCHOR) are raw `<button>` elements with no resting background — they look transparent against the panel. `WallThicknessControl` has no border. The result is visual inconsistency: three buttons appear as cards, the rest float.

## Goal

All tool buttons share the same resting card style. Hover and active states stay per-button (their own colors). Action buttons (undo/redo/clear) are unchanged.

## Changes

### `src/components/plan/PlanToolbar.tsx`

Extract a shared constant at the top of the file:

```ts
const TB_CARD = 'bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800';
```

For each of the 8 raw `<button>` tool elements (PARTITION, EXCLUDE, APPLY_H, APPLY_V, COINCIDE, DIMENSION, THICKNESS, ANCHOR), add `TB_CARD` to the inactive branch of their className ternary. Example for PARTITION:

```tsx
// before
tool === 'PARTITION'
  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
  : 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300'

// after
tool === 'PARTITION'
  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
  : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
```

SELECT / WALL / DOOR already use `<Button variant="tool">` — no change needed.

### `src/components/plan/WallThicknessControl.tsx`

Replace the inline `background` style with Tailwind card classes, and fix the non-existent `--text1` variable:

```tsx
// before
className="h-8 w-8 rounded-xl text-center text-[11px] font-bold outline-none transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
style={{ background: 'var(--surf)', color: 'var(--text1)' }}

// after
className="h-8 w-8 rounded-xl text-center text-[11px] font-bold outline-none transition-colors bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
style={{ color: 'var(--text2)' }}
```

## Out of Scope

- Active / hover state colors — unchanged
- Action buttons (undo, redo, clear) — unchanged
- Any logic, types, props, or tests
