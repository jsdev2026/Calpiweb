# Cuts Band — Collapsible Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontally-scrolling "Groupes de coupes" mini-card band below the plan with a collapsible accordion (collapsed by default) whose header shows the group count and summary stats, expanding to a compact table — one row per merged cut group.

**Architecture:** Add a new `CutGroupsTable` component (one `<table>` row per `MergedCutGroup`, reusing `TileThumbnail` and `GROUP_COLORS` from `CutGroupCard.tsx`, with the existing hover→highlight wiring moved inside each row). Rewrite the `cuts-band` section of `QuantitiesPanel.tsx` into a `▸`/`▾` accordion header (default closed) + conditional `CutGroupsTable`. Delete the now-superseded `CutGroupCardCompact` component and its test.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + React Testing Library.

---

### Task 1: Create `CutGroupsTable` component

**Files:**
- Create: `src/components/quantities/CutGroupsTable.tsx`
- Test: `src/components/quantities/CutGroupsTable.test.tsx`

**Context:** `formatCm(mm)` (from `@/utils/formatters`) converts millimeters to a `"X.X cm"` string (e.g. `formatCm(150)` → `"15.0 cm"`). `MergedCutGroup` (from `@/engine/quantities/mergeSimilarCutGroups`) extends `CutGroup` with `originalIndices: [number, ...number[]]`. `GROUP_COLORS` (array of 10 hex strings) and `TileThumbnail` (props `{ tileW, tileH, usedW, usedH, pieceEdges, color, reused? }`) are exported from `./CutGroupCard` — reuse both as-is, no changes needed to that file.

- [ ] **Step 1: Write the failing test**

Create `src/components/quantities/CutGroupsTable.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CutGroupsTable } from './CutGroupsTable';
import type { MergedCutGroup } from '@/engine/quantities/mergeSimilarCutGroups';

const makeGroup = (overrides: Partial<MergedCutGroup> = {}): MergedCutGroup => ({
  usedW: 150,
  usedH: 300,
  pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
  chuteW: 150,
  chuteH: 300,
  chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
  totalCount: 3,
  reuseCount: 0,
  netTiles: 3,
  originalIndices: [0],
  ...overrides,
});

const defaultProps = {
  groups: [makeGroup()],
  tileW: 300,
  tileH: 300,
  tileColor: '#93c5fd',
  onHighlight: vi.fn(),
};

describe('CutGroupsTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders one row per group plus a header row', () => {
    render(
      <CutGroupsTable
        {...defaultProps}
        groups={[makeGroup(), makeGroup({ originalIndices: [1] })]}
      />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('renders cut dimensions as formatted cm', () => {
    render(<CutGroupsTable {...defaultProps} />);
    expect(screen.getByText('15.0 cm×30.0 cm')).toBeDefined();
  });

  it('shows chute when chuteW and chuteH are both > 20', () => {
    render(<CutGroupsTable {...defaultProps} />);
    expect(screen.getByText('Chute 15.0 cm×30.0 cm')).toBeDefined();
  });

  it('shows reuse note when reuseCount > 0 and there is no big chute', () => {
    render(
      <CutGroupsTable
        {...defaultProps}
        groups={[makeGroup({ reuseCount: 2, chuteW: 0, chuteH: 0 })]}
      />,
    );
    expect(screen.getByText(/2 taillées dans une chute/)).toBeDefined();
  });

  it('renders the net tile count, styled green when reuseCount > 0', () => {
    render(<CutGroupsTable {...defaultProps} groups={[makeGroup({ netTiles: 5, reuseCount: 2 })]} />);
    const cell = screen.getByText('5');
    expect(cell.className).toContain('text-emerald-500');
  });

  it('calls onHighlight(originalIndices[0] + 1) on row mouseEnter', () => {
    const onHighlight = vi.fn();
    render(
      <CutGroupsTable
        {...defaultProps}
        groups={[makeGroup({ originalIndices: [2] })]}
        onHighlight={onHighlight}
      />,
    );
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.mouseEnter(row);
    expect(onHighlight).toHaveBeenCalledWith(3);
  });

  it('calls onHighlight(null) on row mouseLeave', () => {
    const onHighlight = vi.fn();
    render(<CutGroupsTable {...defaultProps} onHighlight={onHighlight} />);
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.mouseLeave(row);
    expect(onHighlight).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quantities/CutGroupsTable.test.tsx`
