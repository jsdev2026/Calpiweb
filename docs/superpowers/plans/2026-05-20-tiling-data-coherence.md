# Tiling Data Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `TilingStats` with `QuantityResult` in the tiling editor sidebar so both the tiling view and the Quantitatifs tab use the same data source.

**Architecture:** `TilingEditor` switches its `useMemo` from `computeTilingMultiRoom` to `analyzeQuantities`, which already calls `computeTilingMultiRoom` internally and returns both `tiles` (for the canvas) and full `QuantityResult` stats. `ResultsPanel` is updated to accept `QuantityResult`, renamed "Quantitatif", and displays 5 rows sourced from the new type. `TilingStats` and the engine are not touched.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

## File Map

| File | Change |
|------|--------|
| `src/components/tiling/TilingEditor.tsx` | Swap `computeTilingMultiRoom` → `analyzeQuantities`; single `result` useMemo |
| `src/components/tiling/TilingEditor.test.tsx` | Update engine mock to `analyzeQuantities` |
| `src/components/results/ResultsPanel.tsx` | New props, new content, rename title/icon |
| `src/components/results/ResultsPanel.test.tsx` | New file — smoke test for QuantityResult display |

---

### Task 1: Update TilingEditor to use `analyzeQuantities`

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx` (lines 10, 77, 165, 228)
- Modify: `src/components/tiling/TilingEditor.test.tsx` (mock block)

- [ ] **Step 1: Write the failing test — update the engine mock**

In `src/components/tiling/TilingEditor.test.tsx`, replace the existing engine mock and add the quantityEngine mock. The file currently has:

```ts
vi.mock('@/engine/tiling/tilingEngine', () => ({
  computeTilingMultiRoom: () => ({ tiles: [], stats: { totalTiles: 0, wholeTiles: 0, cutTiles: 0, reusedTiles: 0, wastePercent: 0, surface: 0, cutGroups: [] } }),
}));
```

Replace it with:

```ts
vi.mock('@/engine/quantities/quantityEngine', () => ({
  analyzeQuantities: () => ({
    tileW: 300, tileH: 300, joint: 3,
    wholeCount: 0, cuts: [], cutGroups: [],
    totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0, toOrder: 0, roomArea: 0,
    tiles: [],
  }),
}));
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npm run test -- --run src/components/tiling/TilingEditor.test.tsx
```

Expected: tests **fail** because TilingEditor still imports `computeTilingMultiRoom` (not yet mocked).

- [ ] **Step 3: Update TilingEditor.tsx**

Open `src/components/tiling/TilingEditor.tsx`. Make these 4 changes:

**a) Replace import on line 10:**
```tsx
// Remove:
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
// Add:
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
```

**b) Replace the useMemo on line 77:**
```tsx
// Remove:
const { tiles, stats } = useMemo(() => computeTilingMultiRoom(rooms, config), [rooms, config]);
// Add:
const result = useMemo(() => analyzeQuantities(rooms, config), [rooms, config]);
```

**c) Replace canvas prop on line 165:**
```tsx
// Remove:
tiles={tiles}
// Add:
tiles={result.tiles}
```

**d) Replace ResultsPanel prop on line 228:**
```tsx
// Remove:
<ResultsPanel stats={stats} />
// Add:
<ResultsPanel result={result} />
```

- [ ] **Step 4: Run the test to see it pass**

```bash
npm run test -- --run src/components/tiling/TilingEditor.test.tsx
```

Expected: all 3 tests **pass**.

- [ ] **Step 5: Run full suite + typecheck**

```bash
npm run typecheck && npm run test -- --run
```

Expected: TypeScript errors on `ResultsPanel` (props mismatch — will fix in Task 2). Tests: 3 TilingEditor tests pass, ResultsPanel tests may fail if they exist.

Note: TypeScript errors here are expected and will be resolved in Task 2. If the only errors are in `ResultsPanel.tsx` and `ResultsPanel.test.tsx`, proceed to Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/components/tiling/TilingEditor.tsx src/components/tiling/TilingEditor.test.tsx
git commit -m "refactor(tiling): switch TilingEditor to analyzeQuantities"
```

