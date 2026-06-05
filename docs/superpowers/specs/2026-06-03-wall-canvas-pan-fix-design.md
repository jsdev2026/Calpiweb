# Fix Pan — WallDrawingCanvas

**Date :** 2026-06-03
**Fichier :** `src/components/plan/WallDrawingCanvas.tsx`

## Problème

Le pan (déplacement du plan) ne se déclenche que via clic du milieu ou Alt+clic gauche. Clic droit et clic-glisser gauche sur zone vide en mode SELECT ne fonctionnent pas.

## Fix — 3 modifications dans `handlePointerDown` + SVG

### 1. Clic droit → pan (tous modes)

```typescript
// AVANT
if (e.button === 1 || (e.button === 0 && e.altKey)) {
// APRÈS
if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
```

### 2. Bloquer le menu contextuel navigateur

Ajouter `onContextMenu={(e) => e.preventDefault()}` sur le `<svg>`.

### 3. SELECT + clic gauche sur zone vide → pan

Dans le bloc `tool === 'SELECT'`, quand ni nœud ni mur n'est touché :

```typescript
} else {
  setEditingWallId(null);
  setIsPanning(true);
  const sp = getSvgPos(e);
  panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
  (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
}
```

## Comportement cible

| Action | Résultat |
|--------|----------|
| SELECT + glisser zone vide | Pan ✓ |
| SELECT + clic nœud | Drag nœud ✓ |
| SELECT + clic mur | Ouvre éditeur ✓ |
| Clic droit + glisser (tous modes) | Pan ✓ |
| Clic milieu (tous modes) | Pan ✓ |
| Molette | Zoom ✓ |
