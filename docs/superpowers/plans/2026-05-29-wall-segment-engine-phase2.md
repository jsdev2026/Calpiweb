# Wall Segment Engine — Phase 2: Corner Geometry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le rendu rectangulaire des murs par des parallélogrammes avec coupes en onglet (miter) aux jonctions, et nettoyer le type `SnapResult`.

**Architecture:** Nouvelle fonction pure `computeCornerGeometry(walls): WallPolygon[]` dans `src/engine/geometry/wallGeometry.ts`. `WallDrawingCanvas` appelle cette fonction et rend des `<polygon>` SVG. La géométrie est calculée en coordonnées monde puis convertie en coordonnées écran au rendu.

**Tech Stack:** React 18, TypeScript, SVG, vitest

---

## Structure de fichiers

| Fichier | Action | Responsabilité |
|---|---|---|
| `src/engine/geometry/wallGeometry.ts` | Créer | `computeCornerGeometry` + types `WallPolygon` |
| `src/engine/geometry/wallGeometry.test.ts` | Créer | Tests unitaires géométrie |
| `src/components/plan/WallDrawingCanvas.tsx` | Modifier | Rendu polygone + import `useMemo` |
| `src/types/wall.ts` | Modifier | Supprimer `'free'` de `SnapResult.type` |

---

## Algorithme miter — référence

Pour un mur W (p1→p2, direction `d`, normale `n = {x: -d.y, y: d.x}`, demi-épaisseur `half`) rejoignant un voisin N au point `corner` :

```
awayW   = direction de W s'éloignant de corner (= d si corner=p1, = -d si corner=p2)
awayN   = direction de N s'éloignant de corner (calculée depuis N.p1/p2)
bisector = normalize(awayW + awayN)
cut      = { x: -bisector.y, y: bisector.x }  (perpendiculaire au bisecteur)

t = (half × side) / dot(n, cut)    où side = +1 (côté normal) ou -1 (côté anti-normal)
vertex = corner + t × cut
```

Sans voisin : `vertex = corner ± n × half` (coupe plate perpendiculaire).

**Dégénérescence** : si `|bisector| < 0.5` (murs anti-parallèles) ou `|dot(n, cut)| < 1e-6`, utiliser la coupe plate.

---

## Task 1: `computeCornerGeometry` + tests

**Files:**
- Create: `src/engine/geometry/wallGeometry.ts`
- Create: `src/engine/geometry/wallGeometry.test.ts`

- [ ] **Step 1 — Écrire les tests (failing)**