---

### Task 2: Update ResultsPanel to use QuantityResult

**Files:**
- Modify: `src/components/results/ResultsPanel.tsx`
- Create: `src/components/results/ResultsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/results/ResultsPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultsPanel } from './ResultsPanel';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';

const makeResult = (overrides: Partial<QuantityResult> = {}): QuantityResult => ({
  tileW: 300, tileH: 300, joint: 3,
  wholeCount: 10,
  cuts: Array.from({ length: 3 }) as QuantityResult['cuts'],
  cutGroups: [],
  totalReuseCount: 2,
  tilesForCuts: 3,
  totalTiles: 13,
  toOrder: 15,
  roomArea: 9.5,
  tiles: [],
  ...overrides,
});

describe('ResultsPanel', () => {
  it('shows Quantitatif heading', () => {
    render(<ResultsPanel result={makeResult()} />);
    expect(screen.getByText('Quantitatif')).toBeDefined();
  });

  it('shows wholeCount, cuts.length, totalReuseCount, toOrder', () => {
    render(<ResultsPanel result={makeResult()} />);
    expect(screen.getByText('10')).toBeDefined();  // wholeCount
    expect(screen.getByText('3')).toBeDefined();   // cuts.length
    expect(screen.getByText('2')).toBeDefined();   // totalReuseCount
    expect(screen.getByText('15')).toBeDefined();  // toOrder
  });

  it('shows empty state when totalTiles is 0', () => {
    render(<ResultsPanel result={makeResult({ totalTiles: 0, roomArea: 0 })} />);
    expect(screen.getByText(/Tracez une pièce/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/components/results/ResultsPanel.test.tsx
```

Expected: **FAIL** — `ResultsPanel` still uses `TilingStats` props.

- [ ] **Step 3: Rewrite ResultsPanel.tsx**

Replace the entire content of `src/components/results/ResultsPanel.tsx` with:

```tsx
'use client';

import { BarChart3 } from 'lucide-react';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { formatM2 } from '@/utils/formatters';

interface ResultsPanelProps {
  result: QuantityResult;
}

export const ResultsPanel = ({ result }: ResultsPanelProps) => (
  <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-zinc-100">
      <BarChart3 size={16} className="text-emerald-500" /> Quantitatif
    </h3>

    {result.totalTiles > 0 ? (
      <div className="space-y-3">
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Surface</span>
          <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">{formatM2(result.roomArea)}</span>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Carreaux entiers</span>
          <span className="font-mono text-gray-900 dark:text-zinc-100">{result.wholeCount}</span>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Coupes</span>
          <span className="font-mono text-gray-900 dark:text-zinc-100">{result.cuts.length}</span>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Chutes récupérées</span>
          <span className="font-mono text-gray-900 dark:text-zinc-100">{result.totalReuseCount}</span>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase text-emerald-500">
            Total à commander (+10%)
          </div>
          <div className="text-2xl font-black tracking-tight text-emerald-400">
            {result.toOrder}{' '}
            <span className="text-sm font-medium opacity-60">carreaux</span>
          </div>
        </div>
      </div>
    ) : (
      <p className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">
        Tracez une pièce pour voir les résultats
      </p>
    )}
  </div>
);
```

**Note:** The unused `analyzeQuantities` import above must be removed — it was added by mistake. The correct import is only `type QuantityResult`:

```tsx
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
```

- [ ] **Step 4: Run ResultsPanel tests**

```bash
npm run test -- --run src/components/results/ResultsPanel.test.tsx
```

Expected: all 3 tests **pass**.

- [ ] **Step 5: Run full suite + typecheck**

```bash
npm run typecheck && npm run test -- --run
```

Expected: no TypeScript errors, all tests pass (target: 95 tests across 20 files).

- [ ] **Step 6: Commit**

```bash
git add src/components/results/ResultsPanel.tsx src/components/results/ResultsPanel.test.tsx
git commit -m "feat(tiling): replace Devis Matériaux with Quantitatif panel using QuantityResult"
```
