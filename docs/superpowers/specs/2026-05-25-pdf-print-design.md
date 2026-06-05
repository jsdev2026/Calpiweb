# PDF Print — Refonte du rendu imprimé

## Goal

Remplacer le rendu PDF actuel (hack CSS de visibilité + `window.print()` dépendant de l'onglet actif) par un composant d'impression dédié, toujours en mode clair, indépendant de l'onglet affiché, affichant les informations client, les paramètres de pose et un filigrane CaléPlan.

## Architecture

Trois évolutions coordonnées :

1. **Extraction `QuantityPlanSvg`** — composant SVG pur extrait de `QuantityPlanView`, partagé entre l'affichage interactif et l'impression.
2. **Nouveau `QuantitiesPrintView`** — composant d'impression complet, toujours rendu dans le DOM (hidden), ciblé par `@media print`.
3. **Simplification `page.tsx`** — le bouton PDF fonctionne sur tous les onglets ; `handlePrint` réduit à `window.print()`.

Aucune librairie externe ajoutée. L'utilisateur passe par la boîte de dialogue d'impression native du navigateur pour enregistrer en PDF.

## Tech Stack

React 18, TypeScript, Tailwind CSS, SVG natif, `@media print` CSS

---

## Feature 1 — Composant `QuantityPlanSvg`

### Rôle

Rendre le plan de calepinage annoté (carreaux entiers en bleu, coupes en orange, contour de pièce en orange, légende) sous forme de `<svg>` statique, sans état interactif.

### Props

```ts
interface QuantityPlanSvgProps {
  result: QuantityResult;
  config: TilingConfig;
  rooms: Room[];
  highlightGroup?: number | null;
  width?: number;   // optionnel, défaut: 100%
  height?: number;  // optionnel, défaut: auto
}
```

### Comportement

- Calcule le bounding box de toutes les pièces valides (comme `QuantityPlanView` le fait aujourd'hui).
- Rend les tuiles `result.tiles` avec `type === 'WHOLE'` en bleu (`fill="#dbeafe"`, stroke `#93c5fd`) et `type === 'CUT'` en orange (`fill="#fed7aa"`, stroke `#f97316`).
- Si `highlightGroup` est défini, les coupes du groupe mis en valeur sont plus opaques.
- Clippe le rendu au contour des pièces.
- Inclut une légende SVG en bas (`rect` + `text`) : "Carreaux entiers" / "Coupes".
- Pas de handlers d'événements, pas de `useState`, pas de `useEffect`.

### Fichier

`src/components/quantities/QuantityPlanSvg.tsx`

### Impact sur `QuantityPlanView`

`QuantityPlanView` est refactorisé pour déléguer le rendu SVG à `QuantityPlanSvg`. La logique de zoom/pan (viewBox state, wheel/touch handlers) reste dans `QuantityPlanView`. Comportement utilisateur inchangé.

---

## Feature 2 — Composant `QuantitiesPrintView`

### Rôle

Rendre le document imprimé complet en HTML pur (couleurs hexadécimales fixes, jamais de variables CSS de thème). Toujours présent dans le DOM via `<div id="quantities-print-target" className="hidden">`.

### Props

```ts
interface QuantitiesPrintViewProps {
  project: Project;
}
```

Le composant appelle lui-même `analyzeQuantities` pour obtenir les résultats (une fois par pièce valide).

### Structure du document (sections numérotées)

```
① En-tête orange CaléPlan
② Bloc infos client + description projet
③ En-tête de pièce (répété par pièce)
④ Plan SVG annoté (QuantityPlanSvg statique)
⑤ Statistiques (4 cartes : total / entiers / coupes / à commander)
⑥ Tableau des coupes
--- répétition ③→⑥ pour chaque pièce suivante ---
⑦ Footer filigrane
```

#### ① En-tête

- Fond orange `#f97316`, texte blanc.
- Gauche : logo CaléPlan SVG + nom "CaléPlan" + sous-titre "Quantitatif de calepinage".
- Droite : `project.name` (gras) + date de génération (`new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })`).

#### ② Infos client

- Grille 3 colonnes : Client (nom, téléphone, e-mail) | Adresse | Description du projet.
- Si un champ est absent (ex. pas de client renseigné), la colonne est omise.
- Bordure inférieure fine `#f1f5f9`.

#### ③ En-tête de pièce

- Fond `#f8fafc`, bordure supérieure `2px solid #e2e8f0`.
- Gauche : `room.name ?? 'Pièce N'` (N = index + 1), gras 13px.
- Droite (flex gap-16) : format `{tileW} × {tileH} cm` (orange) · Joint `{joint} mm` · Mode de pose (libellé français) · Surface `{roomArea} m²`.
- Libellés de pose : `STRAIGHT` → "Pose droite", `HERRINGBONE` → "Bâton rompu", `CHEVRON` → "Chevron".

#### ④ Plan SVG

- `<QuantityPlanSvg>` en mode statique, largeur 100% du contenu, hauteur auto (ratio conservé via `viewBox`).
- Fond `#f8fafc`, padding 12px 18px, bordure inférieure.

#### ⑤ Statistiques

Grille 4 colonnes, cartes à bordure colorée :

| Carte | Valeur | Couleur accent |
|---|---|---|
| Total posés | `result.totalTiles` | gris neutre |
| Carreaux entiers | `result.wholeCount` | bleu `#3b82f6` |
| Coupes | `result.cuts.length` | orange `#f97316` |
| À commander | `result.toOrder` | vert `#16a34a` |

#### ⑥ Tableau des coupes

Tableau HTML (pas de librairie) avec colonnes :

| Couleur | Dimension de coupe | Qté | Chute récupérable | Carreaux source |
|---|---|---|---|---|
| `<div>` carré coloré (couleur du groupe, `GROUP_COLORS[i]`) | `{usedW} × {usedH} cm` | `×{netTiles}` | `{chuteW} × {chuteH} cm (×{netTiles})` si chute > 0, sinon `—` | `{netTiles}` |

- Alternance de fond de ligne (`#fff` / `#fafafa`).
- En-têtes de colonne en `#6b7280`, fond `#f8fafc`.
- Titre de section : "Détail des groupes de coupes" en uppercase 10px.

#### ⑦ Footer

- Fond `#f8fafc`, bordure supérieure `2px solid #e2e8f0`.
- Gauche : logo CaléPlan SVG (opacité 40%) + "Document généré par CaléPlan — Outil professionnel de calepinage" en gris clair.
- Droite : date de génération (même valeur que ①).

### Multi-pièces

Pour un projet avec N pièces valides :
- `analyzeQuantities([room], config, wallThickness)` est appelé pour chaque pièce individuellement.
- Les sections ③→⑥ sont rendues N fois, séparées par le séparateur ③.
- Si une pièce n'a pas de tuiles (`totalTiles === 0`), elle est ignorée dans l'impression.

### Couleurs fixes (jamais de CSS vars)

Toutes les couleurs du composant sont des hexadécimaux fixes pour garantir l'impression en mode clair, quel que soit le thème de l'application.

### Fichier

`src/components/quantities/QuantitiesPrintView.tsx`

---

## Feature 3 — CSS `@media print` et `page.tsx`

### CSS (`src/app/globals.css`)

```css
@media print {
  /* Masquer toute l'application */
  body > * {
    display: none !important;
  }
  /* Afficher uniquement la cible d'impression */
  #quantities-print-target {
    display: block !important;
  }
  /* Forcer les couleurs de fond (header orange, cartes) */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
```

### `page.tsx`

- `handlePrint` devient : `window.print()` (suppression de l'injection de style dynamique).
- Le bouton PDF est **toujours actif** (suppression de `disabled={tab === 'PLAN'}`).
- `QuantitiesPrintView` est rendu dans :

```tsx
<div id="quantities-print-target" className="hidden">
  {activeProject && <QuantitiesPrintView project={activeProject} />}
</div>
```

  Positionné en dehors du `<main>`, après `</main>`, avant `{showSettings && ...}`.

---

## Fichiers modifiés/créés

| Fichier | Changement |
|---|---|
| `src/components/quantities/QuantityPlanSvg.tsx` | **Créé** — SVG statique pur extrait de `QuantityPlanView` |
| `src/components/quantities/QuantityPlanView.tsx` | **Modifié** — utilise `QuantityPlanSvg`, comportement inchangé |
| `src/components/quantities/QuantitiesPrintView.tsx` | **Créé** — composant d'impression complet |
| `src/app/globals.css` | **Modifié** — bloc `@media print` |
| `src/app/project/[id]/page.tsx` | **Modifié** — rend `QuantitiesPrintView`, simplifie `handlePrint`, active PDF sur tous onglets |

## Tests

- `QuantityPlanSvg` : rendu correct des tuiles (whole/cut), pas d'interactivité
- `QuantitiesPrintView` : rendu avec/sans client, mono-pièce, multi-pièces, pièce sans tuiles ignorée
- `page.tsx` : bouton PDF actif sur tous les onglets
