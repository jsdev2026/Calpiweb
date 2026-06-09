# Quantitatifs — Refonte précision et consommables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger la sur-estimation du calcul de carreaux (tolérance + marge auto-calibrée) et ajouter les consommables de pose (colle, joint, croisillons) dans le panneau et le rapport imprimé.

**Architecture:** Couche moteur (`quantityEngine.ts`) étendue avec `computeMargin()` et `computeConsumables()`. Les paramètres utilisateur (marge override, rendements) sont stockés dans `TilingConfig` pour être persistés avec le projet. L'UI lit `QuantityResult.consumables` et appelle `setConfig()` du store pour persister les éditions.

**Tech Stack:** TypeScript, React, Zustand (store), Vitest (tests), Tailwind CSS.

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/engine/quantities/constants.ts` | `CUT_TOLERANCE_MM` 5→10 |
| `src/constants/businessRules.ts` | Ajouter constantes de marge par pose |
| `src/types/tiling.ts` | Ajouter `ConsumableParams`, `marginOverride?`, `consumableParams?` à `TilingConfig` |
| `src/engine/quantities/types.ts` | Ajouter `ConsumableItem`, `Consumables`, étendre `QuantityResult` |
| `src/engine/quantities/quantityEngine.ts` | `computeMargin()`, `computeConsumables()`, intégration |
| `src/components/quantities/QuantitiesPanel.tsx` | Affichage marge éditable + bloc consommables |
| `src/components/quantities/QuantitiesPrintView.tsx` | Section "Récapitulatif chantier" |

---

## Task 1 : Constants + Types (fondation)

**Files:**
- Modify: `src/engine/quantities/constants.ts`
- Modify: `src/constants/businessRules.ts`
- Modify: `src/types/tiling.ts`
- Modify: `src/engine/quantities/types.ts`
- Test: `src/engine/quantities/assignOffcuts.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue (tolérance 10mm)**

Dans `src/engine/quantities/assignOffcuts.test.ts`, ajouter après les tests existants :

```typescript
describe('canReuseFor — tolérance 10mm', () => {
  it('chute 6mm plus petite que le besoin est réutilisable', () => {
    const FACTORY: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'factory' };
    const BOTTOM_CUT: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' };
    // chute 14×200, besoin 20×180 → diff de 6mm en largeur
    // échoue avec tolérance 5mm (14 < 20−5=15), passe avec 10mm (14 >= 20−10=10)
    expect(canReuseFor(14, 200, FACTORY, 20, 180, BOTTOM_CUT)).toBe(true);
  });

  it('assignOffcuts : réemploie une chute 6mm plus petite que le besoin', () => {
    const FACTORY: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'factory' };
    const BOTTOM_CUT: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' };
    // src génère une chute 14×200 ; target a besoin de 20×180
    const src = makeRecord('src', 186, 200, 14, 200, { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }, FACTORY);
    const target = makeRecord('target', 20, 180, 0, 0, BOTTOM_CUT, FACTORY);
    assignOffcuts([src, target]);
    expect(target.coveredById).toBe('src');
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npx vitest run src/engine/quantities/assignOffcuts.test.ts --reporter verbose
```

Expected : les 2 nouveaux tests FAIL. Les anciens tests PASS.

- [ ] **Step 3 : Modifier `constants.ts`**

```typescript
// src/engine/quantities/constants.ts
export const MIN_CHUTE_MM = 50;
export const CUT_TOLERANCE_MM = 10;
```

- [ ] **Step 4 : Ajouter les constantes de marge dans `businessRules.ts`**

```typescript
// src/constants/businessRules.ts
export const SNAP_GRID_MM = 50;
export const CLOSING_TOLERANCE_MM = 200;
export const ORDER_MARGIN_RATIO = 0.1; // conservé pour compatibilité rétroactive des tests existants
export const MARGIN_STRAIGHT = 0.05;   // pose droite
export const MARGIN_DIAGONAL = 0.10;   // pose à 45°
export const MARGIN_CHEVRON = 0.15;    // chevron / bâton rompu
export const WASTE_WARNING_THRESHOLD = 15;
export const WALL_THICKNESS_MM = 100;
export const DOOR_DEFAULT_WIDTH_MM = 900;
```

- [ ] **Step 5 : Ajouter `ConsumableParams` et les nouveaux champs dans `TilingConfig`**

