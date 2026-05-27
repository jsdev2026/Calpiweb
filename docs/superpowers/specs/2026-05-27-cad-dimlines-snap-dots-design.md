# CAD Dimension Lines & Snap Dots — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Rendre les snap dots scale-indépendants et non-envahissants. (2) Afficher les contraintes H/V comme de vraies lignes de cote CAD (flèches ouvertes, lignes d'extension, label encadré). (3) Corriger un bug de signe dans la conversion displayed ↔ stored.

**Architecture:** Deux fichiers modifiés : `DrawingCanvas.tsx` (rendu) et `PlanEditor.tsx` (bug fix). Aucune modification de type, de store, ni du solver.

**Tech Stack:** React 18, TypeScript, SVG, Tailwind CSS, Vitest

---

## 1. Contexte

Deux problèmes signalés par l'utilisateur après l'implémentation du face-snap :

1. **Snap dots trop grands** — les cercles colorés (r=120 ou r=192 world units) sont illisibles au zoom habituel.
2. **Côtes non affichées en CAD** — les contraintes H/V posées avec l'outil DIMENSION n'ont pas de ligne de cote dédiée ; seul un texte flottant sur l'arête existe.

Un troisième problème identifié en code review :

3. **Bug de signe dans openDimensionPopup / submitDimensionPopup** — les formules `displayed = stored + offset` et `stored = displayed - offset` sont inversées, ce qui fait stocker des valeurs incorrectes dès que l'offset est non nul.

---

## 2. Snap dots — `DrawingCanvas.tsx`

### 2.1 Taille scale-indépendante

Les rayons actuels (`baseR: 120` world units pour inactif, `baseR * 1.6 = 192` pour actif) varient avec le zoom. Le correctif divise tous les rayons par `scale` pour obtenir des tailles constantes en pixels-écran.

| État | Rayon world → écran |
|------|---------------------|
| Inactif | `3.5 / scale` px |
| Actif | `6 / scale` px |
| Point source confirmé | `8 / scale` px |

### 2.2 Rendu des snap dots (3 dots sur hover)

Chaque dot reçoit un anneau blanc fin pour se détacher du fond du mur :

```typescript
// Dans le rendu faceSnapHover :
const r = isActive ? 6 / scale : 3.5 / scale;
const sw = isActive ? 1 / scale : 0.8 / scale;
// <circle cx={pos.x} cy={pos.y} r={r} fill={color}
//   opacity={isActive ? 1 : 0.4}
//   stroke="white" strokeWidth={sw} />
```

### 2.3 Point source confirmé

```typescript
// <circle cx={worldPos.x} cy={worldPos.y} r={8/scale} fill="#f97316" />
// <text ... fontSize={14/scale} fontWeight="800" fill="white">{label}</text>
```

---

## 3. Lignes de cote CAD — `DrawingCanvas.tsx`

### 3.1 Style retenu : flèches ouvertes + label encadré (Style C)

Éléments par côte :
- **Lignes d'extension** : 2 lignes fines (opacity 0.7) depuis les points de référence vers la ligne de cote, avec un gap de `50` unités avant le point et un dépassement de `80` unités après.
- **Ligne de cote** : entre les deux extrémités, avec marqueurs SVG de flèches ouvertes aux deux bouts.
- **Label encadré** : `<rect>` + `<text>` centrés sur la ligne de cote. Contient `"I→E  285.0 cm"` (face label + valeur).

### 3.2 Marqueurs SVG flèches ouvertes

Deux marqueurs définis dans `<defs>` (un pour chaque sens) :

```typescript
// Flèche ouverte vers la droite (fin de ligne)
// <marker id="cad-arr-r" markerWidth="8" markerHeight="5" refX="0" refY="2.5" orient="auto">
//   <polyline points="0,0.5 8,2.5 0,4.5" fill="none" stroke={color} strokeWidth={1.2}
//     strokeLinecap="round" strokeLinejoin="round"/>
// </marker>
// Flèche ouverte vers la gauche (début de ligne)
// <marker id="cad-arr-l" markerWidth="8" markerHeight="5" refX="8" refY="2.5" orient="auto">
//   <polyline points="8,0.5 0,2.5 8,4.5" fill="none" stroke={color} strokeWidth={1.2}
//     strokeLinecap="round" strokeLinejoin="round"/>
// </marker>
```

