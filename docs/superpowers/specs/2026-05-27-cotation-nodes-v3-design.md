# Cotation Nodes v3 — Design Spec

**Goal:** Trois améliorations du système de cotation : (1) snap aux nœuds uniquement (plus de projection sur milieu de segment), (2) affichage permanent des nœuds en mode DIMENSION avec dots de face au survol, (3) sélection du type H/V/L via 3 prévisualisations simultanées cliquables.

**Architecture:** Modifications ciblées dans `PlanEditor.tsx` (snap, état `dimTypeSelection`, handlers), `DrawingCanvas.tsx` (rendu nœuds permanents, rendu 3 prévisualisations), et `DrawingCanvas` props (nouveau prop `dimTypeSelection`). Aucun changement de types ni de store — `LENGTH` existe déjà.

**Tech Stack:** React 18, TypeScript, SVG, Zustand, Vitest

---

## 1. Snap aux nœuds uniquement

### 1.1 Problème actuel

`findNearestFaceSnap` dans `PlanEditor.tsx` projette le curseur sur l'arête (paramètre `t ∈ [0,1]`) et stocke `vertexIdx = i` (index de départ du segment). Si le curseur est au milieu du segment (`t = 0.5`), la position affichée ne correspond pas au vertex `room.points[i]` → la contrainte créée référence le mauvais point géométrique.

### 1.2 Remplacement par `findNearestVertexSnap`

Remplacer entièrement `findNearestFaceSnap` par une nouvelle fonction qui itère sur les **sommets** des polygones (pas les arêtes) :

```typescript
const findNearestVertexSnap = useCallback((cursor: Point): FaceSnapPoint | null => {
  const threshold = 80 / scale;
  let best: { snap: FaceSnapPoint; dist: number } | null = null;

  const tryVertex = (
    vtx: Point,
    roomId: string,
    vertexIdx: number,
    prevPt: Point,  // vertex précédent dans le polygone
    nextPt: Point,  // vertex suivant dans le polygone
    halfThick: number,
  ) => {
    const dist = distance(cursor, vtx);
    if (dist > threshold) return;

    // Normal de l'arête la plus alignée avec la direction curseur→vertex
    const wallNormal = bestEdgeNormal(cursor, vtx, prevPt, nextPt);

    const candidates: Array<{ face: 'INSIDE' | 'AXIS' | 'OUTSIDE'; pos: Point }> = [
      { face: 'INSIDE',  pos: { x: vtx.x + wallNormal.x * halfThick, y: vtx.y + wallNormal.y * halfThick } },
      { face: 'AXIS',    pos: vtx },
      { face: 'OUTSIDE', pos: { x: vtx.x - wallNormal.x * halfThick, y: vtx.y - wallNormal.y * halfThick } },
    ];

    // Face la plus proche du curseur
    let bestFace: FaceSnapPoint | null = null;
    let bestFaceDist = Infinity;
    for (const { face, pos } of candidates) {
      const d = distance(cursor, pos);
      if (d < bestFaceDist) {
        bestFaceDist = d;
        bestFace = { roomId, vertexIdx, face, worldPos: pos, wallNormal };
      }
    }
    if (bestFace && (!best || dist < best.dist)) {
      best = { snap: bestFace, dist };
    }
  };

  for (const room of rooms) {
    const pts = room.points;
    const n = pts.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const vtx  = pts[i]!;
      const prev = pts[(i - 1 + n) % n]!;
      const next = pts[(i + 1) % n]!;
      // Épaisseur = max des deux arêtes adjacentes / 2
      const halfPrev = (room.edgeThicknesses?.[(i - 1 + n) % n] ?? wallThickness) / 2;
      const halfNext = (room.edgeThicknesses?.[i] ?? wallThickness) / 2;
      const halfThick = Math.max(halfPrev, halfNext);
      tryVertex(vtx, room.id, i, prev, next, halfThick);
    }
  }

  const result = best as { snap: FaceSnapPoint; dist: number } | null;
  return result ? result.snap : null;
}, [rooms, scale, wallThickness]);
```

**Helper `bestEdgeNormal`** (module-scope ou closure) : retourne la normale unitaire de l'arête (prev→vtx ou vtx→next) la plus perpendiculaire à la direction curseur→vtx :

```typescript
function bestEdgeNormal(cursor: Point, vtx: Point, prev: Point, next: Point): Point {
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
```