```typescript
// src/types/tiling.ts
import type { Point } from '@/types/plan';

export type TileLayout = 'STRAIGHT' | 'HERRINGBONE' | 'CHEVRON';

export interface ConsumableParams {
  tileThickness?: number;       // mm, défaut 10
  colleRendement?: number;      // kg/m², défaut 4
  colleBagSize?: number;        // kg/sac, défaut 25
  jointRendement?: number;      // kg/m², si défini = override ISO 13007
  jointBagSize?: number;        // kg/sac, défaut 5
  croisillonsBagSize?: number;  // unités/sachet, défaut 200
}

export interface TilingConfig {
  width: number;
  height: number;
  joint: number;
  offsetX: number;
  offsetY: number;
  stagger: number;
  angle: number;
  chevronAngle: number;
  color: string;
  layout: TileLayout;
  marginOverride?: number;          // si défini, remplace la marge auto-calibrée
  consumableParams?: ConsumableParams;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TileType = 'WHOLE' | 'CUT' | 'OUTSIDE';

export interface Tile {
  id: string;
  rect: TileRect;
  type: TileType;
  points?: Point[];
}

export interface TilingStats {
  whole: number;
  cuts: number;
  total: number;
  toOrder: number;
  roomArea: number;
  wastePercent: number;
}

export interface TilingResult {
  tiles: Tile[];
  stats: TilingStats | null;
}
```

- [ ] **Step 6 : Ajouter `ConsumableItem`, `Consumables` et étendre `QuantityResult` dans `types.ts`**

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
  tileW: number;
  tileH: number;
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;
  clipCx: number;
  clipCy: number;
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

export interface ConsumableItem {
  total: number;       // quantité totale (kg pour colle/joint, unités pour croisillons)
  bags: number;        // nombre de conditionnements, arrondi au-dessus
  bagSize: number;     // taille d'un conditionnement (kg ou unités)
  rendement: number;   // rendement unitaire (kg/m² ou unités/carreau)
}

export interface Consumables {
  colle: ConsumableItem;
  joint: ConsumableItem;
  croisillons: ConsumableItem;
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
  margin: number;          // marge appliquée, ex. 0.05 pour 5%
  roomArea: number;
  tiles: Tile[];
  consumables: Consumables;
}
```

- [ ] **Step 7 : Lancer les tests**

```bash
npx vitest run --reporter verbose
```

Expected : les 2 nouveaux tests PASS. Tous les autres tests PASS. Pas d'erreur TypeScript (les imports de `QuantityResult` vont échouer à compiler — c'est attendu jusqu'à Task 2).

Note : à ce stade `quantityEngine.ts` ne retourne pas encore `margin` ni `consumables`, donc des erreurs TypeScript peuvent apparaître sur ce fichier. C'est normal — elles seront résolues en Task 2.

- [ ] **Step 8 : Commit**

```bash
git add src/engine/quantities/constants.ts src/constants/businessRules.ts src/types/tiling.ts src/engine/quantities/types.ts src/engine/quantities/assignOffcuts.test.ts
git commit -m "feat(quantities): types consommables + tolérance 10mm + marges par pose"
```

---

## Task 2 : Engine — marge auto-calibrée

**Files:**
- Modify: `src/engine/quantities/quantityEngine.ts`
- Modify: `src/engine/quantities/quantityEngine.integration.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `src/engine/quantities/quantityEngine.integration.test.ts`, ajouter après les imports existants :

```typescript
import { MARGIN_STRAIGHT, MARGIN_DIAGONAL, MARGIN_CHEVRON } from '@/constants/businessRules';
```

Ajouter un nouveau `describe` après les scénarios existants :