```typescript
// src/engine/geometry/wallGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { computeCornerGeometry } from './wallGeometry';
import type { Wall } from '@/types/wall';

function pt(x: number, y: number) { return { x, y }; }

function near(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number },
  eps = 0.01,
): boolean {
  if (!a) return false;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

describe('computeCornerGeometry', () => {
  it('preserves wallId', () => {
    const walls: Wall[] = [{ id: 'abc', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    expect(computeCornerGeometry(walls)[0]!.wallId).toBe('abc');
  });

  it('returns empty points for zero-length wall', () => {
    const walls: Wall[] = [{ id: 'z', p1: pt(0,0), p2: pt(0,0), thickness: 10 }];
    expect(computeCornerGeometry(walls)[0]!.points).toHaveLength(0);
  });

  it('single horizontal wall — flat caps, 4 points', () => {
    // Wall from (0,0) to (100,0), thickness 10, half=5
    // dir=(1,0), normal=(0,1)
    // p1 flat cap: n-side=(0,5), anti-n=(0,-5)
    // p2 flat cap: n-side=(100,5), anti-n=(100,-5)
    // Polygon order: [p1_n, p2_n, p2_a, p1_a]
    const walls: Wall[] = [{ id: 'h', p1: pt(0,0), p2: pt(100,0), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], pt(0, 5))).toBe(true);    // p1 normal-side
    expect(near(pts[1], pt(100, 5))).toBe(true);  // p2 normal-side
    expect(near(pts[2], pt(100, -5))).toBe(true); // p2 anti-normal
    expect(near(pts[3], pt(0, -5))).toBe(true);   // p1 anti-normal
  });

  it('single vertical wall — flat caps', () => {
    // Wall from (0,0) to (0,100), thickness 10
    // dir=(0,1), normal=(-1,0)
    // p1: n-side=(-5,0), anti-n=(5,0)
    // p2: n-side=(-5,100), anti-n=(5,100)
    const walls: Wall[] = [{ id: 'v', p1: pt(0,0), p2: pt(0,100), thickness: 10 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5, 0))).toBe(true);
    expect(near(pts[1], pt(-5, 100))).toBe(true);
    expect(near(pts[2], pt(5, 100))).toBe(true);
    expect(near(pts[3], pt(5, 0))).toBe(true);
  });

  it('two walls at 90° — miter at shared corner', () => {
    // W1 right: (0,0)→(100,0), W2 down: (100,0)→(100,100), both thickness=10
    // At shared corner (100,0):
    //   W1: awayW=(-1,0), awayN=(0,1), normal=(0,1)
    //     bisector=(-1/√2,1/√2), cut=(-1/√2,-1/√2)
    //     denom=dot((0,1),(-1/√2,-1/√2))=-1/√2
    //     n-side:  t=5/(-1/√2)=-5√2 → (100,0)+(-5√2)(-1/√2,-1/√2)=(105,5)
    //     anti-n:  t=5√2 → (100,0)+(5√2)(-1/√2,-1/√2)=(95,-5)
    const w1: Wall = { id: 'w1', p1: pt(0,0), p2: pt(100,0), thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0), p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    // W1 p2 (miter): n-side and anti-n
    expect(near(p1.points[1], pt(105, 5))).toBe(true);
    expect(near(p1.points[2], pt(95, -5))).toBe(true);
    // W1 p1 (flat): unchanged
    expect(near(p1.points[0], pt(0, 5))).toBe(true);
    expect(near(p1.points[3], pt(0, -5))).toBe(true);
  });

  it('miter vertices tile without gaps (no seam at shared corner)', () => {
    const w1: Wall = { id: 'w1', p1: pt(0,0), p2: pt(100,0), thickness: 10 };
    const w2: Wall = { id: 'w2', p1: pt(100,0), p2: pt(100,100), thickness: 10 };
    const polys = computeCornerGeometry([w1, w2]);
    const p1 = polys.find(p => p.wallId === 'w1')!;
    const p2 = polys.find(p => p.wallId === 'w2')!;
    // W1 n-side at p2 == W2 anti-n at p1
    expect(near(p1.points[1], p2.points[3]!)).toBe(true);
    // W1 anti-n at p2 == W2 n-side at p1
    expect(near(p1.points[2], p2.points[0]!)).toBe(true);
  });

  it('diagonal wall (45°) — flat caps are perpendicular to wall', () => {
    // Wall from (0,0) to (100,100), thickness=10√2 ≈ 14.14
    // dir=(1/√2,1/√2), normal=(-1/√2,1/√2), half=5√2
    // p1 n-side: (0,0)+(-5√2)(1/√2,−1/√2)... wait let me recalc
    // normal = (-1/√2, 1/√2) × ... actually normal=(-dir.y,dir.x)=(-1/√2,1/√2)
    // p1 n-side = (0,0)+half*normal = (0,0)+5√2*(-1/√2,1/√2) = (-5,5)
    // p1 anti-n = (0,0)-5√2*(-1/√2,1/√2) = (5,-5)
    const walls: Wall[] = [{ id: 'd', p1: pt(0,0), p2: pt(100,100), thickness: 10*Math.SQRT2 }];
    const pts = computeCornerGeometry(walls)[0]!.points;
    expect(near(pts[0], pt(-5, 5))).toBe(true);
    expect(near(pts[3], pt(5, -5))).toBe(true);
  });
});
```

- [ ] **Step 2 — Vérifier que les tests échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallGeometry.test.ts 2>&1 | tail -8
```

Expected: FAIL "Cannot find module './wallGeometry'".

- [ ] **Step 3 — Créer `src/engine/geometry/wallGeometry.ts`**

```typescript
// src/engine/geometry/wallGeometry.ts
import type { Wall } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points, clockwise: [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1] */
  points: Point[];
}