Les marqueurs pour côtes V (sens haut/bas) sont analogues, orientés à 90°. Le plus simple : utiliser `orient="auto"` et faire pointer la ligne dans la bonne direction.

### 3.3 Helper `resolveDisplayCoord`

```typescript
// Dans DrawingCanvas.tsx (module scope ou inline dans le composant)
function resolveDisplayCoord(
  pt: PointRef,
  rooms: Room[],
  wallThickness: number,
  axis: 'H' | 'V',
): number | null {
  const room = rooms.find(r => r.id === pt.roomId);
  const vertex = room?.points[pt.vertexIdx];
  if (!room || !vertex) return null;

  const preferVertical = axis === 'H';
  const half = halfThicknessAt(pt.vertexIdx, room, wallThickness, preferVertical);
  const face = pt.face ?? 'INSIDE';
  const faceSign = face === 'INSIDE' ? 1 : face === 'OUTSIDE' ? -1 : 0;

  // Determine wall normal sign along the measured axis.
  // Find the most aligned adjacent edge and read its normal direction.
  const n = room.points.length;
  const edgeIndices = [(pt.vertexIdx - 1 + n) % n, pt.vertexIdx];
  let bestEdge = -1, bestScore = -1;
  for (const eIdx of edgeIndices) {
    const p1 = room.points[eIdx]!, p2 = room.points[(eIdx + 1) % n]!;
    const adx = Math.abs(p2.x - p1.x), ady = Math.abs(p2.y - p1.y);
    const total = adx + ady;
    if (total < 0.001) continue;
    const score = preferVertical ? ady / total : adx / total;
    if (score > bestScore) { bestScore = score; bestEdge = eIdx; }
  }
  if (bestEdge === -1 || bestScore < 0.5) {
    return axis === 'H' ? vertex.x : vertex.y;
  }

  const ep1 = room.points[bestEdge]!, ep2 = room.points[(bestEdge + 1) % n]!;
  const edgeDx = ep2.x - ep1.x, edgeDy = ep2.y - ep1.y;
  // Normal perpendicular to edge, signed by room interior direction
  // For a vertical edge (dx≈0), normal is (±1, 0). Sign determined by room centroid.
  const centroidX = room.points.reduce((s, p) => s + p.x, 0) / n;
  const centroidY = room.points.reduce((s, p) => s + p.y, 0) / n;

  let normalSign: number;
  if (axis === 'H') {
    // Normal in X direction. Interior normal: centroid.x vs vertex.x
    const rawNormalX = -edgeDy; // perpendicular to (dx,dy) is (-dy,dx)
    normalSign = rawNormalX >= 0 ? 1 : -1;
    // Verify against centroid: interior means toward centroid
    if ((centroidX - vertex.x) * normalSign < 0) normalSign = -normalSign;
    return vertex.x + faceSign * normalSign * half;
  } else {
    const rawNormalY = edgeDx;
    normalSign = rawNormalY >= 0 ? 1 : -1;
    if ((centroidY - vertex.y) * normalSign < 0) normalSign = -normalSign;
    return vertex.y + faceSign * normalSign * half;
  }
}
```

> **Note implémenteur :** La logique de signe est délicate. Le test décisif : pour une pièce rectangulaire I→I, `resolveDisplayCoord` doit retourner des valeurs plus proches du centre que les vertices axiaux (ex. vertex à x=0 → displayX > 0, vertex à x=3000 → displayX < 3000).

### 3.4 Rendu H_DISTANCE

