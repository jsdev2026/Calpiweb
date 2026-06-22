# Mobile Touch Gestures — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Problème

Sur smartphone, glisser un nœud ou un mur déjà placé est impossible : le gestionnaire `handleTouchStart` intercepte le 1 doigt AVANT que les `PointerEvent` n'atteignent le SVG, et le transforme systématiquement en pan de la vue. Le nœud ne bouge jamais.

## Modèle de gestes cible

| Geste | Comportement |
|---|---|
| 1 doigt | Interaction : déplacer nœud/mur, dessiner, sélectionner, verrouiller |
| 1 doigt sur zone vide | Pan de la vue (géré naturellement par le handler pointer existant) |
| 2 doigts | Navigation uniquement : pinch-to-zoom + pan |

## Architecture

### Pourquoi ça marche après la correction

Le canvas SVG possède déjà des handlers `onPointerDown / onPointerMove / onPointerUp` qui font un hit-test complet :

1. Nœud touché → drag nœud
2. Mur touché → drag mur
3. Zone vide → pan

Ces handlers reçoivent les `PointerEvent` générés par le navigateur à partir des `TouchEvent`. Mais aujourd'hui, `handleTouchStart` appelle `e.preventDefault()` pour tout (y compris 1 doigt), ce qui supprime la génération des pointer events correspondants.

### Correction

Dans `handleTouchStart` (WallDrawingCanvas.tsx) :

**Avant :**
```ts
const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
  e.preventDefault();            // ← bloque les pointer events 1 doigt
  if (e.touches.length === 2) {
    // ... pinch setup ...
  } else if (e.touches.length === 1 && tool === 'SELECT') {
    touchRef.current = { type: '1finger', ... };  // ← vole le geste
  }
};
```

**Après :**
```ts
const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
  if (e.touches.length >= 2) {
    e.preventDefault();          // ← seulement pour 2 doigts (empêche le zoom navigateur)
    // ... pinch setup ... (inchangé)
  }
  // 1 doigt : rien — les pointer events prennent le relais
};
```

Dans `handleTouchMove` : supprimer la branche `else if (ref.type === '1finger' ...)` (dead code — `touchRef` n'est plus jamais initialisé avec `type: '1finger'`).

### Périmètre

- Un seul fichier modifié : `src/components/plan/WallDrawingCanvas.tsx`
- Aucun changement de store, de types, ni de tests snapshot
- Le pinch-to-zoom existant est conservé à l'identique
- Le pan sur zone vide reste fonctionnel via pointer events

## Hors périmètre

- Augmentation des zones de touch (ENDPOINT_RADIUS_PX) — non demandé
- UI toolbar mobile — non demandé
- Mode dessin optimisé mobile — non demandé

## Tests

Les touch events sont difficiles à simuler avec jsdom. On vérifie :

1. **Test unitaire sur la logique** : `handleTouchStart` avec 2 touches appelle `e.preventDefault()` ; avec 1 touche ne l'appelle pas et ne modifie pas `touchRef`.
2. **Test manuel** : sur navigateur mobile (ou DevTools responsive), vérifier que glisser un nœud le déplace bien, et que pinch-to-zoom fonctionne toujours.
