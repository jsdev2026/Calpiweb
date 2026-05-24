# Mobile Portrait — Éditeur de projet : Design Spec

## Goal

Corriger les trois zones de l'éditeur de projet (`/project/[id]`) qui débordent ou sont inutilisables en portrait sur mobile (≥ 375px) : la topbar principale, la barre de contrôles Angle/Décal du calepinage, et la page Quantitatif.

## Breakpoint unique : `md:` (768px)

Même stratégie que l'ensemble de l'application. En dessous de `md:` = layout mobile. Au-dessus = desktop inchangé.

---

## Zone 1 — Topbar projet (`src/app/project/[id]/page.tsx`)

### Problème

La topbar contient en une seule ligne horizontale : logo CaléPlan + séparateur + fil d'ariane ("Projets › nom") + séparateur + badge statut + infos client + actions (thème / PDF / settings / avatar). Impossible à afficher sur 375px.

### Solution

**Mobile (`< md`) :**
- **Masqués** : logo CaléPlan (div logo + texte "CaléPlan"), les deux séparateurs verticaux, le badge statut, le bloc client (nom + date), le bouton PDF.
- **Conservés** : bouton retour "← Projets" (le `<button>` du fil d'ariane devient un bouton `← Projets` ou simplement la flèche `←`), l'input nom du projet (tronqué, `max-w-[160px]`), icône thème, icône settings, avatar/menu utilisateur.
- **Résultat** : une ligne de ~5 éléments compacts qui tient en 375px.

**Desktop (`md:`) :** comportement actuel inchangé.

**Implémentation :** classes `hidden md:flex` / `flex md:hidden` sur les éléments existants dans `src/app/project/[id]/page.tsx`. Aucun nouveau composant.

---

## Zone 2 — Barre de contrôles Calepinage (`src/components/tiling/TilingEditor.tsx`)

### Problème

La barre de contrôles positionnée en `absolute bottom-4` est un flex horizontal avec : bouton Côtes + séparateur + Angle (label + slider `w-24` + valeur) + séparateur + Décal. X (label + slider `w-20`) + Décal. Y (label + slider `w-20`). Déborde largement à 375px en portrait.

### Solution

**Mobile (`< md`) — 2 lignes empilées :**
- Conteneur : `flex-col gap-2 md:flex-row md:gap-5`
- Largeur : `w-[calc(100%-2rem)]` sur mobile (au lieu de `w-auto` centré)
- **Ligne 1** : bouton Côtes (à gauche, flex-shrink-0) + séparateur vertical + Angle (label + slider `w-full flex-1` + valeur)
- **Ligne 2** : Décal. X (label + slider `flex-1`) + Décal. Y (label + slider `flex-1`)
- Les sliders passent en `flex-1` sur mobile pour occuper l'espace disponible

**Desktop (`md:`) :** flex horizontal actuel inchangé.

**Implémentation :** modifier uniquement la div conteneur et les divs internes (~ligne 266) dans `TilingEditor.tsx`.

---

## Zone 3 — Quantitatif (`src/components/quantities/QuantitiesPanel.tsx`)

### Problème

Trois sous-zones problématiques :
1. Header : titre + infos (Format / Joint / Surface) sur une ligne → déborde.
2. Stat strip : `grid-cols-4` → 4 colonnes cramées sur 375px.
3. Corps : 2 colonnes côte à côte (plan annoté + sidebar `w-[360px]` fixe) → sidebar prend tout l'écran.

### Solution

**Header mobile :**
- Le paragraphe d'infos passe en `flex-col gap-0.5 md:flex-row` : Format, Joint, Surface empilés verticalement sur mobile.

**Stat strip :**
- `grid-cols-2 md:grid-cols-4` — 2×2 sur mobile, 4 colonnes sur desktop.

**Corps — onglets internes (même pattern que Aperçu/Réglages) :**
- Ajout d'un état `mobileTab: 'plan' | 'coupes'` (défaut : `'plan'`).
- Barre d'onglets visible uniquement sur mobile (`md:hidden`) : "Plan" et "Coupes", positionnée entre le stat strip et le corps.
- **Onglet "Plan"** → `<QuantityPlanView>` plein écran.
- **Onglet "Coupes"** → liste des groupes de coupes + total, plein écran, scroll vertical.
- Sur mobile, le bouton collapse sidebar (`sidebarOpen`) est masqué (`hidden md:flex`) car remplacé par les onglets.
- **Desktop (`md:`) :** layout 2 colonnes actuel inchangé, `mobileTab` ignoré.

**Implémentation :** modifier uniquement `src/components/quantities/QuantitiesPanel.tsx`.

---

## Out of Scope

- Aucune modification du Plan 2D ni du panneau Réglages du calepinage.
- Pas d'adaptation du dashboard (déjà correct).
- Pas de nouvelles pages ni nouveaux stores.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/app/project/[id]/page.tsx` | Masquage/affichage conditionnel dans la topbar |
| `src/components/tiling/TilingEditor.tsx` | Barre de contrôles en 2 lignes sur mobile |
| `src/components/quantities/QuantitiesPanel.tsx` | Grid 2×2, onglets Plan/Coupes, header empilé |

---

## Tests

Vérification via DevTools à 375px (iPhone SE) et 390px (iPhone 14 Pro) en portrait :
1. Topbar projet : tient en une ligne, nom du projet visible, bouton retour cliquable.
2. Calepinage Aperçu : barre de contrôles en 2 lignes, sliders utilisables au doigt.
3. Quantitatif : stat strip 2×2, onglets Plan/Coupes fonctionnels, aucun débordement horizontal.
