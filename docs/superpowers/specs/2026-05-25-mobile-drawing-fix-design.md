# Mobile Drawing Fix — Design Spec

## Goal

Rendre le dessin et les popups de cotation fonctionnels sur téléphone en mode portrait (écran tactile, `pointer: coarse`, largeur < 768px). Le layout et l'UX existants ne changent pas.

## Diagnostic

### Problème 1 — Dessin bloqué

Un `div` overlay (`absolute inset-0 z-10 md:hidden`) recouvre l'intégralité du canvas en mode mobile. Il a `pointer-events: auto` (valeur par défaut CSS), ce qui le rend opaque aux événements. Tous les touches atterrissent sur l'overlay, jamais sur le SVG.

Le SVG utilise exclusivement des handlers `onPointerDown/Move/Up`. Ces pointer events sont synthétisés par le navigateur à partir des touch events — mais seulement si l'élément cible (l'overlay) ne les intercepte pas. Résultat : aucun tap de dessin n'atteint le SVG.

### Problème 2 — Popups de cotation inaccessibles

`WallEdgeEditor` et `DimensionEditor` se positionnent à `top: screenY` (coordonnée calculée depuis le milieu du mur dans l'espace écran). Quand le clavier virtuel s'ouvre après l'apparition du popup, la fenêtre visible se rétrécit par le bas — le popup se retrouve caché derrière le clavier si `screenY` dépasse la zone visible restante.

## Architecture

Un seul fichier modifié : `src/components/plan/PlanEditor.tsx`.

Aucun changement dans `DrawingCanvas`, `WallEdgeEditor`, `DimensionEditor`, `PlanToolbar` ou les stores.

---

## Feature 1 — Overlay tactile conditionnel

### Principe

L'overlay reçoit `pointer-events: none` dès que l'outil actif est autre que `SELECT`. Les touches "tombent" alors directement sur le SVG, qui reçoit ses pointer events natifs et dessine normalement.

```tsx
<div
  className="absolute inset-0 z-10 md:hidden"
  style={{
    touchAction: 'none',
    pointerEvents: tool === 'SELECT' ? 'auto' : 'none',
  }}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
/>
```

En mode `SELECT`, l'overlay reste opaque (`pointer-events: auto`) : le pan 1-doigt fonctionne comme avant.

### Pinch-zoom — migration sur le wrapper

Quand l'overlay est transparent (`pointer-events: none`), les 2 doigts atteignent le SVG. Le gestionnaire pinch-zoom doit donc être déplacé sur le **`div` wrapper du canvas** (le `div.relative.flex.flex-1.overflow-hidden` parent de l'overlay et du SVG), afin qu'il reste actif quel que soit l'outil.

Le wrapper reçoit trois handlers :

```tsx
const handleWrapperTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 2) return;          // uniquement 2 doigts
  e.preventDefault();
  const t = e.touches;
  const dx = t[1]!.clientX - t[0]!.clientX;
  const dy = t[1]!.clientY - t[0]!.clientY;
  touchRef.current = {
    dist: Math.hypot(dx, dy),
    midX: (t[0]!.clientX + t[1]!.clientX) / 2,
    midY: (t[0]!.clientY + t[1]!.clientY) / 2,
    panX: pan.x,
    panY: pan.y,
  };
};

const handleWrapperTouchMove = (e: React.TouchEvent) => {
  if (e.touches.length !== 2 || !touchRef.current || touchRef.current.dist === 0) return;
  const t = e.touches;
  const dx = t[1]!.clientX - t[0]!.clientX;
  const dy = t[1]!.clientY - t[0]!.clientY;
  const dist = Math.hypot(dx, dy);
  const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
  const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
  const svg = svgRef.current;
  if (svg) {
    const ratio = dist / touchRef.current.dist;
    const rect = svg.getBoundingClientRect();
    const mx = midX - rect.left;
    const my = midY - rect.top;
    const ns = Math.min(Math.max(scale * ratio, MIN_SCALE), MAX_SCALE);
    setPan({
      x: mx - (mx - touchRef.current.panX) * (ns / scale),
      y: my - (my - touchRef.current.panY) * (ns / scale),
    });
    setScale(ns);
  }
  touchRef.current = { dist, midX, midY, panX: pan.x, panY: pan.y };
};

const handleWrapperTouchEnd = () => {
  if (touchRef.current && touchRef.current.dist > 0) touchRef.current = null;
};
```

L'overlay `handleTouchStart` existant est simplifié : il ne gère plus que le pan 1-doigt (branche `t.length === 2` supprimée, déjà couverte par le wrapper).

```tsx
const handleTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 1) return;          // pan 1-doigt uniquement
  e.preventDefault();
  const t = e.touches;
  touchRef.current = { dist: 0, midX: t[0]!.clientX, midY: t[0]!.clientY, panX: pan.x, panY: pan.y };
};
```

Le `handleTouchMove` existant reste inchangé (gère uniquement `dist === 0`, i.e. pan 1-doigt).

### Application sur le wrapper

```tsx
<div
  className="relative flex flex-1 overflow-hidden"
  style={{ background: 'var(--canvas-bg)' }}
  onTouchStart={handleWrapperTouchStart}
  onTouchMove={handleWrapperTouchMove}
  onTouchEnd={handleWrapperTouchEnd}
>
  {/* overlay, SVG, éditeurs… */}
</div>
```

---

## Feature 2 — Popups de cotation repositionnés sur mobile

### Détection

Au montage de `PlanEditor`, détecter si l'appareil est tactile :

```tsx
const isTouchDevice = useMemo(
  () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  [],
);
```

### Coordonnées conditionnelles

Pour chaque éditeur flottant (`WallEdgeEditor`, `DimensionEditor` × 5 occurrences), passer `undefined` aux props `screenX`/`screenY` si `isTouchDevice` :

```tsx
<WallEdgeEditor
  screenX={isTouchDevice ? undefined : editorScreen?.x}
  screenY={isTouchDevice ? undefined : editorScreen?.y}
  ...
/>
```

```tsx
<DimensionEditor
  screenX={isTouchDevice ? undefined : zoneEditorScreen?.x}
  screenY={isTouchDevice ? undefined : zoneEditorScreen?.y}
  ...
/>
```

Quand `screenX`/`screenY` sont `undefined`, le composant utilise son fallback existant :

```tsx
// Dans DimensionEditor / WallEdgeEditor (code inchangé)
style={
  positioned
    ? { left: screenX, top: screenY, transform: 'translate(-50%, -110%)' }
    : { left: '50%', top: '1rem', transform: 'translateX(-50%)' }   // ← fallback mobile
}
```

Le popup s'affiche en haut du canvas, toujours visible au-dessus du clavier virtuel.

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/components/plan/PlanEditor.tsx` | `pointer-events` conditionnel sur overlay + handlers pinch-zoom sur wrapper + `isTouchDevice` + coords `undefined` sur mobile |

## Tests à couvrir

- L'overlay a `pointer-events: none` quand l'outil est WALL, DOOR, PARTITION, EXCLUDE, APPLY_H, APPLY_V, DIMENSION, COINCIDE, ANCHOR, THICKNESS
- L'overlay a `pointer-events: auto` quand l'outil est SELECT
- Les popups (`WallEdgeEditor`, `DimensionEditor`) reçoivent `screenX=undefined` et `screenY=undefined` quand `isTouchDevice = true`
- Aucune régression sur les tests existants de `PlanEditor`
