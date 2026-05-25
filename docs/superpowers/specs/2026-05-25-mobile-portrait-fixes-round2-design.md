# Mobile Portrait — Fixes Round 2 : Design Spec

## Goal

Corriger trois zones restantes de l'éditeur de projet (`/project/[id]`) toujours inutilisables en portrait sur mobile (≥ 375px) : la topbar principale, la barre de contrôles du calepinage, et la page Plan 2D.

## Breakpoint unique : `md:` (768px)

Même stratégie que l'ensemble de l'application. En dessous de `md:` = layout mobile. Au-dessus = desktop inchangé.

---

## Zone 1 — Topbar projet (`src/app/project/[id]/page.tsx`)

### Problème

Le `<input>` nom du projet a un `minWidth: 120` qui, combiné au bouton user menu (avatar + badge plan), fait déborder la topbar sur 375px malgré les masquages du round 1.

### Solution

**Mobile (`< md`) :**
- `<input>` nom du projet : `hidden md:block` — masqué sur mobile.
- Le div wrapper breadcrumb (`.flex.items-center.gap-1.5`) reste dans le DOM mais sans l'input, il occupe `flex:1` naturellement et crée l'espace vide central.
- Résultat : `←` · espace libre · `☀` · `⚙` · avatar+badge.

**Desktop (`md:`) :** comportement actuel inchangé.

**Implémentation :** ajouter `hidden md:block` sur le `<input>` dans `src/app/project/[id]/page.tsx`.

---

## Zone 2 — Contrôles calepinage (`src/components/tiling/TilingEditor.tsx`)

### Problème

1. `absolute bottom-4` (16px) : trop bas sur iOS Safari / Chrome mobile qui ont une barre de navigation de ~80px.
2. La Row 2 (Déc. X + Déc. Y côte à côte) ne laisse pas assez de place aux sliders sur 375px.

### Solution

**Position :** `bottom-20 md:bottom-4` — 80px du bas sur mobile, 16px sur desktop.

**Layout 3 lignes sur mobile (2 lignes restent sur desktop) :**
- Ligne 1 : bouton Côtes + séparateur + Angle (label + slider `flex-1` + valeur °)
- Ligne 2 : DÉC. X seul (label complet + slider `flex-1` + valeur)
- Ligne 3 : DÉC. Y seul (label complet + slider `flex-1` + valeur)
- Séparateur desktop entre Angle et Déc. X/Y : `hidden md:block` (inchangé)

Sur mobile le conteneur passe de `flex-col` 2 items à `flex-col` 3 items. La Row 2 actuelle (Déc. X + Déc. Y côte à côte) est splitée en deux divs séparés.

**Desktop (`md:`) :** layout 2 lignes actuel inchangé.

**Implémentation :** modifier le conteneur flottant et le Row 2 dans `src/components/tiling/TilingEditor.tsx`.

---

## Zone 3 — Plan 2D (`src/components/plan/PlanEditor.tsx` + `src/components/plan/PlanToolbar.tsx`)

### Problème

1. `PlanToolbar` : `hidden md:flex` — tous les outils sont masqués sur mobile.
2. `RoomPanel` : utilise `position: fixed` avec des valeurs hardcodées (`left: 72`, `top: 92`) non adaptées au mobile portrait.
3. Panneau raccourcis clavier (`absolute bottom-5 right-5`) : visible sur mobile mais inutile (raccourcis clavier non disponibles sur touch).
4. Bannière "La création de plans est disponible sur ordinateur ou tablette" : à supprimer (l'outil est maintenant disponible sur mobile).

### Solution

#### PlanToolbar — variante horizontale mobile

Dans `src/components/plan/PlanToolbar.tsx` :
- La colonne verticale existante garde `hidden md:flex` (desktop uniquement).
- Ajout d'une variante horizontale `flex md:hidden` : barre fixe en bas du canvas, `overflow-x-auto`, boutons `h-10 w-10`.
- Ordre des outils dans la barre mobile : SELECT, WALL, DOOR, PARTITION, EXCLUDE, APPLY_H, APPLY_V, DIMENSION, COINCIDE, ANCHOR, THICKNESS, séparateur, Annuler, Rétablir, Supprimer.
- `WallThicknessControl` : masqué sur mobile (réglage non essentiel).

#### RoomPanel — banderole compacte mobile

Dans `src/components/plan/PlanEditor.tsx`, ajouter avant le canvas une banderole mobile `flex md:hidden` :
- Positionnée en flux normal (non `fixed`), sous la barre d'onglets.
- Affiche les onglets de pièces en ligne (`RoomTabs` avec `vertical={false}`).
- Le `RoomPanel` draggable existant reçoit `hidden md:block` pour ne s'afficher que sur desktop.

#### Raccourcis — masqués + hint tactile

- Le panneau raccourcis (`pointer-events-none absolute bottom-5 right-5`) : `hidden md:block`.
- Ajout d'un hint discret sur le canvas, mobile uniquement (`md:hidden`) : `"2 doigts : zoom"` en overlay bas-droit, `pointer-events-none`, fond semi-transparent, `text-[10px]`.

#### Bannière "ordinateur ou tablette"

- Supprimer le div bannière (`absolute inset-x-0 top-0 z-20 … md:hidden`) : l'outil est désormais disponible sur mobile.

**Desktop (`md:`) :** aucun changement.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/app/project/[id]/page.tsx` | `hidden md:block` sur l'input nom |
| `src/components/tiling/TilingEditor.tsx` | `bottom-20 md:bottom-4`, Row 2 → 2 rows séparées |
| `src/components/plan/PlanToolbar.tsx` | Variante horizontale mobile `flex md:hidden` |
| `src/components/plan/PlanEditor.tsx` | Banderole pièces mobile, raccourcis `hidden md:block`, hint tactile, suppression bannière |

---

## Tests

Vérification via DevTools à 375px (iPhone SE) et 390px (iPhone 14 Pro) en portrait :

1. **Topbar** : tient en une ligne, nom masqué, back + thème + settings + avatar visibles.
2. **Calepinage Aperçu** : barre de contrôles en 3 lignes, sliders larges, barre au-dessus de la nav Safari.
3. **Plan 2D** : toolbar horizontale en bas avec tous les outils, banderole pièces en haut, raccourcis masqués, hint zoom visible.
