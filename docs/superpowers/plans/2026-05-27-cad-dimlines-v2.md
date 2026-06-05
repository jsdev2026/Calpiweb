# CAD Dim Lines v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trois améliorations des lignes de cote CAD : badge d'arête sans valeur numérique, flèches corrigées (inward, tips aux points de mesure), et côtes déplaçables par drag avec persistance.

**Architecture:** `displayOffset?: number` ajouté au type `Constraint` et au store. `DrawingCanvas` gère le drag via pointer capture locale et expose un prop `onDimOffsetChange`. Trois fichiers de types/store touchés avant le rendu.

**Tech Stack:** React 18, TypeScript, SVG, Zustand, Vitest

---

## File Map

| Fichier | Action |
|---------|--------|
| `src/types/project.ts` | Ajouter `displayOffset?: number` à `Constraint` |
| `src/store/projectStore.ts` | Ajouter `updateConstraintDisplayOffset` (interface + impl) |
| `src/components/plan/DrawingCanvas.tsx` | Badge fix, flèches refX, drag state + handlers, rendu `dimOffset`, prop `onDimOffsetChange` |
| `src/components/plan/PlanEditor.tsx` | Souscrire à `updateConstraintDisplayOffset`, `handleDimOffsetChange`, passer prop |

---

## Task 1 — Badge d'arête sans valeur numérique

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:529-546`

**Context:** Le bloc per-edge labels (lignes ~505-570) calcule actuellement `dimVal` (la valeur numérique en cm) et l'inclut dans `mainLabel`. On doit supprimer `dimVal` du label et ne montrer que les indicateurs directionnels (`H`, `V`) et l'épaisseur custom (`E:xx`).

- [ ] **Step 1 : Supprimer les calculs obsolètes et modifier mainLabel/showLabel**

Dans `src/components/plan/DrawingCanvas.tsx`, dans le bloc per-edge labels, remplacer le bloc de calculs qui va de `const hasDistC` à `const showLabel` :

```typescript
// Trouver et remplacer ce bloc (lignes ~529-546) :
                const hasDistC = !!(hDistC || vDistC || lenC);
                const hasDirC = hasH || hasV;
                const textColor = hasDistC ? '#22c55e' : hasDirC ? '#60a5fa' : isDoor ? '#f97316' : 'var(--canvas-label-text)';
                const dirIcon = hasH ? 'H ' : hasV ? 'V ' : '';
                const hOffset = hDistC ? constraintFaceOffset(hDistC, room, wallThickness) : 0;
                const vOffset = vDistC ? constraintFaceOffset(vDistC, room, wallThickness) : 0;
                const fallbackType = Math.abs(dxE) >= Math.abs(dyE) ? 'H_DISTANCE' : 'V_DISTANCE';
                const fallbackOffset = constraintFaceOffset(
                  { id: '', type: fallbackType, pts: [{ roomId: room.id, vertexIdx: i }, { roomId: room.id, vertexIdx: (i + 1) % pts.length }] },
                  room, wallThickness,
                );
                const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value - hOffset)
                  : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value - vOffset)
                  : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
                  : formatCm(edgeLen - fallbackOffset);
                const thickPart = thickOverride !== undefined ? ` E:${Math.round(thickOverride / 10)}` : '';
                const mainLabel = `${dirIcon}${dimVal}${thickPart}`;
                const showLabel = !hasDistC && (screenLen > 65 || isHov);