```typescript
describe('quantityEngine — marge auto-calibrée', () => {
  it('STRAIGHT angle=0 → marge 5%', () => {
    const result = analyzeQuantities([makeRoom(306, 204)], { ...BASE_CONFIG, layout: 'STRAIGHT', angle: 0 });
    expect(result.margin).toBe(MARGIN_STRAIGHT);
    expect(result.toOrder).toBe(Math.ceil(result.totalTiles * (1 + MARGIN_STRAIGHT)));
  });

  it('angle=45 → marge 10%', () => {
    const result = analyzeQuantities([makeRoom(306, 204)], { ...BASE_CONFIG, angle: 45 });
    expect(result.margin).toBe(MARGIN_DIAGONAL);
    expect(result.toOrder).toBe(Math.ceil(result.totalTiles * (1 + MARGIN_DIAGONAL)));
  });

  it('CHEVRON → marge 15%', () => {
    const result = analyzeQuantities([makeRoom(306, 204)], { ...BASE_CONFIG, layout: 'CHEVRON', angle: 0 });
    expect(result.margin).toBe(MARGIN_CHEVRON);
    expect(result.toOrder).toBe(Math.ceil(result.totalTiles * (1 + MARGIN_CHEVRON)));
  });

  it('HERRINGBONE → marge 15%', () => {
    const result = analyzeQuantities([makeRoom(306, 204)], { ...BASE_CONFIG, layout: 'HERRINGBONE', angle: 0 });
    expect(result.margin).toBe(MARGIN_CHEVRON);
  });

  it('marginOverride écrase la marge auto', () => {
    const result = analyzeQuantities(
      [makeRoom(306, 204)],
      { ...BASE_CONFIG, layout: 'STRAIGHT', marginOverride: 0.20 },
    );
    expect(result.margin).toBe(0.20);
    expect(result.toOrder).toBe(Math.ceil(result.totalTiles * 1.20));
  });
});
```

Mettre à jour l'invariant I7 dans `checkInvariants` pour utiliser `result.margin` :

```typescript
function checkInvariants(result: QuantityResult): void {
  const { wholeCount, cuts, cutGroups, totalReuseCount,
          tilesForCuts, totalTiles, toOrder, tileW, tileH, margin } = result;

  expect(totalTiles, 'I1').toBe(wholeCount + tilesForCuts);
  expect(tilesForCuts, 'I2').toBe(cuts.length - totalReuseCount);
  expect(totalReuseCount, 'I3').toBe(cuts.filter((c) => c.coveredById !== null).length);
  for (const cut of cuts) {
    expect(cut.usedW, `I4 usedW>0 (${cut.id})`).toBeGreaterThan(0);
    expect(cut.usedH, `I4 usedH>0 (${cut.id})`).toBeGreaterThan(0);
    expect(cut.usedW, `I4 usedW≤tileW (${cut.id})`).toBeLessThanOrEqual(tileW);
    expect(cut.usedH, `I4 usedH≤tileH (${cut.id})`).toBeLessThanOrEqual(tileH);
  }
  const groupTotal = cutGroups.reduce((s, g) => s + g.totalCount, 0);
  expect(groupTotal, 'I5').toBe(cuts.length);
  for (const g of cutGroups) {
    expect(g.netTiles, 'I6').toBe(g.totalCount - g.reuseCount);
  }
  // I7 mis à jour : utilise result.margin au lieu de ORDER_MARGIN_RATIO hardcodé
  expect(toOrder, 'I7: toOrder = ceil(totalTiles × (1 + margin))').toBe(
    Math.ceil(totalTiles * (1 + margin)),
  );
  const cutById = new Map(cuts.map((c) => [c.id, c]));
  for (const cut of cuts) {
    if (cut.coveredById !== null) {
      const src = cutById.get(cut.coveredById);
      expect(src, `I8 src exists (${cut.id})`).toBeDefined();
      expect(src!.reusedForId, `I8 forward (${cut.id})`).toBe(cut.id);
    }
    if (cut.reusedForId !== null) {
      const target = cutById.get(cut.reusedForId);
      expect(target, `I8 target exists (${cut.id})`).toBeDefined();
      expect(target!.coveredById, `I8 reverse (${cut.id})`).toBe(cut.id);
    }
  }
}
```

Supprimer l'import `ORDER_MARGIN_RATIO` dans le test (il n'est plus utilisé dans `checkInvariants`).

- [ ] **Step 2 : Lancer les tests pour confirmer l'échec**

```bash
npx vitest run src/engine/quantities/quantityEngine.integration.test.ts --reporter verbose
```

Expected : les nouveaux tests de marge FAIL (`result.margin` est undefined). Les invariants I7 vont aussi FAIL jusqu'à ce que `margin` soit retourné.

- [ ] **Step 3 : Implémenter `computeMargin` dans `quantityEngine.ts`**

Remplacer le contenu de `src/engine/quantities/quantityEngine.ts` par :

