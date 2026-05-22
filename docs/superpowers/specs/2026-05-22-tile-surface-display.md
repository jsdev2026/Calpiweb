# Surface carreaux (m²) — Design Spec

**Date:** 2026-05-22
**Status:** Approved

## Problem

The quantities panel and the tiling editor results panel both show tile counts (whole tiles, tiles to order) but never the corresponding surface area in m². A professional needing to order tiles must manually multiply count × tile dimensions to get the area to purchase.

## Goal

Display the tile surface area (m²) inline next to existing tile counts — no new fields in the store or in `QuantityResult`, no new components, no layout restructuring.

## Formula

```
tileSurface(n) = n × tileW × tileH   (mm²)
```

Converted to m² via the existing `mm2ToM2` utility (already imported in both target files).

- `tileW` and `tileH` are in mm (from `QuantityResult.tileW` / `QuantityResult.tileH`)
- `n` is either `wholeCount`, `totalTiles`, or `toOrder` depending on location

## Architecture

No new types, no new store actions, no new components. Pure display changes to two existing files.

| File | Change |
|------|--------|
| `src/components/quantities/QuantitiesPanel.tsx` | Extend `sub` prop of two StatCards |
| `src/components/results/ResultsPanel.tsx` | Add m² line under the `toOrder` count |

---

## Section 1 — QuantitiesPanel (`QuantitiesPanel.tsx`)

### StatCard: Carreaux entiers

**Before:**
```tsx
<StatCard
  label="Carreaux entiers"
  value={result.wholeCount}
  accent="zinc"
/>
```

**After:**
```tsx
<StatCard
  label="Carreaux entiers"
  value={result.wholeCount}
  sub={formatM2(result.wholeCount * result.tileW * result.tileH)}
  accent="zinc"
/>
```

### StatCard: Total à commander

**Before:**
```tsx
<StatCard
  label="Total à commander"
  value={result.toOrder}
  sub={`+10% marge · ${result.totalTiles} nets`}
  accent="orange"
/>
```

**After:**
```tsx
<StatCard
  label="Total à commander"
  value={result.toOrder}
  sub={`+10% marge · ${result.totalTiles} nets · ${formatM2(result.toOrder * result.tileW * result.tileH)}`}
  accent="orange"
/>
```

`formatM2` is already imported in `QuantitiesPanel.tsx`.

---

## Section 2 — ResultsPanel (`ResultsPanel.tsx`)

The "Total à commander" block currently renders:

```tsx
<div className="text-2xl font-black tracking-tight text-emerald-400">
  {result.toOrder}{' '}
  <span className="text-sm font-medium opacity-60">carreaux</span>
</div>
```

**After** — add a m² line below the count:

```tsx
<div className="text-2xl font-black tracking-tight text-emerald-400">
  {result.toOrder}{' '}
  <span className="text-sm font-medium opacity-60">carreaux</span>
</div>
<div className="mt-1 text-sm font-semibold text-emerald-400 opacity-70">
  {formatM2(result.toOrder * result.tileW * result.tileH)}
</div>
```

`formatM2` is already imported in `ResultsPanel.tsx`.

---

## Out of Scope

- Surface for "Coupes nécessaires" (partial tiles → area is not meaningful)
- Surface for "Chutes réutilisées" (reuse count, not a purchase quantity)
- Modifying `QuantityResult` type or `analyzeQuantities`
- Any new CSS variables or design tokens