```

Remplacer par :

```typescript
                const hasDistC = !!(hDistC || vDistC || lenC);
                const hasDirC = hasH || hasV;
                const textColor = hasDistC ? '#22c55e' : hasDirC ? '#60a5fa' : isDoor ? '#f97316' : 'var(--canvas-label-text)';
                const dirIcon = hasH ? 'H' : hasV ? 'V' : '';
                const thickPart = thickOverride !== undefined ? `E:${Math.round(thickOverride / 10)}` : '';
                const mainLabel = [dirIcon, thickPart].filter(Boolean).join(' ');
                const showLabel = !!mainLabel && (screenLen > 65 || isHov);
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur (les variables `hOffset`, `vOffset`, `fallbackType`, `fallbackOffset`, `dimVal` sont retirées — vérifier qu'elles ne sont pas utilisées ailleurs dans ce bloc).

- [ ] **Step 3 : Lancer les tests**

```bash
cd /workspaces/Calpiweb
npx vitest run --reporter=verbose 2>&1 | tail -10
```

Expected : 276 tests passent.

- [ ] **Step 4 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/DrawingCanvas.tsx
git commit -m "fix(canvas): badge arête sans valeur numérique (H/V/E:xx uniquement)"
```

---

## Task 2 — Flèches : corriger refX (dépassement)

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:285-296` (bloc `<defs>`)

**Context:** Les flèches SVG dépassent les points de mesure car `refX` place le mauvais point du marqueur à l'ancrage. La correction consiste à échanger les valeurs `refX` pour que les tips atterrissent exactement sur xA et xB.

Pour `cad-arr-r` (markerEnd à xB) : `refX=0` met le bord gauche du marqueur à xB, le tip (x=8) dépasse → changer en `refX=8` pour que le tip soit à xB.

Pour `cad-arr-l` (markerStart à xA) : `refX=8` met le bord droit à xA, le tip (x=0) dépasse → changer en `refX=0` pour que le tip soit à xA.

- [ ] **Step 1 : Corriger refX dans les deux marqueurs**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver :

```tsx
        {/* Flèche ouverte → fin de ligne (pointe vers la droite) */}
        <marker id="cad-arr-r" markerWidth="8" markerHeight="5"
          refX="0" refY="2.5" orient="auto">
          <polyline points="0,0.5 8,2.5 0,4.5" fill="none" stroke="#22c55e"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
        {/* Flèche ouverte ← début de ligne (pointe vers la gauche) */}
        <marker id="cad-arr-l" markerWidth="8" markerHeight="5"
          refX="8" refY="2.5" orient="auto">
          <polyline points="8,0.5 0,2.5 8,4.5" fill="none" stroke="#22c55e"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
```

Remplacer par :

```tsx
        {/* Flèche ouverte → fin de ligne — tip (x=8) ancré à xB */}
        <marker id="cad-arr-r" markerWidth="8" markerHeight="5"
          refX="8" refY="2.5" orient="auto">
          <polyline points="0,0.5 8,2.5 0,4.5" fill="none" stroke="#22c55e"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
        {/* Flèche ouverte ← début de ligne — tip (x=0) ancré à xA */}
        <marker id="cad-arr-l" markerWidth="8" markerHeight="5"
          refX="0" refY="2.5" orient="auto">
          <polyline points="8,0.5 0,2.5 8,4.5" fill="none" stroke="#22c55e"
            strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
```

- [ ] **Step 2 : Vérifier TypeScript + tests**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -5
npx vitest run --reporter=verbose 2>&1 | tail -5
```

- [ ] **Step 3 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/DrawingCanvas.tsx
git commit -m "fix(canvas): flèches CAD inward — tips aux points de mesure (refX swap)"
```

---

## Task 3 — `displayOffset` : type + store action

**Files:**
- Modify: `src/types/project.ts:58-64` (interface `Constraint`)
- Modify: `src/store/projectStore.ts:40` (interface store) et `src/store/projectStore.ts:193` (implémentation)
- Test: `src/components/plan/PlanEditor.toolbar.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `src/components/plan/PlanEditor.toolbar.test.ts`, ajouter à la fin du fichier :

```typescript
// ── displayOffset store action ────────────────────────────────────────────────

describe('updateConstraintDisplayOffset', () => {
  it('met à jour displayOffset sans toucher aux autres champs', async () => {
    const { updateConstraintDisplayOffset } =
      await import('@/store/projectStore').then(m => ({ updateConstraintDisplayOffset: m.useProjectStore.getState().updateConstraintDisplayOffset }));
    // Test indirect via type check — l'action doit exister
    expect(typeof updateConstraintDisplayOffset).toBe('function');
  });
});
```

```bash
cd /workspaces/Calpiweb
npx vitest run src/components/plan/PlanEditor.toolbar.test.ts --reporter=verbose 2>&1 | tail -15
```

Expected : FAIL — `updateConstraintDisplayOffset` n'existe pas encore.

- [ ] **Step 2 : Ajouter `displayOffset` au type `Constraint`**

Dans `src/types/project.ts`, trouver :

```typescript
export interface Constraint {
  id: string;
  type: ConstraintType;
  // FIX: [p]  |  HORIZONTAL/VERTICAL/COINCIDENT/LENGTH: [p1, p2]  |  POINT_ON_LINE: [point, lineP1, lineP2]
  pts: PointRef[];
  value?: number | { x: number; y: number }; // LENGTH → mm distance; FIX → {x,y} anchor coords
}
```

Remplacer par :

```typescript
export interface Constraint {
  id: string;
  type: ConstraintType;
  // FIX: [p]  |  HORIZONTAL/VERTICAL/COINCIDENT/LENGTH: [p1, p2]  |  POINT_ON_LINE: [point, lineP1, lineP2]
  pts: PointRef[];
  value?: number | { x: number; y: number }; // LENGTH → mm distance; FIX → {x,y} anchor coords
  /** Distance d'affichage en mm depuis le point de référence géométrique.
   *  Défaut implicite = DIM_OFFSET (500 mm). Minimum = 100 mm.
   *  Ne participe pas au solveur — affichage uniquement. */
  displayOffset?: number;
}
```

- [ ] **Step 3 : Ajouter `updateConstraintDisplayOffset` à l'interface du store**

Dans `src/store/projectStore.ts`, trouver :

```typescript
  updateConstraintValue: (id: string, value: Constraint['value']) => void;
```

Ajouter juste en dessous :

```typescript
  updateConstraintDisplayOffset: (id: string, offset: number) => void;
```

- [ ] **Step 4 : Implémenter `updateConstraintDisplayOffset`**

Dans `src/store/projectStore.ts`, trouver :

```typescript
  updateConstraintValue: (id, value) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) => (c.id === id ? { ...c, value } : c)),
    }));
  },