```typescript
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { getBoundingBox, rotatePoint, insetRoomPolygon } from '@/engine/geometry/polygon';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { MARGIN_STRAIGHT, MARGIN_DIAGONAL, MARGIN_CHEVRON } from '@/constants/businessRules';
import { buildCutTable } from './buildCutTable';
import { assignOffcuts } from './assignOffcuts';
import { groupCuts } from './groupCuts';
import type { QuantityResult, Consumables } from './types';

export type { TileEdgeSide, PieceEdges, CutRecord, CutGroup, QuantityResult } from './types';

export function computeMargin(config: TilingConfig): number {
  if (config.marginOverride !== undefined) return config.marginOverride;
  if (config.layout === 'CHEVRON' || config.layout === 'HERRINGBONE') return MARGIN_CHEVRON;
  if (config.angle === 45) return MARGIN_DIAGONAL;
  return MARGIN_STRAIGHT;
}

function computeConsumables(
  roomArea: number,
  totalTiles: number,
  config: TilingConfig,
): Consumables {
  const params = config.consumableParams ?? {};
  const surface = roomArea / 1_000_000; // mm² → m²

  const colleRendement = params.colleRendement ?? 4;
  const colleBagSize = params.colleBagSize ?? 25;
  const colleTotal = surface * colleRendement;

  const tileThickness = params.tileThickness ?? 10;
  const isoRendement =
    ((config.width + config.height) / (config.width * config.height)) *
    config.joint * tileThickness * 1.6 * 1.05;
  const jointRendement = params.jointRendement ?? isoRendement;
  const jointBagSize = params.jointBagSize ?? 5;
  const jointTotal = surface * jointRendement;

  const croisillonsBagSize = params.croisillonsBagSize ?? 200;
  const croisillonsTotal = Math.ceil(totalTiles * 1.2);

  return {
    colle: {
      total: colleTotal,
      bags: Math.ceil(colleTotal / colleBagSize),
      bagSize: colleBagSize,
      rendement: colleRendement,
    },
    joint: {
      total: jointTotal,
      bags: Math.ceil(jointTotal / jointBagSize),
      bagSize: jointBagSize,
      rendement: jointRendement,
    },
    croisillons: {
      total: croisillonsTotal,
      bags: Math.ceil(croisillonsTotal / croisillonsBagSize),
      bagSize: croisillonsBagSize,
      rendement: 1.2,
    },
  };
}

function tileSpaceRooms(rooms: Room[], angle: number, cx: number, cy: number, wallThickness = 0): Point[][] {
  return rooms
    .filter((r) => r.points.length >= 3)
    .map((r) => {
      const inset = insetRoomPolygon(r, wallThickness);
      return angle !== 0
        ? inset.map((p) => rotatePoint(p.x, p.y, -angle, cx, cy))
        : inset;
    });
}

const EMPTY_CONSUMABLES: Consumables = {
  colle: { total: 0, bags: 0, bagSize: 25, rendement: 4 },
  joint: { total: 0, bags: 0, bagSize: 5, rendement: 0 },
  croisillons: { total: 0, bags: 0, bagSize: 200, rendement: 1.2 },
};

export function analyzeQuantities(
  rooms: Room[],
  config: TilingConfig,
  wallThickness = 0,
  doorOpenings: DoorOpening[] = [],
): QuantityResult {
  const margin = computeMargin(config);
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config, wallThickness, doorOpenings);

  if (validRooms.length === 0 || !stats) {
    return {
      tileW: config.width, tileH: config.height, joint: config.joint,
      wholeCount: 0, cuts: [], cutGroups: [],
      totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0,
      toOrder: 0, margin, roomArea: 0, tiles: [],
      consumables: EMPTY_CONSUMABLES,
    };
  }

  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const roomPolygons = tileSpaceRooms(validRooms, config.angle, cx, cy, wallThickness);
  const roomIds = validRooms.map((r) => r.id);

  const cuts = buildCutTable(tiles, roomPolygons, roomIds);
  assignOffcuts(cuts);
  const cutGroups = groupCuts(cuts);

  const totalReuseCount = cuts.filter((c) => c.coveredById !== null).length;
  const tilesForCuts = cuts.length - totalReuseCount;
  const totalTiles = stats.whole + tilesForCuts;
  const toOrder = Math.ceil(totalTiles * (1 + margin));
  const consumables = computeConsumables(stats.roomArea, totalTiles, config);

  return {
    tileW: config.width, tileH: config.height, joint: config.joint,
    wholeCount: stats.whole,
    cuts,
    cutGroups,
    totalReuseCount,
    tilesForCuts,
    totalTiles,
    toOrder,
    margin,
    roomArea: stats.roomArea,
    tiles,
    consumables,
  };
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
npx vitest run --reporter verbose
```

