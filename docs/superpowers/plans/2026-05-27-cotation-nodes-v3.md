# Cotation Nodes v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trois améliorations du système de cotation : snap aux nœuds uniquement (`findNearestVertexSnap` remplace la projection sur segment), marqueurs permanents des nœuds en mode DIMENSION, et sélection du type H/V/L via 3 prévisualisations simultanées cliquables.

**Architecture:** Helpers purs `bestEdgeNormal` et `findNearestVertexSnapImpl` + `computeDimDisplayedValue` extraits dans `src/engine/constraints/vertexSnap.ts` pour testabilité directe. `PlanEditor.tsx` les importe et remplace `findNearestFaceSnap` par un `useCallback` thin wrapper. Nouveau state `dimTypeSelection` dans PlanEditor pilote le flow 3-previews. `DrawingCanvas.tsx` reçoit 2 nouveaux props et rend marqueurs permanents + 3 prévisualisations semi-transparentes cliquables.

**Tech Stack:** React 18, TypeScript, SVG, Zustand, Vitest

---

## Files

| Fichier | Action |
|---------|--------|
| `src/engine/constraints/vertexSnap.ts` | **Créer** — `bestEdgeNormal`, `findNearestVertexSnapImpl`, `computeDimDisplayedValue` (fonctions pures, testables) |
| `src/components/plan/PlanEditor.tsx` | Importer vertexSnap, remplacer `findNearestFaceSnap`, ajouter `DimConstraintType` import, ajouter `dimTypeSelection` state, modifier `openDimensionPopup` (param `forcedType` + utilise `computeDimDisplayedValue`), remplacer handler 2ème clic DIMENSION, ajouter `setDimTypeSelection(null)` au reset Escape, ajouter `handleDimTypeSelect`, passer nouveaux props |
| `src/components/plan/DrawingCanvas.tsx` | Importer `DimConstraintType`, ajouter props `dimTypeSelection` + `onDimTypeSelect`, ajouter rendu vertex markers permanents, ajouter rendu 3 prévisualisations |
| `src/components/plan/PlanEditor.dimension.test.ts` | Tests `bestEdgeNormal`, `findNearestVertexSnapImpl` (snap vertex seulement), `computeDimDisplayedValue` (rawValue par type) |

---

### Task 1: Snap aux nœuds — `vertexSnap.ts` + intégration PlanEditor