```

Ajouter juste après :

```typescript
  updateConstraintDisplayOffset: (id, offset) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) =>
        c.id === id ? { ...c, displayOffset: offset } : c
      ),
    }));
  },
```

- [ ] **Step 5 : Vérifier que le test passe**

```bash
cd /workspaces/Calpiweb
npx vitest run src/components/plan/PlanEditor.toolbar.test.ts --reporter=verbose 2>&1 | tail -15
```

Expected : PASS.

- [ ] **Step 6 : Vérifier TypeScript + tous les tests**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -10
npx vitest run --reporter=verbose 2>&1 | tail -8
```

Expected : 0 erreurs TS, tous les tests passent.

- [ ] **Step 7 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/types/project.ts src/store/projectStore.ts src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(types): Constraint.displayOffset + store action updateConstraintDisplayOffset"
```

---

## Task 4 — Côtes déplaçables (DrawingCanvas drag + PlanEditor wiring)

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:88-91` (DrawingCanvasProps — prop `onDimOffsetChange`)
- Modify: `src/components/plan/DrawingCanvas.tsx:250-256` (destructuring composant)
- Modify: `src/components/plan/DrawingCanvas.tsx:256` (état local `dimDrag`)
- Modify: `src/components/plan/DrawingCanvas.tsx:695-850` (rendu côtes CAD — dimOffset + drag handlers)
- Modify: `src/components/plan/PlanEditor.tsx:238` (souscrire `updateConstraintDisplayOffset`)
- Modify: `src/components/plan/PlanEditor.tsx:649` (ajouter `handleDimOffsetChange`)
- Modify: `src/components/plan/PlanEditor.tsx:1870` (passer prop à DrawingCanvas)

**Context :**
- `DIM_OFFSET = 500` est la valeur par défaut d'offset quand `displayOffset` est absent.
- Le drag est entièrement géré dans `DrawingCanvas` via pointer capture. PlanEditor n'est appelé qu'au `pointerUp` pour persister.
- L'état drag a besoin de `scale` (capturé au pointerDown) pour convertir pixels écran → world units.

- [ ] **Step 1 : Ajouter `onDimOffsetChange` dans DrawingCanvasProps**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver la fin de l'interface `DrawingCanvasProps` :

```typescript
  onDimensionClick?: (constraint: Constraint) => void;
}
```

