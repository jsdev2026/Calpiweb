# Tiling Data Coherence — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

## Problem

The sidebar of the tiling editor ("Devis Matériaux") displays data from `TilingStats` — a simplified object computed by `computeStats()`. The Quantitatifs tab uses `QuantityResult` from `analyzeQuantities()`, which is richer and more accurate (cut groups, offcut reuse). The two sources can diverge, and the sidebar label "Devis Matériaux" does not match the vocabulary of the Quantitatifs tab.

## Goal

The tiling editor sidebar shows a compact summary sourced exclusively from `analyzeQuantities()` — the same function used by the Quantitatifs tab — renamed "Quantitatif".

## Architecture

`TilingEditor` switches from calling `computeTilingMultiRoom()` to calling `analyzeQuantities()`. This function already calls `computeTilingMultiRoom` internally and returns both `tiles` (for canvas rendering) and full `QuantityResult` stats. `ResultsPanel` is updated to accept `QuantityResult` instead of `TilingStats`.

`TilingStats`, `computeStats`, and `tilingEngine.ts` are not touched — they remain used internally by the engine.

## Changes

### `src/components/tiling/TilingEditor.tsx`

1. Replace import: `computeTilingMultiRoom` → `analyzeQuantities` (from `@/engine/quantities/quantityEngine`)
2. Remove `TilingStats` import from `@/types/tiling`
3. Replace state:
   - Remove: `const [tiles, setTiles] = useState<Tile[]>([])`  and `const [stats, setStats] = useState<TilingStats | null>(null)`
   - Add: `const [result, setResult] = useState<QuantityResult | null>(null)`
4. Replace computation call:
   - Remove: `const { tiles, stats } = computeTilingMultiRoom(rooms, config); setTiles(tiles); setStats(stats);`
   - Add: `const r = analyzeQuantities(rooms, config); setResult(r);`
5. Replace canvas prop: `tiles={tiles}` → `tiles={result?.tiles ?? []}`
6. Replace sidebar prop: `stats={stats}` → `result={result}`

### `src/components/results/ResultsPanel.tsx`

1. Replace import: `TilingStats` → `QuantityResult` (from `@/engine/quantities/quantityEngine`)
2. Update props interface:
   ```ts
   interface ResultsPanelProps {
     result: QuantityResult | null;
   }
   ```
3. Rename section heading: "Devis Matériaux" → "Quantitatif"
4. Replace icon: `Calculator` → `BarChart3` (from lucide-react)
5. Update display — 5 rows, same key-value layout as currently:

   | Label | Value |
   |-------|-------|
   | Surface | `formatM2(result.roomArea)` |
   | Carreaux entiers | `result.wholeCount` |
   | Coupes | `result.cuts.length` |
   | Chutes récupérées | `result.totalReuseCount` |

   Followed by the highlighted "Total à commander (+10%)" block using `result.toOrder`.

6. Remove the `wastePercent` warning block (field not present in `QuantityResult`).

## Out of Scope

- `TilingStats` type definition — kept as-is (used internally by engine)
- `computeStats` / `cutCalculator.ts` / `tilingEngine.ts` — not touched
- `QuantitiesPanel.tsx` — not touched
- Visual layout/spacing of ResultsPanel beyond label and data changes
