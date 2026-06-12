# Quantities Page Restructure — Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Problem

The current `QuantitiesPanel` (per [2026-05-22-quantities-panel-redesign.md](2026-05-22-quantities-panel-redesign.md)) packs too much into a tall, collapsible header band: title, format/joint/surface, a 4-card stat strip, and a consumables accordion — all above a two-column body (plan left, cut groups right). The user reports the whole page is hard to read and badly arranged:

- The most important number — **total to order** — is buried inside a 4-card grid, not visually prioritized.
- The header band has to collapse/pin to avoid eating the whole screen, adding interaction complexity (`collapsed`, `pinned`, scroll-to-collapse).
- The plan, the page's centerpiece, gets squeezed into half the width alongside the cut group sidebar.
- On mobile, a Plan/Coupes tab switcher hides content behind taps.

## Goals

- **"Total à commander" is the #1 piece of information** and must be immediately visible and visually dominant.
- **The plan is the centerpiece** — give it the most screen space, on both desktop and mobile.
- Keep the cut groups list close to the plan (hover-to-highlight interaction is preserved) but out of the way of the plan's width.
- Remove collapse/pin/sidebar-toggle interaction complexity — replace with a layout that doesn't need to hide itself.
- Same structural logic on desktop and mobile (no separate tab-based mobile mode).

---

## Architecture

No new store actions, no new types, no engine changes. Pure presentation restructure of `QuantitiesPanel` and its children.

| Action | File | Responsibility |
|--------|------|-----------------|
| Rewrite | `src/components/quantities/QuantitiesPanel.tsx` | Page shell: thin header, main area (plan + cuts band), recap column |
| Create | `src/components/quantities/QuantitiesRecapColumn.tsx` | Right-hand recap column: order hero, stat list, consumables accordion |
| Create | `src/components/quantities/CutGroupCardCompact.tsx` | Horizontal-scroll card variant of cut group info, imports `TileThumbnail`/`GROUP_COLORS` from `CutGroupCard.tsx` |
| Modify | `src/components/quantities/CutGroupCard.tsx` | Export `TileThumbnail` (currently a private function) alongside the existing `GROUP_COLORS` export; remove the now-unused `CutGroupCard` component and its props interface |
| Delete | `src/components/quantities/CutGroupCard.test.tsx` | Tests the removed `CutGroupCard` component; replaced by `CutGroupCardCompact.test.tsx` |
| Unchanged | `src/components/quantities/QuantityPlanView.tsx`, `QuantityPlanSvg.tsx` | Plan rendering; only the container size around it changes |
| Unchanged | `src/components/quantities/QuantitiesPrintView.tsx` | Print layout is independent of the on-screen restructure |