Expected : TOUS les tests passent (430+). Pas d'erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add src/engine/quantities/quantityEngine.ts src/engine/quantities/quantityEngine.integration.test.ts
git commit -m "feat(quantities): marge auto-calibrée par type de pose + computeConsumables"
```

---

## Task 3 : Tests consommables

**Files:**
- Modify: `src/engine/quantities/quantityEngine.integration.test.ts`

- [ ] **Step 1 : Ajouter les tests consommables**

Dans `src/engine/quantities/quantityEngine.integration.test.ts`, ajouter un nouveau `describe` :

```typescript
describe('quantityEngine — consommables', () => {
  it('colle : 4 kg/m² par défaut, arrondi en sacs de 25kg', () => {
    // Pièce 3060×2040mm = 6.2424 m² (roomArea inclut l'espace entre les carreaux)
    // La surface réelle est approximative selon le moteur de carrelage
    const result = analyzeQuantities([makeRoom(3060, 2040)], BASE_CONFIG);
    expect(result.consumables.colle.rendement).toBe(4);
    expect(result.consumables.colle.bagSize).toBe(25);
    // colle.total ≈ surface_m2 × 4
    // colle.bags = ceil(total / 25)
    expect(result.consumables.colle.bags).toBeGreaterThanOrEqual(1);
    expect(result.consumables.colle.total).toBeCloseTo(result.roomArea / 1_000_000 * 4, 1);
  });

  it('joint : formule ISO 13007 (100×100mm, joint 2mm, épaisseur 10mm)', () => {
    // rendement = ((100+100)/(100×100)) × 2 × 10 × 1.6 × 1.05
    //           = (200/10000) × 33.6
    //           = 0.02 × 33.6 = 0.672 kg/m²
    const result = analyzeQuantities([makeRoom(3060, 2040)], BASE_CONFIG);
    const expected = ((100 + 100) / (100 * 100)) * 2 * 10 * 1.6 * 1.05;
    expect(result.consumables.joint.rendement).toBeCloseTo(expected, 4);
    expect(result.consumables.joint.bagSize).toBe(5);
  });

  it('croisillons : ceil(totalTiles × 1.2), sachets de 200', () => {
    const result = analyzeQuantities([makeRoom(306, 204)], BASE_CONFIG);
    // S1 : totalTiles = 6
    expect(result.consumables.croisillons.total).toBe(Math.ceil(result.totalTiles * 1.2));
    expect(result.consumables.croisillons.bagSize).toBe(200);
    expect(result.consumables.croisillons.bags).toBe(
      Math.ceil(Math.ceil(result.totalTiles * 1.2) / 200),
    );
  });

  it('consumableParams.colleRendement override', () => {
    const config: TilingConfig = {
      ...BASE_CONFIG,
      consumableParams: { colleRendement: 6, colleBagSize: 20 },
    };
    const result = analyzeQuantities([makeRoom(3060, 2040)], config);
    expect(result.consumables.colle.rendement).toBe(6);
    expect(result.consumables.colle.bagSize).toBe(20);
    expect(result.consumables.colle.total).toBeCloseTo(result.roomArea / 1_000_000 * 6, 1);
  });

  it('consumableParams.jointRendement override remplace ISO', () => {
    const config: TilingConfig = {
      ...BASE_CONFIG,
      consumableParams: { jointRendement: 1.5 },
    };
    const result = analyzeQuantities([makeRoom(3060, 2040)], config);
    expect(result.consumables.joint.rendement).toBe(1.5);
  });
});
```

- [ ] **Step 2 : Lancer les tests**

```bash
npx vitest run src/engine/quantities/quantityEngine.integration.test.ts --reporter verbose
```

Expected : tous les nouveaux tests passent. Tous les anciens tests passent.

- [ ] **Step 3 : Lancer la suite complète**

```bash
npx vitest run --reporter verbose
```

Expected : TOUS les tests passent. `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add src/engine/quantities/quantityEngine.integration.test.ts
git commit -m "test(quantities): tests consommables colle / joint ISO / croisillons"
```

---

## Task 4 : QuantitiesPanel — marge éditable + bloc consommables

**Files:**
- Modify: `src/components/quantities/QuantitiesPanel.tsx`

**Contexte :**
- `result.margin` : la marge calculée (ex. `0.05`)
- `result.consumables` : `{ colle, joint, croisillons }` chacun avec `{ total, bags, bagSize, rendement }`
- `project.config.marginOverride` : override manuel stocké dans le store
- `project.config.consumableParams` : paramètres consommables stockés dans le store
- `setConfig` du store : `useProjectStore((s) => s.setConfig)` → met à jour `project.config` et déclenche le recalcul

- [ ] **Step 1 : Ajouter les imports et l'abonnement au store**

En haut de `src/components/quantities/QuantitiesPanel.tsx`, ajouter dans la section imports :

```typescript
import { useState } from 'react';  // déjà présent
// Ajouter après les imports existants :
import type { ConsumableParams } from '@/types/tiling';
```

Dans le corps du composant `QuantitiesPanel`, ajouter après les `useMemo` existants :

```typescript
const setConfig = useProjectStore((s) => s.setConfig);
const [consumablesOpen, setConsumablesOpen] = useState(false);
const [editingMargin, setEditingMargin] = useState(false);
const [marginInput, setMarginInput] = useState('');
```

- [ ] **Step 2 : Ajouter les fonctions handlers**

Après les fonctions `handleCoupesScroll` et `handlePin` existantes, ajouter :

```typescript
const marginPct = Math.round(result.margin * 100);

