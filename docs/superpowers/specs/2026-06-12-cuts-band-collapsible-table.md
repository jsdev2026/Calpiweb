# Cuts Band — Collapsible Table Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Problem

The "Groupes de coupes" band (introduced in the [2026-06-12 Quantities page restructure](2026-06-12-quantities-page-restructure.md)) is a horizontally-scrollable row of vertical mini-cards below the plan. The user reports it:

- Takes too much vertical space below the plan, which is supposed to be the centerpiece
- Is not visually harmonious and is hard to understand at a glance

## Goals

- Free up vertical space for the plan by default
- Present the cut group information in a clearer, more scannable layout
- Keep the existing hover-to-highlight interaction with the plan

## Design

### 1. Header bar (always visible)

Replaces the current `Groupes de coupes (N)` label with a clickable accordion header, collapsed by default:

> `▸ Groupes de coupes (7) — 18 carreaux à couper, 6 récupérées`

- `▸` when collapsed, `▾` when expanded
- Summary stats (`X carreaux à couper`, `Y récupérées`) come from `result.cuts.length` and `result.totalReuseCount` — already computed in `QuantitiesPanel`
- Same visual language as the "Consommables" accordion in `QuantitiesRecapColumn` (uppercase tracked label, `▸`/`▾` toggle) for consistency

### 2. Expanded content — table layout

When expanded, a table appears below the header bar, one row per merged cut group (`mergedCutGroups`, from `mergeSimilarCutGroups`, unchanged logic):

| Column | Content |
|--------|---------|
| # | Numbered badge, colored per `GROUP_COLORS[i % GROUP_COLORS.length]` (same as today) |
| Miniature | `TileThumbnail` (smaller than today's card version, e.g. ~24px max dimension) |
| Dimensions | `{formatCm(usedW)}×{formatCm(usedH)}` |
| Détail | `Chute {formatCm(chuteW)}×{formatCm(chuteH)}` if `hasBigChute` (chuteW > 20 && chuteH > 20), else `↩ N taillée(s) dans une chute` if `reuseCount > 0`, else empty |
| Nets | `netTiles`, styled green if `reuseCount > 0` (same convention as today) |

- Compact row height, aligned columns via a `<table>` or CSS grid — no horizontal scroll
- Hovering a row calls `onHighlight(group.originalIndices[0]! + 1)` on enter, `onHighlight(null)` on leave — identical mapping to the current implementation (see inline comment in `QuantitiesPanel.tsx`)

### 3. Space management

- Collapsed (default, `cutsOpen = false`): only the header bar renders, the plan (`plan-section`, `flex-1`) gets full height of the main area
- Expanded: the table area gets `max-height` + `overflow-y-auto` (same pattern as the recap column scroll fix in `QuantitiesRecapColumn.tsx`), so the plan retains a reasonable share of height even with many groups

---

## Architecture

| Action | File | Responsibility |
|--------|------|-----------------|
| Modify | `src/components/quantities/QuantitiesPanel.tsx` | Cuts-band section becomes a collapsible accordion (`cutsOpen` state, default `false`); header shows count + summary stats; renders `CutGroupsTable` when expanded |
| Create | `src/components/quantities/CutGroupsTable.tsx` | Renders the table — one row per merged cut group, reusing `TileThumbnail` and `GROUP_COLORS` from `CutGroupCard.tsx` |
| Create | `src/components/quantities/CutGroupsTable.test.tsx` | Tests: renders one row per merged group, renders dimensions/chute/reuse/nets correctly, calls `onHighlight` on row hover/unhover |
| Delete | `src/components/quantities/CutGroupCardCompact.tsx` | Superseded by `CutGroupsTable` |
| Delete | `src/components/quantities/CutGroupCardCompact.test.tsx` | Tests the removed component |
| Unchanged | `src/components/quantities/CutGroupCard.tsx` | `TileThumbnail` and `GROUP_COLORS` remain exported and reused |
| Unchanged | `src/components/quantities/QuantitiesRecapColumn.tsx`, `QuantityPlanView.tsx`, `QuantitiesPrintView.tsx` | No changes — print view and recap column logic are independent of this restructure |

---

## Removed / Changed Interaction

- `data-testid="cuts-band"` container remains, but its internal structure changes: header bar (always visible) + conditional table (only when `cutsOpen`)
- Horizontal-scroll row of `CutGroupCardCompact` cards is removed entirely

## Kept

- `highlightGroup` state and hover wiring (same index mapping via `originalIndices[0]`)
- `mergedCutGroups` computation (`mergeSimilarCutGroups`, unchanged)
- `GROUP_COLORS`, `TileThumbnail` from `CutGroupCard.tsx`

---

## Testing

- `QuantitiesPanel` integration test: cuts band renders collapsed by default (table not present), header shows count + summary stats, clicking the header expands the table, hovering a table row sets `highlightGroup`
- `CutGroupsTable` unit tests: one row per merged group, dimensions/chute/reuse/nets render correctly, `onHighlight` called on row hover/unhover
