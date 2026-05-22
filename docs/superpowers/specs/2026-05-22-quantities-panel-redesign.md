# QuantitiesPanel Redesign — Design Spec

**Date:** 2026-05-22
**Status:** Approved

## Problem

The current QuantitiesPanel (536 lines, single file) is hard to read for two reasons:

1. **A 7-column table** ("Détail des coupes") presents cut data in a technical format that is opaque to non-professionals.
2. **Disconnected sections**: the annotated plan, the cut table, and the order summary feel like three independent documents rather than one coherent report.

The page serves two use cases:
- **B — Client presentation**: explain the quote in a clear, professional way
- **C — Quantity verification**: let the user check that the tile count logic adds up

It is NOT a step-by-step on-site cutting guide (data is theoretical).

---

## Goals

- Make the layout readable on **paper** first (printed report), interactive second
- The plan is the centerpiece — it must be large and unambiguous
- The cut groups must be understandable by a non-professional
- The reuse logic ("chutes réutilisées") must be explained in plain language
- Hovering a cut group card highlights the corresponding tiles on the plan (screen only)

---

## Architecture

No new store actions, no new types. Pure presentation changes.

| Action | File | Responsibility |
|--------|------|----------------|
| Rewrite | `src/components/quantities/QuantitiesPanel.tsx` | Page shell, layout, side panel |
| Extract → Create | `src/components/quantities/QuantityPlanView.tsx` | SVG plan with hover highlighting |
| Extract → Create | `src/components/quantities/CutGroupCard.tsx` | Individual cut group card |
| Delete (inline) | `StatCard` sub-component in QuantitiesPanel | Replaced by simpler stat boxes |
| Delete (inline) | `TileThumbnail` sub-component in QuantitiesPanel | Moved into CutGroupCard |

The current `QuantityPlanView` and `TileThumbnail` functions stay in the same repo but are extracted to their own files.

---

## Layout

Two-column layout filling the full viewport height:

```
┌──────────────────────────── PAGE ─────────────────────────────┐
│ HEADER: "Tableau des quantités" · format · joint · surface    │
├─────────────────────────────┬─────────────────────────────────┤
│                             │                                 │
│   PLAN ANNOTÉ               │  ① 2 stat boxes                 │
│   flex: 1 (remplit tout)    │  ② Section "Groupes de coupes"  │
│                             │     → CutGroupCards             │
│   + légende en bas          │  ③ Total à commander            │
│                             │                                 │
└─────────────────────────────┴─────────────────────────────────┘
```

- **Left column**: `flex: 1` — takes all remaining width
- **Right column**: fixed `360px` wide, scrollable independently
- **Plan**: no `maxHeight` constraint — fills the available vertical space via `flex: 1`

---

## Section 1 — Header

Single line, same as current:

```
Tableau des quantités   Format: 30 × 30 cm   Joint: 2 mm   Surface: 7.20 m²
```

No change from current header.

---

## Section 2 — Plan (`QuantityPlanView.tsx`)

### Visual encoding

| Tile type | Fill | Label |
|-----------|------|-------|
| Whole tile | `config.color` at 70% opacity | — |
| Cut — group N | `#1e293b` (dark) | Circle with group number, colored per group |
| Reused cut | `#052e16` (dark green) | Circle with `↩` + group number in `#4ade80` |

Group colors: a fixed palette of 6 distinct colors (orange, violet, teal, rose, amber, sky), cycling if more than 6 groups.

### Hover highlighting (screen only, not print)

`QuantityPlanView` accepts a `highlightGroup: number | null` prop (1-indexed group number, `null` = no highlight).

When `highlightGroup` is set:
- Tiles NOT in the highlighted group: `opacity` drops to `0.12`
- Tiles IN the highlighted group (including reused): remain at full opacity, gain a CSS `filter: drop-shadow(0 0 8px <groupColor>88)`
- Transition: `opacity 0.15s ease, filter 0.15s ease` on each tile `<rect>`

### Legend

Below the SVG, a horizontal flex row of legend items:
- One item per used tile type: "Carreau entier", one item per cut group ("Coupe 1", "Coupe 2"…), "↩ Taillée dans une chute" (only if `totalReuseCount > 0`)

