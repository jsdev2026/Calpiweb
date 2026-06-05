# CAD Dimension Lines & Snap Dots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Rendre les snap dots scale-indépendants. (2) Afficher les contraintes H/V/L comme de vraies lignes de cote CAD (flèches ouvertes, lignes d'extension, label encadré). (3) Corriger le bug de signe dans la conversion displayed ↔ stored. (4) Câbler `onDimensionClick` pour rouvrir le DimensionPopup depuis une côte CAD.

**Architecture:** Deux fichiers principaux modifiés : `DrawingCanvas.tsx` (rendu SVG) et `PlanEditor.tsx` (bug fix + callback). Tests dans `PlanEditor.toolbar.test.ts`. Aucune modification de types, de store ni du solver.

**Tech Stack:** React 18, TypeScript, SVG, Vitest

---

## File Map

| Fichier | Action |
|---------|--------|
| `src/components/plan/DrawingCanvas.tsx` | Modifier — import `halfThicknessAt`, hoist `FACE_LABEL`, snap dots scale-indépendants, `resolveDisplayCoord`, marqueurs SVG, rendu côtes CAD, badge suppression, prop `onDimensionClick` |
| `src/components/plan/PlanEditor.tsx` | Modifier — bug fix signe `openDimensionPopup` + `submitDimensionPopup`, `handleDimensionClick`, passer prop à `DrawingCanvas` |
| `src/components/plan/PlanEditor.toolbar.test.ts` | Modifier — 2 tests pour le bug fix de signe |

---

## Task 1 — Bug fix signe openDimensionPopup / submitDimensionPopup

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx:637` (openDimensionPopup)
- Modify: `src/components/plan/PlanEditor.tsx:660` (submitDimensionPopup)
- Test: `src/components/plan/PlanEditor.toolbar.test.ts` (section `constraintFaceOffset`, après la ligne 338)

**Context:** `constraintFaceOffset` retourne `+20` pour I→I (halfThick=10 chaque côté). La relation correcte est `displayed = stored − offset` et `stored = displayed + offset`. L'implémentation actuelle a les signes inversés.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ouvrir `src/components/plan/PlanEditor.toolbar.test.ts` et ajouter après la fermeture du bloc `constraintFaceOffset` (après la ligne `});` à la ligne 338), un nouveau `describe` :

```typescript
// ── Conversion displayed ↔ stored ────────────────────────────────────────────

describe('Conversion displayed ↔ stored (bug fix signe)', () => {
  it('openDimensionPopup: displayed = stored - offset (pas + offset)', () => {
    // stored = 3000mm, offset I→I avec halfThick=10 chaque = 20mm
    // displayed correct = 3000 - 20 = 2980mm = 298.0cm
    const stored = 3000;
    const offset = 20;
    expect((stored - offset) / 10).toBe(298);    // formule correcte
    expect((stored + offset) / 10).not.toBe(298); // le bug
  });

  it('submitDimensionPopup: stored = displayed + offset (pas - offset)', () => {
    // L'utilisateur saisit 298cm = 2980mm, offset = 20mm
    // stored correct = 2980 + 20 = 3000mm
    const displayedMm = 2980;
    const offset = 20;
    expect(displayedMm + offset).toBe(3000);    // formule correcte
    expect(displayedMm - offset).not.toBe(3000); // le bug
  });
});
```

- [ ] **Step 2 : Vérifier que les tests passent (ils vérifient la logique arithmétique)**

```bash
cd /workspaces/Calpiweb
npx vitest run src/components/plan/PlanEditor.toolbar.test.ts --reporter=verbose 2>&1 | tail -20
```

Ces tests vérifient des expressions arithmétiques pures, ils doivent passer immédiatement.

- [ ] **Step 3 : Corriger le bug dans `openDimensionPopup` (ligne 637)**

Dans `src/components/plan/PlanEditor.tsx`, trouver :
```typescript
      displayedValue = (existing.value + offset) / 10;
```
Remplacer par :
```typescript
      displayedValue = (existing.value - offset) / 10;
```

- [ ] **Step 4 : Corriger le bug dans `submitDimensionPopup` (ligne 660)**

Dans `src/components/plan/PlanEditor.tsx`, trouver :
```typescript
    const storedMm = displayedMm - offset;
```
Remplacer par :
```typescript
    const storedMm = displayedMm + offset;