`ConsumableCard` and `PinButton` currently live inline in `QuantitiesPanel.tsx`. `ConsumableCard` moves into `QuantitiesRecapColumn.tsx` (it's only used there). `PinButton` and all `collapsed`/`pinned`/`sidebarOpen`/`mobileTab` state are deleted — no longer needed.

---

## Layout

Single layout, no separate mobile mode. On narrow screens the recap column moves above the main area (CSS flex-direction switch only — same DOM order is fine since the recap column is short).

```
Desktop (md and up) — flex-row:
┌──────────────────────────────── PAGE ─────────────────────────────────┐
│ HEADER (thin, single row): "Tableau des quantités" · format · joint ·  │
│         surface                                                        │
├─────────────────────────────────────────────┬─────────────────────────┤
│  MAIN AREA (flex: 1)                         │  RECAP COLUMN (230px)   │
│                                               │                         │
│  ┌─────────────────────────────────────────┐│  ┌─────────────────────┐│
│  │ PLAN ANNOTÉ                               ││  │ TOTAL À COMMANDER   ││
│  │ flex: 1 (remplit la hauteur disponible)  ││  │ (hero, orange)      ││
│  │                                           ││  │ 84 carreaux ·33.6m² ││
│  │                                           ││  │ détail calcul+marge ││
│  └─────────────────────────────────────────┘│  ├─────────────────────┤│
│  ┌─────────────────────────────────────────┐│  │ Carreaux entiers  72││
│  │ GROUPES DE COUPES — scroll horizontal    ││  │ À couper          18││
│  │ [card][card][card][card]...          →   ││  │ Récupérées         6││
│  └─────────────────────────────────────────┘│  ├─────────────────────┤│
│                                               │  │ ▸ Consommables      ││
│                                               │  └─────────────────────┘│
└───────────────────────────────────────────────┴─────────────────────────┘

Mobile/tablet (< md) — flex-col:
┌──────────────── PAGE ────────────────┐
│ HEADER (thin)                        │
├───────────────────────────────────────┤
│ RECAP COLUMN (full width, collapsible,│
│  default open)                        │
├───────────────────────────────────────┤
│ PLAN ANNOTÉ (flex: 1)                 │
├───────────────────────────────────────┤
│ GROUPES DE COUPES — scroll horizontal │
└───────────────────────────────────────┘
```

### 1. Header

A single fixed-height row, never collapses:

- Left: `<h2>Tableau des quantités</h2>`
- Right (or wraps below on very narrow screens): `Format: 60×60 — Joint: 2mm — Surface: 33.6 m²` (existing text content from the current header, same formatting helpers)

No pin button, no collapse animation, no `bandeaux-wrapper`/`collapsed-bar` test ids.

### 2. Main area — Plan

`QuantityPlanView` wrapped in a `flex-1` container that fills all remaining vertical space in the main area (after the cuts band). No behavior change to the plan itself — same props (`result`, `config`, `rooms`, `highlightGroup`, `wallPolygons`, `doorOpenings`).

### 3. Main area — Cut groups band

Below the plan, a horizontally-scrollable row of compact cards (`CutGroupCardCompact`), one per merged cut group (`mergedCutGroups`, unchanged logic from `mergeSimilarCutGroups`). Each card shows, in a vertical mini-layout:

- Group badge (number + color, same as today)
- `TileThumbnail` (same SVG thumbnail as today)
- Dimensions (`{usedW}×{usedH}`)
- Chute (if `hasBigChute`) or reuse note (`↩ N taillée(s) dans une chute`)
- Net tile count

Hover still calls `onHighlight(groupIndex + 1)` / `onHighlight(null)`, same as `CutGroupCard` today — this drives the plan highlight.

A small label above the row: `Groupes de coupes (N)`.

Footer line "Carreaux nets pour coupes: X carreaux" moves into the recap column (it's order-related info, fits naturally near the totals) — see below.

### 4. Recap column

Fixed width on desktop (~230px), full width on mobile, contains in order:

1. **Hero card "Total à commander"** (orange, prominent):
   - Big number: `result.toOrder`
   - Subtext: `formatM2(result.toOrder * result.tileW * result.tileH)`
   - Calculation detail + editable margin %, reusing the existing inline-edit interaction (`editingMargin`, `marginInput`, `handleMarginEdit`, `handleMarginCommit`, `handleMarginReset`) — same behavior, restyled into the hero card.
   - "Carreaux nets pour coupes: X" line (moved from the cuts band footer).

2. **Stat list** (compact rows, not cards): Carreaux entiers / À couper / Récupérées — same numbers as today's stat strip, reformatted as a vertical list of label/value rows instead of a grid of cards. Drop the per-stat m² sub-line (it's redundant with the hero's m² and the plan).

3. **Consumables accordion** (`▸ Consommables`): same content as today (`ConsumableCard` × 3 + tile-thickness input), same open/closed toggle (`consumablesOpen`), just moved into this column.

No print button is added — printing is already handled by the existing global "PDF" button in the project toolbar (`src/app/project/[id]/page.tsx`), which renders `QuantitiesPrintView` separately.

---

## Removed Interaction / State

From `QuantitiesPanel.tsx`, delete:
- `collapsed`, `pinned`, `handleCoupesScroll`, `handlePin`, `PinButton` component
- `sidebarOpen` and the `‹›` sidebar collapse toggle
- `mobileTab` and the Plan/Coupes tab bar
- `data-testid="bandeaux-wrapper"`, `"collapsed-bar"`, `"plan-section"`, `"coupes-section"` (replace with new test ids matching the new structure, e.g. `"plan-section"` can stay on the plan container, `"cuts-band"` and `"recap-column"` are new)

Kept:
- `highlightGroup` state and hover wiring
- `editingMargin` / `marginInput` and margin edit handlers
- `consumablesOpen` and consumables content
- `wallPolygons`, `doorOpenings`, `result`, `mergedCutGroups` computations

---

## Testing

- Existing tests referencing removed test ids/behaviors (`bandeaux-wrapper`, `collapsed-bar`, `plan-section`/`coupes-section` toggle, mobile tab bar, pin button) must be updated or removed.
- New tests for `QuantitiesRecapColumn`: renders total-to-order hero, margin edit interaction, consumables accordion toggle.
- New tests for `CutGroupCardCompact`: renders dimensions/chute/reuse/net count, calls `onHighlight` on hover.
- `QuantitiesPanel` integration test: verifies plan + cuts band + recap column all render together, hover on a compact cut card sets `highlightGroup`.
