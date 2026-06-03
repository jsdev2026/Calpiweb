# Auto-cotations wall-engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher automatiquement des lignes de cote (hors-tout vert, vide utile bleu, mur isolé orange) sur le canvas WallDrawingCanvas, sans persistence ni interaction utilisateur.

**Architecture:** Module pur `wallCotation.ts` exporte `detectClosedPolygons` et `computeAutoCotations`. WallDrawingCanvas appelle `computeAutoCotations` dans un `useMemo` et rend les lignes SVG en coordonnées écran. Les anchors extérieurs proviennent directement des `WallPolygon.points` ; les anchors intérieurs sont calculés par intersection de faces via `interiorCorner`.

**Tech Stack:** TypeScript, React 18, SVG, Vitest

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/types/wall.ts` | Modifier — ajouter `AutoCotation` |
| `src/engine/geometry/wallCotation.ts` | Créer — `detectClosedPolygons`, `computeAutoCotations`, helpers |
| `src/engine/geometry/wallCotation.test.ts` | Créer — tests unitaires |
| `src/components/plan/WallDrawingCanvas.tsx` | Modifier — import, useMemo, rendu SVG |

---

## Notes géométriques pour l'implémenteur

Le module réutilise `computeCornerGeometry` (déjà dans `wallGeometry.ts`) pour obtenir les
polygones de murs. Ces polygones ont 4 points dans cet ordre :
```
points[0] = node1, côté +normal   points[1] = node2, côté +normal
points[3] = node1, côté -normal   points[2] = node2, côté -normal
```
où `normal = { x: -dir.y, y: dir.x }` (perpendiculaire gauche du vecteur directeur).

**Anchors extérieurs** : les `WallPolygon.points` du côté le plus éloigné du centroïde
sont exactement les coins de face extérieure (intersections géométriques des faces) → utilisation directe.

**Anchors intérieurs** : les `WallPolygon.points` du côté proche du centroïde sont des
artefacts de rendu (le mur s'étend dans l'angle pour couvrir les joints visuels) et ne
correspondent PAS aux coins intérieurs de la pièce. Il faut calculer l'intersection des
deux faces intérieures adjacentes via `interiorCorner`. Pour un angle de 90° et épaisseur 10 :
- Coin extérieur à node=(0,0) : (-5,-5) ✓ (vient du WallPolygon)
- Coin intérieur à node=(0,0) : (5,5) ✓ (doit être calculé via interiorCorner)

La direction passée à `interiorCorner` peut être dans n'importe quel sens (le résultat
est identique car on intersecte deux droites infinies). On peut donc toujours passer
`wallDir(wall, nodes)` sans se soucier du sens de parcours.

---

### Task 1 : Type `AutoCotation` dans `src/types/wall.ts`

**Files:**
- Modify: `src/types/wall.ts`
- Test: `src/engine/geometry/wallCotation.test.ts` (juste l'import)

- [ ] **Step 1 : Créer le fichier de test avec import**

Créer `src/engine/geometry/wallCotation.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { detectClosedPolygons, computeAutoCotations } from './wallCotation';
import type { Wall, WallNode, AutoCotation } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function w(id: string, n1: string, n2: string, t = 10): Wall {
  return { id, node1Id: n1, node2Id: n2, thickness: t };
}
```

- [ ] **Step 2 : Lancer — vérifier FAIL (module introuvable)**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallCotation.test.ts 2>&1 | tail -5
```

Expected : erreur "Cannot find module './wallCotation'".

- [ ] **Step 3 : Ajouter `AutoCotation` dans `src/types/wall.ts`**

Ajouter à la fin du fichier (après `DrawingChain`) :

```typescript
export interface AutoCotation {
  wallId: string;
  side: 'exterior' | 'interior' | 'isolated';
  anchor1: Point;
  anchor2: Point;
  normal: Point;
  offset: number;
  label: string;
}
```

- [ ] **Step 4 : Commit**