**Tous les appels** à `findNearestFaceSnap` dans `PlanEditor.tsx` sont remplacés par `findNearestVertexSnap`.

---

## 2. Affichage des nœuds en mode DIMENSION

### 2.1 Nœuds permanents (petits carrés)

Dans `DrawingCanvas.tsx`, dans le bloc `{tool === 'DIMENSION' && ...}`, ajouter **avant** le rendu des snap dots de survol :

```tsx
{/* ── Vertex markers permanents en mode DIMENSION ── */}
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

### 2.2 Dots de face au survol (inchangé dans la logique, mais recalculé depuis le vertex)

Le rendu des 3 dots INSIDE/AXIS/OUTSIDE dans `DrawingCanvas.tsx` reste identique à l'existant. Puisque `faceSnapHover.worldPos` est maintenant calculé depuis le vertex (et non un point projeté), les dots sont correctement positionnés au vertex.

---

## 3. Sélection du type H / V / L (3 prévisualisations)

### 3.1 Nouveau state dans PlanEditor

```typescript
const [dimTypeSelection, setDimTypeSelection] = useState<{
  from: { ref: PointRef; worldPos: Point };
  to:   { ref: PointRef; worldPos: Point };
} | null>(null);
```

### 3.2 Modification du flow DIMENSION (handleCanvasClick)

**Avant :** le 2ème clic appelait directement `openDimensionPopup`.

**Après :**

```typescript
if (tool === 'DIMENSION') {
  if (!dimensionSource) {
    if (faceSnapHover) {
      setDimensionSource({ ref: { roomId: faceSnapHover.roomId, vertexIdx: faceSnapHover.vertexIdx, face: faceSnapHover.face }, worldPos: faceSnapHover.worldPos });
    }
    return;
  }
  // 2ème clic
  if (faceSnapHover) {
    setDimTypeSelection({
      from: dimensionSource,
      to: { ref: { roomId: faceSnapHover.roomId, vertexIdx: faceSnapHover.vertexIdx, face: faceSnapHover.face }, worldPos: faceSnapHover.worldPos },
    });
    setDimensionSource(null);  // efface le point orange source
  } else {
    setDimensionSource(null);  // clic dans le vide = annule
  }
  return;
}
```

**Clic en dehors** (canvas click sans snap) quand `dimTypeSelection` est actif → `setDimTypeSelection(null)` (retour à l'étape 1).

### 3.3 Handler de sélection de type

```typescript
const handleDimTypeSelect = useCallback((type: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH') => {
  if (!dimTypeSelection) return;
  openDimensionPopup(
    dimTypeSelection.from.ref,
    dimTypeSelection.to.ref,
    dimTypeSelection.from.worldPos,
    dimTypeSelection.to.worldPos,
    type,   // ← nouveau paramètre forcé
  );
  setDimTypeSelection(null);
}, [dimTypeSelection, openDimensionPopup]);
```

**Modification de `openDimensionPopup`** : ajouter un paramètre optionnel `forcedType?: DimConstraintType`. Quand fourni, il court-circuite la détection auto H vs V :

```typescript
const openDimensionPopup = useCallback((
  fromRef, toRef, fromWorld, toWorld,
  forcedType?: DimConstraintType,
) => {
  const dx = Math.abs(toWorld.x - fromWorld.x);
  const dy = Math.abs(toWorld.y - fromWorld.y);
  const dimType = forcedType ?? (dx >= dy ? 'H_DISTANCE' : 'V_DISTANCE');
  // ... reste identique
}, [...]);
```

### 3.4 Nouveau prop DrawingCanvas

```typescript
// Dans DrawingCanvasProps :
dimTypeSelection?: {
  from: { ref: PointRef; worldPos: Point };
  to:   { ref: PointRef; worldPos: Point };
} | null;
onDimTypeSelect?: (type: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH') => void;
```

Passés depuis PlanEditor :
```tsx
<DrawingCanvas
  dimTypeSelection={dimTypeSelection}
  onDimTypeSelect={handleDimTypeSelect}
  ...
/>
```

### 3.5 Rendu des 3 prévisualisations dans DrawingCanvas

Quand `dimTypeSelection` est non-null, rendre les 3 côtes simultanément en `opacity={0.35}`, chacune cliquable :

```tsx
{dimTypeSelection && (() => {
  const { from, to } = dimTypeSelection;
  const fA = from.worldPos, fB = to.worldPos;

  // H preview : même Y = min(fA.y, fB.y) - DIM_OFFSET
  // V preview : même X = max(fA.x, fB.x) + DIM_OFFSET
  // L preview : parallèle, offset dans la normale du segment

  const previews: Array<{ type: DimConstraintType; x1: number; y1: number; x2: number; y2: number; color: string; labelX: number; labelY: number; label: string }> = [
    // H
    { type: 'H_DISTANCE', ... color: '#22c55e', label: 'H' },
    // V
    { type: 'V_DISTANCE', ... color: '#3b82f6', label: 'V' },
    // L
    { type: 'LENGTH', ... color: '#f97316', label: 'L' },
  ];

  return (
    <g>
      {previews.map(({ type, x1, y1, x2, y2, color, labelX, labelY, label }) => (
        <g key={type} opacity={0.35} className="cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onDimTypeSelect?.(type); }}
          onPointerEnter={(e) => (e.currentTarget as SVGGElement).style.opacity = '0.85'}
          onPointerLeave={(e) => (e.currentTarget as SVGGElement).style.opacity = '0.35'}
        >
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color} strokeWidth={sw}
            markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)" />
          <text x={labelX} y={labelY}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={fontSize} fontWeight="700" fill={color}
            className="select-none pointer-events-none"
            style={{ fontFamily: 'system-ui' }}>
            {label}
          </text>
        </g>
      ))}
    </g>
  );
})()}
```

**Survol** : `onPointerEnter` monte l'opacité à `0.85`, `onPointerLeave` la remet à `0.35`.

**Géométrie des 3 previews** (basée sur les worldPos) :
- **H** : `x1=fA.x, x2=fB.x, y1=y2=Math.min(fA.y,fB.y) - DIM_OFFSET`, extension lines verticales
- **V** : `y1=fA.y, y2=fB.y, x1=x2=Math.max(fA.x,fB.x) + DIM_OFFSET`, extension lines horizontales
- **L** : `dx=fB.x-fA.x, dy=fB.y-fA.y, nx=-dy/len, ny=dx/len`, `x1=fA.x+nx*DIM_OFFSET, y1=fA.y+ny*DIM_OFFSET`, `x2=fB.x+nx*DIM_OFFSET, y2=fB.y+ny*DIM_OFFSET`

---

## 4. Fichiers touchés

| Fichier | Action |
|---------|--------|
| `src/components/plan/PlanEditor.tsx` | Remplacer `findNearestFaceSnap` par `findNearestVertexSnap`, ajouter `bestEdgeNormal`, ajouter state `dimTypeSelection`, modifier flow 2ème clic, ajouter `handleDimTypeSelect`, modifier `openDimensionPopup` (param `forcedType`), passer nouveaux props |
| `src/components/plan/DrawingCanvas.tsx` | Ajouter props `dimTypeSelection` + `onDimTypeSelect`, importer `DimConstraintType` depuis `@/types/project`, ajouter rendu vertex markers permanents, ajouter rendu 3 prévisualisations |
| `src/components/plan/PlanEditor.dimension.test.ts` | Tests pour `findNearestVertexSnap` (snap au vertex, pas au milieu), `handleDimTypeSelect`, flow 2ème clic → `dimTypeSelection` |

---

## 5. Cas limites

- **Vertex partagé (nœud commun de deux rooms)** : snappé via les deux rooms ; le premier `best` avec la distance minimale gagne — comportement correct.
- **dimTypeSelection actif + outil changé** : le bloc de reset existant dans PlanEditor (qui clear `dimensionSource`, `faceSnapHover`, etc. lors du changement d'outil) doit être complété avec `setDimTypeSelection(null)` — nouveau state à ajouter explicitement au reset.
- **Valeur LENGTH entre deux points H-alignés** : `LENGTH = sqrt(dx²+dy²)` = `dx` car `dy=0` → correct.
- **Preview H quand fA.y ≈ fB.y** : côte quasiment nulle visuellement — pas un bug, c'est le vrai H entre ces deux points.
- **DIM_OFFSET pour les previews** : utiliser `DIM_OFFSET = 500` (constante module-scope déjà présente dans DrawingCanvas).