### Print

`@media print`:
- Remove `filter` and transition styles
- All tiles render at full opacity
- Legend visible

---

## Section 3 — Side Panel

### 3a — Stat boxes (top)

Two boxes side by side, replacing the current 4-StatCard grid:

| Box | Value | Sub |
|-----|-------|-----|
| Carreaux entiers | `result.wholeCount` | `formatM2(wholeCount × tileW × tileH)` |
| Carreaux à couper | `result.cuts.length` | `formatM2(totalCutArea)` posés |

`totalCutArea = result.cuts.reduce((sum, c) => sum + c.usedW * c.usedH, 0)`

Each box has a 2px colored top border (blue for entiers, orange for coupes).

### 3b — Cut group cards (`CutGroupCard.tsx`)

One card per `CutGroup` in `result.cutGroups`.

**Card anatomy:**

```
[ badge N ] [ thumbnail SVG ] [ info block          ] [ qty block ]
                               dim: 20 × 30 cm         ×5 total
                               Chute: 10 × 30 cm        5 nets
                               ↩ 2 taillées dans        (green if
                                 une chute              reused > 0)
```

- **Badge**: colored circle/square with group number (same color as on plan)
- **Thumbnail**: SVG showing the tile with the used portion filled, unused portion empty with dashed border. 44×44px. Same rendering as current `TileThumbnail`.
- **Dimensions**: `formatCm(usedW) × formatCm(usedH)` in bold
- **Chute sub-line**: `Chute disponible : formatCm(chuteW) × formatCm(chuteH)` — only if `chuteW > 20 && chuteH > 20`
- **Reuse badge**: if `reuseCount > 0`, show green pill `↩ N taillée(s) dans une chute`
- **Qty block** (right-aligned):
  - `×totalCount total` (muted)
  - `netTiles nets` — colored green if `reuseCount > 0`, white otherwise

**Hover interaction:**
- Card `onMouseEnter` → call `onHighlight(groupIndex + 1)`
- Card `onMouseLeave` → call `onHighlight(null)`
- Card visual: subtle background tint + left border in group color on hover

**Net summary row** (below all cards):
```
Carreaux nets pour coupes        9 carreaux
```
`result.tilesForCuts` total.

### 3c — Total à commander block

Orange-tinted block at the bottom of the side panel:

```
TOTAL À COMMANDER

35 entiers                    ┐
+  9 pour coupes              │     49
= 44 nets          ──────────→│  carreaux
×  1.10 (+10%)                ┘  2.94 m²
```

Left column: the breakdown in small text.
Right column: big number + "carreaux" label + m².

The breakdown uses `result.wholeCount`, `result.tilesForCuts`, `result.totalTiles`, `result.toOrder`, `result.toOrder * result.tileW * result.tileH`.

---

## What is Removed

| Current element | Replacement |
|-----------------|-------------|
| 7-column cut table (`<table>`) | CutGroupCard list |
| Separate "Récapitulatif de commande" orange block | Integrated into side panel section 3c |
| 4-StatCard grid at top of page | 2 stat boxes in side panel section 3a |
| `StatCard` sub-component | Inline stat box markup |
| `result.cutGroups.length` "formats distincts" sub text | Now shown implicitly — each distinct format is one card |

---

## Language Changes

| Before | After |
|--------|-------|
| "Chutes réutilisées" | "Taillée(s) dans une chute" |
| "N carreaux économisés" | "↩ N taillée(s) dans une chute" (on cut card) |
| "Aucune économie" | *(absent — no badge shown)* |
| "Coupes nécessaires" | "Carreaux à couper" |

---

## State Management

`QuantitiesPanel` owns `highlightGroup: number | null` via `useState`. It passes:
- `highlightGroup` down to `QuantityPlanView`
- `onHighlight(n)` callback down to each `CutGroupCard`

No store changes needed.

---

## Out of Scope

- Export / print button (separate feature)
- Clickable tiles on plan (hover only, no click)
- Mobile responsive layout (desktop-first tool)
- Any change to `analyzeQuantities` engine or `QuantityResult` type