/** Euclidean distance. */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Dot product. */
function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** Normalize; returns zero vector on degenerate input. */
function normalize(v: Point): Point {
  const l = Math.sqrt(v.x * v.x + v.y * v.y);
  return l < 1e-10 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

/** 90° counter-clockwise rotation. */
function perp(v: Point): Point {
  return { x: -v.y, y: v.x };
}

/** Endpoints within this world-unit distance are considered coincident. */
const ENDPOINT_TOL = 2;

/**
 * Compute a miter corner vertex.
 *
 * @param corner     - The shared endpoint (world coords)
 * @param awayW      - Unit vector from corner ALONG W toward W's other endpoint
 * @param wallNormal - W's left normal: { x: -dir.y, y: dir.x }, always based on p1→p2
 * @param awayN      - Unit vector from corner ALONG the neighbor toward its other endpoint
 * @param half       - W's half-thickness
 * @param side       - +1 = normal-side vertex, -1 = anti-normal-side vertex
 */
function miterCorner(
  corner: Point,
  awayW: Point,
  wallNormal: Point,
  awayN: Point,
  half: number,
  side: 1 | -1,
): Point {
  const bis = normalize({ x: awayW.x + awayN.x, y: awayW.y + awayN.y });
  // Degenerate: anti-parallel walls (U-turn) → flat cap
  if (bis.x === 0 && bis.y === 0) {
    return { x: corner.x + wallNormal.x * half * side, y: corner.y + wallNormal.y * half * side };
  }
  const cut = perp(bis);
  const denom = dot(wallNormal, cut);
  // Degenerate: near-parallel walls → flat cap
  if (Math.abs(denom) < 1e-6) {
    return { x: corner.x + wallNormal.x * half * side, y: corner.y + wallNormal.y * half * side };
  }
  const t = (half * side) / denom;
  return { x: corner.x + t * cut.x, y: corner.y + t * cut.y };
}

/**
 * Return the first wall (other than wallId) that has an endpoint within ENDPOINT_TOL of pt.
 */
function findNeighbor(wallId: string, pt: Point, walls: Wall[]): Wall | null {
  for (const w of walls) {
    if (w.id === wallId) continue;
    if (dist(w.p1, pt) < ENDPOINT_TOL || dist(w.p2, pt) < ENDPOINT_TOL) return w;
  }
  return null;
}

/**
 * Return unit vector from corner ALONG neighbor toward its other endpoint.
 */
function awayFromCorner(neighbor: Wall, corner: Point): Point {
  const other = dist(neighbor.p1, corner) < ENDPOINT_TOL ? neighbor.p2 : neighbor.p1;
  return normalize({ x: other.x - corner.x, y: other.y - corner.y });
}

/**
 * Compute SVG polygon points for each wall, applying miter cuts at joined corners.
 *
 * Each wall becomes a 4-point polygon [normal-p1, normal-p2, anti-normal-p2, anti-normal-p1].
 * Zero-length walls return an empty points array.
 */
export function computeCornerGeometry(walls: Wall[]): WallPolygon[] {
  return walls.map((wall) => {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.1) return { wallId: wall.id, points: [] };

    const dir: Point = { x: dx / len, y: dy / len };
    const n: Point = { x: -dir.y, y: dir.x };  // left normal, fixed p1→p2 orientation
    const half = wall.thickness / 2;

    // away-from-corner direction for W at each endpoint
    const awayP1 = dir;                                         // from p1 toward p2
    const awayP2: Point = { x: -dir.x, y: -dir.y };            // from p2 toward p1

    const nbP1 = findNeighbor(wall.id, wall.p1, walls);
    const nbP2 = findNeighbor(wall.id, wall.p2, walls);

    const p1_n: Point = nbP1
      ? miterCorner(wall.p1, awayP1, n, awayFromCorner(nbP1, wall.p1), half, +1)
      : { x: wall.p1.x + n.x * half, y: wall.p1.y + n.y * half };
    const p1_a: Point = nbP1
      ? miterCorner(wall.p1, awayP1, n, awayFromCorner(nbP1, wall.p1), half, -1)
      : { x: wall.p1.x - n.x * half, y: wall.p1.y - n.y * half };

    const p2_n: Point = nbP2
      ? miterCorner(wall.p2, awayP2, n, awayFromCorner(nbP2, wall.p2), half, +1)
      : { x: wall.p2.x + n.x * half, y: wall.p2.y + n.y * half };
    const p2_a: Point = nbP2
      ? miterCorner(wall.p2, awayP2, n, awayFromCorner(nbP2, wall.p2), half, -1)
      : { x: wall.p2.x - n.x * half, y: wall.p2.y - n.y * half };

    return {
      wallId: wall.id,
      points: [p1_n, p2_n, p2_a, p1_a],
    };
  });
}
```

- [ ] **Step 4 — Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallGeometry.test.ts 2>&1 | tail -8
```

