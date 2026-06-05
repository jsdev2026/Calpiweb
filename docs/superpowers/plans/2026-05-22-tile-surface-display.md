# Tile Surface Area Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the tile surface area in m² inline next to existing tile counts in ResultsPanel and QuantitiesPanel.

**Architecture:** Pure display change — `toOrder × tileW × tileH` and `wholeCount × tileW × tileH` (both in mm²) are converted to m² via the existing `formatM2` utility. No new types, no store changes, no new components.

**Tech Stack:** TypeScript, React 18, Vitest, @testing-library/react.

---

## File Structure

| Action | File | Change |
|--------|------|--------|
| Modify | `src/components/results/ResultsPanel.tsx` | Add m² line under `toOrder` count |
| Modify | `src/components/results/ResultsPanel.test.tsx` | Add test for m² display |
| Modify | `src/components/quantities/QuantitiesPanel.tsx` | Add `sub` with m² to two StatCards |
| Create | `src/components/quantities/QuantitiesPanel.surface.test.ts` | Unit tests for tile surface formula |

---

### Task 1: ResultsPanel — add m² under `toOrder`

**Files:**
- Modify: `src/components/results/ResultsPanel.tsx:40-43`
- Modify: `src/components/results/ResultsPanel.test.tsx`

#### Background

`ResultsPanel` shows a "Total à commander (+10%)" block with the `toOrder` count. `formatM2` is already imported. `result.tileW` and `result.tileH` are in mm; `toOrder × tileW × tileH` gives mm², which `formatM2` converts to a "X.XX m²" string.

With fixture values `tileW=300, tileH=300, toOrder=15`:
`formatM2(15 × 300 × 300) = formatM2(1_350_000) = "1.35 m²"`

- [ ] **Step 1: Add the failing test**

In `src/components/results/ResultsPanel.test.tsx`, add a new test case inside the existing `describe('ResultsPanel', ...)` block:

```ts
it('shows toOrder tile surface in m²', () => {
  render(<ResultsPanel result={makeResult()} />);
  // toOrder=15, tileW=300, tileH=300 → 15 × 300 × 300 = 1 350 000 mm² = 1.35 m²
  expect(screen.getByText('1.35 m²')).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- --run src/components/results/ResultsPanel.test.tsx
```
Expected: FAIL — `Unable to find an element with the text: 1.35 m²`

- [ ] **Step 3: Implement the fix in ResultsPanel.tsx**

In `src/components/results/ResultsPanel.tsx`, find lines 40–43:

```tsx
          <div className="text-2xl font-black tracking-tight text-emerald-400">
            {result.toOrder}{' '}
            <span className="text-sm font-medium opacity-60">carreaux</span>
          </div>
```

Replace with:

```tsx
          <div className="text-2xl font-black tracking-tight text-emerald-400">
            {result.toOrder}{' '}
            <span className="text-sm font-medium opacity-60">carreaux</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-400 opacity-70">
            {formatM2(result.toOrder * result.tileW * result.tileH)}
          </div>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- --run src/components/results/ResultsPanel.test.tsx
```
Expected: all 4 tests PASS

- [ ] **Step 5: Run full suite**

```bash
npm run test -- --run
```
Expected: all 114+ tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/results/ResultsPanel.tsx src/components/results/ResultsPanel.test.tsx
git commit -m "feat(results): show toOrder tile surface in m² under count

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: QuantitiesPanel — add m² to two StatCards

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx:307-330`
- Create: `src/components/quantities/QuantitiesPanel.surface.test.ts`

#### Background

`QuantitiesPanel` renders four `StatCard` components. Two get m² added to their `sub` prop:

1. **"Carreaux entiers"** (`wholeCount`) — currently has no `sub`. Add `sub={formatM2(result.wholeCount * result.tileW * result.tileH)}`.
2. **"Total à commander"** (`toOrder`) — currently `sub="+10% marge · N nets"`. Extend to `"+10% marge · N nets · X m²"`.

`formatM2` is already imported in `QuantitiesPanel.tsx`.

With `wholeCount=10, tileW=300, tileH=300`: `formatM2(10 × 300 × 300) = "0.90 m²"`
With `toOrder=15, tileW=300, tileH=300`: `formatM2(15 × 300 × 300) = "1.35 m²"`

The `StatCard` component renders `sub` as:
```tsx
{sub && <div className="mt-0.5 text-[10px] opacity-50">{sub}</div>}
```

- [ ] **Step 1: Write the failing test**

Create `src/components/quantities/QuantitiesPanel.surface.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatM2 } from '@/utils/formatters';

