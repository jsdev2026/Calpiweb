# CAD Dim Lines v2 — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trois améliorations des lignes de cote CAD : (1) badge d'arête sans valeur numérique, (2) flèches inward corrigées, (3) côtes déplaçables par drag avec persistance.

**Architecture:** Quatre fichiers touchés : `src/types/project.ts` (champ `displayOffset`), `src/store/projectStore.ts` (action `updateConstraintDisplayOffset`), `src/components/plan/DrawingCanvas.tsx` (badge, flèches, drag state, rendu), `src/components/plan/PlanEditor.tsx` (handler + prop).

**Tech Stack:** React 18, TypeScript, SVG, Zustand, Vitest

---

## 1. Badge d'arête — valeur numérique supprimée

### 1.1 Avant / Après

| Avant | Après |
|-------|-------|
| `H 285.0 cm E:15` | `H E:15` |
| `285.0 cm` | *(rien)* |
| `H` | `H` |
| `E:15` | `E:15` |

### 1.2 Changements dans `DrawingCanvas.tsx`

Dans le bloc **per-edge labels** (section `{/* ── Per-edge labels ... ──*/}`):

**Supprimer** le calcul de :
- `hOffset`, `vOffset` (utilisés uniquement pour `dimVal`)
- `fallbackType`, `fallbackOffset`
- `dimVal`

**Modifier `mainLabel`** :
```typescript
// AVANT :
const mainLabel = `${dirIcon}${dimVal}${thickPart}`;

// APRÈS :
const mainLabel = `${dirIcon}${thickPart}`.trim();
```

**Modifier `showLabel`** :
```typescript
// AVANT :
const showLabel = !hasDistC && (screenLen > 65 || isHov);

// APRÈS :
const showLabel = (!!dirIcon || !!thickPart) && (screenLen > 65 || isHov);
```

> Note : `hasDistC` reste défini (utilisé par `textColor`) mais ne conditionne plus `showLabel`.

---

## 2. Flèches — correction du dépassement

### 2.1 Problème

Les `refX` actuels placent l'ancre au mauvais endroit : les tips des flèches dépassent les points de mesure (xA, xB) au lieu d'y atterrir exactement.

### 2.2 Fix dans `DrawingCanvas.tsx` (`<defs>`)

```tsx
{/* AVANT — flèche droite, markerEnd */}
<marker id="cad-arr-r" markerWidth="8" markerHeight="5"
  refX="0" refY="2.5" orient="auto">

{/* APRÈS */}
<marker id="cad-arr-r" markerWidth="8" markerHeight="5"
  refX="8" refY="2.5" orient="auto">
```

```tsx
{/* AVANT — flèche gauche, markerStart */}
<marker id="cad-arr-l" markerWidth="8" markerHeight="5"
  refX="8" refY="2.5" orient="auto">

{/* APRÈS */}
<marker id="cad-arr-l" markerWidth="8" markerHeight="5"
  refX="0" refY="2.5" orient="auto">
```

**Résultat :** les flèches pointent vers l'intérieur de la côte, tips exactement aux points xA et xB.

---

## 3. Côtes déplaçables

### 3.1 Modèle de données

Dans `src/types/project.ts`, ajouter un champ optionnel à `Constraint` :

```typescript
export interface Constraint {
  id: string;
  type: ConstraintType;
  pts: PointRef[];
  value?: number | { x: number; y: number };
  displayOffset?: number; // mm, distance depuis le point de référence dans la direction d'offset
                          // défaut implicite = DIM_OFFSET (500). Minimum recommandé = 100.
}
```

### 3.2 Store action

Dans `src/store/projectStore.ts`, ajouter en miroir de `updateConstraintValue` :

```typescript
// Interface (à côté de updateConstraintValue):
updateConstraintDisplayOffset: (id: string, offset: number) => void;

// Implémentation :
updateConstraintDisplayOffset: (id, offset) => {
  get().updateActive((p) => ({
    ...p,
    constraints: p.constraints.map((c) =>
      c.id === id ? { ...c, displayOffset: offset } : c
    ),
  }));
},
```

### 3.3 Interaction drag