```

- [ ] **Step 5 : Lancer tous les tests pour vérifier aucune régression**

```bash
cd /workspaces/Calpiweb
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected : tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "fix(plan): corriger signe displayed↔stored dans openDimensionPopup/submitDimensionPopup"
```

---

## Task 2 — Snap dots scale-indépendants

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:819-863` (snap dots + confirmed source dot)

**Context:** Les rayons actuels sont en world units (120, 100, 180) et grossissent avec le zoom. Le fix divise par `scale` pour avoir des pixels-écran constants. Ajouter un anneau blanc pour la lisibilité. Le `FACE_LABEL` est actuellement défini INLINE à la ligne 847 (dans le bloc confirmed source) — il faut le hisser au scope module pour pouvoir le réutiliser dans Task 3.

- [ ] **Step 1 : Hisser `FACE_LABEL` au scope module**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver le bloc du confirmed source dot (autour des lignes 845-863) qui contient :
```typescript
        {tool === 'DIMENSION' && dimensionSource && (() => {
          const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' } as const;
```

Extraire la constante vers le **scope module** (avant la définition de `DrawingCanvas`, après les fonctions helper existantes, vers la ligne 93). Ajouter :
```typescript
const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' } as const;
```

Puis supprimer la ligne `const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' } as const;` qui était inline dans le composant.

- [ ] **Step 2 : Remplacer le rendu des snap dots (lignes ~819-843)**

Trouver le bloc :
```typescript
          const dots: Array<{ pos: Point; dotFace: 'INSIDE' | 'AXIS' | 'OUTSIDE'; color: string; baseR: number }> = [
            { pos: outsidePos, dotFace: 'OUTSIDE', color: '#3b82f6', baseR: 120 },
            { pos: axisPos,    dotFace: 'AXIS',    color: '#a855f7', baseR: 100 },
            { pos: insidePos,  dotFace: 'INSIDE',  color: '#22c55e', baseR: 120 },
          ];

          return (
            <g className="pointer-events-none">
              {dots.map(({ pos, dotFace, color, baseR }) => {
                const isActive = dotFace === face;
                const r = isActive ? baseR * 1.6 : baseR;
                const opacity = isActive ? 1 : 0.5;
                return (
                  <circle
                    key={dotFace}
                    cx={pos.x} cy={pos.y}
                    r={r}
                    fill={color}
                    opacity={opacity}
                  />
                );
              })}
            </g>
          );
```

Remplacer par :
```typescript
          const dots: Array<{ pos: Point; dotFace: 'INSIDE' | 'AXIS' | 'OUTSIDE'; color: string }> = [
            { pos: outsidePos, dotFace: 'OUTSIDE', color: '#3b82f6' },
            { pos: axisPos,    dotFace: 'AXIS',    color: '#a855f7' },
            { pos: insidePos,  dotFace: 'INSIDE',  color: '#22c55e' },
          ];

          return (
            <g className="pointer-events-none">
              {dots.map(({ pos, dotFace, color }) => {
                const isActive = dotFace === face;
                const r  = Math.min(isActive ? 6 / scale : 3.5 / scale, 2000);
                const sw = isActive ? 1 / scale : 0.8 / scale;
                return (
                  <circle
                    key={dotFace}
                    cx={pos.x} cy={pos.y}
                    r={r}
                    fill={color}
                    opacity={isActive ? 1 : 0.4}
                    stroke="white"
                    strokeWidth={sw}
                  />
                );
              })}
            </g>
          );
```

- [ ] **Step 3 : Remplacer le confirmed source dot (lignes ~851-862)**

Trouver :
```typescript
              <circle cx={worldPos.x} cy={worldPos.y} r={180} fill="#f97316" />
              <text
                x={worldPos.x} y={worldPos.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={160} fontWeight="800" fill="white"
                style={{ fontFamily: 'system-ui' }}
              >
```

Remplacer par :
```typescript
              <circle cx={worldPos.x} cy={worldPos.y} r={Math.min(8 / scale, 2000)} fill="#f97316" />
              <text
                x={worldPos.x} y={worldPos.y}
                textAnchor="middle" dominantBaseline="central"
                fontSize={14 / scale} fontWeight="800" fill="white"
                style={{ fontFamily: 'system-ui' }}
              >
```