describe('QuantitiesPanel tile surface formula', () => {
  it('wholeCount surface: 10 × 300 × 300 mm = 0.90 m²', () => {
    expect(formatM2(10 * 300 * 300)).toBe('0.90 m²');
  });

  it('toOrder surface: 15 × 300 × 300 mm = 1.35 m²', () => {
    expect(formatM2(15 * 300 * 300)).toBe('1.35 m²');
  });

  it('sub string for total: includes m² value', () => {
    const toOrder = 15;
    const totalTiles = 13;
    const tileW = 300, tileH = 300;
    const sub = `+10% marge · ${totalTiles} nets · ${formatM2(toOrder * tileW * tileH)}`;
    expect(sub).toBe('+10% marge · 13 nets · 1.35 m²');
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (pure logic, no component rendering needed)

```bash
npm run test -- --run src/components/quantities/QuantitiesPanel.surface.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 3: Apply the changes in QuantitiesPanel.tsx**

In `src/components/quantities/QuantitiesPanel.tsx`, find the four-StatCard grid (lines 307–330):

```tsx
          <StatCard
            label="Carreaux entiers"
            value={result.wholeCount}
            accent="zinc"
          />
          <StatCard
            label="Coupes nécessaires"
            value={result.cuts.length}
            sub={`${result.cutGroups.length} format${result.cutGroups.length > 1 ? 's' : ''} distinct${result.cutGroups.length > 1 ? 's' : ''}`}
            accent="zinc"
          />
          <StatCard
            label="Chutes réutilisées"
            value={result.totalReuseCount}
            sub={result.totalReuseCount > 0 ? `${result.totalReuseCount} carreau${result.totalReuseCount > 1 ? 'x' : ''} économisé${result.totalReuseCount > 1 ? 's' : ''}` : 'Aucune économie'}
            accent={result.totalReuseCount > 0 ? 'green' : 'zinc'}
          />
          <StatCard
            label="Total à commander"
            value={result.toOrder}
            sub={`+10% marge · ${result.totalTiles} nets`}
            accent="orange"
          />
```

Replace with:

```tsx
          <StatCard
            label="Carreaux entiers"
            value={result.wholeCount}
            sub={formatM2(result.wholeCount * result.tileW * result.tileH)}
            accent="zinc"
          />
          <StatCard
            label="Coupes nécessaires"
            value={result.cuts.length}
            sub={`${result.cutGroups.length} format${result.cutGroups.length > 1 ? 's' : ''} distinct${result.cutGroups.length > 1 ? 's' : ''}`}
            accent="zinc"
          />
          <StatCard
            label="Chutes réutilisées"
            value={result.totalReuseCount}
            sub={result.totalReuseCount > 0 ? `${result.totalReuseCount} carreau${result.totalReuseCount > 1 ? 'x' : ''} économisé${result.totalReuseCount > 1 ? 's' : ''}` : 'Aucune économie'}
            accent={result.totalReuseCount > 0 ? 'green' : 'zinc'}
          />
          <StatCard
            label="Total à commander"
            value={result.toOrder}
            sub={`+10% marge · ${result.totalTiles} nets · ${formatM2(result.toOrder * result.tileW * result.tileH)}`}
            accent="orange"
          />
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors

- [ ] **Step 5: Run all tests**

```bash
npm run test -- --run
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.surface.test.ts
git commit -m "feat(quantities): show tile surface m² in StatCards for whole and toOrder

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
