# Snap Colinéaire + Réduction Force — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire la force de l'aimantation (~30 %) et ajouter un snap colinéaire qui permet d'aligner un nœud ou un nouveau mur sur la droite d'un mur existant.

**Architecture:** Deux nouvelles fonctions dans `wallSnap.ts` (`collinearSnap` pour le dessin, `collinearSnapForNode` pour le drag), extension du type `SnapResult` avec `'collinear'` et `dir?: Point`, intégration dans le canvas avec indicateur visuel violet.

**Tech Stack:** TypeScript, Vitest, React/SVG.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/types/wall.ts` | Étendre `SnapResult.type` + ajouter `dir?: Point` |
| `src/engine/geometry/wallSnap.ts` | Ajouter `collinearSnap` + `collinearSnapForNode` |
| `src/engine/geometry/wallSnap.test.ts` | Ajouter tests pour les deux nouvelles fonctions |
| `src/components/plan/WallDrawingCanvas.tsx` | Constantes + imports + appels snap + indicateur visuel |

---

### Task 1 : Types + fonctions snap colinéaire + tests

**Files:**
- Modify: `src/types/wall.ts`
- Modify: `src/engine/geometry/wallSnap.ts`
- Modify: `src/engine/geometry/wallSnap.test.ts`

- [ ] **Step 1 : Écrire les tests qui doivent échouer**

Dans `src/engine/geometry/wallSnap.test.ts`, modifier la ligne 3 :

```ts
import { snapToWalls, perpendicularSnapForNode, adjacentAxisSnapForNode, collinearSnap, collinearSnapForNode } from './wallSnap';
```

Ajouter à la fin du fichier :

```ts
describe('collinearSnap', () => {
  const nodes = [nd('n1', 0, 0), nd('n2', 200, 0)];
  const walls: Wall[] = [{ id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 20 }];

  it('snappe le curseur sur la droite infinie du mur (milieu du segment)', () => {
    const r = collinearSnap({ x: 100, y: 8 }, walls, nodes, 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it("snappe au-delà de l'extrémité du mur (extension)", () => {
    const r = collinearSnap({ x: 300, y: 5 }, walls, nodes, 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(300);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('retourne null quand le curseur est trop loin de la droite', () => {
    const r = collinearSnap({ x: 100, y: 20 }, walls, nodes, 1, 12);
    expect(r).toBeNull();
  });

  it('peuple dir avec la direction normalisée du mur', () => {
    const r = collinearSnap({ x: 100, y: 5 }, walls, nodes, 1, 12);
    expect(r?.dir?.x).toBeCloseTo(1);
    expect(r?.dir?.y).toBeCloseTo(0);
  });
});

describe('collinearSnapForNode', () => {
  const A = nd('a', 0, 0);
  const B = nd('b', 200, 0);

  it('snappe le curseur sur la droite A-B', () => {
    const r = collinearSnapForNode({ x: 100, y: 8 }, [A, B], 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('retourne null avec un seul nœud adjacent (pas de paire)', () => {
    const r = collinearSnapForNode({ x: 100, y: 5 }, [A], 1, 12);
    expect(r).toBeNull();
  });

  it('retourne null quand le curseur est trop loin', () => {
    const r = collinearSnapForNode({ x: 100, y: 20 }, [A, B], 1, 12);
    expect(r).toBeNull();
  });

  it('fonctionne avec une paire diagonale', () => {
    const C = nd('c', 0, 0), D = nd('d', 100, 100);
    // Droite y=x. Curseur à (50, 55) → dist = |55-50|/√2 ≈ 3.5 < 12 → snap à (52.5, 52.5)
    const r = collinearSnapForNode({ x: 50, y: 55 }, [C, D], 1, 12);
    expect(r?.type).toBe('collinear');
    expect(r?.point.x).toBeCloseTo(52.5, 0);
    expect(r?.point.y).toBeCloseTo(52.5, 0);
  });

  it('peuple dir avec la direction normalisée de la paire', () => {
    const r = collinearSnapForNode({ x: 100, y: 5 }, [A, B], 1, 12);
    expect(r?.dir?.x).toBeCloseTo(1);
    expect(r?.dir?.y).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/geometry/wallSnap.test.ts
```

Attendu : FAIL — `collinearSnap is not exported`

- [ ] **Step 3 : Étendre `SnapResult` dans `src/types/wall.ts`**

Remplacer la ligne 26 :

```ts
// Avant
type: 'endpoint' | 'face' | 'hv' | 'perpendicular';

// Après
type: 'endpoint' | 'face' | 'hv' | 'perpendicular' | 'collinear';
```

Et ajouter `dir?: Point` après `axis?: 'h' | 'v'` (ligne 29) :

```ts
export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv' | 'perpendicular' | 'collinear';
  wallId?: string;
  nodeId?: string;
  axis?: 'h' | 'v';
  dir?: Point;  // direction normalisée — utilisée par le snap colinéaire
}
```

- [ ] **Step 4 : Ajouter `collinearSnap` et `collinearSnapForNode` dans `src/engine/geometry/wallSnap.ts`**

Ajouter à la FIN du fichier (après `perpendicularSnapForNode`) :

```ts
/**
 * Snap colinéaire pour le DESSIN : projette le curseur sur la droite
 * INFINIE de chaque mur existant. Permet de prolonger un mur en ligne droite.
 */
export function collinearSnap(
  cursor: Point,
  walls: Wall[],
  nodes: WallNode[],
  scale: number,
  snapPx: number,
): SnapResult | null {
  const r = snapPx / scale;
  let best: { point: Point; dist: number; dir: Point } | null = null;

  for (const wall of walls) {
    const n1 = nodes.find(n => n.id === wall.node1Id);
    const n2 = nodes.find(n => n.id === wall.node2Id);
    if (!n1 || !n2) continue;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    const dir: Point = { x: dx / len, y: dy / len };
    const t = ((cursor.x - n1.x) * dx + (cursor.y - n1.y) * dy) / lenSq;
    const proj: Point = { x: n1.x + t * dx, y: n1.y + t * dy };
    const d = Math.hypot(cursor.x - proj.x, cursor.y - proj.y);
    if (d < r && (!best || d < best.dist)) best = { point: proj, dist: d, dir };
  }

  return best ? { point: best.point, type: 'collinear', dir: best.dir } : null;
}

/**
 * Snap colinéaire pour le DRAG de nœud : projette le curseur sur la droite
 * définie par chaque paire de nœuds adjacents. Permet de réaligner
 * des segments M-A et M-B sur la droite (A, B).
 */
export function collinearSnapForNode(
  cursor: Point,
  adjacentNodes: WallNode[],
  scale: number,
  snapPx: number,
): SnapResult | null {
  const r = snapPx / scale;
  let best: { point: Point; dist: number; dir: Point } | null = null;

  for (let i = 0; i < adjacentNodes.length; i++) {
    for (let j = i + 1; j < adjacentNodes.length; j++) {
      const A = adjacentNodes[i]!, B = adjacentNodes[j]!;
      const dx = B.x - A.x, dy = B.y - A.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1) continue;
      const len = Math.sqrt(lenSq);
      const dir: Point = { x: dx / len, y: dy / len };
      const t = ((cursor.x - A.x) * dx + (cursor.y - A.y) * dy) / lenSq;
      const proj: Point = { x: A.x + t * dx, y: A.y + t * dy };
      const d = Math.hypot(cursor.x - proj.x, cursor.y - proj.y);
      if (d < r && (!best || d < best.dist)) best = { point: proj, dist: d, dir };
    }
  }

  return best ? { point: best.point, type: 'collinear', dir: best.dir } : null;
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

```
npx vitest run src/engine/geometry/wallSnap.test.ts
```

Attendu : tous les tests PASS (existants + 9 nouveaux).

- [ ] **Step 6 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 7 : Commit**

```
git add src/types/wall.ts src/engine/geometry/wallSnap.ts src/engine/geometry/wallSnap.test.ts
git commit -m "feat(wallSnap): collinearSnap + collinearSnapForNode — aimantation colinéaire"
```

---

### Task 2 : Canvas — constantes + intégration + indicateur visuel

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 1 : Mettre à jour les imports et les constantes**

**Ligne 7** — ajouter `collinearSnap, collinearSnapForNode` à l'import :

```ts
import { snapToWalls, perpendicularSnapForNode, adjacentAxisSnapForNode, collinearSnap, collinearSnapForNode } from '@/engine/geometry/wallSnap';
```

**Lignes 18-20** — remplacer les 3 constantes et ajouter la 4ème :

```ts
const HV_SNAP_PX          = 15;  // était 20
const HV_SNAP_DRAG_PX     = 28;  // était 40
const PERP_SNAP_PX        = 22;  // était 30
const COLLINEAR_SNAP_PX   = 12;  // nouveau — snap colinéaire (dessin + drag)
```

- [ ] **Step 2 : Mettre à jour le snap pendant le dessin (handlePointerDown)**

Trouver le bloc autour des lignes 250-253 :

```ts
const snap = isCtrlPressed
  ? null
  : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
const pt = snap?.point ?? world;
```

Remplacer par :

```ts
const baseSnap = isCtrlPressed
  ? null
  : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
const snap = (isCtrlPressed || baseSnap?.type === 'endpoint')
  ? baseSnap
  : (collinearSnap(world, walls, nodes, scale, COLLINEAR_SNAP_PX) ?? baseSnap);
const pt = snap?.point ?? world;
```

- [ ] **Step 3 : Mettre à jour le snap pendant le déplacement de la souris (handlePointerMove)**

Trouver le bloc autour des lignes 479-483 :

```ts
const snap = isCtrlPressed
  ? null
  : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
setCursor(snap?.point ?? world);
setSnapResult(snap);
```

Remplacer par :

```ts
const baseSnap = isCtrlPressed
  ? null
  : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
const snap = (isCtrlPressed || baseSnap?.type === 'endpoint')
  ? baseSnap
  : (collinearSnap(world, walls, nodes, scale, COLLINEAR_SNAP_PX) ?? baseSnap);
setCursor(snap?.point ?? world);
setSnapResult(snap);
```

- [ ] **Step 4 : Mettre à jour le snap pendant le drag de nœud**

Trouver le bloc autour des lignes 439-462 :

```ts
let snap = null;
if (!isCtrlPressed) {
  const wallSnap = snapToWalls(world, snapWalls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_DRAG_PX);
  if (wallSnap?.type === 'endpoint') {
    snap = wallSnap;
  } else {
    const adjSnap = adjacentNodes.length > 0
      ? adjacentAxisSnapForNode(world, adjacentNodes, scale, HV_SNAP_DRAG_PX)
      : null;
    if (adjSnap && !adjSnap.axis) {
      snap = adjSnap;
    } else {
      const perpSnap = adjacentNodes.length >= 2
        ? perpendicularSnapForNode(world, adjacentNodes, scale, PERP_SNAP_PX)
        : null;
      snap = perpSnap ?? adjSnap ?? wallSnap;
    }
  }
}
```

Remplacer par :

```ts
let snap = null;
if (!isCtrlPressed) {
  const wallSnap = snapToWalls(world, snapWalls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_DRAG_PX);
  if (wallSnap?.type === 'endpoint') {
    snap = wallSnap;
  } else {
    const adjSnap = adjacentNodes.length > 0
      ? adjacentAxisSnapForNode(world, adjacentNodes, scale, HV_SNAP_DRAG_PX)
      : null;
    if (adjSnap && !adjSnap.axis) {
      // Intersection H+V : priorité max après endpoint
      snap = adjSnap;
    } else {
      const colSnap = adjacentNodes.length >= 2
        ? collinearSnapForNode(world, adjacentNodes, scale, COLLINEAR_SNAP_PX)
        : null;
      const perpSnap = adjacentNodes.length >= 2
        ? perpendicularSnapForNode(world, adjacentNodes, scale, PERP_SNAP_PX)
        : null;
      snap = colSnap ?? perpSnap ?? adjSnap ?? wallSnap;
    }
  }
}
```

- [ ] **Step 5 : Ajouter l'indicateur visuel colinéaire**

Dans le rendu SVG, trouver le bloc des guides H/V (autour de la ligne `{/* H/V snap guide lines */}`). Juste AVANT ce bloc, ajouter :

```tsx
{/* Snap colinéaire — ligne pointillée violette dans la direction du mur */}
{snapResult?.type === 'collinear' && snapResult.dir && cursor && (() => {
  const sc = worldToScreen(cursor);
  const d = snapResult.dir;
  const BIG = 2000;
  return (
    <line
      x1={sc.x - d.x * BIG} y1={sc.y - d.y * BIG}
      x2={sc.x + d.x * BIG} y2={sc.y + d.y * BIG}
      stroke="#8b5cf6" strokeWidth={1} strokeDasharray="6,3" opacity={0.6}
    />
  );
})()}
```

- [ ] **Step 6 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 7 : Lancer toute la suite de tests**

```
npx vitest run
```

Attendu : tous les tests passent.

- [ ] **Step 8 : Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-canvas): snap colinéaire + réduction force aimantation (HV 20→15, drag 40→28)"
```