Expected: FAIL — `Failed to resolve import "./CutGroupsTable"` (module doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/quantities/CutGroupsTable.tsx`:

```tsx
'use client';

import type { MergedCutGroup } from '@/engine/quantities/mergeSimilarCutGroups';
import { formatCm } from '@/utils/formatters';
import { GROUP_COLORS, TileThumbnail } from './CutGroupCard';

export interface CutGroupsTableProps {
  groups: MergedCutGroup[];
  tileW: number;
  tileH: number;
  tileColor: string;
  onHighlight: (group: number | null) => void;
}

export const CutGroupsTable = ({ groups, tileW, tileH, tileColor, onHighlight }: CutGroupsTableProps) => {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-400 dark:text-zinc-500">
          <th className="px-2 py-1 font-normal">#</th>
          <th className="px-2 py-1 font-normal" />
          <th className="px-2 py-1 font-normal">Dimensions</th>
          <th className="px-2 py-1 font-normal">Détail</th>
          <th className="px-2 py-1 text-right font-normal">Nets</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, i) => {
          const hasBigChute = group.chuteW > 20 && group.chuteH > 20;
          const groupColor = GROUP_COLORS[i % GROUP_COLORS.length]!;

          return (
            <tr
              key={group.originalIndices.join(',')}
              className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
              // Plan highlighting is keyed by the original (pre-merge) cutGroups
              // index, not the merged display index `i` — use originalIndices[0].
              onMouseEnter={() => onHighlight(group.originalIndices[0]! + 1)}
              onMouseLeave={() => onHighlight(null)}
            >
              <td className="px-2 py-1">
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
                  style={{
                    background: `${groupColor}20`,
                    color: groupColor,
                    border: `1.5px solid ${groupColor}40`,
                  }}
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-2 py-1">
                <TileThumbnail
                  tileW={tileW}
                  tileH={tileH}
                  usedW={group.usedW}
                  usedH={group.usedH}
                  pieceEdges={group.pieceEdges}
                  color={tileColor}
                  reused={group.reuseCount > 0}
                />
              </td>
              <td className="px-2 py-1 font-mono font-bold text-gray-900 dark:text-zinc-100">
                {formatCm(group.usedW)}×{formatCm(group.usedH)}
              </td>
              <td className="px-2 py-1">
                {hasBigChute ? (
                  <span className="text-gray-400 dark:text-zinc-500">
                    Chute {formatCm(group.chuteW)}×{formatCm(group.chuteH)}
                  </span>
                ) : group.reuseCount > 0 ? (
                  <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                    ↩ {group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
                  </span>
                ) : null}
              </td>
              <td
                className={`px-2 py-1 text-right font-black tabular-nums ${
                  group.reuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-100'
                }`}
              >
                {group.netTiles}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quantities/CutGroupsTable.test.tsx`
Expected: PASS (7/7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/quantities/CutGroupsTable.tsx src/components/quantities/CutGroupsTable.test.tsx
git commit -m "feat(quantities): table des groupes de coupes"
```

---

### Task 2: Rewrite the cuts band in `QuantitiesPanel` as a collapsible accordion

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx`
- Modify: `src/components/quantities/QuantitiesPanel.test.tsx`

**Context:** Current `QuantitiesPanel.tsx` (133 lines) imports `CutGroupCardCompact` and `GROUP_COLORS` from `CutGroupCard`, and renders the cuts band as:

```tsx
<div data-testid="cuts-band" className="flex shrink-0 flex-col gap-2">
  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
    Groupes de coupes ({mergedCutGroups.length})
  </h3>
  <div className="flex gap-2 overflow-x-auto pb-1">
    {mergedCutGroups.map((group, i) => (
      <CutGroupCardCompact
        key={group.originalIndices.join(',')}
        group={group}
        groupIndex={i}
        groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
        tileW={result.tileW}
        tileH={result.tileH}
        tileColor={color}
        onHighlight={(n) => setHighlightGroup(
          // Plan highlighting is keyed by the original (pre-merge) cutGroups
          // index, not the merged display index `i` — use originalIndices[0].
          n === null ? null : group.originalIndices[0]! + 1,
        )}
      />
    ))}
  </div>
</div>
```

This whole block must be replaced with a `▸`/`▾` accordion header (default collapsed, `cutsOpen` state) showing `Groupes de coupes (N) — X carreaux à couper, Y récupérées`, and a conditional `CutGroupsTable` (with `max-h-[30vh] overflow-y-auto` so the plan retains space, per the spec's "Space management" section). The index-mapping responsibility (`originalIndices[0]! + 1`) now lives inside `CutGroupsTable` (Task 1), so `onHighlight` here is just `setHighlightGroup` directly.

`QuantitiesPanel.test.tsx` currently has these two tests that reference the old band (lines 92–106):

```tsx
  it('renders the cuts band with merged cut groups', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByTestId('cuts-band')).toBeDefined();
    expect(screen.getByText('Groupes de coupes (1)')).toBeDefined();
  });

  it('hovering a compact cut card sets the plan highlight', () => {
    const { container } = render(<QuantitiesPanel />);
    const cutsBand = screen.getByTestId('cuts-band');
    const card = cutsBand.querySelector('div[style*="border-top-color"]') as Element;
    fireEvent.mouseEnter(card);
    // No visible assertion on QuantityPlanView (mocked); ensure no crash and plan section still renders
    expect(screen.getByTestId('plan-section')).toBeDefined();
    expect(container).toBeDefined();
  });
```

These must be replaced with tests for the new collapsed-by-default / expand-on-click / hover-row behavior. The mocked `analyzeQuantities` (in the same test file) returns `cuts: []` (length 0), `totalReuseCount: 0`, and one `cutGroups` entry — so after merging there is 1 merged group, and the header text is `Groupes de coupes (1) — 0 carreaux à couper, 0 récupérées`.

- [ ] **Step 1: Update the failing/changed tests in `QuantitiesPanel.test.tsx`**

Replace the two tests shown above (lines 92–106) with:

```tsx
  it('renders the cuts band header collapsed by default', () => {
    render(<QuantitiesPanel />);
    const cutsBand = screen.getByTestId('cuts-band');
    expect(cutsBand.textContent).toContain('Groupes de coupes (1)');
    expect(cutsBand.textContent).toContain('0 carreaux à couper, 0 récupérées');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('expands the cuts table when the header is clicked', () => {
    render(<QuantitiesPanel />);
    const toggle = screen.getByRole('button', { name: /Groupes de coupes/ });
    fireEvent.click(toggle);
    expect(screen.getByRole('table')).toBeDefined();
  });

  it('hovering a cut row sets the plan highlight', () => {
    render(<QuantitiesPanel />);
    const toggle = screen.getByRole('button', { name: /Groupes de coupes/ });
    fireEvent.click(toggle);
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.mouseEnter(row);
    // No visible assertion on QuantityPlanView (mocked); ensure no crash and plan section still renders
    expect(screen.getByTestId('plan-section')).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/quantities/QuantitiesPanel.test.tsx`
Expected: FAIL — the old `Groupes de coupes (1)` header text and `border-top-color` card no longer exist after Step 3 is applied... but at this point Step 3 hasn't been applied yet, so instead this should currently FAIL because `screen.queryByRole('table')` finds nothing to assert against meaningfully and `getByRole('button', { name: /Groupes de coupes/ })` doesn't match anything (the current header is an `<h3>`, not a `<button>`). Confirm failure on the new tests before proceeding.

- [ ] **Step 3: Rewrite the cuts-band section and imports in `QuantitiesPanel.tsx`**

In `src/components/quantities/QuantitiesPanel.tsx`:

Replace the import block:

```typescript
import { QuantityPlanView } from './QuantityPlanView';
import { CutGroupCardCompact } from './CutGroupCardCompact';
import { GROUP_COLORS } from './CutGroupCard';
import { QuantitiesRecapColumn } from './QuantitiesRecapColumn';
```

with:

```typescript
import { QuantityPlanView } from './QuantityPlanView';
import { CutGroupsTable } from './CutGroupsTable';
import { QuantitiesRecapColumn } from './QuantitiesRecapColumn';
```

Add a `cutsOpen` state alongside the existing `highlightGroup` state:

```typescript
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);
  const [cutsOpen, setCutsOpen] = useState(false);
```

Replace the entire `data-testid="cuts-band"` block with:

```tsx
              <div data-testid="cuts-band" className="flex shrink-0 flex-col gap-2 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCutsOpen((o) => !o)}
                  className="flex shrink-0 items-center gap-1 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500"
                >
                  <span>{cutsOpen ? '▾' : '▸'}</span>
                  <span>
                    Groupes de coupes ({mergedCutGroups.length}) — {result.cuts.length} carreaux à couper, {result.totalReuseCount} récupérées
                  </span>
                </button>

                {cutsOpen && (
                  <div className="max-h-[30vh] overflow-y-auto">
                    <CutGroupsTable
                      groups={mergedCutGroups}
                      tileW={result.tileW}
                      tileH={result.tileH}
                      tileColor={color}
                      onHighlight={setHighlightGroup}
                    />
                  </div>
                )}
              </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/quantities/QuantitiesPanel.test.tsx`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.test.tsx
git commit -m "feat(quantities): bandeau de coupes repliable avec tableau"
```

---

### Task 3: Remove the superseded `CutGroupCardCompact` component

**Files:**
- Delete: `src/components/quantities/CutGroupCardCompact.tsx`
- Delete: `src/components/quantities/CutGroupCardCompact.test.tsx`

**Context:** After Task 2, `CutGroupCardCompact` is no longer imported anywhere (verify before deleting). It is fully superseded by `CutGroupsTable`.

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "CutGroupCardCompact" src/`
Expected: no output (no matches)

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/quantities/CutGroupCardCompact.tsx src/components/quantities/CutGroupCardCompact.test.tsx
```

- [ ] **Step 3: Run the full quantities test suite**

Run: `npx vitest run src/components/quantities/`
Expected: PASS, with one fewer test file than before (the `CutGroupCardCompact.test.tsx` file is gone)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(quantities): supprime CutGroupCardCompact, remplacé par CutGroupsTable"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the project**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

---

## Self-Review Notes

- **Spec coverage:** Header bar with `▸`/`▾` + count + summary stats (Task 2 Step 3) ✅; table with #, Miniature, Dimensions, Détail, Nets columns (Task 1) ✅; hover-highlight wiring preserved via `originalIndices[0]! + 1` (moved into `CutGroupsTable`, Task 1) ✅; collapsed by default with `cutsOpen = false` (Task 2) ✅; expanded table gets `max-h-[30vh] overflow-y-auto` (Task 2) ✅; `CutGroupCardCompact` removed (Task 3) ✅; `CutGroupCard.tsx` (`TileThumbnail`, `GROUP_COLORS`), `QuantitiesRecapColumn.tsx`, `QuantityPlanView.tsx`, `QuantitiesPrintView.tsx` left unchanged ✅.
- **TileThumbnail sizing:** The spec suggests "~24px max dimension" for the table thumbnail; `TileThumbnail` has no size prop (hardcoded `maxDim = 18`). This plan keeps `TileThumbnail` unchanged (per the spec's architecture table, which marks `CutGroupCard.tsx` as Unchanged) — 18px is already compact and adding a size prop would be a YAGNI-violating change not required by any other consumer.
- **Type consistency:** `CutGroupsTableProps.onHighlight: (group: number | null) => void` matches `setHighlightGroup`'s signature (`useState<number | null>`); `MergedCutGroup` import path (`@/engine/quantities/mergeSimilarCutGroups`) matches the existing export.