- [ ] **Step 4 : Vérifier TypeScript**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -20
```

Expected : aucune erreur dans DrawingCanvas.tsx.

- [ ] **Step 5 : Lancer les tests**

```bash
cd /workspaces/Calpiweb
npx vitest run --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 6 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/DrawingCanvas.tsx
git commit -m "fix(canvas): snap dots scale-indépendants (r=6/scale actif, r=3.5/scale inactif)"
```

---

## Task 3 — Lignes de cote CAD (H_DISTANCE / V_DISTANCE / LENGTH)

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:11` (ajouter import `halfThicknessAt`)
- Modify: `src/components/plan/DrawingCanvas.tsx` (après les helpers existants ~ligne 93, avant `DrawingCanvas`) — ajouter `resolveDisplayCoord`
- Modify: `src/components/plan/DrawingCanvas.tsx` (dans le JSX retourné) — ajouter `<defs>` SVG + rendu des côtes
- Modify: `src/components/plan/DrawingCanvas.tsx:464` — supprimer badge si côte CAD existe

**Context :**
- `DIM_OFFSET = 500` world units (offset de la ligne de cote par rapport à la géométrie)
- `EXT_GAP = 50` (espace entre le point de référence et le début de la ligne d'extension)
- `EXT_OVER = 80` (dépassement de la ligne d'extension au-delà de la ligne de cote)
- Côte H : ligne de cote au-dessus (dimY = topY − DIM_OFFSET), lignes d'extension verticales
- Côte V : ligne de cote à droite (dimX = rightX + DIM_OFFSET), lignes d'extension horizontales
- Flèches ouvertes via marqueurs SVG dans `<defs>`
- Label encadré : `<rect>` + `<text>` centrés sur la ligne de cote

- [ ] **Step 1 : Ajouter l'import `halfThicknessAt`**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver la ligne :
```typescript
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
```
Remplacer par :
```typescript
import { constraintFaceOffset, halfThicknessAt } from '@/engine/constraints/faceOffset';
```

- [ ] **Step 2 : Ajouter les constantes CAD et le helper `resolveDisplayCoord`**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver la ligne `const FACE_LABEL = ...` (déplacée en scope module à la Task 2) et ajouter juste APRÈS cette ligne :

```typescript
// ── CAD dimension line constants ───────────────────────────────────────────
const DIM_OFFSET = 500; // world units — offset de la ligne de cote
const EXT_GAP   = 50;  // espace entre pt de référence et début ligne d'extension
const EXT_OVER  = 80;  // dépassement de la ligne d'extension au-delà de la cote

/**
 * Calcule la coordonnée affichée d'un PointRef le long de l'axe mesuré,
 * en tenant compte du décalage de face (INSIDE / AXIS / OUTSIDE).
 *
 * Pour une contrainte H_DISTANCE, axis = 'H' → retourne la coordonnée X ajustée.
 * Pour une contrainte V_DISTANCE, axis = 'V' → retourne la coordonnée Y ajustée.
 *
 * Invariant de test : pour une pièce rectangulaire I→I,
 *   vertex à x=0 → displayX > 0
 *   vertex à x=3000 → displayX < 3000
 */
function resolveDisplayCoord(
  pt: PointRef,
  rooms: Room[],
  wallThickness: number,
  axis: 'H' | 'V',
): number | null {
  const room = rooms.find(r => r.id === pt.roomId);
  const vertex = room?.points[pt.vertexIdx];
  if (!room || !vertex) return null;

  const preferVertical = axis === 'H'; // murs verticaux délimitent une dist H
  const half = halfThicknessAt(pt.vertexIdx, room, wallThickness, preferVertical);
  const face = pt.face ?? 'INSIDE';
  const faceSign = face === 'INSIDE' ? 1 : face === 'OUTSIDE' ? -1 : 0;

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
  const centroidX = room.points.reduce((s, p) => s + p.x, 0) / n;
  const centroidY = room.points.reduce((s, p) => s + p.y, 0) / n;

  if (axis === 'H') {
    const edgeDy = ep2.y - ep1.y;
    const rawNormalX = -edgeDy;
    let normalSign = rawNormalX >= 0 ? 1 : -1;
    if ((centroidX - vertex.x) * normalSign < 0) normalSign = -normalSign;
    return vertex.x + faceSign * normalSign * half;
  } else {
    const edgeDx = ep2.x - ep1.x;
    const rawNormalY = edgeDx;
    let normalSign = rawNormalY >= 0 ? 1 : -1;
    if ((centroidY - vertex.y) * normalSign < 0) normalSign = -normalSign;
    return vertex.y + faceSign * normalSign * half;
  }
}
```

- [ ] **Step 3 : Ajouter les marqueurs SVG `<defs>` dans le JSX**

Dans `src/components/plan/DrawingCanvas.tsx`, localiser la balise `<svg` principale (le SVG du canvas). Juste après la balise d'ouverture `<svg ...>`, ajouter un bloc `<defs>` avec les marqueurs de flèches ouvertes :

```tsx
        {/* ── Marqueurs SVG pour flèches ouvertes CAD ─── */}
        <defs>
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
        </defs>
```

- [ ] **Step 4 : Ajouter le rendu des côtes H_DISTANCE et V_DISTANCE**

Dans `src/components/plan/DrawingCanvas.tsx`, chercher la section où sont rendus les POINT_ON_LINE tick marks (vers la ligne 488). Juste AVANT cette section (après la fermeture du bloc des per-edge labels), ajouter :

```tsx
        {/* ── Lignes de cote CAD (H_DISTANCE / V_DISTANCE / LENGTH) ─────── */}
        {constraints.map((c) => {
          if (c.type !== 'H_DISTANCE' && c.type !== 'V_DISTANCE' && c.type !== 'LENGTH') return null;
          if (c.pts.length < 2 || typeof c.value !== 'number') return null;

          const roomA = rooms.find(r => r.id === c.pts[0]!.roomId);
          const roomB = rooms.find(r => r.id === c.pts[1]!.roomId);
          if (!roomA || !roomB) return null;

          const vA = roomA.points[c.pts[0]!.vertexIdx];
          const vB = roomB.points[c.pts[1]!.vertexIdx];
          if (!vA || !vB) return null;

          const hOffset = constraintFaceOffset(c, roomA, wallThickness);
          const displayedMm = c.value - hOffset;
          const displayedCm = (displayedMm / 10).toFixed(1);
          const faceLabel = `${FACE_LABEL[c.pts[0]!.face ?? 'INSIDE']}→${FACE_LABEL[c.pts[1]!.face ?? 'INSIDE']}`;

          const sw = 1.2 / scale;   // épaisseur trait
          const extSw = 0.8 / scale;
          const fontSize = 11 / scale;
          const padX = 28 / scale, padY = 8 / scale;

          if (c.type === 'H_DISTANCE') {
            const xA = resolveDisplayCoord(c.pts[0]!, rooms, wallThickness, 'H') ?? vA.x;
            const xB = resolveDisplayCoord(c.pts[1]!, rooms, wallThickness, 'H') ?? vB.x;
            const topY = Math.min(vA.y, vB.y);
            const dimY  = topY - DIM_OFFSET;
            const extY0 = topY - EXT_GAP;
            const extY1 = dimY + EXT_OVER;
            const midX = (xA + xB) / 2;
            const labelText = `${faceLabel}  ${displayedCm} cm`;
            const textW = labelText.length * fontSize * 0.6 + padX * 2;
            return (
              <g key={`cad-h-${c.id}`} className="pointer-events-none">
                {/* Lignes d'extension */}
                <line x1={xA} y1={extY0} x2={xA} y2={extY1}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7} />
                <line x1={xB} y1={extY0} x2={xB} y2={extY1}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7} />
                {/* Ligne de cote avec flèches ouvertes */}
                <line x1={xA} y1={dimY} x2={xB} y2={dimY}
                  stroke="#22c55e" strokeWidth={sw}
                  markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)" />
                {/* Label encadré */}
                <rect
                  x={midX - textW / 2} y={dimY - fontSize - padY * 1.5}
                  width={textW} height={fontSize + padY * 2}
                  rx={4 / scale} fill="var(--canvas-bg)"
                  stroke="#22c55e" strokeWidth={0.8 / scale} />
                <text x={midX} y={dimY - padY * 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize} fontWeight="700" fill="#22c55e"
                  style={{ fontFamily: 'system-ui' }}>
                  {labelText}
                </text>
              </g>
            );
          }

          if (c.type === 'V_DISTANCE') {
            const yA = resolveDisplayCoord(c.pts[0]!, rooms, wallThickness, 'V') ?? vA.y;
            const yB = resolveDisplayCoord(c.pts[1]!, rooms, wallThickness, 'V') ?? vB.y;
            const rightX = Math.max(vA.x, vB.x);
            const dimX  = rightX + DIM_OFFSET;
            const extX0 = rightX + EXT_GAP;
            const extX1 = dimX - EXT_OVER;
            const midY = (yA + yB) / 2;
            const labelText = `${faceLabel}  ${displayedCm} cm`;
            const textW = labelText.length * fontSize * 0.6 + padX * 2;
            return (
              <g key={`cad-v-${c.id}`} className="pointer-events-none">
                {/* Lignes d'extension */}
                <line x1={extX0} y1={yA} x2={extX1} y2={yA}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7} />
                <line x1={extX0} y1={yB} x2={extX1} y2={yB}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7} />
                {/* Ligne de cote avec flèches ouvertes */}
                <line x1={dimX} y1={yA} x2={dimX} y2={yB}
                  stroke="#22c55e" strokeWidth={sw}
                  markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)" />
                {/* Label encadré */}
                <rect
                  x={dimX + padY} y={midY - fontSize / 2 - padY}
                  width={textW} height={fontSize + padY * 2}
                  rx={4 / scale} fill="var(--canvas-bg)"
                  stroke="#22c55e" strokeWidth={0.8 / scale} />
                <text x={dimX + padY + textW / 2} y={midY}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize} fontWeight="700" fill="#22c55e"
                  style={{ fontFamily: 'system-ui' }}>
                  {labelText}
                </text>
              </g>
            );
          }

          if (c.type === 'LENGTH') {
            // Côte LENGTH : ligne parallèle à l'arête, décalée perpendiculairement
            const dx = vB.x - vA.x, dy = vB.y - vA.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / len, ny = dx / len; // normale perpendiculaire
            const ox = nx * DIM_OFFSET, oy = ny * DIM_OFFSET;
            const ax = vA.x + ox, ay = vA.y + oy;
            const bx = vB.x + ox, by = vB.y + oy;
            const midX = (ax + bx) / 2, midY = (ay + by) / 2;
            const labelText = `${(c.value / 10).toFixed(1)} cm`;
            const textW = labelText.length * fontSize * 0.6 + padX * 2;
            return (
              <g key={`cad-l-${c.id}`} className="pointer-events-none">
                {/* Lignes d'extension */}
                <line x1={vA.x + nx * EXT_GAP} y1={vA.y + ny * EXT_GAP}
                  x2={ax + nx * EXT_OVER} y2={ay + ny * EXT_OVER}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7} />
                <line x1={vB.x + nx * EXT_GAP} y1={vB.y + ny * EXT_GAP}
                  x2={bx + nx * EXT_OVER} y2={by + ny * EXT_OVER}
                  stroke="#22c55e" strokeWidth={extSw} opacity={0.7} />
                {/* Ligne de cote */}
                <line x1={ax} y1={ay} x2={bx} y2={by}
                  stroke="#22c55e" strokeWidth={sw}
                  markerStart="url(#cad-arr-l)" markerEnd="url(#cad-arr-r)" />
                {/* Label encadré */}
                <rect
                  x={midX - textW / 2} y={midY - fontSize / 2 - padY}
                  width={textW} height={fontSize + padY * 2}
                  rx={4 / scale} fill="var(--canvas-bg)"
                  stroke="#22c55e" strokeWidth={0.8 / scale} />
                <text x={midX} y={midY}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={fontSize} fontWeight="700" fill="#22c55e"
                  style={{ fontFamily: 'system-ui' }}>
                  {labelText}
                </text>
              </g>
            );
          }

          return null;
        })}
```

- [ ] **Step 5 : Supprimer le badge texte quand une côte CAD existe**

Dans `src/components/plan/DrawingCanvas.tsx`, dans la section per-edge labels, trouver :
```typescript
                const showLabel = screenLen > 65 || isHov;
```
Remplacer par :
```typescript
                const showLabel = !hasDistC && (screenLen > 65 || isHov);
```

(La variable `hasDistC` est déjà définie juste au-dessus : `const hasDistC = !!(hDistC || vDistC || lenC);`)

- [ ] **Step 6 : Vérifier TypeScript**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -30
```

Expected : aucune erreur TypeScript.

- [ ] **Step 7 : Lancer les tests**

```bash
cd /workspaces/Calpiweb
npx vitest run --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 8 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/DrawingCanvas.tsx
git commit -m "feat(canvas): lignes de cote CAD (H/V/L) + badge suppression si côte CAD présente"
```

---

## Task 4 — `onDimensionClick` : clic sur label CAD → rouvre DimensionPopup

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx:91` (interface DrawingCanvasProps — ajouter prop)
- Modify: `src/components/plan/DrawingCanvas.tsx:172-185` (destructuring — ajouter `onDimensionClick`)
- Modify: `src/components/plan/DrawingCanvas.tsx` (dans le rendu côtes CAD — ajouter `pointer-events-auto` + onClick)
- Modify: `src/components/plan/PlanEditor.tsx` (ajouter `handleDimensionClick`, passer prop à `DrawingCanvas`)

**Context :** Le label encadré de chaque côte CAD doit être cliquable pour rouvrir le `DimensionPopup` avec les valeurs existantes.

- [ ] **Step 1 : Ajouter `onDimensionClick` dans DrawingCanvasProps**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver la fin de l'interface `DrawingCanvasProps` :
```typescript
  deleteHover: DeleteHoverTarget | null;
}
```
Remplacer par :
```typescript
  deleteHover: DeleteHoverTarget | null;
  onDimensionClick?: (constraint: Constraint) => void;
}
```

- [ ] **Step 2 : Ajouter `onDimensionClick` dans le destructuring du composant**

Dans `src/components/plan/DrawingCanvas.tsx`, trouver :
```typescript
  deleteHover,
}: DrawingCanvasProps) => {
```
Remplacer par :
```typescript
  deleteHover,
  onDimensionClick,
}: DrawingCanvasProps) => {
```

- [ ] **Step 3 : Rendre les labels cliquables dans le rendu CAD**

Dans le bloc de rendu des côtes CAD ajouté à la Task 3, dans chacune des 3 branches (`H_DISTANCE`, `V_DISTANCE`, `LENGTH`), retirer la classe `pointer-events-none` du `<g>` parent et rendre le `<rect>` du label cliquable.

Pour **H_DISTANCE**, remplacer :
```tsx
              <g key={`cad-h-${c.id}`} className="pointer-events-none">
```
par :
```tsx
              <g key={`cad-h-${c.id}`}>
```
Et sur le `<rect>` du label, ajouter :
```tsx
                  className={onDimensionClick ? 'cursor-pointer' : 'pointer-events-none'}
                  onClick={() => onDimensionClick?.(c)}
```

Pour **V_DISTANCE**, de même : retirer `pointer-events-none` du `<g>` parent, et sur le `<rect>` du label ajouter :
```tsx
                  className={onDimensionClick ? 'cursor-pointer' : 'pointer-events-none'}
                  onClick={() => onDimensionClick?.(c)}
```

Pour **LENGTH**, de même.

Ajouter `className="pointer-events-none"` explicitement sur les `<line>` et `<text>` à l'intérieur de chaque `<g>` pour que seul le `<rect>` soit cliquable.

- [ ] **Step 4 : Ajouter `handleDimensionClick` dans PlanEditor.tsx**

Dans `src/components/plan/PlanEditor.tsx`, repérer la fonction `openDimensionPopup` (ligne ~609). Après la fermeture de ce `useCallback` (après la ligne `}, [constraints, rooms, wallThickness]);`), ajouter :

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

- [ ] **Step 5 : Passer `onDimensionClick` à `<DrawingCanvas>`**

Dans `src/components/plan/PlanEditor.tsx`, trouver dans le JSX le bloc `<DrawingCanvas ...>`. Trouver la ligne :
```tsx
        onZoneEdgePointerDown={handleZoneEdgePointerDown}
      />
```
Remplacer par :
```tsx
        onZoneEdgePointerDown={handleZoneEdgePointerDown}
        onDimensionClick={handleDimensionClick}
      />
```

- [ ] **Step 6 : Vérifier TypeScript**

```bash
cd /workspaces/Calpiweb
npx tsc --noEmit 2>&1 | head -30
```

Expected : aucune erreur.

- [ ] **Step 7 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected : tous les tests passent.

- [ ] **Step 8 : Commit**

```bash
cd /workspaces/Calpiweb
git add src/components/plan/DrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat(canvas): onDimensionClick — clic sur label CAD rouvre DimensionPopup"
```
