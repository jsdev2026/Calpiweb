# Mobile Input Zoom Fix — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Problème

Sur iOS Safari (et tout navigateur mobile), le viewport zoome automatiquement lorsqu'un `<input>` (ou `<select>`, `<textarea>`) reçoit le focus avec un `font-size < 16px`. Ce zoom non sollicité se produit lors de toute saisie dans l'outil de dessin : popup de côte, épaisseur de mur, renommage de pièce, cotation automatique.

**Cause racine :** `body { font-size: 13.5px }` dans `globals.css` → tous les inputs héritent 13.5px par défaut. Les inputs avec une taille explicite aggravent le cas.

### Inputs affectés

| Fichier | font-size actuel | Déclencheur |
|---|---|---|
| `src/components/plan/DimensionPopup.tsx:101` | `text-sm` = 14px | `autoFocus` |
| `src/components/plan/WallEdgeEditor.tsx:56` | `text-sm` = 14px | `autoFocus` |
| `src/components/plan/AutoCotationPanel.tsx:110` | `text-sm` = 14px | `autoFocus` |
| `src/components/plan/WallDrawingCanvas.tsx:1421` | `text-xs` = 12px | `autoFocus` |
| `src/components/plan/DimensionEditor.tsx:39` | hérité = 13.5px | `autoFocus` |
| `src/components/plan/WallRoomPanel.tsx:116` | `text-[11px]` | focus manuel |
| `src/components/plan/RoomTabs.tsx:50` | `text-[11px]` | focus manuel |

## Solution retenue

Une seule règle CSS dans `src/app/globals.css`, ajoutée à la fin du fichier :

```css
@media (pointer: coarse) {
  input, select, textarea { font-size: 16px; }
}
```

### Choix techniques

**`pointer: coarse`** — cible les écrans tactiles (smartphone, tablette) sans affecter le desktop. Plus précis qu'un breakpoint `max-width` arbitraire.

**`16px` fixe** — valeur minimale requise par Safari iOS pour ne pas déclencher le zoom. `max(16px, 1em)` ne fonctionnerait pas car `1em` hériterait du body à 13.5px.

**Règle globale `input, select, textarea`** — couvre tous les inputs présents et futurs sans modifier les composants individuellement.

## Fichier modifié

| Fichier | Changement |
|---|---|
| `src/app/globals.css` | Ajout d'un bloc `@media (pointer: coarse)` à la fin du fichier |

## Ce qui ne change pas

- Apparence desktop : la règle est limitée aux appareils `pointer: coarse`
- Code des composants : aucune modification dans les `.tsx`
- Inputs desktop-only (ex. `WallThicknessControl` non-compact) : inchangés

## Impact visuel mobile

Les inputs passent de 11–14px à 16px sur mobile. Ce changement intervient uniquement dans des états d'édition active (l'utilisateur est en train de saisir) — la lisibilité à 16px est meilleure. Aucun impact sur l'apparence au repos.

## Tests

Pas de test unitaire — la règle CSS n'est pas testable par Vitest.

**Vérification manuelle :** DevTools → mode responsive → iPhone (ou appareil `pointer: coarse`) → taper sur un input → le viewport ne doit pas zoomer.