const handleMarginEdit = () => {
  setMarginInput(String(marginPct));
  setEditingMargin(true);
};

const handleMarginCommit = () => {
  const val = parseFloat(marginInput);
  if (!isNaN(val) && val >= 0 && val <= 100) {
    setConfig({ ...project.config, marginOverride: val / 100 });
  }
  setEditingMargin(false);
};

const handleMarginReset = () => {
  setConfig({ ...project.config, marginOverride: undefined });
  setEditingMargin(false);
};

const updateConsumableParam = (patch: Partial<ConsumableParams>) => {
  setConfig({
    ...project.config,
    consumableParams: { ...(project.config.consumableParams ?? {}), ...patch },
  });
};
```

- [ ] **Step 3 : Modifier l'affichage "Total à commander"**

Localiser le bloc "Total à commander" dans le stat strip (ligne `× 1.10` codée en dur) et le remplacer :

Ancien code :
```tsx
<div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
  {result.wholeCount} + ({result.cuts.length}−{result.totalReuseCount}) = {result.totalTiles} × 1.10
</div>
```

Nouveau code :
```tsx
<div className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500">
  <span>
    {result.wholeCount} + ({result.cuts.length}−{result.totalReuseCount}) = {result.totalTiles}
  </span>
  {editingMargin ? (
    <span className="flex items-center gap-1">
      ×&nbsp;
      <input
        autoFocus
        type="number"
        min="0"
        max="100"
        step="1"
        value={marginInput}
        onChange={(e) => setMarginInput(e.target.value)}
        onBlur={handleMarginCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleMarginCommit(); if (e.key === 'Escape') setEditingMargin(false); }}
        className="w-12 rounded border border-orange-400 bg-transparent px-1 text-orange-400 outline-none"
      />
      %
      {project.config.marginOverride !== undefined && (
        <button type="button" onClick={handleMarginReset} className="text-[9px] text-gray-400 underline hover:text-gray-600">auto</button>
      )}
    </span>
  ) : (
    <button
      type="button"
      onClick={handleMarginEdit}
      className="flex items-center gap-0.5 text-orange-400 hover:text-orange-500"
      title="Modifier la marge de sécurité"
    >
      × {marginPct}%
      {project.config.marginOverride !== undefined && (
        <span className="text-[9px] text-yellow-500">✎</span>
      )}
    </button>
  )}