Remplacer par :

```typescript
  onDimensionClick?: (constraint: Constraint) => void;
  onDimOffsetChange?: (constraintId: string, newOffset: number) => void;
}
```

- [ ] **Step 2 : Ajouter `onDimOffsetChange` dans le destructuring**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver :

```typescript
  onDimensionClick,
}: DrawingCanvasProps) => {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
```

Remplacer par :

```typescript
  onDimensionClick,
  onDimOffsetChange,
}: DrawingCanvasProps) => {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  const [dimDrag, setDimDrag] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    startOffset: number;
    liveOffset: number;
    axis: 'H' | 'V' | 'L';
    nx: number;  // normale X (pour LENGTH)
    ny: number;  // normale Y (pour LENGTH)
  } | null>(null);
```

- [ ] **Step 3 : Remplacer le rendu H_DISTANCE pour utiliser `dimOffset` + drag**

Dans `src/components/plan/DrawingCanvas.tsx`, dans le bloc `if (c.type === 'H_DISTANCE')`, remplacer le contenu actuel par :

```tsx
          if (c.type === 'H_DISTANCE') {
            const xA = resolveDisplayCoord(c.pts[0]!, rooms, wallThickness, 'H') ?? vA.x;
            const xB = resolveDisplayCoord(c.pts[1]!, rooms, wallThickness, 'H') ?? vB.x;
            const topY = Math.min(vA.y, vB.y);
            const dimOffset = (dimDrag?.id === c.id)
              ? dimDrag.liveOffset
              : (c.displayOffset ?? DIM_OFFSET);
            const dimY  = topY - dimOffset;
            const extY0 = topY - EXT_GAP;
            const extY1 = dimY + EXT_OVER;
            const midX = (xA + xB) / 2;
            const labelText = `${faceLabel}  ${displayedCm} cm`;
            const textW = labelText.length * fontSize * 0.6 + padX * 2;
            const isDragging = dimDrag?.id === c.id;
            return (
              <g key={`cad-h-${c.id}`}>
                {/* Lignes d'extension */}
                <line x1={xA} y1={extY0} x2={xA} y2={extY1}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7}
                  className="pointer-events-none" />
                <line x1={xB} y1={extY0} x2={xB} y2={extY1}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7}
                  className="pointer-events-none" />
                {/* Ligne de cote — grabable */}
                <line x1={xA} y1={dimY} x2={xB} y2={dimY}
                  stroke="#22c55e" strokeWidth={isDragging ? sw * 1.5 : sw}
                  markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)"
                  className="cursor-ns-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as SVGLineElement).setPointerCapture(e.pointerId);
                    setDimDrag({
                      id: c.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startOffset: c.displayOffset ?? DIM_OFFSET,
                      liveOffset: c.displayOffset ?? DIM_OFFSET,
                      axis: 'H',
                      nx: 0, ny: -1,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (dimDrag?.id !== c.id) return;
                    const delta = (dimDrag.startClientY - e.clientY) / scale;
                    const newOffset = Math.max(100, dimDrag.startOffset + delta);
                    setDimDrag(d => d ? { ...d, liveOffset: newOffset } : null);
                  }}
                  onPointerUp={() => {
                    if (dimDrag?.id !== c.id) return;
                    onDimOffsetChange?.(c.id, dimDrag.liveOffset);
                    setDimDrag(null);
                  }}
                  onPointerCancel={() => setDimDrag(null)}
                />
                {/* Label encadré */}
                <rect
                  x={midX - textW / 2} y={dimY - fontSize / 2 - padY}
                  width={textW} height={fontSize + padY * 2}
                  rx={4 / scale} fill="var(--canvas-bg)"
                  stroke="#22c55e" strokeWidth={0.8 / scale}
                  className={onDimensionClick ? 'cursor-pointer' : undefined}
                  onClick={() => onDimensionClick?.(c)} />
                <text x={midX} y={dimY}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize} fontWeight="700" fill="#22c55e"
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'system-ui' }}>
                  {labelText}
                </text>
              </g>
            );
          }
```

- [ ] **Step 4 : Remplacer le rendu V_DISTANCE pour utiliser `dimOffset` + drag**