**Files:**
- Create: `src/engine/constraints/vertexSnap.ts`
- Modify: `src/components/plan/PlanEditor.tsx:549-608` (remplacer `findNearestFaceSnap`)
- Modify: `src/components/plan/PlanEditor.tsx:1327` (renommer l'appel)
- Test: `src/components/plan/PlanEditor.dimension.test.ts`

- [ ] **Step 1 : Écrire les tests échouants**

Ajouter dans `src/components/plan/PlanEditor.dimension.test.ts`, après les tests existants :

```typescript
import { bestEdgeNormal, findNearestVertexSnapImpl } from '@/engine/constraints/vertexSnap';
import type { Point } from '@/types/plan';

describe('bestEdgeNormal', () => {
  // Polygone en L : prev=(0,0) → vtx=(1000,0) → next=(1000,1000)
  // seg prev→vtx  : dx=1000,dy=0  → normal = (0, 1)
  // seg vtx→next  : dx=0,  dy=1000 → normal = (-1, 0)

  it('picks normal of edge most aligned with cursor direction — above vtx', () => {
    const cursor: Point = { x: 1000, y: -200 }; // au-dessus du vtx
    const vtx: Point    = { x: 1000, y: 0 };
    const prev: Point   = { x: 0, y: 0 };
    const next: Point   = { x: 1000, y: 1000 };
    // toCursor = (0,-200); dot1 with (0,1) = -200 |200|; dot2 with (-1,0) = 0 |0|
    // → picks n1 = (0,1)
    const n = bestEdgeNormal(cursor, vtx, prev, next);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
  });

  it('picks normal of other edge when cursor is on that side', () => {
    const cursor: Point = { x: 1200, y: 0 }; // à droite du vtx
    const vtx: Point    = { x: 1000, y: 0 };
    const prev: Point   = { x: 0, y: 0 };
    const next: Point   = { x: 1000, y: 1000 };
    // toCursor = (200,0); dot1 with (0,1)=0; dot2 with (-1,0)=-200 |200|
    // → picks n2 = (-1,0)
    const n = bestEdgeNormal(cursor, vtx, prev, next);
    expect(n.x).toBeCloseTo(-1);
    expect(n.y).toBeCloseTo(0);
  });
});

describe('findNearestVertexSnapImpl', () => {
  const room: Room = {
    id: 'r1',
    points: [
      { x: 0,    y: 0    },
      { x: 2000, y: 0    },
      { x: 2000, y: 3000 },
      { x: 0,    y: 3000 },
    ],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const wallThickness = 100;

  it('snaps to vertex when cursor is within threshold', () => {
    // threshold = 80/scale = 80 ; distance from (50,30) to (0,0) ≈ 58 < 80
    const snap = findNearestVertexSnapImpl({ x: 50, y: 30 }, [room], 1, wallThickness);
    expect(snap).not.toBeNull();
    expect(snap!.vertexIdx).toBe(0);
  });

  it('does NOT snap to segment midpoint — only to vertices', () => {
    // midpoint top edge = (1000,0); nearest vertices at dist=1000 > threshold 80
    const snap = findNearestVertexSnapImpl({ x: 1000, y: 0 }, [room], 1, wallThickness);
    expect(snap).toBeNull();
  });

  it('returns AXIS face when cursor is exactly on vertex axis', () => {
    const snap = findNearestVertexSnapImpl({ x: 0, y: 0 }, [room], 1, wallThickness);
    expect(snap).not.toBeNull();
    expect(snap!.face).toBe('AXIS');
  });

  it('returns null when no vertex within threshold', () => {
    // cursor far from all vertices
    const snap = findNearestVertexSnapImpl({ x: 500, y: 500 }, [room], 1, wallThickness);
    expect(snap).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier FAIL**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.dimension.test.ts
```

Expected : FAIL — `vertexSnap` module introuvable.

- [ ] **Step 3 : Créer `src/engine/constraints/vertexSnap.ts`**

```typescript
import type { Point } from '@/types/plan';
import type { DimConstraintType, Room } from '@/types/project';
import type { FaceSnapPoint } from '@/components/plan/DrawingCanvas';
import { distance } from '@/engine/geometry/polygon';

/**
 * Retourne la normale unitaire de l'arête (prev→vtx ou vtx→next) la plus
 * perpendiculaire à la direction curseur→vtx.
 */
export function bestEdgeNormal(
  cursor: Point,
  vtx: Point,
  prev: Point,
  next: Point,
): Point {
  const toCursor = { x: cursor.x - vtx.x, y: cursor.y - vtx.y };
  const normalOf = (a: Point, b: Point): Point => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: -dy / len, y: dx / len };
  };
  const n1 = normalOf(prev, vtx);
  const n2 = normalOf(vtx, next);
  const dot1 = n1.x * toCursor.x + n1.y * toCursor.y;
  const dot2 = n2.x * toCursor.x + n2.y * toCursor.y;
  return Math.abs(dot1) >= Math.abs(dot2) ? n1 : n2;
}

/**
 * Trouve le FaceSnapPoint le plus proche sur les nœuds (vertices) des rooms.
 * Remplace findNearestFaceSnap (qui projetait le curseur sur tout le segment).
 * Snap threshold : 80 world-units / scale.
 */
export function findNearestVertexSnapImpl(
  cursor: Point,
  rooms: Room[],
  scale: number,
  wallThickness: number,
): FaceSnapPoint | null {
  const threshold = 80 / scale;
  let best: { snap: FaceSnapPoint; dist: number } | null = null;

  for (const room of rooms) {
    const pts = room.points;
    const n = pts.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const vtx  = pts[i]!;
      const dist = distance(cursor, vtx);
      if (dist > threshold) continue;

      const prev = pts[(i - 1 + n) % n]!;
      const next = pts[(i + 1) % n]!;
      const halfPrev  = (room.edgeThicknesses?.[(i - 1 + n) % n] ?? wallThickness) / 2;
      const halfNext  = (room.edgeThicknesses?.[i] ?? wallThickness) / 2;
      const halfThick = Math.max(halfPrev, halfNext);

      const wallNormal = bestEdgeNormal(cursor, vtx, prev, next);

      const candidates: Array<{ face: 'INSIDE' | 'AXIS' | 'OUTSIDE'; pos: Point }> = [
        { face: 'INSIDE',  pos: { x: vtx.x + wallNormal.x * halfThick, y: vtx.y + wallNormal.y * halfThick } },
        { face: 'AXIS',    pos: vtx },
        { face: 'OUTSIDE', pos: { x: vtx.x - wallNormal.x * halfThick, y: vtx.y - wallNormal.y * halfThick } },
      ];

      let bestFace: FaceSnapPoint | null = null;
      let bestFaceDist = Infinity;
      for (const { face, pos } of candidates) {
        const d = distance(cursor, pos);
        if (d < bestFaceDist) {
          bestFaceDist = d;
          bestFace = { roomId: room.id, vertexIdx: i, face, worldPos: pos, wallNormal };
        }
      }
      if (bestFace && (!best || dist < best.dist)) {
        best = { snap: bestFace, dist };
      }
    }
  }

  return best ? best.snap : null;
}

/**
 * Calcule la valeur affichée brute (en cm, sans correction faceOffset) pour un
 * nouveau dimensionnement selon le type forcé.
 */
export function computeDimDisplayedValue(
  fromWorld: Point,
  toWorld: Point,
  dimType: DimConstraintType,
): number {
  const dx = Math.abs(toWorld.x - fromWorld.x);
  const dy = Math.abs(toWorld.y - fromWorld.y);
  const rawMm =
    dimType === 'H_DISTANCE' ? dx :
    dimType === 'V_DISTANCE' ? dy :
    Math.sqrt(dx * dx + dy * dy);
  return rawMm / 10;
}
```

- [ ] **Step 4 : Lancer les tests — vérifier PASS**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.dimension.test.ts
```

Expected : tous les nouveaux tests passent.

- [ ] **Step 5 : Intégrer dans PlanEditor.tsx**

**5a.** Ligne 6, ajouter `DimConstraintType` aux imports depuis `@/types/project` :
```typescript
import type { Constraint, DimConstraintType, EdgeType, PointRef, Room } from '@/types/project';
```

**5b.** Après les imports existants (après la ligne `import { constraintFaceOffset } from ...`), ajouter :
```typescript
import { findNearestVertexSnapImpl } from '@/engine/constraints/vertexSnap';
```

**5c.** Remplacer tout le bloc `findNearestFaceSnap` (lignes 549–608) par :
```typescript
  // ── DIMENSION vertex-snap helpers ────────────────────────────────────────

  const findNearestVertexSnap = useCallback((cursor: Point): FaceSnapPoint | null => {
    return findNearestVertexSnapImpl(cursor, rooms, scale, wallThickness);
  }, [rooms, scale, wallThickness]);
```

**5d.** Ligne 1327, remplacer :
```typescript
      setFaceSnapHover(findNearestFaceSnap(raw));
```
par :
```typescript
      setFaceSnapHover(findNearestVertexSnap(raw));
```

- [ ] **Step 6 : Vérifier compilation TypeScript**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 7 : Commit**

```bash
git add src/engine/constraints/vertexSnap.ts src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.dimension.test.ts
git commit -m "feat(dimension): snap aux nœuds uniquement — findNearestVertexSnapImpl + bestEdgeNormal

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2 : Marqueurs permanents des nœuds (DrawingCanvas)

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx` (insérer avant ligne 1115)

- [ ] **Step 1 : Ajouter les vertex markers permanents**

Dans `src/components/plan/DrawingCanvas.tsx`, insérer le bloc suivant **immédiatement avant** la ligne
`{/* ── Face snap dots (DIMENSION tool hover) ─────────────────────── */}` (actuellement ligne ~1115) :

```tsx
        {/* ── Vertex markers permanents en mode DIMENSION ─────────────────── */}
        {tool === 'DIMENSION' && rooms.map(room =>
          room.points.map((pt, i) => (
            <rect
              key={`vm-${room.id}-${i}`}
              x={pt.x - 2 / scale} y={pt.y - 2 / scale}
              width={4 / scale} height={4 / scale}
              fill="#475569" rx={0.5 / scale}
              className="pointer-events-none"
            />
          ))
        )}
```

- [ ] **Step 2 : Vérifier compilation**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add src/components/plan/DrawingCanvas.tsx
git commit -m "feat(dimension): marqueurs carrés permanents sur nœuds en mode DIMENSION

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3 : `dimTypeSelection` state + `forcedType` dans `openDimensionPopup`

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx` (state, openDimensionPopup, click handler, reset)
- Test: `src/components/plan/PlanEditor.dimension.test.ts`

- [ ] **Step 1 : Écrire les tests échouants pour `computeDimDisplayedValue`**

Ajouter dans `src/components/plan/PlanEditor.dimension.test.ts` :

```typescript
import { computeDimDisplayedValue } from '@/engine/constraints/vertexSnap';

describe('computeDimDisplayedValue — rawValue par type', () => {
  it('H_DISTANCE : rawValue = |dx| / 10', () => {
    const from: Point = { x: 0,    y: 0 };
    const to:   Point = { x: 3000, y: 1000 };
    expect(computeDimDisplayedValue(from, to, 'H_DISTANCE')).toBeCloseTo(300);
  });

  it('V_DISTANCE : rawValue = |dy| / 10', () => {
    const from: Point = { x: 0,    y: 0 };
    const to:   Point = { x: 3000, y: 1000 };
    expect(computeDimDisplayedValue(from, to, 'V_DISTANCE')).toBeCloseTo(100);
  });

  it('LENGTH : rawValue = sqrt(dx²+dy²) / 10', () => {
    const from: Point = { x: 0, y: 0 };
    const to:   Point = { x: 3000, y: 4000 };
    // sqrt(9000000+16000000)/10 = 5000/10 = 500
    expect(computeDimDisplayedValue(from, to, 'LENGTH')).toBeCloseTo(500);
  });

  it('LENGTH entre deux points alignés H : rawValue = |dx| / 10', () => {
    const from: Point = { x: 0,    y: 0 };
    const to:   Point = { x: 2500, y: 0 };
    expect(computeDimDisplayedValue(from, to, 'LENGTH')).toBeCloseTo(250);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier résultat actuel**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.dimension.test.ts
```

Note : les tests `computeDimDisplayedValue` devraient **déjà passer** (la fonction a été créée en Task 1). Si oui, continuer ; si non, corriger `computeDimDisplayedValue` dans vertexSnap.ts.

- [ ] **Step 3 : Ajouter le state `dimTypeSelection` dans PlanEditor.tsx**

Insérer **après** la ligne `} | null>(null);` qui termine `dimensionSource` (actuellement ligne 287) :

```typescript
  const [dimTypeSelection, setDimTypeSelection] = useState<{
    from: { ref: PointRef; worldPos: Point };
    to:   { ref: PointRef; worldPos: Point };
  } | null>(null);
```

- [ ] **Step 4 : Ajouter l'import `computeDimDisplayedValue` dans PlanEditor.tsx**

Modifier l'import vertexSnap (ajouté en Task 1) :
```typescript
import { findNearestVertexSnapImpl, computeDimDisplayedValue } from '@/engine/constraints/vertexSnap';
```

- [ ] **Step 5 : Modifier `openDimensionPopup` (lignes 610–650)**

Remplacer l'intégralité du bloc `openDimensionPopup` par :

```typescript
  const openDimensionPopup = useCallback((
    fromRef: PointRef,
    toRef: PointRef,
    fromWorld: Point,
    toWorld: Point,
    forcedType?: DimConstraintType,
  ) => {
    const dx = Math.abs(toWorld.x - fromWorld.x);
    const dy = Math.abs(toWorld.y - fromWorld.y);
    const dimType: DimConstraintType =
      forcedType ?? (dx >= dy ? 'H_DISTANCE' : 'V_DISTANCE');

    // Check for existing constraint between these vertices
    const existing = constraints.find((c) =>
      (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
        c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
       (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
        c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
    );

    let displayedValue: number;
    const resolvedDimType = existing ? (existing.type as DimConstraintType) : dimType;

    if (existing && typeof existing.value === 'number') {
      const room = rooms.find(r => r.id === fromRef.roomId);
      const syntheticC = { ...existing, pts: [fromRef, toRef] };
      const offset = room ? constraintFaceOffset(syntheticC, room, wallThickness) : 0;
      displayedValue = (existing.value - offset) / 10;
    } else {
      displayedValue = computeDimDisplayedValue(fromWorld, toWorld, dimType);
    }

    setDimensionPopup({
      fromRef,
      toRef,
      dimType: resolvedDimType,
      value: displayedValue.toFixed(1),
    });
  }, [constraints, rooms, wallThickness]);
```

- [ ] **Step 6 : Ajouter `handleDimTypeSelect` (immédiatement après `openDimensionPopup`)**

```typescript
  const handleDimTypeSelect = useCallback((type: DimConstraintType) => {
    if (!dimTypeSelection) return;
    openDimensionPopup(
      dimTypeSelection.from.ref,
      dimTypeSelection.to.ref,
      dimTypeSelection.from.worldPos,
      dimTypeSelection.to.worldPos,
      type,
    );
    setDimTypeSelection(null);
  }, [dimTypeSelection, openDimensionPopup]);
```

- [ ] **Step 7 : Remplacer le handler DIMENSION 1er/2ème clic (lignes 1047–1075)**

Remplacer l'intégralité du bloc `// ── DIMENSION ──` (lignes 1047–1075) par :

```typescript
    // ── DIMENSION ──
    if (tool === 'DIMENSION') {
      // Un clic canvas annule les 3 prévisualisations (les previews SVG utilisent stopPropagation)
      if (dimTypeSelection) {
        setDimTypeSelection(null);
        return;
      }
      if (!dimensionSource) {
        if (faceSnapHover) {
          setDimensionSource({
            ref: {
              roomId: faceSnapHover.roomId,
              vertexIdx: faceSnapHover.vertexIdx,
              face: faceSnapHover.face,
            },
            worldPos: faceSnapHover.worldPos,
          });
        }
        return;
      }
      // Second click
      if (faceSnapHover) {
        setDimTypeSelection({
          from: dimensionSource,
          to: {
            ref: {
              roomId: faceSnapHover.roomId,
              vertexIdx: faceSnapHover.vertexIdx,
              face: faceSnapHover.face,
            },
            worldPos: faceSnapHover.worldPos,
          },
        });
        setDimensionSource(null);
      } else {
        setDimensionSource(null);
      }
      return;
    }
```

- [ ] **Step 8 : Ajouter `setDimTypeSelection(null)` dans le bloc reset Escape (ligne ~744)**

Remplacer la ligne :
```typescript
        setCoincideSource(null); setDimensionSource(null); setFaceSnapHover(null); setDimensionPopup(null); setPartitionOrigin(null); setExcludePoints([]);
```
par :
```typescript
        setCoincideSource(null); setDimensionSource(null); setFaceSnapHover(null); setDimensionPopup(null); setDimTypeSelection(null); setPartitionOrigin(null); setExcludePoints([]);
```

- [ ] **Step 9 : Vérifier compilation TypeScript**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 10 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.dimension.test.ts
```

Expected : tous les tests passent.

- [ ] **Step 11 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/engine/constraints/vertexSnap.ts src/components/plan/PlanEditor.dimension.test.ts
git commit -m "feat(dimension): dimTypeSelection flow + forcedType dans openDimensionPopup + LENGTH rawValue

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4 : Rendu des 3 prévisualisations H/V/L (DrawingCanvas + wiring PlanEditor)

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx` (imports, DrawingCanvasProps, destructuring, rendu)
- Modify: `src/components/plan/PlanEditor.tsx:1882` (passer nouveaux props)

- [ ] **Step 1 : Ajouter `DimConstraintType` à l'import DrawingCanvas.tsx (ligne 5)**

```typescript
import type { DimConstraintType, Room, Constraint, ExcludedZone, Partition, PointRef } from '@/types/project';
```

- [ ] **Step 2 : Ajouter les nouveaux props dans `DrawingCanvasProps` (après ligne 92)**

Insérer avant le `}` fermant `DrawingCanvasProps` (après `onDimOffsetChange?`) :

```typescript
  dimTypeSelection?: {
    from: { ref: PointRef; worldPos: Point };
    to:   { ref: PointRef; worldPos: Point };
  } | null;
  onDimTypeSelect?: (type: DimConstraintType) => void;
```

- [ ] **Step 3 : Destructurer les nouveaux props dans la signature de `DrawingCanvas`**

Trouver la ligne `function DrawingCanvas({` (ou équivalent) et ajouter dans la liste de déstructuration :

```typescript
  dimTypeSelection,
  onDimTypeSelect,
```

- [ ] **Step 4 : Ajouter le rendu des 3 prévisualisations**

Insérer le bloc suivant **immédiatement après** le bloc "Confirmed dimension source point"
(après le `})()`  qui ferme ce bloc, aux alentours de la ligne 1183) :

```tsx
        {/* ── 3 côtes prévisualisées H / V / L (dimTypeSelection) ─────────── */}
        {dimTypeSelection && (() => {
          const { from, to } = dimTypeSelection;
          const fA = from.worldPos, fB = to.worldPos;
          const segDx = fB.x - fA.x, segDy = fB.y - fA.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy) || 1;
          const nx = -segDy / segLen, ny = segDx / segLen; // normale perpendiculaire

          // H preview : ligne horizontale au-dessus des deux points
          const hY = Math.min(fA.y, fB.y) - DIM_OFFSET;
          // V preview : ligne verticale à droite des deux points
          const vX = Math.max(fA.x, fB.x) + DIM_OFFSET;
          // L preview : parallèle au segment, décalée selon la normale
          const lX1 = fA.x + nx * DIM_OFFSET, lY1 = fA.y + ny * DIM_OFFSET;
          const lX2 = fB.x + nx * DIM_OFFSET, lY2 = fB.y + ny * DIM_OFFSET;

          const sw       = Math.min(2 / scale, 2000);
          const fontSize = Math.min(13 / scale, 2000);

          const previews: Array<{
            type: DimConstraintType;
            x1: number; y1: number; x2: number; y2: number;
            color: string; labelX: number; labelY: number; label: string;
          }> = [
            {
              type: 'H_DISTANCE',
              x1: fA.x, y1: hY, x2: fB.x, y2: hY,
              color: '#22c55e', label: 'H',
              labelX: (fA.x + fB.x) / 2,
              labelY: hY - fontSize * 1.2,
            },
            {
              type: 'V_DISTANCE',
              x1: vX, y1: fA.y, x2: vX, y2: fB.y,
              color: '#3b82f6', label: 'V',
              labelX: vX + fontSize * 1.5,
              labelY: (fA.y + fB.y) / 2,
            },
            {
              type: 'LENGTH',
              x1: lX1, y1: lY1, x2: lX2, y2: lY2,
              color: '#f97316', label: 'L',
              labelX: (lX1 + lX2) / 2 + nx * fontSize * 1.5,
              labelY: (lY1 + lY2) / 2 + ny * fontSize * 1.5,
            },
          ];

          return (
            <g>
              {previews.map(({ type, x1, y1, x2, y2, color, labelX, labelY, label }) => (
                <g
                  key={type}
                  opacity={0.35}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onDimTypeSelect?.(type); }}
                  onPointerEnter={(e) => { (e.currentTarget as SVGGElement).style.opacity = '0.85'; }}
                  onPointerLeave={(e) => { (e.currentTarget as SVGGElement).style.opacity = '0.35'; }}
                >
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={color} strokeWidth={sw}
                    markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)"
                  />
                  <text
                    x={labelX} y={labelY}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={fontSize} fontWeight="700" fill={color}
                    className="select-none pointer-events-none"
                    style={{ fontFamily: 'system-ui' }}
                  >
                    {label}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}
```

- [ ] **Step 5 : Passer les nouveaux props depuis PlanEditor.tsx (ligne ~1882)**

Modifier le JSX `<DrawingCanvas ... />` pour ajouter après `onDimOffsetChange` :

```tsx
        onDimOffsetChange={handleDimOffsetChange}
        dimTypeSelection={dimTypeSelection}
        onDimTypeSelect={handleDimTypeSelect}
```

- [ ] **Step 6 : Vérifier compilation TypeScript**

```bash
cd /workspaces/Calpiweb && npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 7 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb && npx vitest run
```

Expected : tous les tests passent, aucune régression.

- [ ] **Step 8 : Commit**

```bash
git add src/components/plan/DrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat(dimension): 3 prévisualisations H/V/L simultanées cliquables après 2ème nœud

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Cas limites couverts

| Cas | Comportement |
|-----|-------------|
| Vertex partagé par 2 rooms | `findNearestVertexSnapImpl` garde le vertex avec `dist` minimal — correct |
| Changement d'outil quand `dimTypeSelection` actif | Reset Escape appelle `setDimTypeSelection(null)` — couvert en Step 8 de Task 3 |
| LENGTH entre 2 points H-alignés | `sqrt(dx²+0)=dx` — identique à H_DISTANCE — correct |
| Preview H quand fA.y ≈ fB.y | Côte de longueur quasiment nulle — pas un bug, affichage honnête |
| Clic canvas pendant dimTypeSelection sans snap | Handler annule `dimTypeSelection` et retourne (Step 7 Task 3) |
| Clic sur une preview | `e.stopPropagation()` — le handler canvas ne voit pas le clic |
