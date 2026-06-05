# Spec — Amélioration du contraste des joints en light mode

**Date :** 2026-05-22  
**Périmètre :** Vue calepinage — tokens CSS uniquement  
**Fichier impacté :** `src/app/globals.css`

---

## Problème

En light mode, `--tile-joint` (`#d1d5db`, gray-300) et `--tile-cut-bg` (`#d1d5db`) ont la même valeur. Le fond de la pièce est rempli avec `--tile-joint` et les carreaux sont dessinés par-dessus ; les joints apparaissent dans les gaps entre carreaux. Quand la couleur du carreau est claire (blanc, beige, gris pâle), les joints deviennent quasi invisibles.

Le dark mode n'est pas affecté : `--tile-joint` vaut `#09090b` (quasi-noir), le contraste est excellent.

---

## Solution

Modifier deux tokens CSS dans `:root` uniquement. Aucun changement JS/TSX.

| Variable | Avant | Après |
|---|---|---|
| `--tile-joint` | `#d1d5db` (gray-300) | `#94a3b8` (slate-400) |
| `--tile-cut-bg` | `#d1d5db` (gray-300) | `#cbd5e1` (slate-300) |

### Justification des valeurs

- `#94a3b8` (slate-400) : déjà utilisé dans le design pour `--canvas-vtx-default`. Évoque le coulis ciment, suffisamment foncé pour ressortir sur carreaux clairs, sans être agressif.
- `#cbd5e1` (slate-300) : légèrement plus clair que `#94a3b8`, crée une distinction visuelle subtile entre carreaux coupés et joints, tout en restant dans la même famille slate.

### Dark mode

Aucune modification. Les valeurs dark (`--tile-joint: #09090b`, `--tile-cut-bg: #3f3f46`) offrent déjà un contraste optimal.

---

## Périmètre strict

- **Modifié :** `src/app/globals.css` — deux valeurs dans `:root`
- **Non modifié :** `TilingCanvas.tsx`, logique de rendu, `TilingConfig`, autres composants
- **Non concerné :** dark mode, miniature de la page d'accueil, panel quantités (utilise les mêmes tokens, bénéficiera automatiquement du fix)
