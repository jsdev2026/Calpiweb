# Refonte moteur quantitatif — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper `quantityEngine.ts` en trois fonctions pures testables (`buildCutTable`, `assignOffcuts`, `groupCuts`), corriger les bugs de clipping chevron et d'algorithme de réutilisation, passer le seuil de chute à 50 mm.

**Architecture:** `types.ts` + `constants.ts` définissent le modèle partagé. Trois fichiers implémentent une fonction chacun. `quantityEngine.ts` orchestre et ré-exporte. `QuantitiesPanel.tsx` ne change que ses imports.

**Tech Stack:** TypeScript, Vitest, Sutherland-Hodgman clipping (existant), algorithme greedy descending best-fit.

---

## Structure des fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `src/engine/quantities/types.ts` | Créer | `TileEdgeSide`, `PieceEdges`, `CutRecord`, `CutGroup`, `QuantityResult` |
| `src/engine/quantities/constants.ts` | Créer | `MIN_CHUTE_MM = 50`, `CUT_TOLERANCE_MM = 5` |
| `src/engine/quantities/buildCutTable.ts` | Créer | Clipping + détection des bords + calcul chute |
| `src/engine/quantities/buildCutTable.test.ts` | Créer | Tests unitaires buildCutTable |
| `src/engine/quantities/assignOffcuts.ts` | Créer | Algorithme descending best-fit + canReuseFor |
| `src/engine/quantities/assignOffcuts.test.ts` | Créer | Tests unitaires assignOffcuts |
| `src/engine/quantities/groupCuts.ts` | Créer | Groupement par clé (usedW×usedH\|edges) |
| `src/engine/quantities/groupCuts.test.ts` | Créer | Tests unitaires groupCuts |
| `src/engine/quantities/quantityEngine.ts` | Réécrire | Orchestre les 3 fonctions, ré-exporte les types |
| `src/components/quantities/QuantitiesPanel.tsx` | Modifier | `CutDetail` → `CutRecord` (2 occurrences) |

---

## Task 1 : Types et constantes partagés

**Files:**
- Create: `src/engine/quantities/types.ts`
- Create: `src/engine/quantities/constants.ts`

- [ ] **Step 1 : Créer `types.ts`**

```typescript
// src/engine/quantities/types.ts
import type { Tile } from '@/types/tiling';

export type TileEdgeSide = 'factory' | 'cut';

export interface PieceEdges {
  left: TileEdgeSide;
  right: TileEdgeSide;
  top: TileEdgeSide;
  bottom: TileEdgeSide;
}

export interface CutRecord {
  id: string;
  roomId: string;
  /** Dimensions réelles de la tuile source (orientation bâton rompu prise en compte) */
  tileW: number;
  tileH: number;
  /** Bounding box de la partie utilisée */
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  /** Chute récupérable (0×0 si < MIN_CHUTE_MM sur un axe) */
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;
  /** Centre de la pièce coupée pour annotation plan */
  clipCx: number;
  clipCy: number;
  /** Liens de réutilisation (remplis par assignOffcuts) */
  coveredById: string | null;
  reusedForId: string | null;
}

export interface CutGroup {
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  totalCount: number;
  reuseCount: number;
  netTiles: number;
}

export interface QuantityResult {
  tileW: number;
  tileH: number;
  joint: number;
  wholeCount: number;
  cuts: CutRecord[];
  cutGroups: CutGroup[];
  totalReuseCount: number;
  tilesForCuts: number;
  totalTiles: number;
  toOrder: number;
  roomArea: number;
  tiles: Tile[];
}
```

- [ ] **Step 2 : Créer `constants.ts`**

```typescript
// src/engine/quantities/constants.ts
export const MIN_CHUTE_MM = 50;
export const CUT_TOLERANCE_MM = 5;
```