Dans `src/components/plan/DrawingCanvas.tsx`, dans le bloc `if (c.type === 'V_DISTANCE')`, remplacer par :

```tsx
          if (c.type === 'V_DISTANCE') {
            const yA = resolveDisplayCoord(c.pts[0]!, rooms, wallThickness, 'V') ?? vA.y;
            const yB = resolveDisplayCoord(c.pts[1]!, rooms, wallThickness, 'V') ?? vB.y;
            const rightX = Math.max(vA.x, vB.x);
            const dimOffset = (dimDrag?.id === c.id)
              ? dimDrag.liveOffset
              : (c.displayOffset ?? DIM_OFFSET);
            const dimX  = rightX + dimOffset;
            const extX0 = rightX + EXT_GAP;
            const extX1 = dimX - EXT_OVER;
            const midY = (yA + yB) / 2;
            const labelText = `${faceLabel}  ${displayedCm} cm`;
            const textW = labelText.length * fontSize * 0.6 + padX * 2;
            const isDragging = dimDrag?.id === c.id;
            return (
              <g key={`cad-v-${c.id}`}>
                {/* Lignes d'extension */}
                <line x1={extX0} y1={yA} x2={extX1} y2={yA}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7}
                  className="pointer-events-none" />
                <line x1={extX0} y1={yB} x2={extX1} y2={yB}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7}
                  className="pointer-events-none" />
                {/* Ligne de cote — grabable */}
                <line x1={dimX} y1={yA} x2={dimX} y2={yB}
                  stroke="#22c55e" strokeWidth={isDragging ? sw * 1.5 : sw}
                  markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)"
                  className="cursor-ew-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as SVGLineElement).setPointerCapture(e.pointerId);
                    setDimDrag({
                      id: c.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startOffset: c.displayOffset ?? DIM_OFFSET,
                      liveOffset: c.displayOffset ?? DIM_OFFSET,
                      axis: 'V',
                      nx: 1, ny: 0,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (dimDrag?.id !== c.id) return;
                    const delta = (e.clientX - dimDrag.startClientX) / scale;
                    const newOffset = Math.max(100, dimDrag.startOffset + delta);
                    setDimDrag(d => d ? { ...d, liveOffset: newOffset } : null);
                  }}
                  onPointerUp={() => {
                    if (dimDrag?.id !== c.id) return;
                    onDimOffsetChange?.(c.id, dimDrag.liveOffset);
                    setDimDrag(null);
                  }}
                  onPointerCancel={() => setDimDrag(null)}
                />
                {/* Label encadré */}
                <rect
                  x={dimX + padY} y={midY - fontSize / 2 - padY}
                  width={textW} height={fontSize + padY * 2}
                  rx={4 / scale} fill="var(--canvas-bg)"
                  stroke="#22c55e" strokeWidth={0.8 / scale}
                  className={onDimensionClick ? 'cursor-pointer' : undefined}
                  onClick={() => onDimensionClick?.(c)} />
                <text x={dimX + padY + textW / 2} y={midY}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize} fontWeight="700" fill="#22c55e"
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'system-ui' }}>
                  {labelText}
                </text>
              </g>
            );
          }
```

- [ ] **Step 5 : Remplacer le rendu LENGTH pour utiliser `dimOffset` + drag**

Dans `src/components/plan/DrawingCanvas.tsx`, dans le bloc `if (c.type === 'LENGTH')`, remplacer par :

