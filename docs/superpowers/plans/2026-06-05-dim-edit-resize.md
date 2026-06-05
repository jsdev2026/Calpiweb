# Édition de côtes avec redimensionnement physique — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de cliquer sur le label d'une côte dans la vue calepinage, saisir une nouvelle valeur en cm, et redimensionner physiquement la pièce en déplaçant le nœud de mur ancré en p2.

**Architecture:** Ajout de `p2NodeId` dans `TilingDimension` pour suivre quel nœud de mur est ancré en p2 ; extension du snap pour reconnaître les nœuds bruts (priorité 0) ; nouveau composant `DimPropertiesPanel` dans le sidebar droit. La fonction `computeNewP2` est extraite pour être testée de façon isolée.

**Tech Stack:** TypeScript, React, Zustand, Vitest, SVG.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/types/tilingDimension.ts` | Modifier — ajouter `p2NodeId?: string` |
| `src/store/projectStore.ts` | Modifier — ajouter `updateTilingDimension` action |
| `src/engine/tiling/snapTiling.ts` | Modifier — snap wall-node priorité 0 + `nodeId` dans SnapResult |
| `src/engine/tiling/snapTiling.test.ts` | Modifier — tests snap wall-node |
| `src/hooks/useTilingDimension.ts` | Modifier — passer nodes, enregistrer p2NodeId |
| `src/components/tiling/DimLine.tsx` | Modifier — ajouter `onLabelClick` |
| `src/components/tiling/TilingDimensionLayer.tsx` | Modifier — ajouter `onSelect` |
| `src/components/tiling/DimPropertiesPanel.tsx` | Créer — panneau propriétés côte |
| `src/components/tiling/TilingEditor.tsx` | Modifier — câblage selectedDimId + panneau |
| `src/store/projectStore.test.ts` | Modifier — test updateTilingDimension |

---

## Task 1 : TilingDimension type + action store `updateTilingDimension`

**Files:**
- Modify: `src/types/tilingDimension.ts`
- Modify: `src/store/projectStore.ts`
- Modify: `src/store/projectStore.test.ts`

### Contexte

`src/types/tilingDimension.ts` contient l'interface `TilingDimension`. Le store expose déjà `addTilingDimension`, `removeTilingDimension`, `updateTilingDimensionPerpOffset`. Il faut ajouter `p2NodeId` au type et une action de patch générique.

La fonction `updateActive` utilisée par les autres actions prend un callback `(p: Project) => Project` et met à jour le projet actif.

- [ ] **Step 1 : Ajouter `p2NodeId` à `TilingDimension`**

Remplacer le contenu de `src/types/tilingDimension.ts` :

```ts
import type { Point } from '@/types/plan';

export type DimDirection = 'H' | 'V' | 'parallel';

export interface TilingDimension {
  id: string;
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
  perpOffset: number;
  p2NodeId?: string;
}
```

- [ ] **Step 2 : Ajouter `updateTilingDimension` à l'interface du store**

Dans `src/store/projectStore.ts`, autour de la ligne 87 (après `updateTilingDimensionPerpOffset: ...`), ajouter dans l'interface `ProjectState` :

```ts
  updateTilingDimension: (id: string, patch: Partial<TilingDimension>) => void;
```

L'import `TilingDimension` est déjà présent en ligne 2 (`import type { Project, Room, ..., TilingDimension } from '@/types/project'`).

- [ ] **Step 3 : Implémenter `updateTilingDimension`**

Dans `src/store/projectStore.ts`, après l'implémentation de `updateTilingDimensionPerpOffset` (ligne ~528), ajouter :

```ts
  updateTilingDimension: (id, patch) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
      d.id === id ? { ...d, ...patch } : d,
    ),
  })),