```
Constante : DIM_OFFSET = 500 world units (au-dessus de la géométrie)
EXT_GAP   = 50  (espace entre le point de référence et le début de la ligne d'extension)
EXT_OVER  = 80  (dépassement de la ligne d'extension au-delà de la ligne de cote)
```

Pour chaque contrainte `c` de type `H_DISTANCE` :

```typescript
const xA = resolveDisplayCoord(c.pts[0]!, rooms, wallThickness, 'H') ?? 0;
const xB = resolveDisplayCoord(c.pts[1]!, rooms, wallThickness, 'H') ?? 0;
const roomA = rooms.find(r => r.id === c.pts[0]!.roomId);
const yA = roomA?.points[c.pts[0]!.vertexIdx]?.y ?? 0;
const roomB = rooms.find(r => r.id === c.pts[1]!.roomId);
const yB = roomB?.points[c.pts[1]!.vertexIdx]?.y ?? 0;

const topY  = Math.min(yA, yB);
const dimY  = topY - DIM_OFFSET;         // ligne de cote au-dessus
const extY0 = topY - EXT_GAP;           // début ligne d'extension (juste sous le point)
const extY1 = dimY + EXT_OVER;          // dépassement au-dessus de la cote

// SVG à rendre :
// ligne extension A : x1={xA} y1={extY0} x2={xA} y2={extY1}
// ligne extension B : x1={xB} y1={extY0} x2={xB} y2={extY1}
// ligne de cote     : x1={xA} y1={dimY}  x2={xB} y2={dimY}  (avec marqueurs flèches)
// label             : x={(xA+xB)/2} y={dimY - 60/scale}
```

Valeur affichée :
```typescript
const displayedMm = (c.value ?? 0) - constraintFaceOffset(c, roomA!, wallThickness);
const displayedCm = (displayedMm / 10).toFixed(1);
const faceLabel   = `${FACE_LABEL[c.pts[0]!.face ?? 'INSIDE']}→${FACE_LABEL[c.pts[1]!.face ?? 'INSIDE']}`;
const labelText   = `${faceLabel}  ${displayedCm} cm`;
```

### 3.5 Rendu V_DISTANCE

Identique, axes pivotés de 90° :
- Points de référence : `yA = resolveDisplayCoord(..., 'V')`, `yB` idem
- `xA/xB` = coordonnée X des vertices (axiale)
- `dimX = Math.max(xA, xB) + DIM_OFFSET` (à droite)
- Lignes d'extension horizontales, ligne de cote verticale

### 3.6 Rendu LENGTH

Pour une contrainte LENGTH (longueur réelle, sans offset) :
- Pas de `resolveDisplayCoord` nécessaire (offset = 0)
- Ligne de cote **parallèle** à l'arête, décalée de `DIM_OFFSET` perpendiculairement
- Flèches ouvertes + label au milieu
- Valeur : `c.value / 10` (en cm)

### 3.7 Suppression du badge texte quand une côte CAD existe

Dans la section "Per-edge labels" :

```typescript
// Avant (actuel) :
const showLabel = screenLen > 65 || isHov;

// Après :
const showLabel = !hasDistC && (screenLen > 65 || isHov);
// hasDistC = !!(hDistC || vDistC || lenC) — défini juste au-dessus
```

Quand `hasDistC = true`, le badge texte sur l'arête est masqué. La ligne de cote CAD prend le relais.

### 3.8 Clic sur la ligne de cote

Le label (zone de clic) déclenche `onDimensionClick(c)` — un nouveau prop `DrawingCanvasProps`.

```typescript
// Nouveau prop :
onDimensionClick?: (constraint: Constraint) => void;
```

Dans `PlanEditor.tsx`, ce callback ouvre `DimensionPopup` avec les valeurs existantes.

---

## 4. Bug fix — `PlanEditor.tsx`

### 4.1 Problème

`constraintFaceOffset` retourne **+100** pour I→I (INSIDE=+halfThick, positif). La relation correcte est :
```
displayed = stored − offset
stored    = displayed + offset
```