```bash
git add src/types/wall.ts src/engine/geometry/wallCotation.test.ts
git commit -m "feat(wall-cotation): AutoCotation type + test scaffold

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2 : `detectClosedPolygons` dans `wallCotation.ts`

**Files:**
- Create: `src/engine/geometry/wallCotation.ts`
- Test: `src/engine/geometry/wallCotation.test.ts`

- [ ] **Step 1 : Ajouter les tests `detectClosedPolygons`**

Ajouter dans `src/engine/geometry/wallCotation.test.ts` :

```typescript
// ── detectClosedPolygons ──────────────────────────────────────────────────

describe('detectClosedPolygons', () => {
  it('pièce rectangulaire 4 murs → 1 polygone avec 4 wallIds', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
    const walls = [w('w1','a','b'), w('w2','b','c'), w('w3','c','d'), w('w4','d','a')];
    const result = detectClosedPolygons(walls, nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.wallIds).toHaveLength(4);
    expect(new Set(result[0]!.wallIds)).toEqual(new Set(['w1','w2','w3','w4']));
  });

  it('4 murs fermés + 1 mur isolé → 1 polygone, mur isolé non inclus', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140),
                   nd('e',400,0), nd('f',500,0)];
    const walls = [w('w1','a','b'), w('w2','b','c'), w('w3','c','d'), w('w4','d','a'),
                   w('wi','e','f')];
    const result = detectClosedPolygons(walls, nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.wallIds).not.toContain('wi');
  });

  it('T-junction → 0 polygones', () => {
    // node b a 3 connexions : w1(a-b), w2(b-c), w3(b-m)
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0), nd('m',100,100)];
    const walls = [w('w1','a','b'), w('w2','b','c'), w('w3','b','m')];
    expect(detectClosedPolygons(walls, nodes)).toHaveLength(0);
  });

  it('2 murs ouverts → 0 polygones', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0)];
    const walls = [w('w1','a','b'), w('w2','b','c')];
    expect(detectClosedPolygons(walls, nodes)).toHaveLength(0);
  });

  it('mur unique isolé → 0 polygones', () => {
    const nodes = [nd('a',0,0), nd('b',100,0)];
    const walls = [w('w1','a','b')];
    expect(detectClosedPolygons(walls, nodes)).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Lancer — vérifier FAIL**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallCotation.test.ts 2>&1 | tail -8
```

Expected : FAIL — "Cannot find module './wallCotation'".

- [ ] **Step 3 : Créer `src/engine/geometry/wallCotation.ts` avec `detectClosedPolygons`**

```typescript
import type { Wall, WallNode, AutoCotation } from '@/types/wall';
import type { Point } from '@/types/plan';
import { computeCornerGeometry } from './wallGeometry';
import { formatCm } from '@/utils/formatters';

// ── Constantes ────────────────────────────────────────────────────────────
const COTE_OFFSET_EXT = 400; // mm depuis la face extérieure
const COTE_OFFSET_INT = 200; // mm depuis la face intérieure, vers l'intérieur
const COTE_OFFSET_ISO = 300; // mm depuis l'axe, mur isolé

// ── Helpers géométriques ──────────────────────────────────────────────────

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function nodePos(id: string, nodes: WallNode[]): Point {
  const n = nodes.find((n) => n.id === id);
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

function wallDir(wall: Wall, nodes: WallNode[]): Point {
  const p1 = nodePos(wall.node1Id, nodes);
  const p2 = nodePos(wall.node2Id, nodes);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

// ── detectClosedPolygons ──────────────────────────────────────────────────

/**
 * Trouve les polygones fermés simples dans le graphe de murs.
 * Limitation MVP : abandonne si un nœud a plus d'une arête disponible (T-junction).
 */
export function detectClosedPolygons(
  walls: Wall[],
  nodes: WallNode[],
): Array<{ wallIds: string[]; nodeIds: string[] }> {
  // Adjacence : nodeId → [{wallId, otherNodeId}]
  const adj = new Map<string, { wallId: string; otherNodeId: string }[]>();
  for (const wall of walls) {
    for (const [from, to] of [[wall.node1Id, wall.node2Id], [wall.node2Id, wall.node1Id]] as [string,string][]) {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push({ wallId: wall.id, otherNodeId: to });
    }
  }

  const result: Array<{ wallIds: string[]; nodeIds: string[] }> = [];
  const visitedWalls = new Set<string>();

  for (const wall of walls) {
    if (visitedWalls.has(wall.id)) continue;

    const startNodeId = wall.node1Id;
    const wallIds = [wall.id];
    const nodeIds = [startNodeId];
    let current = wall.node2Id;
    let prev = startNodeId;
    let valid = true;

    while (current !== startNodeId) {
      if (nodeIds.includes(current)) { valid = false; break; }
      nodeIds.push(current);

      const edges = (adj.get(current) ?? []).filter((e) => e.otherNodeId !== prev);
      if (edges.length !== 1 || visitedWalls.has(edges[0]!.wallId)) {
        valid = false; break;
      }

      wallIds.push(edges[0]!.wallId);
      prev = current;
      current = edges[0]!.otherNodeId;

      if (wallIds.length > walls.length) { valid = false; break; }
    }

    if (valid && wallIds.length >= 3) {
      for (const wId of wallIds) visitedWalls.add(wId);
      result.push({ wallIds, nodeIds });
    }
  }

  return result;
}
```

- [ ] **Step 4 : Lancer — vérifier PASS (les tests detectClosedPolygons)**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallCotation.test.ts 2>&1 | tail -10
```

Expected : les 5 tests `detectClosedPolygons` passent (les tests `computeAutoCotations` ne sont pas encore écrits).

- [ ] **Step 5 : Commit**

```bash
git add src/engine/geometry/wallCotation.ts src/engine/geometry/wallCotation.test.ts
git commit -m "feat(wall-cotation): detectClosedPolygons — DFS cycles simples sans T-junction

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3 : `computeAutoCotations` dans `wallCotation.ts`

**Files:**
- Modify: `src/engine/geometry/wallCotation.ts`
- Test: `src/engine/geometry/wallCotation.test.ts`

- [ ] **Step 1 : Ajouter les tests `computeAutoCotations`**

Ajouter dans `src/engine/geometry/wallCotation.test.ts` :

```typescript
// ── computeAutoCotations ──────────────────────────────────────────────────

describe('computeAutoCotations', () => {
  // Pièce rectangulaire : 200mm × 140mm, épaisseur 10mm (h=5)
  const rectNodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
  const rectWalls = [w('w1','a','b'), w('w2','b','c'), w('w3','c','d'), w('w4','d','a')];

  it('pièce 4 murs → 8 cotations (2 par mur)', () => {
    expect(computeAutoCotations(rectWalls, rectNodes)).toHaveLength(8);
  });

  it('côte extérieure du mur du haut plus longue que la côte intérieure', () => {
    const result = computeAutoCotations(rectWalls, rectNodes);
    const ext = result.find((c) => c.wallId === 'w1' && c.side === 'exterior')!;
    const int = result.find((c) => c.wallId === 'w1' && c.side === 'interior')!;
    const extLen = dist(ext.anchor1, ext.anchor2);
    const intLen = dist(int.anchor1, int.anchor2);
    expect(extLen).toBeGreaterThan(intLen);
  });

  it('label côte extérieure top = hors-tout = "21.0 cm" (200+2×5 = 210mm)', () => {
    const result = computeAutoCotations(rectWalls, rectNodes);
    const ext = result.find((c) => c.wallId === 'w1' && c.side === 'exterior')!;
    expect(ext.label).toBe('21.0 cm');
  });

  it('label côte intérieure top = vide utile = "19.0 cm" (200−2×5 = 190mm)', () => {
    const result = computeAutoCotations(rectWalls, rectNodes);
    const int = result.find((c) => c.wallId === 'w1' && c.side === 'interior')!;
    expect(int.label).toBe('19.0 cm');
  });

  it('mur isolé horizontal 150mm → 1 cotation isolated, label "15.0 cm"', () => {
    const isoNodes = [nd('p',0,0), nd('q',150,0)];
    const isoWalls = [w('wi','p','q')];
    const result = computeAutoCotations(isoWalls, isoNodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.side).toBe('isolated');
    expect(result[0]!.label).toBe('15.0 cm');
  });

  it('mur longueur 0 → aucune cotation', () => {
    const isoNodes = [nd('p',0,0), nd('q',0,0)];
    const isoWalls = [w('wi','p','q')];
    expect(computeAutoCotations(isoWalls, isoNodes)).toHaveLength(0);
  });

  it('mur isolé horizontal → normal = (0,1) (perpendiculaire gauche)', () => {
    const isoNodes = [nd('p',0,0), nd('q',100,0)];
    const isoWalls = [w('wi','p','q')];
    const result = computeAutoCotations(isoWalls, isoNodes);
    expect(result[0]!.normal.x).toBeCloseTo(0);
    expect(result[0]!.normal.y).toBeCloseTo(1);
  });
});

// Helper visible dans ce fichier uniquement (copie de l'helper interne)
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}
```

- [ ] **Step 2 : Lancer — vérifier FAIL**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallCotation.test.ts 2>&1 | tail -8
```

Expected : les nouveaux tests `computeAutoCotations` FAIL (fonction non exportée).

- [ ] **Step 3 : Ajouter les helpers internes et `computeAutoCotations` dans `wallCotation.ts`**

Ajouter après la fonction `detectClosedPolygons` (à la fin du fichier) :

```typescript
// ── Helpers internes pour computeAutoCotations ────────────────────────────

/** Normale intérieure du mur (côté le plus proche du centroïde). */
function interiorNormal(
  wall: Wall,
  nodes: WallNode[],
  poly: { points: Point[] } | undefined,
  centroid: Point,
): Point {
  const d = wallDir(wall, nodes);
  const nPlus: Point = { x: -d.y, y: d.x };
  if (!poly || poly.points.length < 4) return nPlus;
  const midPlus:  Point = { x: (poly.points[0]!.x + poly.points[1]!.x) / 2,
                             y: (poly.points[0]!.y + poly.points[1]!.y) / 2 };
  const midMinus: Point = { x: (poly.points[2]!.x + poly.points[3]!.x) / 2,
                             y: (poly.points[2]!.y + poly.points[3]!.y) / 2 };
  return dist(midPlus, centroid) < dist(midMinus, centroid)
    ? nPlus
    : { x: -nPlus.x, y: -nPlus.y };
}

/**
 * Calcule le coin intérieur de la pièce au nœud partagé entre wallA et wallB.
 * = intersection des droites (face intérieure de wallA) et (face intérieure de wallB).
 * Le sens des directions dA / dB est indifférent (droites infinies).
 */
function interiorCorner(
  nodeId: string,
  wallA: Wall, dA: Point, intNormA: Point,
  wallB: Wall, dB: Point, intNormB: Point,
  nodes: WallNode[],
): Point {
  const N = nodePos(nodeId, nodes);
  const pA: Point = { x: N.x + intNormA.x * wallA.thickness / 2,
                      y: N.y + intNormA.y * wallA.thickness / 2 };
  const pB: Point = { x: N.x + intNormB.x * wallB.thickness / 2,
                      y: N.y + intNormB.y * wallB.thickness / 2 };
  const denom = cross(dA, dB);
  if (Math.abs(denom) < 1e-6) return pA; // murs parallèles
  const diff: Point = { x: pB.x - pA.x, y: pB.y - pA.y };
  const t = cross(diff, dB) / denom;
  return { x: pA.x + t * dA.x, y: pA.y + t * dA.y };
}

// ── computeAutoCotations ──────────────────────────────────────────────────

export function computeAutoCotations(walls: Wall[], nodes: WallNode[]): AutoCotation[] {
  const polys    = computeCornerGeometry(walls, nodes);
  const polyMap  = new Map(polys.map((p) => [p.wallId, p]));
  const rooms    = detectClosedPolygons(walls, nodes);
  const wallsInRooms = new Set<string>();
  const result: AutoCotation[] = [];

  for (const room of rooms) {
    for (const wId of room.wallIds) wallsInRooms.add(wId);

    // Centroïde du polygone de la pièce
    const n = room.nodeIds.length;
    const centroid: Point = {
      x: room.nodeIds.reduce((s, id) => s + nodePos(id, nodes).x, 0) / n,
      y: room.nodeIds.reduce((s, id) => s + nodePos(id, nodes).y, 0) / n,
    };

    for (let i = 0; i < room.wallIds.length; i++) {
      const wallId = room.wallIds[i]!;
      const wall   = walls.find((w) => w.id === wallId);
      const poly   = polyMap.get(wallId);
      if (!wall || !poly || poly.points.length < 4) continue;

      const dir     = wallDir(wall, nodes);
      const nPlus: Point = { x: -dir.y, y: dir.x };
      const midPlus:  Point = { x: (poly.points[0]!.x + poly.points[1]!.x) / 2,
                                 y: (poly.points[0]!.y + poly.points[1]!.y) / 2 };
      const midMinus: Point = { x: (poly.points[2]!.x + poly.points[3]!.x) / 2,
                                 y: (poly.points[2]!.y + poly.points[3]!.y) / 2 };
      const plusIsInt = dist(midPlus, centroid) < dist(midMinus, centroid);

      // ── Anchors extérieurs (coins WallPolygon côté le plus éloigné) ──
      const extPt1  = plusIsInt ? poly.points[3]! : poly.points[0]!;
      const extPt2  = plusIsInt ? poly.points[2]! : poly.points[1]!;
      const extNorm = plusIsInt
        ? { x: -nPlus.x, y: -nPlus.y }
        : nPlus;

      result.push({
        wallId, side: 'exterior',
        anchor1: extPt1, anchor2: extPt2,
        normal: extNorm, offset: COTE_OFFSET_EXT,
        label: formatCm(dist(extPt1, extPt2)),
      });

      // ── Anchors intérieurs (intersection des faces intérieures adjacentes) ──
      const intNorm = plusIsInt ? nPlus : { x: -nPlus.x, y: -nPlus.y };

      const node1Id  = room.nodeIds[i]!;
      const node2Id  = room.nodeIds[(i + 1) % n]!;
      const adjIdx1  = (i - 1 + room.wallIds.length) % room.wallIds.length;
      const adjIdx2  = (i + 1) % room.wallIds.length;
      const adjWall1 = walls.find((w) => w.id === room.wallIds[adjIdx1]!);
      const adjWall2 = walls.find((w) => w.id === room.wallIds[adjIdx2]!);

      if (!adjWall1 || !adjWall2) continue;

      const intNorm1 = interiorNormal(adjWall1, nodes, polyMap.get(adjWall1.id), centroid);
      const intNorm2 = interiorNormal(adjWall2, nodes, polyMap.get(adjWall2.id), centroid);
      const dir1     = wallDir(adjWall1, nodes);
      const dir2     = wallDir(adjWall2, nodes);

      const intAnchor1 = interiorCorner(node1Id, wall, dir, intNorm, adjWall1, dir1, intNorm1, nodes);
      const intAnchor2 = interiorCorner(node2Id, wall, dir, intNorm, adjWall2, dir2, intNorm2, nodes);

      result.push({
        wallId, side: 'interior',
        anchor1: intAnchor1, anchor2: intAnchor2,
        normal: intNorm, offset: COTE_OFFSET_INT,
        label: formatCm(dist(intAnchor1, intAnchor2)),
      });
    }
  }

  // ── Murs isolés ───────────────────────────────────────────────────────
  for (const wall of walls) {
    if (wallsInRooms.has(wall.id)) continue;
    const p1 = nodePos(wall.node1Id, nodes);
    const p2 = nodePos(wall.node2Id, nodes);
    const d  = dist(p1, p2);
    if (d < 1) continue;
    const dir: Point    = { x: (p2.x - p1.x) / d, y: (p2.y - p1.y) / d };
    const normal: Point = { x: -dir.y, y: dir.x };
    result.push({
      wallId: wall.id, side: 'isolated',
      anchor1: p1, anchor2: p2,
      normal, offset: COTE_OFFSET_ISO,
      label: formatCm(d),
    });
  }

  return result;
}
```

- [ ] **Step 4 : Lancer — vérifier PASS**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/geometry/wallCotation.test.ts 2>&1 | tail -10
```

Expected : tous les tests passent.

- [ ] **Step 5 : Vérifier compilation TypeScript**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -20
```

Expected : 0 erreurs.

- [ ] **Step 6 : Commit**

```bash
git add src/engine/geometry/wallCotation.ts src/engine/geometry/wallCotation.test.ts
git commit -m "feat(wall-cotation): computeAutoCotations — ext/int par pièce + isolated

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4 : Rendu SVG dans `WallDrawingCanvas.tsx`

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 1 : Ajouter l'import et le type**

Dans `src/components/plan/WallDrawingCanvas.tsx`, modifier la ligne 5 :

```typescript
import type { Wall, WallNode, DrawingChain, SnapResult, AutoCotation } from '@/types/wall';
```

Ajouter après la ligne 8 (`import { computeCornerGeometry, computeJointLines }...`) :

```typescript
import { computeAutoCotations } from '@/engine/geometry/wallCotation';
```

- [ ] **Step 2 : Ajouter le useMemo**

Dans `WallDrawingCanvas`, après la ligne :
```typescript
const jointLines   = useMemo(() => computeJointLines(walls, nodes),     [walls, nodes]);
```

Ajouter :
```typescript
const autoCotations = useMemo(() => computeAutoCotations(walls, nodes), [walls, nodes]);
```

- [ ] **Step 3 : Ajouter le rendu SVG des cotations**

Insérer le bloc suivant **immédiatement après** la fermeture du bloc `{/* Joint lines */}` (après le `})}` de jointLines, avant `{/* Chain preview */}`) :

```tsx
        {/* Auto-cotations */}
        {autoCotations.map((c, i) => {
          const sa1 = worldToScreen(c.anchor1);
          const sa2 = worldToScreen(c.anchor2);
          // Offset en coordonnées écran
          const ox = c.normal.x * c.offset * scale;
          const oy = c.normal.y * c.offset * scale;
          const sl1 = { x: sa1.x + ox, y: sa1.y + oy };
          const sl2 = { x: sa2.x + ox, y: sa2.y + oy };
          const smid = { x: (sl1.x + sl2.x) / 2, y: (sl1.y + sl2.y) / 2 };
          const color =
            c.side === 'exterior' ? '#22c55e' :
            c.side === 'interior' ? '#3b82f6' : '#f97316';
          const tick = 5; // px
          return (
            <g key={`cot-${i}`} className="pointer-events-none">
              {/* Lignes témoins pointillées */}
              <line x1={sa1.x} y1={sa1.y} x2={sl1.x} y2={sl1.y}
                stroke={color} strokeWidth={0.7} strokeDasharray="3,3" />
              <line x1={sa2.x} y1={sa2.y} x2={sl2.x} y2={sl2.y}
                stroke={color} strokeWidth={0.7} strokeDasharray="3,3" />
              {/* Ligne de cote */}
              <line x1={sl1.x} y1={sl1.y} x2={sl2.x} y2={sl2.y}
                stroke={color} strokeWidth={1} />
              {/* Ticks perpendiculaires (le long de la normale) */}
              <line
                x1={sl1.x - c.normal.x * tick} y1={sl1.y - c.normal.y * tick}
                x2={sl1.x + c.normal.x * tick} y2={sl1.y + c.normal.y * tick}
                stroke={color} strokeWidth={1.5} />
              <line
                x1={sl2.x - c.normal.x * tick} y1={sl2.y - c.normal.y * tick}
                x2={sl2.x + c.normal.x * tick} y2={sl2.y + c.normal.y * tick}
                stroke={color} strokeWidth={1.5} />
              {/* Label */}
              <text
                x={smid.x + c.normal.x * 12} y={smid.y + c.normal.y * 12}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill={color}
                style={{ fontFamily: 'monospace', userSelect: 'none' }}
              >
                {c.label}
              </text>
            </g>
          );
        })}
```

- [ ] **Step 4 : Vérifier compilation TypeScript**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -20
```

Expected : 0 erreurs.

- [ ] **Step 5 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -8
```

Expected : tous les tests passent (aucune régression).

- [ ] **Step 6 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-cotation): rendu SVG auto-cotations dans WallDrawingCanvas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Vérification visuelle (post-implémentation)

Ouvrir le projet en mode dev (`npm run dev`), créer une pièce fermée en mode WALL,
passer en mode SELECT. Vérifier :
- Côtes vertes autour du périmètre extérieur
- Côtes bleues à l'intérieur de la pièce
- Un mur isolé (non fermé) affiche une côte orange
- Les labels affichent "X.X cm" avec les bonnes valeurs
- Les cotations restent lisibles à différents niveaux de zoom