```

- [ ] **Step 4 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 5 : Écrire le test pour `updateTilingDimension`**

Dans `src/store/projectStore.test.ts`, après le dernier `describe` block, ajouter :

```ts
describe('projectStore — updateTilingDimension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProjectStore.setState({ projects: [], activeProjectId: null, hydrated: false });
  });

  async function createAndInit() {
    mockSupabaseDb.getProfile.mockResolvedValue({ plan: 'free' });
    mockSupabaseDb.save.mockResolvedValue(undefined);
    await useProjectStore.getState().create();
    useProjectStore.getState().initWallEngine();
  }

  it('patches p2 without affecting other fields', async () => {
    await createAndInit();
    const dim = {
      id: 'd1',
      p1: { x: 0, y: 0 },
      p2: { x: 200, y: 0 },
      direction: 'H' as const,
      perpOffset: 600,
      p2NodeId: 'n2',
    };
    useProjectStore.getState().addTilingDimension(dim);
    useProjectStore.getState().updateTilingDimension('d1', { p2: { x: 300, y: 0 } });

    const dims = selectActiveProject(useProjectStore.getState())?.tilingDimensions ?? [];
    expect(dims).toHaveLength(1);
    expect(dims[0]?.p2.x).toBe(300);
    expect(dims[0]?.p2NodeId).toBe('n2');    // préservé
    expect(dims[0]?.perpOffset).toBe(600);   // préservé
  });

  it('ignore un id inexistant sans erreur', async () => {
    await createAndInit();
    expect(() =>
      useProjectStore.getState().updateTilingDimension('ghost', { p2: { x: 0, y: 0 } }),
    ).not.toThrow();
  });
});
```

Ajouter l'import `TilingDimension` en tête du fichier (s'il n'existe pas encore) :

```ts
import type { TilingDimension } from '@/types/tilingDimension';
```

- [ ] **Step 6 : Lancer les tests**

```
npx vitest run src/store/projectStore.test.ts
```

Attendu : tous les tests passent.

- [ ] **Step 7 : Commit**

```
git add src/types/tilingDimension.ts src/store/projectStore.ts src/store/projectStore.test.ts
git commit -m "feat(dim): ajouter p2NodeId à TilingDimension + action updateTilingDimension"
```

---

## Task 2 : `snapToTiling` — snap wall-node avec priorité 0

**Files:**
- Modify: `src/engine/tiling/snapTiling.ts`
- Modify: `src/engine/tiling/snapTiling.test.ts`

### Contexte

`snapToTiling` snap aux sommets/milieux du polygone inset et aux coins/milieux des tuiles. Il faut ajouter un snap de priorité 0 (la plus haute) sur les positions brutes des `WallNode`, et inclure `nodeId` dans `SnapResult` quand le snap est de type `'wall-node'`.

Interface actuelle de `SnapResult` dans ce fichier (distincte du `SnapResult` de `@/types/wall`) :
```ts
export interface SnapResult {
  point: Point;
  kind: 'wall-vertex' | 'wall-midpoint' | 'tile-corner' | 'tile-midpoint';
}
```

- [ ] **Step 1 : Écrire les tests d'abord (TDD)**

Dans `src/engine/tiling/snapTiling.test.ts`, ajouter après le dernier `describe` :

```ts
import type { WallNode } from '@/types/wall';