- [ ] **Step 3 : Vérifier que TypeScript est satisfait**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit
```

Expected: aucune erreur (ces fichiers n'ont pas encore de consommateurs).

- [ ] **Step 4 : Commit**

```bash
git add src/engine/quantities/types.ts src/engine/quantities/constants.ts
git commit -m "feat(quantities): add CutRecord types and shared constants"
```

---

## Task 2 : `buildCutTable` — tests d'abord

**Files:**
- Create: `src/engine/quantities/buildCutTable.test.ts`
- Create: `src/engine/quantities/buildCutTable.ts`

### Contexte pour l'implémenteur

`buildCutTable` reçoit le tableau de `Tile[]` (tous types confondus), les polygones des pièces **en coordonnées tile-space** (déjà tournés), et les identifiants des pièces. Elle ne retourne que les tuiles `CUT`.

Pour les tuiles **chevron**, `tile.points` contient les 4 sommets du parallélogramme réel. Pour les tuiles **STRAIGHT/HERRINGBONE**, `tile.points` est absent et on utilise les 4 coins de `tile.rect`.

La fonction `clipPolygon` (Sutherland-Hodgman) attend un polygone clip en CCW (sens trigonométrique positif). `ensureCCW` normalise les polygones des pièces.

- [ ] **Step 1 : Écrire les tests (fichier entier)**

```typescript
// src/engine/quantities/buildCutTable.test.ts
import { describe, it, expect } from 'vitest';
import { buildCutTable } from './buildCutTable';
import type { Tile } from '@/types/tiling';
import type { Point } from '@/types/plan';

// Pièce carrée 200×200 en CCW
const ROOM: Point[] = [
  { x: 0, y: 0 }, { x: 200, y: 0 },
  { x: 200, y: 200 }, { x: 0, y: 200 },
];

