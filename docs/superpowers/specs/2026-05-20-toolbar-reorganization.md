# Toolbar Reorganization — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

## Changes

Single file: `src/components/plan/PlanToolbar.tsx`

### 1. Move `WallThicknessControl`

From: bottom of toolbar (after Actions)  
To: immediately after SELECT + WALL, before the first divider

**Rationale:** Thickness is a property of the wall drawing action. Placing it next to WALL makes the connection immediate.

### 2. Move DOOR to zone/openings group

From: drawing tools group (with SELECT + WALL)  
To: openings & zones group (with PARTITION + EXCLUDE)

**Rationale:** A door is an opening in a wall — it modifies the room envelope like partitions and excluded zones do, not a drawing primitive like SELECT or WALL.

## New toolbar order

1. SELECT
2. WALL
3. WallThicknessControl  ← moved up
4. ─ divider ─
5. DOOR                  ← moved down
6. PARTITION
7. EXCLUDE
8. ─ divider ─
9. H, V, ⊗, 📐, E, 📌 (constraints)
10. ─ divider ─
11. ↩ ↪ 🗑 (actions)

## Out of scope

No tooltip changes, no new tools, no logic changes anywhere else.