describe('snapToTiling — wall-node snap', () => {
  const nodes: WallNode[] = [
    { id: 'n1', x: 0, y: 0 },
    { id: 'n2', x: 3000, y: 0 },
  ];

  it('retourne kind wall-node et nodeId quand le curseur est proche d\'un nœud', () => {
    // n1 est à (0,0), curseur à (5, 3) — dist ~5.8 < rayon 15/1
    const result = snapToTiling({ x: 5, y: 3 }, [room300], [], 0, 1, nodes);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('wall-node');
    expect(result!.nodeId).toBe('n1');
    expect(result!.point.x).toBeCloseTo(0);
    expect(result!.point.y).toBeCloseTo(0);
  });

  it('wall-node a priorité sur wall-vertex quand les deux sont proches', () => {
    // room300 a un wall-vertex à (0,0). n1 est aussi à (0,0).
    // wall-node doit gagner (priorité 0 < 1).
    const result = snapToTiling({ x: 2, y: 2 }, [room300], [], 0, 1, nodes);
    expect(result!.kind).toBe('wall-node');
    expect(result!.nodeId).toBe('n1');
  });

  it('retourne null si aucun nœud dans le rayon et nodes fournis', () => {
    const result = snapToTiling({ x: 9999, y: 9999 }, [], [], 0, 1, nodes);
    expect(result).toBeNull();
  });

  it('sans nodes, le comportement existant est préservé', () => {
    const result = snapToTiling({ x: 1, y: 1 }, [room300], [], 0, 1);
    expect(result!.kind).toBe('wall-vertex');
    expect(result!.nodeId).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/tiling/snapTiling.test.ts
```

Attendu : les 4 nouveaux tests échouent (wall-node non implémenté).

- [ ] **Step 3 : Mettre à jour `SnapResult` et implémenter le snap wall-node**

Remplacer le contenu de `src/engine/tiling/snapTiling.ts` :

```ts
import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { Tile } from '@/types/tiling';
import type { WallNode } from '@/types/wall';
import { insetRoomPolygon } from '@/engine/geometry/polygon';

export interface SnapResult {
  point: Point;
  kind: 'wall-node' | 'wall-vertex' | 'wall-midpoint' | 'tile-corner' | 'tile-midpoint';
  nodeId?: string;
}

interface BestCandidate {
  priority: number;
  dist: number;
  result: SnapResult;
}

export function snapToTiling(
  worldPt: Point,
  rooms: Room[],
  tiles: Tile[],
  wallThickness: number,
  scale: number,
  nodes: WallNode[] = [],
): SnapResult | null {
  const radius = 15 / scale;
  const state: { best: BestCandidate | null } = { best: null };

  const consider = (pt: Point, kind: SnapResult['kind'], priority: number, nodeId?: string) => {
    const dist = Math.hypot(pt.x - worldPt.x, pt.y - worldPt.y);
    if (dist > radius) return;
    const candidate: BestCandidate = {
      priority,
      dist,
      result: { point: { x: pt.x, y: pt.y }, kind, ...(nodeId ? { nodeId } : {}) },
    };
    if (
      !state.best ||
      priority < state.best.priority ||
      (priority === state.best.priority && dist < state.best.dist)
    ) {
      state.best = candidate;
    }
  };

  // Priority 0: wall-node (nœuds de mur bruts — la plus haute priorité)
  for (const node of nodes) {
    consider({ x: node.x, y: node.y }, 'wall-node', 0, node.id);
  }

  // Priority 1: wall-vertex (inset polygon vertices)
  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (const v of poly) {
      consider(v, 'wall-vertex', 1);
    }
  }

  // Priority 2: wall-midpoint (inset polygon edge midpoints)
  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      consider({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 'wall-midpoint', 2);
    }
  }

  // Priority 3: tile-corner (four corners of tile.rect)
  for (const tile of tiles) {
    const { x, y, w, h } = tile.rect;
    for (const pt of [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ]) {
      consider(pt, 'tile-corner', 3);
    }
  }

  // Priority 4: tile-midpoint (four edge midpoints of tile.rect)
  for (const tile of tiles) {
    const { x, y, w, h } = tile.rect;
    for (const pt of [
      { x: x + w / 2, y }, { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h }, { x, y: y + h / 2 },
    ]) {
      consider(pt, 'tile-midpoint', 4);
    }
  }

  return state.best ? state.best.result : null;
}

export function getParallelAngle(
  p1: Point,
  rooms: Room[],
  wallThickness: number,
): number | null {
  let bestDist = Infinity;
  let bestAngle: number | null = null;

  for (const room of rooms) {
    const poly = insetRoomPolygon(room, wallThickness);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(mid.x - p1.x, mid.y - p1.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestAngle = Math.atan2(b.y - a.y, b.x - a.x);
      }
    }
  }

  return bestAngle;
}
```

- [ ] **Step 4 : Lancer tous les tests snap**

```
npx vitest run src/engine/tiling/snapTiling.test.ts
```

Attendu : tous les tests (anciens + nouveaux) passent.

- [ ] **Step 5 : Suite complète**

```
npx vitest run
```

Attendu : 0 régressions.

- [ ] **Step 6 : Commit**

```
git add src/engine/tiling/snapTiling.ts src/engine/tiling/snapTiling.test.ts
git commit -m "feat(snap): snap wall-node priorité 0 avec nodeId dans SnapResult"
```

---

## Task 3 : `useTilingDimension` — passer les nœuds et enregistrer `p2NodeId`

**Files:**
- Modify: `src/hooks/useTilingDimension.ts`

### Contexte

Le hook `useTilingDimension` appelle `snapToTiling` à deux endroits (dans `onPointerMove` et `onClick`). La signature de `snapToTiling` accepte maintenant un paramètre optionnel `nodes?: WallNode[]`. Il faut passer les nœuds et, lors de la création d'une `TilingDimension`, inclure `p2NodeId` si le snap a retourné un `nodeId`.

- [ ] **Step 1 : Mettre à jour `useTilingDimension`**

Remplacer le contenu de `src/hooks/useTilingDimension.ts` :

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile } from '@/types/tiling';
import type { WallNode } from '@/types/wall';
import type { DimDirection, TilingDimension } from '@/types/tilingDimension';
import { generateId } from '@/utils/id';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { useProjectStore } from '@/store/projectStore';
import { snapToTiling, getParallelAngle } from '@/engine/tiling/snapTiling';
import type { SnapResult } from '@/engine/tiling/snapTiling';

type Phase = 'picking_start' | 'picking_end';
const PERP_OFFSET = 600;
const DIR_CYCLE: DimDirection[] = ['H', 'V', 'parallel'];

function computePerpOffset(
  rx1: number, ry1: number, rx2: number, ry2: number,
  rooms: Room[],
): number {
  const dx = rx2 - rx1;
  const dy = ry2 - ry1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return PERP_OFFSET;
  const nx = -dy / len;
  const ny = dx / len;
  const midX = (rx1 + rx2) / 2;
  const midY = (ry1 + ry2) / 2;
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  if (validRooms.length === 0) return PERP_OFFSET;
  let cx = 0, cy = 0;
  for (const r of validRooms) {
    const bb = getBoundingBox(r.points);
    cx += (bb.minX + bb.maxX) / 2;
    cy += (bb.minY + bb.maxY) / 2;
  }
  cx /= validRooms.length;
  cy /= validRooms.length;
  const dot = (cx - midX) * nx + (cy - midY) * ny;
  return dot > 0 ? -PERP_OFFSET : PERP_OFFSET;
}

export interface DimPreview {
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
  perpOffset: number;
}

export function useTilingDimension(
  rooms: Room[],
  tiles: Tile[],
  wallThickness: number,
  scale: number,
  active: boolean,
  nodes: WallNode[] = [],
): {
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  onPointerMove: (worldPt: Point) => void;
  onClick: (worldPt: Point, ctrlHeld: boolean) => void;
  onContextMenu: (dimId: string) => void;
} {
  const addTilingDimension = useProjectStore((s) => s.addTilingDimension);
  const removeTilingDimension = useProjectStore((s) => s.removeTilingDimension);

  const [phase, setPhase] = useState<Phase>('picking_start');
  const [p1, setP1] = useState<Point | null>(null);
  const [hoverSnap, setHoverSnap] = useState<SnapResult | null>(null);
  const [autoDirection, setAutoDirection] = useState<DimDirection>('H');
  const [manualDirection, setManualDirection] = useState<DimDirection | null>(null);

  useEffect(() => {
    if (!active) {
      setPhase('picking_start');
      setP1(null);
      setHoverSnap(null);
      setAutoDirection('H');
      setManualDirection(null);
    }
  }, [active]);

  const effectiveDirection = manualDirection ?? autoDirection;

  const preview: DimPreview | null = (() => {
    if (phase !== 'picking_end' || p1 === null || hoverSnap === null) return null;
    const dir = effectiveDirection;
    const target = hoverSnap.point;
    const parallelAngle = dir === 'parallel' ? (getParallelAngle(p1, rooms, wallThickness) ?? 0) : undefined;

    let rx2: number, ry2: number;
    if (dir === 'H') {
      rx2 = target.x; ry2 = p1.y;
    } else if (dir === 'V') {
      rx2 = p1.x; ry2 = target.y;
    } else {
      const angle = parallelAngle ?? 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const proj = (target.x - p1.x) * cos + (target.y - p1.y) * sin;
      rx2 = p1.x + proj * cos;
      ry2 = p1.y + proj * sin;
    }

    return {
      p1,
      p2: target,
      direction: dir,
      parallelAngle,
      perpOffset: computePerpOffset(p1.x, p1.y, rx2, ry2, rooms),
    };
  })();

  const onPointerMove = useCallback(
    (worldPt: Point) => {
      if (!active) return;
      const snap = snapToTiling(worldPt, rooms, tiles, wallThickness, scale, nodes);
      setHoverSnap(snap);
      if (phase === 'picking_end' && snap && p1 !== null && manualDirection === null) {
        const dx = snap.point.x - p1.x;
        const dy = snap.point.y - p1.y;
        setAutoDirection(Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V');
      }
    },
    [active, rooms, tiles, wallThickness, scale, nodes, phase, p1, manualDirection],
  );

  const onClick = useCallback(
    (worldPt: Point, ctrlHeld: boolean) => {
      if (!active) return;
      const snap = snapToTiling(worldPt, rooms, tiles, wallThickness, scale, nodes);
      const target = snap?.point ?? worldPt;

      if (phase === 'picking_start') {
        setP1(target);
        setPhase('picking_end');
        setManualDirection(null);
        setAutoDirection('H');
        return;
      }

      // picking_end
      if (ctrlHeld) {
        const current = manualDirection ?? autoDirection;
        const idx = DIR_CYCLE.indexOf(current);
        setManualDirection(DIR_CYCLE[(idx + 1) % DIR_CYCLE.length]!);
        return;
      }

      if (p1 === null) return;
      const dir = manualDirection ?? autoDirection;
      const parallelAngle =
        dir === 'parallel' ? (getParallelAngle(p1, rooms, wallThickness) ?? 0) : undefined;

      let rx2: number, ry2: number;
      if (dir === 'H') {
        rx2 = target.x; ry2 = p1.y;
      } else if (dir === 'V') {
        rx2 = p1.x; ry2 = target.y;
      } else {
        const angle = parallelAngle ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const proj = (target.x - p1.x) * cos + (target.y - p1.y) * sin;
        rx2 = p1.x + proj * cos;
        ry2 = p1.y + proj * sin;
      }

      const perpOffset = computePerpOffset(p1.x, p1.y, rx2, ry2, rooms);

      const dim: TilingDimension = {
        id: generateId(),
        p1,
        p2: target,
        direction: dir,
        ...(parallelAngle !== undefined ? { parallelAngle } : {}),
        perpOffset,
        ...(snap?.nodeId ? { p2NodeId: snap.nodeId } : {}),
      };

      addTilingDimension(dim);
      setPhase('picking_start');
      setP1(null);
      setHoverSnap(null);
      setManualDirection(null);
      setAutoDirection('H');
    },
    [active, rooms, tiles, wallThickness, scale, nodes, phase, p1, manualDirection, autoDirection, addTilingDimension],
  );

  const onContextMenu = useCallback(
    (dimId: string) => {
      removeTilingDimension(dimId);
    },
    [removeTilingDimension],
  );

  return { hoverSnap, preview, onPointerMove, onClick, onContextMenu };
}
```

- [ ] **Step 2 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Suite de tests**

```
npx vitest run
```

Attendu : 0 régressions.

- [ ] **Step 4 : Commit**

```
git add src/hooks/useTilingDimension.ts
git commit -m "feat(dim): passer nodes au snap + enregistrer p2NodeId dans TilingDimension"
```

---

## Task 4 : `DimLine.onLabelClick` + `TilingDimensionLayer.onSelect`

**Files:**
- Modify: `src/components/tiling/DimLine.tsx`
- Modify: `src/components/tiling/TilingDimensionLayer.tsx`

### Contexte

`DimLine` rend la pill label dans un `<g transform="translate(...) rotate(...)">`. Il faut ajouter `onClick` sur ce groupe pour déclencher la sélection. `TilingDimensionLayer` orchestre les `DimLine` et doit exposer un callback `onSelect(id)`.

Interface actuelle de `DimLine` :
```ts
interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  scale?: number;
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (e: PointerEvent<SVGGElement>) => void;
}
```

- [ ] **Step 1 : Ajouter `onLabelClick` à `DimLine`**

Remplacer le contenu de `src/components/tiling/DimLine.tsx` :

```tsx
'use client';

import type { MouseEvent, PointerEvent } from 'react';

interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  scale?: number;
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (e: PointerEvent<SVGGElement>) => void;
  onLabelClick?: () => void;
}

export const DimLine = ({
  x1, y1, x2, y2, label,
  perpOffset = 500, scale = 1,
  onContextMenu, onPointerDown, onLabelClick,
}: DimLineProps) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return null;

  const ux = dx / len, uy = dy / len;
  const nx = -dy / len, ny = dx / len;

  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;

  const perpSign = perpOffset >= 0 ? 1 : -1;
  const absPerp = Math.abs(perpOffset);
  const enx = nx * perpSign, eny = ny * perpSign;

  const S = scale;
  const ARROW_L  = 12 / S;
  const ARROW_W  = 6  / S;
  const EXT_GAP  = 6  / S;
  const EXT_OVER = 8  / S;
  const FONT_PX  = 12 / S;
  const PILL_H   = 20 / S;
  const PILL_W   = (label.length * 7.5 + 16) / S;
  const LABEL_GAP = 8 / S;

  const a1 = `${dlx1},${dly1} ${dlx1 + ARROW_L*ux + ARROW_W*nx},${dly1 + ARROW_L*uy + ARROW_W*ny} ${dlx1 + ARROW_L*ux - ARROW_W*nx},${dly1 + ARROW_L*uy - ARROW_W*ny}`;
  const a2 = `${dlx2},${dly2} ${dlx2 - ARROW_L*ux + ARROW_W*nx},${dly2 - ARROW_L*uy + ARROW_W*ny} ${dlx2 - ARROW_L*ux - ARROW_W*nx},${dly2 - ARROW_L*uy - ARROW_W*ny}`;

  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;

  const labelOffset = LABEL_GAP + PILL_H / 2;
  const lx = midX + nx * perpSign * labelOffset;
  const ly = midY + ny * perpSign * labelOffset;

  return (
    <g
      className={onPointerDown ? 'cursor-grab' : onContextMenu ? undefined : 'pointer-events-none'}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
      {/* Extension lines */}
      <line
        x1={x1 + enx * EXT_GAP} y1={y1 + eny * EXT_GAP}
        x2={x1 + enx * (absPerp + EXT_OVER)} y2={y1 + eny * (absPerp + EXT_OVER)}
        stroke="#94a3b8" strokeWidth={1 / S}
      />
      <line
        x1={x2 + enx * EXT_GAP} y1={y2 + eny * EXT_GAP}
        x2={x2 + enx * (absPerp + EXT_OVER)} y2={y2 + eny * (absPerp + EXT_OVER)}
        stroke="#94a3b8" strokeWidth={1 / S}
      />
      {/* Dim line between arrowhead bases */}
      {len > 2 * ARROW_L && (
        <line
          x1={dlx1 + ARROW_L * ux} y1={dly1 + ARROW_L * uy}
          x2={dlx2 - ARROW_L * ux} y2={dly2 - ARROW_L * uy}
          stroke="#f97316" strokeWidth={2 / S}
        />
      )}
      {/* Arrowheads */}
      <polygon points={a1} fill="#f97316" />
      <polygon points={a2} fill="#f97316" />
      {/* Label: translucent pill */}
      <g
        transform={`translate(${lx}, ${ly}) rotate(${ang})`}
        onClick={onLabelClick ? (e) => { e.stopPropagation(); onLabelClick(); } : undefined}
        style={onLabelClick ? { cursor: 'pointer' } : undefined}
      >
        <rect
          x={-PILL_W / 2} y={-PILL_H / 2}
          width={PILL_W} height={PILL_H}
          fill="rgba(255,255,255,0.82)" rx={PILL_H / 2}
        />
        <text
          x="0" y="1"
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FONT_PX} fill="#475569" fontWeight="600"
        >
          {label}
        </text>
      </g>
    </g>
  );
};
```

- [ ] **Step 2 : Ajouter `onSelect` à `TilingDimensionLayer`**

Remplacer le contenu de `src/components/tiling/TilingDimensionLayer.tsx` :

```tsx
'use client';

import type { MouseEvent, PointerEvent } from 'react';
import type { TilingDimension, DimDirection } from '@/types/tilingDimension';
import type { Point } from '@/types/plan';
import type { SnapResult } from '@/engine/tiling/snapTiling';
import type { DimPreview } from '@/hooks/useTilingDimension';
import { formatCm } from '@/utils/formatters';
import { DimLine } from './DimLine';

interface TilingDimensionLayerProps {
  activeTool: 'pan' | 'dimension';
  dimensions: TilingDimension[];
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  scale: number;
  livePerpOverride: { id: string; perpOffset: number } | null;
  onContextMenu: (dimId: string) => void;
  onDimDragStart: (
    id: string,
    nx: number, ny: number,
    startPerp: number,
    e: PointerEvent<SVGGElement>,
  ) => void;
  onSelect?: (id: string) => void;
}

interface ProjectedDim {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset: number;
}

function projectDim(
  p1: Point,
  p2: Point,
  direction: DimDirection,
  parallelAngle: number | undefined,
  perpOffset: number,
): ProjectedDim {
  if (direction === 'H') {
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, label: formatCm(Math.abs(p2.x - p1.x)), perpOffset };
  }
  if (direction === 'V') {
    return { x1: p1.x, y1: p1.y, x2: p1.x, y2: p2.y, label: formatCm(Math.abs(p2.y - p1.y)), perpOffset };
  }
  const angle = parallelAngle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const proj = (p2.x - p1.x) * cos + (p2.y - p1.y) * sin;
  return {
    x1: p1.x, y1: p1.y,
    x2: p1.x + proj * cos, y2: p1.y + proj * sin,
    label: formatCm(Math.abs(proj)),
    perpOffset,
  };
}

function hasLength(pd: ProjectedDim): boolean {
  return Math.hypot(pd.x2 - pd.x1, pd.y2 - pd.y1) >= 10;
}

export const TilingDimensionLayer = ({
  activeTool,
  dimensions,
  hoverSnap,
  preview,
  scale,
  livePerpOverride,
  onContextMenu,
  onDimDragStart,
  onSelect,
}: TilingDimensionLayerProps) => {
  return (
    <g>
      {/* Snap indicator */}
      {activeTool === 'dimension' && hoverSnap && (
        <circle
          cx={hoverSnap.point.x}
          cy={hoverSnap.point.y}
          r={40 / scale}
          stroke="#10b981"
          strokeWidth={20 / scale}
          fill="none"
          className="pointer-events-none"
        />
      )}

      {/* Preview dimension (during picking_end) */}
      {preview && (() => {
        const pd = projectDim(preview.p1, preview.p2, preview.direction, preview.parallelAngle, preview.perpOffset);
        if (!hasLength(pd)) return null;
        return (
          <g className="pointer-events-none" opacity={0.6}>
            <DimLine x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2} label={pd.label} perpOffset={pd.perpOffset} scale={scale} />
          </g>
        );
      })()}

      {/* Placed dimensions */}
      {dimensions.map((dim) => {
        const effectivePerp = livePerpOverride?.id === dim.id ? livePerpOverride.perpOffset : dim.perpOffset;
        const pd = projectDim(dim.p1, dim.p2, dim.direction, dim.parallelAngle, effectivePerp);
        if (!hasLength(pd)) return null;
        return (
          <DimLine
            key={dim.id}
            x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2}
            label={pd.label}
            perpOffset={effectivePerp}
            scale={scale}
            onContextMenu={(e: MouseEvent<SVGGElement>) => {
              e.preventDefault();
              onContextMenu(dim.id);
            }}
            onPointerDown={(e: PointerEvent<SVGGElement>) => {
              e.stopPropagation();
              const { x1, y1, x2, y2 } = pd;
              const segLen = Math.hypot(x2 - x1, y2 - y1);
              if (segLen < 1) return;
              const snx = -(y2 - y1) / segLen;
              const sny =  (x2 - x1) / segLen;
              onDimDragStart(dim.id, snx, sny, effectivePerp, e);
            }}
            onLabelClick={onSelect ? () => onSelect(dim.id) : undefined}
          />
        );
      })}
    </g>
  );
};
```

- [ ] **Step 3 : TypeScript + tests**

```
npx tsc --noEmit && npx vitest run
```

Attendu : 0 erreurs, 0 régressions.

- [ ] **Step 4 : Commit**

```
git add src/components/tiling/DimLine.tsx src/components/tiling/TilingDimensionLayer.tsx
git commit -m "feat(dim): ajouter onLabelClick à DimLine + onSelect à TilingDimensionLayer"
```

---

## Task 5 : Créer `DimPropertiesPanel`

**Files:**
- Create: `src/components/tiling/DimPropertiesPanel.tsx`

### Contexte

Le panneau affiche : longueur (champ éditable si `p2NodeId` présent), direction (lecture seule), ancre fixe (lecture seule). On apply :
1. Convertit cm → mm (`cmToMm`)
2. Calcule `newP2` selon la direction (formules spec)
3. Appelle `updateNode(p2NodeId, newP2)` — action store déjà existante (`updateNode: (id, patch) => void`)
4. Appelle `updateTilingDimension(id, { p2: newP2 })` — action ajoutée en Task 1

La fonction pure `computeNewP2` est exportée pour les tests.

- [ ] **Step 1 : Créer `DimPropertiesPanel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { TilingDimension } from '@/types/tilingDimension';
import { mmToCm, cmToMm } from '@/utils/units';
import { useProjectStore } from '@/store/projectStore';

interface DimPropertiesPanelProps {
  dim: TilingDimension;
  onClose: () => void;
}

function projectedLengthMm(dim: TilingDimension): number {
  if (dim.direction === 'H') return Math.abs(dim.p2.x - dim.p1.x);
  if (dim.direction === 'V') return Math.abs(dim.p2.y - dim.p1.y);
  const angle = dim.parallelAngle ?? 0;
  return Math.abs(
    (dim.p2.x - dim.p1.x) * Math.cos(angle) +
    (dim.p2.y - dim.p1.y) * Math.sin(angle),
  );
}

export function computeNewP2(
  dim: TilingDimension,
  newDistMm: number,
): { x: number; y: number } {
  if (dim.direction === 'H') {
    return {
      x: dim.p1.x + Math.sign(dim.p2.x - dim.p1.x) * newDistMm,
      y: dim.p2.y,
    };
  }
  if (dim.direction === 'V') {
    return {
      x: dim.p2.x,
      y: dim.p1.y + Math.sign(dim.p2.y - dim.p1.y) * newDistMm,
    };
  }
  const angle = dim.parallelAngle ?? 0;
  return {
    x: dim.p1.x + Math.cos(angle) * newDistMm,
    y: dim.p1.y + Math.sin(angle) * newDistMm,
  };
}

function dirLabel(dir: TilingDimension['direction']): string {
  if (dir === 'H') return 'Horizontal (H)';
  if (dir === 'V') return 'Vertical (V)';
  return 'Parallèle au mur';
}

export const DimPropertiesPanel = ({ dim, onClose }: DimPropertiesPanelProps) => {
  const [rawValue, setRawValue] = useState(
    () => mmToCm(projectedLengthMm(dim)).toFixed(1),
  );
  const [error, setError] = useState<string | null>(null);

  const updateNode = useProjectStore((s) => s.updateNode);
  const updateTilingDimension = useProjectStore((s) => s.updateTilingDimension);

  const canEdit = Boolean(dim.p2NodeId);

  const handleApply = () => {
    const val = parseFloat(rawValue);
    if (isNaN(val) || val <= 0) {
      setError('Valeur invalide (> 0 requis)');
      return;
    }
    setError(null);
    const newP2 = computeNewP2(dim, cmToMm(val));
    if (dim.p2NodeId) {
      updateNode(dim.p2NodeId, { x: newP2.x, y: newP2.y });
    }
    updateTilingDimension(dim.id, { p2: newP2 });
    onClose();
  };

  return (
    <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
          Côte sélectionnée
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm leading-none text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[10px] text-gray-500 dark:text-zinc-500">Longueur</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={rawValue}
            disabled={!canEdit}
            onChange={(e) => { setRawValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
            className="w-20 rounded border border-orange-500 bg-gray-50 dark:bg-zinc-800 px-2 py-1 text-sm font-bold disabled:border-gray-300 dark:disabled:border-zinc-700 disabled:cursor-not-allowed disabled:text-gray-400"
          />
          <span className="text-xs text-gray-500 dark:text-zinc-500">cm</span>
          {canEdit && (
            <button
              type="button"
              onClick={handleApply}
              className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white hover:bg-orange-600"
            >
              ↵
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
        {!canEdit && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-zinc-600">
            Ancrez p2 sur un nœud de mur pour éditer
          </p>
        )}
      </div>

      <div className="mb-1.5">
        <div className="text-[10px] text-gray-500 dark:text-zinc-500">Direction</div>
        <div className="text-xs text-gray-700 dark:text-zinc-300">{dirLabel(dim.direction)}</div>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 dark:text-zinc-500">Ancre fixe</div>
        <div className="text-xs text-gray-700 dark:text-zinc-300">p1 (première ancre placée)</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2 : Écrire les tests de `computeNewP2`**

Créer `src/components/tiling/DimPropertiesPanel.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { computeNewP2 } from './DimPropertiesPanel';
import type { TilingDimension } from '@/types/tilingDimension';

const base: TilingDimension = {
  id: 'd1',
  p1: { x: 0, y: 0 },
  p2: { x: 3000, y: 0 },
  direction: 'H',
  perpOffset: 600,
  p2NodeId: 'n2',
};

describe('computeNewP2', () => {
  it('direction H — déplace uniquement X, préserve Y', () => {
    const result = computeNewP2(base, 4000);
    expect(result.x).toBeCloseTo(4000);
    expect(result.y).toBeCloseTo(0);
  });

  it('direction H inversée (p2 à gauche de p1) — signe correct', () => {
    const dim: TilingDimension = { ...base, p2: { x: -3000, y: 0 } };
    const result = computeNewP2(dim, 4000);
    expect(result.x).toBeCloseTo(-4000);
    expect(result.y).toBeCloseTo(0);
  });

  it('direction V — déplace uniquement Y, préserve X', () => {
    const dim: TilingDimension = { ...base, direction: 'V', p2: { x: 0, y: 3000 } };
    const result = computeNewP2(dim, 4000);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(4000);
  });

  it('direction parallel — suit l\'angle', () => {
    const angle = Math.PI / 4; // 45°
    const dim: TilingDimension = {
      ...base,
      direction: 'parallel',
      parallelAngle: angle,
      p2: { x: 2121, y: 2121 }, // ~3000 à 45°
    };
    const dist = 4000;
    const result = computeNewP2(dim, dist);
    expect(result.x).toBeCloseTo(Math.cos(angle) * dist, 0);
    expect(result.y).toBeCloseTo(Math.sin(angle) * dist, 0);
  });
});
```

- [ ] **Step 3 : Lancer les tests**

```
npx vitest run src/components/tiling/DimPropertiesPanel.test.ts
```

Attendu : 4 tests PASS.

- [ ] **Step 4 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 5 : Commit**

```
git add src/components/tiling/DimPropertiesPanel.tsx src/components/tiling/DimPropertiesPanel.test.ts
git commit -m "feat(dim): créer DimPropertiesPanel avec édition de longueur et redimensionnement"
```

---

## Task 6 : Câbler `TilingEditor` — `selectedDimId` + panneau dans le sidebar

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx`

### Contexte

`TilingEditor` gère l'état global du mode côtes. Il faut :
1. Ajouter `selectedDimId: string | null` state
2. Déselectionner quand on quitte le mode Côtes (Échap ou bouton)
3. Passer `onSelect` et les nœuds à `useTilingDimension` + `TilingDimensionLayer`
4. Rendre `DimPropertiesPanel` en tête du sidebar droit

L'import `DimPropertiesPanel` s'ajoute aux imports existants. `wallEngine` est déjà sélectionné via `useProjectStore(s => selectActiveProject(s)?.wallEngine)`.

- [ ] **Step 1 : Ajouter l'import**

En ligne 18 (après `import { TilingDimensionLayer } from './TilingDimensionLayer';`), ajouter :

```ts
import { DimPropertiesPanel } from './DimPropertiesPanel';
```

- [ ] **Step 2 : Ajouter `selectedDimId` state**

Après la ligne `const [livePerpOverride, setLivePerpOverride] = useState...` (~ligne 38), ajouter :

```ts
const [selectedDimId, setSelectedDimId] = useState<string | null>(null);
```

- [ ] **Step 3 : Déselectionner quand on quitte le mode Côtes**

Le `useEffect` gérant `keydown` (ligne ~142) devient :

```ts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && activeTool === 'dimension') {
      setActiveTool('pan');
      setSelectedDimId(null);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [activeTool]);
```

Le bouton Côtes (ligne ~286) devient :

```tsx
onClick={() => setActiveTool((t) => {
  const next = t === 'dimension' ? 'pan' : 'dimension';
  if (next === 'pan') setSelectedDimId(null);
  return next;
})}
```

- [ ] **Step 4 : Passer les nœuds à `useTilingDimension`**

La ligne `const dimHook = useTilingDimension(...)` (~ligne 102) devient :

```ts
const dimHook = useTilingDimension(
  rooms, result.tiles, wallThickness, scale,
  activeTool === 'dimension',
  wallEngine?.nodes ?? [],
);
```

- [ ] **Step 5 : Passer `onSelect` à `TilingDimensionLayer`**

Dans la const `dimensionLayer` (~ligne 210), ajouter le prop `onSelect` :

```tsx
const dimensionLayer = (
  <TilingDimensionLayer
    activeTool={activeTool}
    dimensions={dimensions}
    hoverSnap={dimHook.hoverSnap}
    preview={dimHook.preview}
    scale={scale}
    livePerpOverride={livePerpOverride}
    onContextMenu={dimHook.onContextMenu}
    onDimDragStart={handleDimDragStart}
    onSelect={setSelectedDimId}
  />
);
```

- [ ] **Step 6 : Rendre `DimPropertiesPanel` dans le sidebar**

Dans l'élément `<aside>` (~ligne 338), juste avant `<TilingControls>` :

```tsx
<aside className={`z-20 flex w-full flex-col overflow-y-auto dark:bg-zinc-900 bg-white shadow-2xl md:w-80 ${mobileTab === 'apercu' ? 'hidden md:flex' : 'flex'}`}>
  {selectedDimId && (() => {
    const dim = dimensions.find((d) => d.id === selectedDimId);
    return dim ? (
      <DimPropertiesPanel
        dim={dim}
        onClose={() => setSelectedDimId(null)}
      />
    ) : null;
  })()}
  <TilingControls config={config} onChange={setConfig} />
  <ResultsPanel result={result} />
</aside>
```

- [ ] **Step 7 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 8 : Suite complète de tests**

```
npx vitest run
```

Attendu : tous les tests passent (aucune régression).

- [ ] **Step 9 : Commit final**

```
git add src/components/tiling/TilingEditor.tsx
git commit -m "feat(dim): câbler TilingEditor — sélection côte + panneau propriétés dans sidebar"
```