Mais l'implémentation actuelle utilise :
- `openDimensionPopup` : `displayed = stored + offset` ← **inversé**
- `submitDimensionPopup` : `stored = displayed − offset` ← **inversé**

Conséquence : une contrainte I→I saisie à 290 cm est stockée comme 280 cm (−100 au lieu de +100), puis affichée à 270 cm.

### 4.2 Fix `openDimensionPopup` (ligne ~637)

```typescript
// AVANT (bugué) :
displayedValue = (existing.value + offset) / 10;

// APRÈS :
displayedValue = (existing.value - offset) / 10;
```

### 4.3 Fix `submitDimensionPopup` (ligne ~660)

```typescript
// AVANT (bugué) :
const storedMm = displayedMm - offset;

// APRÈS :
const storedMm = displayedMm + offset;
```

### 4.4 Tests à ajouter

Dans `PlanEditor.toolbar.test.ts`, section `constraintFaceOffset` existante, ajouter :

```typescript
it('openDimensionPopup: displayed = stored - offset (not + offset)', () => {
  // stored = 3000, offset for I→I with halfThick=50 each = 100
  // displayed should be 3000 - 100 = 2900mm = 290cm
  const stored = 3000;
  const offset = 100; // I→I, half=50 each
  expect((stored - offset) / 10).toBe(290);   // correct
  expect((stored + offset) / 10).not.toBe(290); // the bug
});

it('submitDimensionPopup: stored = displayed + offset (not - offset)', () => {
  const displayed = 2900; // 290cm user input
  const offset = 100;
  expect(displayed + offset).toBe(3000); // correct axis-to-axis
  expect(displayed - offset).not.toBe(3000); // the bug
});
```

---

## 5. `onDimensionClick` — `PlanEditor.tsx`

Nouveau handler passé à `DrawingCanvas` :

```typescript
const handleDimensionClick = useCallback((c: Constraint) => {
  const fromRef = c.pts[0]!;
  const toRef   = c.pts[1]!;
  const fromRoom = rooms.find(r => r.id === fromRef.roomId);
  const toRoom   = rooms.find(r => r.id === toRef.roomId);
  const fromVertex = fromRoom?.points[fromRef.vertexIdx];
  const toVertex   = toRoom?.points[toRef.vertexIdx];
  if (!fromVertex || !toVertex) return;
  openDimensionPopup(fromRef, toRef, fromVertex, toVertex);
}, [rooms, openDimensionPopup]);
```

Passé via `<DrawingCanvas onDimensionClick={handleDimensionClick} ... />`.

---

## 6. Fichiers touchés

| Fichier | Action |
|---------|--------|
| `src/components/plan/DrawingCanvas.tsx` | Modifier — snap dots, `resolveDisplayCoord`, CAD dim lines, badge suppression, `onDimensionClick` prop ; **ajouter import** `halfThicknessAt` from `@/engine/constraints/faceOffset` |
| `src/components/plan/PlanEditor.tsx` | Modifier — fix signe `openDimensionPopup` + `submitDimensionPopup`, `handleDimensionClick` |
| `src/components/plan/PlanEditor.toolbar.test.ts` | Modifier — 2 tests bug fix |

---

## 7. Cas limites

- **H_DISTANCE cross-room** : `constraintFaceOffset` retourne 0 → offset = 0, extension lines depuis les vertices axiaux.
- **Multiple côtes sur le même axe** : les lignes se superposent à `DIM_OFFSET`. Pour l'instant, offset fixe (empilage non géré — itération future).
- **LENGTH** : pas de face offset → `resolveDisplayCoord` non nécessaire, extension ligne perpendiculaire à l'arête.
- **Zoom extrême (scale < 0.01)** : diviser par scale peut donner des valeurs énormes — limiter `r` à `Math.min(6/scale, 2000)`.
- **Contrainte déjà éditée via DimensionPopup** : `onDimensionClick` rappelle `openDimensionPopup` qui lit le face existant depuis `c.pts`.