</div>
```

- [ ] **Step 4 : Ajouter le bloc consommables**

Après la fermeture du div "Stat strip" (après `</div>` du grid), et avant la fermeture du `bandeaux-wrapper`, ajouter le bloc consommables :

```tsx
{/* Bloc consommables */}
<div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
  <button
    type="button"
    onClick={() => setConsumablesOpen((o) => !o)}
    className="flex w-full items-center justify-between px-5 md:px-8 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-blue-500 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors"
  >
    <span>Consommables de pose</span>
    <span className="text-gray-400">{consumablesOpen ? '▲' : '▼'}</span>
  </button>

  {consumablesOpen && (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-5 md:px-8 pb-4 pt-1">
      {/* Épaisseur carreau (commune à tout) */}
      <div className="md:col-span-3 flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
        <span>Épaisseur carreau :</span>
        <input
          type="number"
          min="1"
          max="30"
          step="1"
          defaultValue={(project.config.consumableParams?.tileThickness ?? 10)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) updateConsumableParam({ tileThickness: v });
          }}
          className="w-14 rounded border border-gray-300 dark:border-zinc-600 bg-transparent px-1 text-center text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-400"
        />
        <span>mm</span>
      </div>

      {/* Colle */}
      <ConsumableCard
        label="Colle"
        unit="sacs"
        bags={result.consumables.colle.bags}
        bagSize={result.consumables.colle.bagSize}
        bagUnit="kg"
        rendement={result.consumables.colle.rendement}
        rendementUnit="kg/m²"
        totalKg={result.consumables.colle.total}
        onRendementChange={(v) => updateConsumableParam({ colleRendement: v })}
        onBagSizeChange={(v) => updateConsumableParam({ colleBagSize: v })}
        color="blue"
      />

      {/* Joint */}
      <ConsumableCard
        label="Joint"
        unit="sacs"
        bags={result.consumables.joint.bags}
        bagSize={result.consumables.joint.bagSize}
        bagUnit="kg"
        rendement={result.consumables.joint.rendement}
        rendementUnit="kg/m²"
        totalKg={result.consumables.joint.total}
        onRendementChange={(v) => updateConsumableParam({ jointRendement: v })}
        onBagSizeChange={(v) => updateConsumableParam({ jointBagSize: v })}
        color="blue"
      />

      {/* Croisillons */}
      <ConsumableCard
        label="Croisillons"
        unit="sachets"
        bags={result.consumables.croisillons.bags}
        bagSize={result.consumables.croisillons.bagSize}
        bagUnit="unités"
        rendement={result.consumables.croisillons.rendement}
        rendementUnit="×/carreau"
        totalKg={result.consumables.croisillons.total}
        onRendementChange={null}
        onBagSizeChange={(v) => updateConsumableParam({ croisillonsBagSize: v })}
        color="violet"
      />
    </div>
  )}
</div>
```

- [ ] **Step 5 : Ajouter le sous-composant `ConsumableCard`**

Ajouter avant le composant `QuantitiesPanel` (après `PinButton`) :

```tsx
interface ConsumableCardProps {
  label: string;
  unit: string;
  bags: number;
  bagSize: number;
  bagUnit: string;
  rendement: number;
  rendementUnit: string;
  totalKg: number;
  onRendementChange: ((v: number) => void) | null;
  onBagSizeChange: (v: number) => void;
  color: 'blue' | 'violet';
}