Expected: tous les tests PASS.

- [ ] **Step 5 — Commit**

```bash
git add src/engine/geometry/wallGeometry.ts src/engine/geometry/wallGeometry.test.ts
git commit -m "feat(wall-engine): computeCornerGeometry — miter joints"
```

---

## Task 2: WallDrawingCanvas — rendu polygone

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

Remplacer le rendu `<rect>` rotatif par des `<polygon>` calculés depuis `computeCornerGeometry`. Garder le `<rect>` rotatif uniquement pour le preview de la chaîne en cours.

- [ ] **Step 1 — Modifier `src/components/plan/WallDrawingCanvas.tsx`**

**1a.** Ajouter les imports en tête de fichier (après les imports existants) :

```typescript
import { useMemo } from 'react';
import { computeCornerGeometry } from '@/engine/geometry/wallGeometry';
```

Note : `useMemo` n'est peut-être pas encore importé — ajouter à l'import de React existant s'il est déjà là, sinon ajouter une ligne séparée.

Vérifier la ligne 3 : `import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react';`
→ Remplacer par :

```typescript
import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent } from 'react';
```

**1b.** Ajouter le calcul des polygones juste avant le `return`, après `editingScreen` (ligne ~220) :

```typescript
const wallPolygons = useMemo(() => computeCornerGeometry(walls), [walls]);
```

**1c.** Remplacer le bloc `{/* Rendered walls */}` (lignes 242-258, le `walls.map` qui rend les `<rect>`) par :

```tsx
{/* Rendered walls */}
{wallPolygons.map((poly) => {
  if (!poly.points.length) return null;
  const isSelected = poly.wallId === selectedWallId;
  const color = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
  const screenPts = poly.points
    .map((p) => worldToScreen(p))
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
  return (
    <polygon
      key={poly.wallId}
      points={screenPts}
      fill={color}
    />
  );
})}
```

**1d.** Supprimer la fonction `wallToRect` (lignes 204-214) et la constante `halfThickPx` (si elle n'est plus utilisée). Vérifier que `halfThickPx` n'est pas utilisée ailleurs dans le fichier :

```bash
grep -n "halfThickPx\|wallToRect" /workspaces/Calpiweb/src/components/plan/WallDrawingCanvas.tsx
```

Si `halfThickPx` est seulement utilisée dans `wallToRect` (et nulle part ailleurs), supprimer les deux. Le preview chain utilise son propre calcul inline `(DEFAULT_THICKNESS / 2) * scale`.

- [ ] **Step 2 — Vérifier TypeScript compile**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | grep "WallDrawingCanvas" | head -10
```

Expected: aucune erreur sur `WallDrawingCanvas.tsx`.

- [ ] **Step 3 — Vérifier les tests existants passent**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -8
```

Expected: tous les tests passent (300+8 nouveaux = 308).

- [ ] **Step 4 — Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — rendu polygone miter"
```

---

## Task 3: Nettoyage `SnapResult.type`

**Files:**
- Modify: `src/types/wall.ts`

Le membre `'free'` de `SnapResult.type` est mort : `snapToWalls` retourne `null` (pas `{type:'free'}`) pour le placement libre, et aucun code ne vérifie `type === 'free'`. Le supprimer évite de tromper les futurs lecteurs.

- [ ] **Step 1 — Modifier `src/types/wall.ts`**

Trouver :
```typescript
export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'free';
  wallId?: string;
}
```

Remplacer par :
```typescript
export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face';
  wallId?: string;
}
```

- [ ] **Step 2 — Vérifier TypeScript compile**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -10
```

Expected: aucune nouvelle erreur (suppression de `'free'` ne brise rien car elle n'était jamais utilisée).

- [ ] **Step 3 — Vérifier les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -8
```

Expected: tous les tests PASS.

- [ ] **Step 4 — Commit**

```bash
git add src/types/wall.ts
git commit -m "fix(wall-engine): supprimer SnapResult.type 'free' inutilisé"
```

---

## Tests de régression finaux

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -10
```

Expected: 308 tests PASS (300 anciens + 8 nouveaux dans `wallGeometry.test.ts`).

---

## Hors périmètre Phase 2

- Cotations automatiques (`computeAutoCotations`) → Phase 3
- Gestion de plus d'un voisin par extrémité (jonctions multiples)
- Anti-aliasing des arêtes SVG (stroke fin sur le contour)