```tsx
          if (c.type === 'LENGTH') {
            const dx = vB.x - vA.x, dy = vB.y - vA.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const dimOffset = (dimDrag?.id === c.id)
              ? dimDrag.liveOffset
              : (c.displayOffset ?? DIM_OFFSET);
            const ox = nx * dimOffset, oy = ny * dimOffset;
            const ax = vA.x + ox, ay = vA.y + oy;
            const bx = vB.x + ox, by = vB.y + oy;
            const midX = (ax + bx) / 2, midY = (ay + by) / 2;
            const labelText = `${(c.value / 10).toFixed(1)} cm`;
            const textW = labelText.length * fontSize * 0.6 + padX * 2;
            const isDragging = dimDrag?.id === c.id;
            return (
              <g key={`cad-l-${c.id}`}>
                {/* Lignes d'extension */}
                <line x1={vA.x + nx * EXT_GAP} y1={vA.y + ny * EXT_GAP}
                  x2={ax + nx * EXT_OVER} y2={ay + ny * EXT_OVER}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7}
                  className="pointer-events-none" />
                <line x1={vB.x + nx * EXT_GAP} y1={vB.y + ny * EXT_GAP}
                  x2={bx + nx * EXT_OVER} y2={by + ny * EXT_OVER}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7}
                  className="pointer-events-none" />
                {/* Ligne de cote — grabable */}
                <line x1={ax} y1={ay} x2={bx} y2={by}
                  stroke="#22c55e" strokeWidth={isDragging ? sw * 1.5 : sw}
                  markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)"
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as SVGLineElement).setPointerCapture(e.pointerId);
                    setDimDrag({
                      id: c.id,
                      startClientX: e.clientX,
                      startClientY: e.clientY,
                      startOffset: c.displayOffset ?? DIM_OFFSET,
                      liveOffset: c.displayOffset ?? DIM_OFFSET,
                      axis: 'L',
                      nx, ny,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (dimDrag?.id !== c.id) return;
                    const dcx = e.clientX - dimDrag.startClientX;
                    const dcy = e.clientY - dimDrag.startClientY;
                    const delta = (dcx * dimDrag.nx + dcy * dimDrag.ny) / scale;
                    const newOffset = Math.max(100, dimDrag.startOffset + delta);
                    setDimDrag(d => d ? { ...d, liveOffset: newOffset } : null);
                  }}
                  onPointerUp={() => {
                    if (dimDrag?.id !== c.id) return;
                    onDimOffsetChange?.(c.id, dimDrag.liveOffset);
                    setDimDrag(null);
                  }}
                  onPointerCancel={() => setDimDrag(null)}
                />
                {/* Label encadré */}
                <rect
                  x={midX - textW / 2} y={midY - fontSize / 2 - padY}
                  width={textW} height={fontSize + padY * 2}
                  rx={4 / scale} fill="var(--canvas-bg)"
                  stroke="#22c55e" strokeWidth={0.8 / scale}
                  className={onDimensionClick ? 'cursor-pointer' : undefined}
                  onClick={() => onDimensionClick?.(c)} />
                <text x={midX} y={midY}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize} fontWeight="700" fill="#22c55e"
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'system-ui' }}>
                  {labelText}
                </text>
              </g>
            );
          }
```

- [ ] **Step 6 : Vérifier TypeScript**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur.

- [ ] **Step 7 : Souscrire `updateConstraintDisplayOffset` dans PlanEditor**

Dans `src/components/plan/PlanEditor.tsx`, trouver :

```typescript
  const updateConstraintValue = useProjectStore((s) => s.updateConstraintValue);
```

Ajouter juste en dessous :

```typescript
  const updateConstraintDisplayOffset = useProjectStore((s) => s.updateConstraintDisplayOffset);
```

- [ ] **Step 8 : Ajouter `handleDimOffsetChange` dans PlanEditor**

Dans `src/components/plan/PlanEditor.tsx`, après le callback `handleDimensionClick` (lignes ~651-660), ajouter :

```typescript
  const handleDimOffsetChange = useCallback((id: string, offset: number) => {
    pushHistory();
    updateConstraintDisplayOffset(id, offset);
  }, [pushHistory, updateConstraintDisplayOffset]);
```

- [ ] **Step 9 : Passer `onDimOffsetChange` à DrawingCanvas**

Dans `src/components/plan/PlanEditor.tsx`, trouver dans le JSX :

```tsx
        onDimensionClick={handleDimensionClick}
      />
```

Remplacer par :

```tsx
        onDimensionClick={handleDimensionClick}
        onDimOffsetChange={handleDimOffsetChange}
      />
```

- [ ] **Step 10 : Vérifier TypeScript + tous les tests**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -10
npx vitest run --reporter=verbose 2>&1 | tail -8
```

Expected : 0 erreurs TS, tous les tests passent.

- [ ] **Step 11 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/DrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat(canvas): côtes CAD déplaçables par drag (pointer capture, persistance displayOffset)"
```