**Zone grabable :** uniquement la `<line>` du trait de cote (pas le label, pas les lignes d'extension).

**Curseur :**
- H_DISTANCE : `cursor-ns-resize`
- V_DISTANCE : `cursor-ew-resize`
- LENGTH : `cursor-move`

**Mécanisme :** pointer capture sur l'élément `<line>` de la côte.

```typescript
// Handlers sur la <line> de cote :
onPointerDown={(e) => {
  e.stopPropagation();
  (e.currentTarget as SVGLineElement).setPointerCapture(e.pointerId);
  setDimDrag({
    id: c.id,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startOffset: c.displayOffset ?? DIM_OFFSET,
    axis: 'H', // ou 'V' ou 'L'
    nx: 0,     // composantes de la normale (pour LENGTH)
    ny: -1,
  });
}}
onPointerMove={(e) => {
  if (!dimDrag || dimDrag.id !== c.id) return;
  const dClient = (axis === 'H')
    ? dimDrag.startClientY - e.clientY   // drag up = offset augmente
    : (axis === 'V')
    ? e.clientX - dimDrag.startClientX   // drag right = offset augmente
    : (e.clientX - dimDrag.startClientX) * dimDrag.nx +
      (e.clientY - dimDrag.startClientY) * dimDrag.ny; // projection sur normale
  const newOffset = Math.max(100, dimDrag.startOffset + dClient / scale);
  setDimDrag(d => d ? { ...d, liveOffset: newOffset } : null);
}}
onPointerUp={() => {
  if (!dimDrag || dimDrag.id !== c.id) return;
  if (dimDrag.liveOffset !== undefined) {
    onDimOffsetChange?.(c.id, dimDrag.liveOffset);
  }
  setDimDrag(null);
}}
```

**State local DrawingCanvas :**
```typescript
const [dimDrag, setDimDrag] = useState<{
  id: string;
  startClientX: number;
  startClientY: number;
  startOffset: number;
  liveOffset?: number;
  axis: 'H' | 'V' | 'L';
  nx: number;
  ny: number;
} | null>(null);
```

**Offset de rendu :**
```typescript
// Pour chaque contrainte :
const dimOffset = (dimDrag?.id === c.id && dimDrag.liveOffset !== undefined)
  ? dimDrag.liveOffset
  : (c.displayOffset ?? DIM_OFFSET);

// H_DISTANCE :  dimY = topY - dimOffset
// V_DISTANCE :  dimX = rightX + dimOffset
// LENGTH :      ox = nx * dimOffset,  oy = ny * dimOffset
```

### 3.4 Prop et handler PlanEditor

**Nouveau prop DrawingCanvas :**
```typescript
onDimOffsetChange?: (constraintId: string, newOffset: number) => void;
```

**Handler PlanEditor :**
```typescript
const handleDimOffsetChange = useCallback((id: string, offset: number) => {
  pushHistory();
  updateConstraintDisplayOffset(id, offset);
}, [pushHistory, updateConstraintDisplayOffset]);
```

Passé à `<DrawingCanvas onDimOffsetChange={handleDimOffsetChange} ... />`.

---

## 4. Fichiers touchés

| Fichier | Action |
|---------|--------|
| `src/types/project.ts` | Ajouter `displayOffset?: number` à `Constraint` |
| `src/store/projectStore.ts` | Ajouter `updateConstraintDisplayOffset` |
| `src/components/plan/DrawingCanvas.tsx` | Badge, flèches, drag state, rendu `displayOffset`, prop `onDimOffsetChange` |
| `src/components/plan/PlanEditor.tsx` | `handleDimOffsetChange`, `updateConstraintDisplayOffset` depuis store, passer prop |

---

## 5. Cas limites

- `displayOffset < 100` : clampé à 100 (dim line reste visible au-dessus du mur)
- Drag en cours + zoom : `scale` est capturé à l'état au moment du pointerDown (évite les sauts)
- `displayOffset` sur un axe H = déplace uniquement le dimY, les lignes d'extension s'allongent automatiquement (elles vont de `topY - EXT_GAP` à `dimY + EXT_OVER`)
- Undo : `pushHistory()` avant `updateConstraintDisplayOffset` → drag annulable par Ctrl+Z