const ConsumableCard = ({
  label, unit, bags, bagSize, bagUnit, rendement, rendementUnit,
  totalKg, onRendementChange, onBagSizeChange, color,
}: ConsumableCardProps) => {
  const accent = color === 'blue' ? 'text-blue-500' : 'text-violet-500';
  const border = color === 'blue' ? 'border-blue-500/30' : 'border-violet-500/30';
  const bg = color === 'blue' ? 'bg-blue-500/5' : 'bg-violet-500/5';

  return (
    <div className={`rounded-xl border ${border} ${bg} px-4 py-3`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${accent} mb-2`}>{label}</div>
      <div className="flex items-end gap-1 mb-2">
        <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{bags}</span>
        <span className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">{unit}</span>
      </div>
      <div className="space-y-1 text-[11px] text-gray-400 dark:text-zinc-500">
        <div className="flex items-center gap-1">
          <span>Cdt :</span>
          <input
            type="number"
            min="1"
            step="1"
            defaultValue={bagSize}
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) onBagSizeChange(v);
            }}
            className="w-14 rounded border border-gray-300 dark:border-zinc-600 bg-transparent px-1 text-center text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-400"
          />
          <span>{bagUnit}/{unit.slice(0, -1)}</span>
        </div>
        {onRendementChange !== null && (
          <div className="flex items-center gap-1">
            <span>Rdmt :</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              defaultValue={parseFloat(rendement.toFixed(3))}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) onRendementChange(v);
              }}
              className="w-14 rounded border border-gray-300 dark:border-zinc-600 bg-transparent px-1 text-center text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-400"
            />
            <span>{rendementUnit}</span>
          </div>
        )}
        <div className="text-[10px]">{totalKg.toFixed(1)} {bagUnit} total</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6 : Vérifier TypeScript et tests**

```bash
npx tsc --noEmit
npx vitest run --reporter verbose
```

Expected : 0 erreur TypeScript, tous les tests passent.

- [ ] **Step 7 : Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx
git commit -m "feat(quantities): panneau — marge éditable + bloc consommables"
```

---

## Task 5 : QuantitiesPrintView — Récapitulatif chantier

**Files:**
- Modify: `src/components/quantities/QuantitiesPrintView.tsx`

**Contexte :**
- `QuantitiesPrintView` reçoit `project`, `rooms`, `doorOpenings`
- Il fait actuellement un `analyzeQuantities` par pièce. Il faut ajouter un `analyzeQuantities` global (toutes les pièces) pour les consommables globaux
- Le résultat global donne `result.consumables`, `result.margin`, `result.totalTiles`, `result.toOrder`, `result.roomArea`

- [ ] **Step 1 : Ajouter l'analyse globale**

Dans `QuantitiesPrintView`, après la déclaration de `roomResults`, ajouter :

```typescript
// Analyse globale pour les consommables et les totaux chantier
const globalResult = analyzeQuantities(validRooms, config, wallThickness, doorOpenings);
```

- [ ] **Step 2 : Ajouter la section "Récapitulatif chantier"**

Dans le JSX de `QuantitiesPrintView`, après le bloc `① En-tête CaléPlan` et avant la section info projet, ajouter :

```tsx
{/* ② Récapitulatif chantier */}
{globalResult.totalTiles > 0 && (
  <div style={{ margin: '16px 24px', border: '2px solid #f97316', borderRadius: 10, overflow: 'hidden' }}>
    <div style={{ background: '#fff7ed', padding: '8px 16px', borderBottom: '1px solid #fed7aa' }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: '#ea580c', letterSpacing: '-0.2px' }}>
        Récapitulatif chantier
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
      {/* Surface */}
      <div style={{ padding: '10px 16px', borderRight: '1px solid #fed7aa', borderBottom: '1px solid #fed7aa' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Surface totale</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{formatM2(globalResult.roomArea)}</div>
      </div>
      {/* Carreaux */}
      <div style={{ padding: '10px 16px', borderRight: '1px solid #fed7aa', borderBottom: '1px solid #fed7aa' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>
          Carreaux à commander
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#f97316' }}>{globalResult.toOrder}</div>
        <div style={{ fontSize: 9, color: '#9ca3af' }}>
          {globalResult.totalTiles} + marge {Math.round(globalResult.margin * 100)}%
        </div>
      </div>
      {/* Colle */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #fed7aa' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Colle</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6' }}>
          {globalResult.consumables.colle.bags} sacs
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af' }}>
          × {globalResult.consumables.colle.bagSize} kg — {globalResult.consumables.colle.rendement.toFixed(1)} kg/m²
        </div>
      </div>
      {/* Joint */}
      <div style={{ padding: '10px 16px', borderRight: '1px solid #fed7aa' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Joint</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#3b82f6' }}>
          {globalResult.consumables.joint.bags} sacs
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af' }}>
          × {globalResult.consumables.joint.bagSize} kg — {globalResult.consumables.joint.rendement.toFixed(3)} kg/m²
        </div>
      </div>
      {/* Croisillons */}
      <div style={{ padding: '10px 16px', borderRight: '1px solid #fed7aa' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Croisillons</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#8b5cf6' }}>
          {globalResult.consumables.croisillons.bags} sachets
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af' }}>
          × {globalResult.consumables.croisillons.bagSize} unités — {globalResult.consumables.croisillons.total} pcs
        </div>
      </div>
      {/* Joint largeur */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' as const, marginBottom: 3 }}>Format pose</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
          {formatCm(globalResult.tileW)} × {formatCm(globalResult.tileH)}
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af' }}>joint {globalResult.joint} mm</div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3 : Vérifier TypeScript et tests**

```bash
npx tsc --noEmit
npx vitest run --reporter verbose
```

Expected : 0 erreur TypeScript, tous les tests passent.

- [ ] **Step 4 : Commit**

```bash
git add src/components/quantities/QuantitiesPrintView.tsx
git commit -m "feat(quantities): rapport imprimé — section Récapitulatif chantier"
```

---

## Vérification finale

```bash
npx tsc --noEmit && npx vitest run --reporter verbose
```

Expected : 0 erreur TypeScript, TOUS les tests passent.