describe('buildCutTable', () => {
  it('filtre les tuiles WHOLE et retourne uniquement les CUT', () => {
    const tiles: Tile[] = [
      { id: 'w1', rect: { x: 10, y: 10, w: 60, h: 60 }, type: 'WHOLE' },
      { id: 'c1', rect: { x: 170, y: 10, w: 60, h: 60 }, type: 'CUT' },
    ];
    const result = buildCutTable(tiles, [ROOM], ['r1']);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c1');
  });

  it('coupe droite à droite : usedW < tileW, bord droit cut, autres factory', () => {
    // Tuile à x=170, largeur 60 → dépasse la pièce de 30px à droite
    const tile: Tile = { id: 't1', rect: { x: 170, y: 50, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.usedW).toBe(30);
    expect(rec!.usedH).toBe(60);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.pieceEdges.left).toBe('factory');
    expect(rec!.pieceEdges.top).toBe('factory');
    expect(rec!.pieceEdges.bottom).toBe('factory');
  });

  it('coupe en coin bas-droit : bords droit et bas cut', () => {
    // Tuile à (170, 170, 60, 60) — dépasse à droite et en bas
    const tile: Tile = { id: 't2', rect: { x: 170, y: 170, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.pieceEdges.bottom).toBe('cut');
    expect(rec!.chuteArea).toBeGreaterThan(0);
  });

  it('chute de 40 mm (< 50 mm) → chuteW=0, chuteH=0, chuteArea=0', () => {
    // Tuile à x=162, w=60 → partie dans la pièce = 200-162 = 38px, chute = 22px
    const tile: Tile = { id: 't3', rect: { x: 162, y: 50, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.chuteW).toBe(0);
    expect(rec!.chuteH).toBe(0);
    expect(rec!.chuteArea).toBe(0);
  });

  it('chute de 55 mm (> 50 mm) → chute renseignée', () => {
    // Tuile à x=145, w=100 → partie dans la pièce = 55px, chute = 45px
    // Mais chute = tileW - usedW = 100 - 55 = 45... hmm need to find a case where chute >= 50
    // Tuile à x=130, w=100 → usedW = 70, chute = 30... still < 50
    // Tuile à x=100, w=100 → exactly 100 used → no cut
    // Tuile à x=90, w=100 → usedW = 100 (entirely inside) → WHOLE, not CUT...
    // Actually, for a right-cut: tile at x=140, w=100 → usedW = 60, chuteW = 40 → still < 50
    // tile at x=120, w=100 → usedW = 80, chuteW = 20 → < 50
    // tile at x=100, w=100 → WHOLE (200-100=100 = full tile width)
    // For left-cut: tile at x=-10, w=100 → usedW = 90... chuteW = 10 → < 50
    // Hmm, with a 200×200 room and 100mm tiles, getting a chute >= 50 is tricky.
    // Let's use a different room or a specific dimension.
    // Actually the simplest: tile at x=150, w=100 → usedW = 50, chuteW = 50 → exactly 50 → viable
    const tile: Tile = { id: 't4', rect: { x: 150, y: 50, w: 100, h: 100 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.chuteW).toBeGreaterThanOrEqual(50);
    expect(rec!.chuteH).toBeGreaterThanOrEqual(50);
    expect(rec!.chuteArea).toBeGreaterThan(0);
  });

  it('tuile chevron avec tile.points : clipping sur le parallélogramme réel', () => {
    // Parallélogramme qui dépasse la pièce à droite (x > 200)
    const pts: Point[] = [
      { x: 160, y: 50 },
      { x: 210, y: 50 },
      { x: 210, y: 110 },
      { x: 160, y: 110 },
    ];
    const tile: Tile = {
      id: 't5',
      rect: { x: 160, y: 50, w: 50, h: 60 },
      type: 'CUT',
      points: pts,
    };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.usedW).toBeLessThan(50);
  });

  it('tuile HERRINGBONE H×W : tileW=90, tileH=45 stockés correctement', () => {
    const tile: Tile = {
      id: 't6',
      rect: { x: 170, y: 50, w: 90, h: 45 },
      type: 'CUT',
    };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.tileW).toBe(90);
    expect(rec!.tileH).toBe(45);
  });

  it('coveredById et reusedForId initialisés à null', () => {
    const tile: Tile = { id: 't7', rect: { x: 170, y: 50, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.coveredById).toBeNull();
    expect(rec!.reusedForId).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/buildCutTable.test.ts 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module './buildCutTable'"

- [ ] **Step 3 : Implémenter `buildCutTable.ts`**

```typescript
// src/engine/quantities/buildCutTable.ts
import type { Point } from '@/types/plan';
import type { Tile } from '@/types/tiling';
import { clipPolygon } from '@/engine/geometry/clipper';
import { getBoundingBox } from '@/engine/geometry/polygon';
import type { CutRecord, PieceEdges } from './types';
import { MIN_CHUTE_MM, CUT_TOLERANCE_MM } from './constants';

const ALL_FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};

function ensureCCW(poly: Point[]): Point[] {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i]!;
    const next = poly[(i + 1) % poly.length]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return area < 0 ? [...poly].reverse() : poly;
}

export function buildCutTable(
  tiles: Tile[],
  roomPolygons: Point[][],
  roomIds: string[],
): CutRecord[] {
  return tiles
    .filter((t) => t.type === 'CUT')
    .map((tile): CutRecord => {
      const { x, y, w, h } = tile.rect;

      // Use actual polygon for chevron, bounding-box corners otherwise
      const tilePoly: Point[] = tile.points ?? [
        { x,         y         },
        { x: x + w,  y         },
        { x: x + w,  y: y + h  },
        { x,         y: y + h  },
      ];

      // Clip against all room polygons, accumulate bounding box of result
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const rawPoly of roomPolygons) {
        const clipped = clipPolygon(tilePoly, ensureCCW(rawPoly));
        for (const p of clipped) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
      }

      if (minX === Infinity) {
        return {
          id: tile.id, roomId: roomIds[0] ?? '',
          tileW: w, tileH: h,
          usedW: w, usedH: h,
          pieceEdges: ALL_FACTORY,
          chuteW: 0, chuteH: 0, chuteEdges: ALL_FACTORY, chuteArea: 0,
          clipCx: x + w / 2, clipCy: y + h / 2,
          coveredById: null, reusedForId: null,
        };
      }

      const usedW = Math.max(1, Math.round(Math.min(w, maxX - minX)));
      const usedH = Math.max(1, Math.round(Math.min(h, maxY - minY)));
      const clipCx = (minX + maxX) / 2;
      const clipCy = (minY + maxY) / 2;

      const isCutLeft   = minX > x + CUT_TOLERANCE_MM;
      const isCutRight  = maxX < x + w - CUT_TOLERANCE_MM;
      const isCutTop    = minY > y + CUT_TOLERANCE_MM;
      const isCutBottom = maxY < y + h - CUT_TOLERANCE_MM;

      const pieceEdges: PieceEdges = {
        left:   isCutLeft   ? 'cut' : 'factory',
        right:  isCutRight  ? 'cut' : 'factory',
        top:    isCutTop    ? 'cut' : 'factory',
        bottom: isCutBottom ? 'cut' : 'factory',
      };

      const isCutH = isCutLeft || isCutRight;
      const isCutV = isCutTop  || isCutBottom;
      const hTrim = isCutLeft ? (minX - x) : isCutRight ? (x + w - maxX) : 0;
      const vTrim = isCutTop  ? (minY - y) : isCutBottom ? (y + h - maxY) : 0;

      let chuteW = 0, chuteH = 0;
      let chuteEdges: PieceEdges = ALL_FACTORY;

      if (isCutH && isCutV) {
        // Corner cut: choose the larger strip
        if (hTrim * h >= w * vTrim) {
          chuteW = hTrim; chuteH = h;
          chuteEdges = isCutLeft
            ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
            : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
        } else {
          chuteW = w; chuteH = vTrim;
          chuteEdges = isCutTop
            ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
            : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
        }
      } else if (isCutH) {
        chuteW = hTrim; chuteH = h;
        chuteEdges = isCutLeft
          ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
          : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
      } else if (isCutV) {
        chuteW = w; chuteH = vTrim;
        chuteEdges = isCutTop
          ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
          : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
      }

      const viable = chuteW >= MIN_CHUTE_MM && chuteH >= MIN_CHUTE_MM;

      // Assign roomId by proximity (tile center ↔ room polygon center)
      const cx2 = x + w / 2, cy2 = y + h / 2;
      let bestRoom = roomIds[0] ?? '';
      let bestDist = Infinity;
      for (let r = 0; r < roomPolygons.length; r++) {
        const pb = getBoundingBox(roomPolygons[r]!);
        const pcx = (pb.minX + pb.maxX) / 2, pcy = (pb.minY + pb.maxY) / 2;
        const d = (cx2 - pcx) ** 2 + (cy2 - pcy) ** 2;
        if (d < bestDist) { bestDist = d; bestRoom = roomIds[r] ?? ''; }
      }

      return {
        id: tile.id,
        roomId: bestRoom,
        tileW: w, tileH: h,
        usedW, usedH,
        pieceEdges,
        chuteW:    viable ? chuteW : 0,
        chuteH:    viable ? chuteH : 0,
        chuteEdges: viable ? chuteEdges : ALL_FACTORY,
        chuteArea:  viable ? chuteW * chuteH : 0,
        clipCx, clipCy,
        coveredById: null,
        reusedForId: null,
      };
    });
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/buildCutTable.test.ts 2>&1 | tail -20
```

Expected: 7 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/engine/quantities/buildCutTable.ts src/engine/quantities/buildCutTable.test.ts
git commit -m "feat(quantities): add buildCutTable with chevron polygon clipping"
```

---

## Task 3 : `assignOffcuts` — tests d'abord

**Files:**
- Create: `src/engine/quantities/assignOffcuts.test.ts`
- Create: `src/engine/quantities/assignOffcuts.ts`

### Contexte pour l'implémenteur

`assignOffcuts` trie les coupes par aire décroissante (`usedW × usedH`), puis pour chaque coupe cherche dans un pool la **plus petite** chute qui peut encore la couvrir (best-fit). Si une chute convient, la coupe est marquée comme couverte. Si aucune chute ne convient et que cette coupe génère une chute viable, on ajoute cette chute au pool.

`canReuseFor` essaie les 4 rotations (0°/90°/180°/270°). Rotation 90° sens horaire : `new = (bottom, left, top, right)` pour `(left, top, right, bottom)`, et les dimensions `(w, h)` s'échangent.

**Important :** `assignOffcuts` mutate les champs `coveredById` et `reusedForId` des records passés en argument. Elle ne retourne rien.

- [ ] **Step 1 : Écrire les tests**

```typescript
// src/engine/quantities/assignOffcuts.test.ts
import { describe, it, expect } from 'vitest';
import { assignOffcuts, canReuseFor } from './assignOffcuts';
import type { CutRecord, PieceEdges } from './types';

const FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};
const RIGHT_CUT: PieceEdges = {
  left: 'factory', right: 'cut', top: 'factory', bottom: 'factory',
};

function makeRecord(
  id: string,
  usedW: number,
  usedH: number,
  chuteW: number,
  chuteH: number,
  pieceEdges: PieceEdges = RIGHT_CUT,
  chuteEdges: PieceEdges = FACTORY,
): CutRecord {
  return {
    id, roomId: 'r1',
    tileW: 200, tileH: 200,
    usedW, usedH,
    pieceEdges,
    chuteW, chuteH,
    chuteEdges,
    chuteArea: chuteW * chuteH,
    clipCx: 0, clipCy: 0,
    coveredById: null,
    reusedForId: null,
  };
}

describe('assignOffcuts', () => {
  it('grande coupe génère chute qui couvre la petite', () => {
    // grande: usedW=180, usedH=180, chute=20×180
    // petite: usedW=18×170 — couverte par chute 20×180
    const large = makeRecord('large', 180, 180, 20, 180, RIGHT_CUT, FACTORY);
    const small = makeRecord('small', 18, 170, 0, 0, RIGHT_CUT, FACTORY);
    assignOffcuts([large, small]);
    expect(small.coveredById).toBe('large');
    expect(large.reusedForId).toBe('small');
  });

  it('aucune réutilisation quand aucune chute disponible', () => {
    const a = makeRecord('a', 60, 60, 0, 0);
    const b = makeRecord('b', 40, 40, 0, 0);
    assignOffcuts([a, b]);
    expect(a.coveredById).toBeNull();
    expect(b.coveredById).toBeNull();
  });

  it('trois coupes identiques : 1ère génère chute, 2ème couverte, 3ème génère chute', () => {
    const records = [
      makeRecord('a', 160, 160, 40, 160),
      makeRecord('b', 160, 160, 40, 160),
      makeRecord('c', 160, 160, 40, 160),
    ];
    assignOffcuts(records);
    const covered = records.filter((r) => r.coveredById !== null);
    expect(covered).toHaveLength(1);
    // 2 tuiles nettes pour 3 coupes
    const nets = records.filter((r) => r.coveredById === null).length;
    expect(nets).toBe(2);
  });

  it('best-fit : utilise la plus petite chute suffisante (60×60) plutôt que 150×150', () => {
    // src1 a une chute 60×60 (aire 3600)
    // src2 a une chute 150×150 (aire 22500)
    // target a besoin de 55×55 — les deux chutes conviennent, doit utiliser 60×60
    const src2 = makeRecord('src2', 190, 190, 150, 150, RIGHT_CUT, FACTORY);
    const src1 = makeRecord('src1', 180, 180, 60, 60, RIGHT_CUT, FACTORY);
    const target = makeRecord('target', 55, 55, 0, 0, RIGHT_CUT, FACTORY);
    // Ordre dans le tableau : src2 (plus grande aire) traité en 1er
    assignOffcuts([src2, src1, target]);
    expect(target.coveredById).toBe('src1');
  });

  it('rotation 90° : chute 80×40 couvre un besoin de 35×70', () => {
    // chute 80×40 pivotée 90° donne 40×80, qui couvre 35×70
    const src = makeRecord('src', 160, 120, 80, 40, RIGHT_CUT, FACTORY);
    // target needs 35×70 — edges factory partout
    const target = makeRecord('target', 35, 70, 0, 0, FACTORY, FACTORY);
    src.chuteEdges = FACTORY;
    assignOffcuts([src, target]);
    expect(target.coveredById).toBe('src');
  });

  it('chute insuffisante en dimensions ne couvre pas', () => {
    // Chute 48×48 (< 50mm seuil → chuteW=0 normalement)
    // Ici on force manuellement pour tester canReuseFor directement
    const src = makeRecord('src', 160, 160, 48, 48, RIGHT_CUT, FACTORY);
    const target = makeRecord('target', 45, 45, 0, 0, FACTORY, FACTORY);
    assignOffcuts([src, target]);
    // MIN_CHUTE_MM s'applique dans buildCutTable (qui met chuteW=0 si < 50mm).
    // assignOffcuts ne re-vérifie pas ce seuil : si chuteW > 0, elle tente la réutilisation.
    expect(target.coveredById).toBe('src');
  });
});

describe('canReuseFor', () => {
  it('dimensions exactes → true', () => {
    expect(canReuseFor(60, 60, FACTORY, 60, 60, FACTORY)).toBe(true);
  });

  it('chute trop petite → false', () => {
    expect(canReuseFor(40, 40, FACTORY, 60, 60, FACTORY)).toBe(false);
  });

  it('rotation 90° permet la couverture', () => {
    // Chute 80×40, besoin 35×70 → rotation donne 40×80 → ok
    expect(canReuseFor(80, 40, FACTORY, 35, 70, FACTORY)).toBe(true);
  });

  it('bord factory requis non satisfait → false', () => {
    const cutRight: PieceEdges = { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' };
    // Besoin : bord droit factory. Chute : bord droit cut. → false même si dimensions ok
    expect(canReuseFor(80, 80, cutRight, 60, 60, FACTORY)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/assignOffcuts.test.ts 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module './assignOffcuts'"

- [ ] **Step 3 : Implémenter `assignOffcuts.ts`**

```typescript
// src/engine/quantities/assignOffcuts.ts
import type { CutRecord, PieceEdges, TileEdgeSide } from './types';
import { CUT_TOLERANCE_MM } from './constants';

export function canReuseFor(
  cw: number, ch: number, ce: PieceEdges,
  nw: number, nh: number, ne: PieceEdges,
): boolean {
  let ew = cw, eh = ch;
  let el: TileEdgeSide = ce.left,  er: TileEdgeSide = ce.right;
  let et: TileEdgeSide = ce.top,   eb: TileEdgeSide = ce.bottom;

  for (let r = 0; r < 4; r++) {
    if (ew >= nw - CUT_TOLERANCE_MM && eh >= nh - CUT_TOLERANCE_MM) {
      const ok =
        (ne.left   === 'factory' ? el === 'factory' : true) &&
        (ne.right  === 'factory' ? er === 'factory' : true) &&
        (ne.top    === 'factory' ? et === 'factory' : true) &&
        (ne.bottom === 'factory' ? eb === 'factory' : true);
      if (ok) return true;
    }
    // Rotate 90° CW: left←bottom, top←left, right←top, bottom←right
    const nl = eb, nt = el, nr = et, nb = er;
    el = nl; et = nt; er = nr; eb = nb;
    [ew, eh] = [eh, ew];
  }
  return false;
}

export function assignOffcuts(records: CutRecord[]): void {
  // Process largest cuts first so their offcuts populate the pool early
  const sorted = [...records].sort((a, b) => b.usedW * b.usedH - a.usedW * a.usedH);

  const pool: {
    w: number; h: number; edges: PieceEdges; fromId: string; used: boolean;
  }[] = [];

  for (const record of sorted) {
    // Best-fit: find smallest chute in pool that still satisfies this cut
    let bestIdx = -1;
    let bestArea = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const chute = pool[i]!;
      if (chute.used) continue;
      if (canReuseFor(chute.w, chute.h, chute.edges, record.usedW, record.usedH, record.pieceEdges)) {
        const area = chute.w * chute.h;
        if (area < bestArea) { bestArea = area; bestIdx = i; }
      }
    }

    if (bestIdx >= 0) {
      pool[bestIdx]!.used = true;
      record.coveredById = pool[bestIdx]!.fromId;
      const src = records.find((r) => r.id === pool[bestIdx]!.fromId);
      if (src) src.reusedForId = record.id;
    } else if (record.chuteW > 0 && record.chuteH > 0) {
      pool.push({
        w: record.chuteW, h: record.chuteH,
        edges: record.chuteEdges, fromId: record.id, used: false,
      });
    }
  }
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/assignOffcuts.test.ts 2>&1 | tail -20
```

Expected: 9 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/engine/quantities/assignOffcuts.ts src/engine/quantities/assignOffcuts.test.ts
git commit -m "feat(quantities): add assignOffcuts with descending best-fit algorithm"
```

---

## Task 4 : `groupCuts` — tests d'abord

**Files:**
- Create: `src/engine/quantities/groupCuts.test.ts`
- Create: `src/engine/quantities/groupCuts.ts`

- [ ] **Step 1 : Écrire les tests**

```typescript
// src/engine/quantities/groupCuts.test.ts
import { describe, it, expect } from 'vitest';
import { groupCuts } from './groupCuts';
import type { CutRecord, PieceEdges } from './types';

const FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};
const RIGHT_CUT: PieceEdges = {
  left: 'factory', right: 'cut', top: 'factory', bottom: 'factory',
};
const LEFT_CUT: PieceEdges = {
  left: 'cut', right: 'factory', top: 'factory', bottom: 'factory',
};

function makeRecord(
  id: string,
  usedW: number,
  usedH: number,
  pieceEdges: PieceEdges = RIGHT_CUT,
  coveredById: string | null = null,
): CutRecord {
  return {
    id, roomId: 'r1',
    tileW: 100, tileH: 100,
    usedW, usedH,
    pieceEdges,
    chuteW: 0, chuteH: 0, chuteEdges: FACTORY, chuteArea: 0,
    clipCx: 0, clipCy: 0,
    coveredById,
    reusedForId: null,
  };
}

describe('groupCuts', () => {
  it('deux records identiques → 1 groupe, totalCount=2', () => {
    const groups = groupCuts([makeRecord('a', 30, 45), makeRecord('b', 30, 45)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.totalCount).toBe(2);
    expect(groups[0]!.netTiles).toBe(2);
  });

  it('un record couvert → reuseCount=1, netTiles=1', () => {
    const groups = groupCuts([makeRecord('a', 30, 45), makeRecord('b', 30, 45, RIGHT_CUT, 'a')]);
    expect(groups[0]!.reuseCount).toBe(1);
    expect(groups[0]!.netTiles).toBe(1);
  });

  it('30×45 et 45×30 avec bords différents → 2 groupes distincts', () => {
    const a = makeRecord('a', 30, 45, RIGHT_CUT);
    const b = makeRecord('b', 45, 30, LEFT_CUT);
    const groups = groupCuts([a, b]);
    expect(groups).toHaveLength(2);
  });

  it('mêmes dimensions mais bords différents → 2 groupes distincts', () => {
    const a = makeRecord('a', 30, 45, RIGHT_CUT);
    const b = makeRecord('b', 30, 45, LEFT_CUT);
    const groups = groupCuts([a, b]);
    expect(groups).toHaveLength(2);
  });

  it('tableau vide → tableau vide', () => {
    expect(groupCuts([])).toHaveLength(0);
  });

  it('groupes triés par netTiles*usedW*usedH décroissant', () => {
    // Groupe A : 1 tile nette de 80×80 = score 6400
    // Groupe B : 2 tiles nettes de 30×45 = score 2700
    const records = [
      makeRecord('a', 30, 45, RIGHT_CUT),
      makeRecord('b', 30, 45, LEFT_CUT),       // groupe distinct
      makeRecord('c', 80, 80, FACTORY),
    ];
    const groups = groupCuts(records);
    expect(groups[0]!.usedW).toBe(80);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/groupCuts.test.ts 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module './groupCuts'"

- [ ] **Step 3 : Implémenter `groupCuts.ts`**

```typescript
// src/engine/quantities/groupCuts.ts
import type { CutRecord, CutGroup, PieceEdges } from './types';

function edgeKey(pe: PieceEdges): string {
  return `${pe.left[0]}${pe.right[0]}${pe.top[0]}${pe.bottom[0]}`;
}

export function groupCuts(records: CutRecord[]): CutGroup[] {
  const map = new Map<string, CutGroup>();

  for (const rec of records) {
    const key = `${rec.usedW}×${rec.usedH}|${edgeKey(rec.pieceEdges)}`;
    if (!map.has(key)) {
      map.set(key, {
        usedW: rec.usedW,
        usedH: rec.usedH,
        pieceEdges: rec.pieceEdges,
        chuteW: rec.chuteW,
        chuteH: rec.chuteH,
        chuteEdges: rec.chuteEdges,
        totalCount: 0,
        reuseCount: 0,
        netTiles: 0,
      });
    }
    const g = map.get(key)!;
    g.totalCount += 1;
    if (rec.coveredById !== null) g.reuseCount += 1;
  }

  for (const g of map.values()) g.netTiles = g.totalCount - g.reuseCount;

  return [...map.values()].sort(
    (a, b) => b.netTiles * b.usedW * b.usedH - a.netTiles * a.usedW * a.usedH,
  );
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/groupCuts.test.ts 2>&1 | tail -20
```

Expected: 6 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/engine/quantities/groupCuts.ts src/engine/quantities/groupCuts.test.ts
git commit -m "feat(quantities): add groupCuts"
```

---

## Task 5 : Réécrire `quantityEngine.ts`

**Files:**
- Modify: `src/engine/quantities/quantityEngine.ts` (réécriture complète)

### Contexte

Le fichier actuel définit `CutDetail`, `CutGroup`, `QuantityResult`, `PieceEdges`, `TileEdgeSide`, `ALL_FACTORY`, `ensureCCW`, `tileSpaceRooms`, `computeCutInfo`, `canReuseFor`, `optimizeReuse`, `edgeKey`, `groupCuts`, `analyzeQuantities`.

Après cette tâche, le fichier :
- Importe les types depuis `./types` et les ré-exporte (pour ne pas casser `QuantitiesPanel.tsx`)
- Importe `buildCutTable`, `assignOffcuts`, `groupCuts` depuis leurs modules
- Garde uniquement `tileSpaceRooms` et `analyzeQuantities`
- Supprime tout le reste (plus de `computeCutInfo`, `optimizeReuse`, `canReuseFor`, etc.)

**`QuantitiesPanel.tsx` importe `CutDetail` par son nom.** Le nouveau fichier doit ré-exporter `CutRecord` sous l'alias `CutDetail` pour éviter une erreur TypeScript — **ou** on met à jour `QuantitiesPanel.tsx` (Task 6 s'en charge). Ici on se contente de ré-exporter les types correctement.

- [ ] **Step 1 : Réécrire `quantityEngine.ts`**

Remplacer l'intégralité du contenu du fichier par :

```typescript
// src/engine/quantities/quantityEngine.ts
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox, rotatePoint } from '@/engine/geometry/polygon';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';
import { buildCutTable } from './buildCutTable';
import { assignOffcuts } from './assignOffcuts';
import { groupCuts } from './groupCuts';
import type { QuantityResult } from './types';

export type { TileEdgeSide, PieceEdges, CutRecord, CutGroup, QuantityResult } from './types';
// Backwards-compat alias used by QuantitiesPanel (removed in Task 6)
export type { CutRecord as CutDetail } from './types';

function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) =>
      angle !== 0
        ? r.points.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : r.points,
    );
}

export function analyzeQuantities(rooms: Room[], config: TilingConfig): QuantityResult {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config);

  if (validRooms.length === 0 || !stats) {
    return {
      tileW: config.width, tileH: config.height, joint: config.joint,
      wholeCount: 0, cuts: [], cutGroups: [],
      totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0, toOrder: 0, roomArea: 0,
      tiles: [],
    };
  }

  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const roomPolygons = tileSpaceRooms(validRooms, config.angle, cx, cy);
  const roomIds = validRooms.map((r) => r.id);

  const cuts = buildCutTable(tiles, roomPolygons, roomIds);
  assignOffcuts(cuts);
  const cutGroups = groupCuts(cuts);

  const totalReuseCount = cuts.filter((c) => c.coveredById !== null).length;
  const tilesForCuts = cuts.length - totalReuseCount;
  const totalTiles = stats.whole + tilesForCuts;
  const toOrder = Math.ceil(totalTiles * (1 + ORDER_MARGIN_RATIO));

  return {
    tileW: config.width, tileH: config.height, joint: config.joint,
    wholeCount: stats.whole,
    cuts,
    cutGroups,
    totalReuseCount,
    tilesForCuts,
    totalTiles,
    toOrder,
    roomArea: stats.roomArea,
    tiles,
  };
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur (l'alias `CutDetail` est ré-exporté, `QuantitiesPanel` compile encore).

- [ ] **Step 3 : Lancer toute la suite de tests**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -20
```

Expected: tous les tests passent (le nombre total doit avoir augmenté par rapport aux 42 tests initiaux).

- [ ] **Step 4 : Commit**

```bash
git add src/engine/quantities/quantityEngine.ts
git commit -m "refactor(quantities): orchestrate buildCutTable+assignOffcuts+groupCuts, fix reuse algorithm"
```

---

## Task 6 : Mettre à jour `QuantitiesPanel.tsx`

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx` (2 occurrences de `CutDetail`)

### Contexte

`QuantitiesPanel.tsx` ligne 5 importe `CutDetail` depuis `quantityEngine`. Ligne 106, il crée une `Map<string, CutDetail>`. L'alias `CutDetail` créé en Task 5 permet au code de compiler sans toucher ce fichier, mais on préfère utiliser le vrai nom `CutRecord` pour la cohérence.

- [ ] **Step 1 : Mettre à jour l'import ligne 5**

Remplacer :
```typescript
import { analyzeQuantities, type QuantityResult, type CutDetail, type PieceEdges } from '@/engine/quantities/quantityEngine';
```

Par :
```typescript
import { analyzeQuantities, type QuantityResult, type CutRecord, type PieceEdges } from '@/engine/quantities/quantityEngine';
```

- [ ] **Step 2 : Mettre à jour l'utilisation ligne 106**

Remplacer :
```typescript
  const cutMap = new Map<string, CutDetail>(result.cuts.map((c) => [c.id, c]));
```

Par :
```typescript
  const cutMap = new Map<string, CutRecord>(result.cuts.map((c) => [c.id, c]));
```

- [ ] **Step 3 : Supprimer l'alias dans `quantityEngine.ts`**

Retirer la ligne :
```typescript
// Backwards-compat alias used by QuantitiesPanel (removed in Task 6)
export type { CutRecord as CutDetail } from './types';
```

- [ ] **Step 4 : Vérifier TypeScript + tests**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit && npx vitest run 2>&1 | tail -20
```

Expected: 0 erreur TypeScript, tous les tests PASS.

- [ ] **Step 5 : Commit final**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/engine/quantities/quantityEngine.ts
git commit -m "refactor(quantities): rename CutDetail → CutRecord in QuantitiesPanel"
```

---

## Vérification finale

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit && npx vitest run 2>&1 | tail -10
```

Expected :
```
Test Files  X passed (X)
     Tests  ≥ 58 passed (≥ 58)   # 42 existants + 7 + 9 + 6 nouveaux
  Start at  ...
  Duration  ...
```
