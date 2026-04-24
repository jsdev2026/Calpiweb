# Documentation technique — Calpiweb (TILEA)

> Ce document explique l'ensemble du code source du projet : à quoi sert chaque fichier, comment les pièces s'assemblent, et quels paramètres modifier pour faire évoluer l'application. Il est rédigé pour être compréhensible sans formation en développement.

---

## Sommaire

1. [Vue d'ensemble de l'application](#1-vue-densemble-de-lapplication)
2. [Architecture du projet](#2-architecture-du-projet)
3. [Les types de données (`src/types/`)](#3-les-types-de-données-srctypes)
4. [Les constantes (`src/constants/`)](#4-les-constantes-srcconstants)
5. [La base de données locale (`src/lib/`)](#5-la-base-de-données-locale-srclib)
6. [Le store — mémoire vive de l'application (`src/store/`)](#6-le-store--mémoire-vive-de-lapplication-srcstore)
7. [Les moteurs de calcul (`src/engine/`)](#7-les-moteurs-de-calcul-srcengine)
8. [Les utilitaires (`src/utils/`)](#8-les-utilitaires-srcutils)
9. [Les pages (`src/app/`)](#9-les-pages-srcapp)
10. [Les composants d'interface (`src/components/`)](#10-les-composants-dinterface-srccomponents)
11. [Les tests automatiques](#11-les-tests-automatiques)
12. [Flux de données complet](#12-flux-de-données-complet)
13. [Guide de maintenance rapide](#13-guide-de-maintenance-rapide)

---

## 1. Vue d'ensemble de l'application

TILEA est une application web de **calepinage de carrelage**. Elle permet de :

1. **Dessiner un plan 2D** d'une ou plusieurs pièces (murs, portes).
2. **Simuler la pose** du carrelage en choisissant le format des carreaux, le joint, la disposition (droit, bâton rompu, pointe de hongrie) et d'autres paramètres.
3. **Calculer les quantités** : nombre de carreaux entiers, nombre de coupes, optimisation des chutes, quantité à commander avec marge.

L'application fonctionne **entièrement dans le navigateur** — aucun serveur, aucune connexion réseau requise. Les projets sont sauvegardés dans le navigateur lui-même (IndexedDB).

**Technologies principales :**

| Technologie | Rôle |
|---|---|
| **Next.js 14** | Cadre applicatif React (routage, pages) |
| **React 18** | Bibliothèque d'interface utilisateur |
| **TypeScript** | JavaScript avec types stricts (moins de bugs) |
| **Tailwind CSS** | Styles visuels écrits directement dans le code |
| **Zustand** | Gestion de l'état global (mémoire partagée entre composants) |
| **IndexedDB / idb** | Base de données locale dans le navigateur |
| **Vitest** | Tests automatiques |

---

## 2. Architecture du projet

```
src/
├── app/                  ← Pages de l'application (routage Next.js)
│   ├── page.tsx          ← Page d'accueil (liste des projets)
│   ├── layout.tsx        ← Enveloppe HTML commune à toutes les pages
│   ├── globals.css       ← Styles globaux (police, couleurs de base)
│   └── project/[id]/
│       └── page.tsx      ← Espace de travail d'un projet (3 onglets)
│
├── components/           ← Composants d'interface réutilisables
│   ├── home/             ← Écran d'accueil
│   ├── plan/             ← Éditeur de plan 2D
│   ├── tiling/           ← Éditeur de calepinage
│   ├── quantities/       ← Panneau quantitatif
│   ├── results/          ← Résumé des stats de calepinage
│   └── ui/               ← Composants génériques (bouton, champ texte…)
│
├── engine/               ← Calculs purs (géométrie, calepinage, quantités)
│   ├── geometry/         ← Outils mathématiques (polygones, intersections…)
│   ├── tiling/           ← Génération de la grille de carreaux
│   ├── quantities/       ← Analyse détaillée des coupes
│   └── export/           ← Adaptateur d'export
│
├── store/
│   └── projectStore.ts   ← État global : projets, pièces, config
│
├── lib/
│   └── db.ts             ← Accès à la base de données IndexedDB
│
├── types/                ← Définitions des structures de données
│   ├── plan.ts           ← Point, Plan
│   ├── project.ts        ← Room, Project, EdgeType
│   └── tiling.ts         ← TilingConfig, Tile, TilingStats…
│
├── constants/
│   ├── businessRules.ts  ← Valeurs métier (marges, tolérances…)
│   └── tileDefaults.ts   ← Configuration de calepinage par défaut
│
└── utils/
    ├── formatters.ts     ← Formatage des nombres (cm, m²)
    ├── id.ts             ← Génération d'identifiants uniques
    └── units.ts          ← Conversions mm ↔ cm ↔ m²
```

---

## 3. Les types de données (`src/types/`)

Les fichiers de types définissent la **forme** des données manipulées dans toute l'application. Ils ne contiennent pas de logique — uniquement des descriptions.

### `plan.ts`

```
Point  →  un point dans l'espace : { x, y }  (en millimètres)
Plan   →  une liste de Point (le contour d'une pièce)
```

### `project.ts`

```
EdgeType  →  'WALL' (mur) ou 'DOOR' (porte)

Room  →  une pièce :
  - id        : identifiant unique
  - name      : nom optionnel ("Salon", "Salle de bain"…)
  - points    : liste de Point formant le contour
  - edges     : pour chaque côté, 'WALL' ou 'DOOR'

Project  →  un projet complet :
  - id, name
  - createdAt, updatedAt  : timestamps de création/modification
  - rooms                 : liste de Room
  - config                : la configuration de calepinage (TilingConfig)
  - wallThickness         : épaisseur des murs (mm), utilisée à l'affichage
```

### `tiling.ts`

```
TileLayout  →  'STRAIGHT' | 'HERRINGBONE' | 'CHEVRON'

TilingConfig  →  tous les paramètres de calepinage :
  - width, height     : dimensions du carreau (mm)
  - joint             : largeur du joint (mm)
  - offsetX, offsetY  : décalage de la grille (mm)
  - stagger           : décalage de rang (0, 33 ou 50 %)
  - angle             : rotation globale du calepinage (0–90°)
  - chevronAngle      : angle d'ouverture de la pointe de hongrie (15–75°)
  - color             : couleur des carreaux entiers (code hexadécimal)
  - layout            : mode de pose (TileLayout)

TileRect  →  rectangle d'un carreau : { x, y, w, h }
TileType  →  'WHOLE' (entier) | 'CUT' (coupé) | 'OUTSIDE' (hors pièce)

Tile  →  un carreau calculé :
  - id     : identifiant unique (basé sur sa position)
  - rect   : son rectangle (TileRect)
  - type   : WHOLE / CUT / OUTSIDE
  - points : (optionnel) liste de Point pour les carreaux polygonaux (chevron)

TilingStats  →  résultats globaux :
  - whole, cuts, total : comptages
  - toOrder            : quantité à commander (avec marge)
  - roomArea           : surface de la pièce (mm²)
  - wastePercent       : pourcentage de chute
```

---

## 4. Les constantes (`src/constants/`)

### `businessRules.ts`

Ce fichier centralise les **règles métier** modifiables sans toucher à la logique :

| Constante | Valeur | Signification |
|---|---|---|
| `SNAP_GRID_MM` | 50 mm | Pas de la grille d'aimantation dans l'éditeur de plan |
| `CLOSING_TOLERANCE_MM` | 200 mm | Distance maximale pour fermer automatiquement une forme |
| `ORDER_MARGIN_RATIO` | 0.10 | Majoration de 10 % sur la quantité à commander |
| `WASTE_WARNING_THRESHOLD` | 15 % | Seuil d'alerte chute (non encore utilisé visuellement) |
| `WALL_THICKNESS_MM` | 100 mm | Épaisseur des murs par défaut |
| `DOOR_DEFAULT_WIDTH_MM` | 900 mm | Largeur d'une porte insérée par défaut |

> **Pour modifier la marge de commande**, changer `ORDER_MARGIN_RATIO`. Ex : `0.15` = 15 %.

### `tileDefaults.ts`

Définit la **configuration initiale** d'un nouveau calepinage :

```
DEFAULT_TILING_CONFIG :
  width: 300, height: 600   → carreau 30×60 cm
  joint: 3                  → joint de 3 mm
  stagger: 33               → décalage d'un tiers
  angle: 0                  → pas de rotation
  chevronAngle: 45          → angle classique pour la pointe de hongrie
  color: '#93c5fd'          → bleu clair
  layout: 'STRAIGHT'        → pose droite
```

Contient aussi les listes de presets affichés dans l'interface :
- `STAGGER_PRESETS` : 0 %, 33 %, 50 %
- `COLOR_PRESETS` : 5 couleurs proposées
- `LAYOUT_PRESETS` : Droit, Bâton rompu, Pte de hongrie

---

## 5. La base de données locale (`src/lib/`)

### `db.ts`

Ce fichier ouvre et gère une **base de données IndexedDB** dans le navigateur. IndexedDB est un système de stockage persistant : les données survivent à la fermeture du navigateur, sans serveur.

La base s'appelle `TileLayoutProDB` et contient une seule table (`projects`), indexée par l'`id` du projet.

**Quatre opérations disponibles :**

| Méthode | Action |
|---|---|
| `projectsDb.getAll()` | Récupère tous les projets |
| `projectsDb.get(id)` | Récupère un projet par son id |
| `projectsDb.save(project)` | Crée ou met à jour un projet |
| `projectsDb.delete(id)` | Supprime un projet |

> Ce fichier ne se modifie que si la structure des données change (ajout d'un nouveau champ obligatoire nécessitant une migration de schéma).

---

## 6. Le store — mémoire vive de l'application (`src/store/`)

### `projectStore.ts`

C'est le **cerveau de l'application**. Il centralise l'état (les données en cours d'utilisation) et expose des actions pour le modifier. Tous les composants d'interface y accèdent via le hook `useProjectStore`.

**État stocké :**
- `projects` : liste de tous les projets chargés
- `activeProjectId` : l'id du projet actuellement ouvert
- `hydrated` : booléen indiquant si les données ont été chargées depuis IndexedDB

**Actions disponibles :**

| Action | Effet |
|---|---|
| `hydrate()` | Charge les projets depuis IndexedDB au démarrage |
| `create()` | Crée un nouveau projet vide et le sauvegarde |
| `rename(id, name)` | Renomme un projet |
| `remove(id)` | Supprime un projet |
| `setActive(id)` | Définit le projet actif |
| `addRoom()` | Ajoute une pièce vide au projet actif |
| `removeRoom(roomId)` | Supprime une pièce |
| `updateRoom(roomId, points, edges)` | Met à jour le contour et les types de bords d'une pièce |
| `renameRoom(roomId, name)` | Renomme une pièce |
| `setConfig(config)` | Met à jour la configuration de calepinage |
| `setWallThickness(mm)` | Change l'épaisseur des murs |

**Fonction `migrateProject`** : lors du chargement depuis IndexedDB, cette fonction assure la **compatibilité avec d'anciens formats** de données. Elle reconstitue les champs manquants (ex. : un projet sans `rooms` est converti depuis l'ancien format `plan`). Elle ajoute aussi `chevronAngle` et `layout` s'ils manquent (anciens projets sans ces champs).

---

## 7. Les moteurs de calcul (`src/engine/`)

Ces fichiers contiennent la **logique mathématique pure** : pas d'interface, pas d'état global — seulement des fonctions qui prennent des données en entrée et retournent un résultat.

### `engine/geometry/polygon.ts`

Boîte à outils de **géométrie plane** :

| Fonction | Rôle |
|---|---|
| `distance(p1, p2)` | Distance euclidienne entre deux points |
| `angle(p1, p2)` | Angle en radians entre deux points |
| `getPolygonArea(pts)` | Aire d'un polygone (formule du lacet de Shoelace) |
| `pointInPolygon(point, vs)` | Test d'inclusion point-dans-polygone (ray casting) |
| `getIntersection(A,B,C,D)` | Calcule l'intersection de deux segments |
| `rotatePoint(x,y,angle,cx,cy)` | Rotation d'un point autour d'un centre |
| `getPointOnSegment(p,a,b)` | Projection d'un point sur un segment (pour l'aimantation) |
| `getBoundingBox(pts)` | Rectangle englobant une liste de points |

### `engine/geometry/clipping.ts`

Détermine si un carreau est **entier, coupé ou hors pièce** :

- **`classifyTile(rect, roomPoly, edges?)`** : pour les carreaux rectangulaires (STRAIGHT et HERRINGBONE). Teste si les 4 coins sont dans la pièce. Gère les portes (les carreaux aux bords d'une porte ne sont pas faussement classifiés comme coupés).
- **`classifyPolygonTile(tilePoints, roomPoly)`** : pour les carreaux polygonaux (CHEVRON). Version simplifiée : teste si les sommets du parallélogramme sont dans la pièce.

### `engine/geometry/clipper.ts`

Implémente l'**algorithme de Sutherland–Hodgman** : découpe un polygone selon un autre polygone. Utilisé dans le quantitatif pour calculer précisément la portion visible d'un carreau coupé.

### `engine/geometry/grid.ts`

Fonction utilitaire `buildGrid` partagée entre les différents moteurs pour construire les bornes d'une grille de tuiles (point de départ, point d'arrivée, pas horizontal et vertical).

### `engine/tiling/tilingEngine.ts`

C'est le **moteur principal de calepinage**. Il génère la liste complète des carreaux à afficher.

**`buildGrid(centerX, centerY, maxRadius, config)`**  
Calcule les bornes de la grille à générer : assez grande pour couvrir toute la pièce + marges de sécurité.

**`buildHerringbonePositions(centerX, centerY, maxRadius, config)`**  
Génère les positions des carreaux en **bâton rompu** via un réseau diagonal :
- Vecteurs de base : `(H, H)` et `(W, -W)` où W = largeur, H = longueur du carreau
- Chaque cellule du réseau place 2 carreaux formant un L :
  - Carreau 1 (horizontal) : largeur H, hauteur W
  - Carreau 2 (vertical) : décalé de (H-W, W), dimensions W×H

**`computeTiling(plan, config)`**  
Calcule le calepinage pour **une seule pièce** :
1. Calcule le centre et le rayon maximal de la pièce
2. Si l'angle ≠ 0, fait pivoter la pièce dans le repère inverse (pour aligner la grille avec les axes)
3. Selon le layout (`STRAIGHT` / `HERRINGBONE` / `CHEVRON`), génère les positions des carreaux
4. Pour chaque position, classifie le carreau (WHOLE / CUT / OUTSIDE)
5. Retourne la liste des carreaux et les statistiques

**`computeTilingMultiRoom(rooms, config)`**  
Même logique mais pour **plusieurs pièces** simultanément. La grille est commune (centrée sur l'ensemble des pièces) ; un carreau est conservé s'il est à l'intérieur d'au moins une pièce.

**Géométrie CHEVRON :**  
Les carreaux sont des parallélogrammes. L'inclinaison est controlée par `chevronAngle` :
- `dy = height × tan(chevronAngle)` : décalage vertical entre les deux extrémités horizontales
- Colonnes paires : inclinées à droite. Colonnes impaires : inclinées à gauche.
- Les dimensions `width` et `height` restent constantes quelle que soit la valeur de l'angle.

### `engine/tiling/cutCalculator.ts`

**`computeStats(tiles, roomArea, tileWidth, tileHeight)`**  
Calcule les statistiques globales à partir de la liste des carreaux :
- Compte les carreaux entiers et coupés
- Calcule le pourcentage de chute (surface achetée − surface utile)
- Ajoute la marge de commande (`ORDER_MARGIN_RATIO`)

### `engine/tiling/offsetCalculator.ts`

Utilitaire pour calculer les offsets de la grille (non encore utilisé dans l'interface principale — présent pour usage futur).

### `engine/quantities/quantityEngine.ts`

Analyse avancée des **coupes** pour le quantitatif :

**`computeCutDimensions(tile, roomPolygons, tileW, tileH)`**  
Pour un carreau coupé, calcule :
- `usedW × usedH` : dimensions du morceau réellement utilisé
- `chuteW × chuteH` : dimensions de la plus grande chute rectangulaire récupérable

**`optimizeReuse(cuts)`** (algorithme glouton)  
Parcourt les coupes triées par surface croissante. Pour chaque coupe, vérifie si une chute précédente peut la couvrir (en orientation normale ou pivotée à 90°). Réduit le nombre de carreaux à acheter.

**`groupCuts(cuts)`**  
Regroupe les coupes identiques (même `usedW × usedH`) pour produire une liste de commande consolidée.

**`analyzeQuantities(rooms, config)`**  
Point d'entrée principal : orchestre toutes les étapes et retourne un `QuantityResult` complet utilisé par le panneau quantitatif.

### `engine/export/exportAdapter.ts`

Adaptateur pour l'export (PDF, impression). Prépare les données dans un format adapté à l'impression via `window.print()`.

---

## 8. Les utilitaires (`src/utils/`)

### `formatters.ts`

| Fonction | Entrée | Sortie |
|---|---|---|
| `formatCm(mm)` | 3050 mm | `"305.0 cm"` |
| `formatM2(mm2)` | 12500000 mm² | `"12.50 m²"` |

### `units.ts`

Conversions entre unités :
- `mmToCm(mm)` : divise par 10
- `mm2ToM2(mm2)` : divise par 1 000 000
- `screenToWorld(screenCoord, scale, panOffset)` : convertit une coordonnée écran en coordonnée monde (tient compte du zoom et du déplacement)

### `id.ts`

`generateId()` : génère un identifiant unique aléatoire (utilisé pour les projets et les pièces).

---

## 9. Les pages (`src/app/`)

### `layout.tsx`

Enveloppe HTML racine : définit la balise `<html>`, la police (Geist), les métadonnées par défaut.

### `globals.css`

Variables CSS globales (couleurs Tailwind, police) + reset de base.

### `page.tsx` — Page d'accueil

Affiche :
- Une barre latérale (logo TILEA, navigation, bouton "Nouveau projet")
- La liste des projets existants (`ProjectList`)

Comportement :
- Au chargement, appelle `hydrate()` pour récupérer les projets depuis IndexedDB
- "Nouveau projet" → crée un projet et navigue vers son espace de travail
- Clic sur un projet → ouvre l'espace de travail
- Suppression → demande confirmation, puis supprime

### `project/[id]/page.tsx` — Espace de travail

C'est la page principale. Elle contient 3 onglets :

| Onglet | Composant | Condition d'accès |
|---|---|---|
| 1. Plan 2D | `PlanEditor` | Toujours accessible |
| 2. Calepinage | `TilingEditor` | Au moins une pièce avec ≥ 3 points |
| 3. Quantitatif | `QuantitiesPanel` | Même condition |

En-tête : nom du projet (éditable en ligne), indicateur "Sauvegardé", bouton PDF.

**Impression PDF** : injecte temporairement un `<style>` masquant tout sauf `#print-target`, puis appelle `window.print()`. Le style est retiré après impression.

---

## 10. Les composants d'interface (`src/components/`)

### Composants génériques (`ui/`)

**`Button.tsx`**  
Bouton avec plusieurs variantes (`primary`, `secondary`, `ghost`) et tailles (`sm`, `md`, `icon`). Accepte des enfants React (texte, icône).

**`Input.tsx`**  
Champ de saisie avec label flottant. Accepte tous les attributs HTML standard (`type`, `value`, `onChange`, `onBlur`, `onKeyDown`…).

**`StepIndicator.tsx`**  
Indicateur visuel d'étapes (non visible actuellement dans l'interface principale).

---

### Composants d'accueil (`home/`)

**`ProjectCard.tsx`**  
Carte d'un projet : affiche le nom, la date de modification, et les boutons ouvrir/supprimer.

**`ProjectList.tsx`**  
Liste les projets avec `ProjectCard`. Si la liste est vide, affiche un écran d'invitation à créer le premier projet.

---

### Composants éditeur de plan (`plan/`)

**`PlanEditor.tsx`** — Chef d'orchestre du dessin

Gère tout l'état local du dessin :
- `tool` : outil actif (`WALL` pour dessiner, `SELECT` pour sélectionner/déplacer, `DOOR` pour placer une porte)
- `scale` / `pan` : zoom et déplacement de la vue
- `draggedVertex` : sommet en cours de déplacement
- `editingEdge` : côté en cours d'édition dimensionnelle
- `snapPreview` : indicateur d'aimantation visuelle
- `originPoint` : repère d'origine placé par Alt+clic

Logique d'aimantation (`snapPos`) :
1. Aimantation sur les sommets existants (si distance < 30 px / scale)
2. Aimantation sur les bords des pièces fermées
3. Aimantation sur la grille (pas de 50 mm)
4. Orthogonalité si Shift enfoncé ou si le mouvement est quasi-horizontal/vertical

**`DrawingCanvas.tsx`** — Surface SVG de dessin

Reçoit toutes les données calculées par `PlanEditor` et les dessine en SVG :
- La grille de fond (lignes tous les 50 mm, marqueurs kilométriques tous les 500 mm)
- Le contour de chaque pièce (murs en orange, portes en tirets)
- Les sommets (cercles déplaçables)
- Les cotes des côtés
- L'aperçu du prochain point (ligne fantôme)
- L'indicateur d'aimantation (vertex = cercle, edge = croix)
- L'origine marquée (Alt+clic)

**`PlanToolbar.tsx`** — Barre d'outils gauche

Contient les boutons d'outil (Dessin / Sélection / Porte), les boutons Annuler / Réinitialiser, la gestion des pièces multiples (liste, ajout, suppression, renommage), et le champ "Épaisseur des murs".

**`DimensionEditor.tsx`** — Éditeur de cote

Popover flottant qui apparaît quand on clique sur un côté. Permet de saisir une dimension précise en cm, ou de forcer l'alignement horizontal/vertical du côté.

---

### Composants éditeur de calepinage (`tiling/`)

**`TilingEditor.tsx`** — Chef d'orchestre du calepinage

- Appelle `computeTilingMultiRoom` via `useMemo` (recalcul uniquement quand les pièces ou la config changent)
- Gère le zoom/déplacement de la vue SVG
- Contient la barre flottante en bas : toggle côtes, curseur angle, curseurs décalage X/Y
- Compose `TilingCanvas` (visualisation) + `TilingControls` (paramètres) + `ResultsPanel` (stats)

**`TilingCanvas.tsx`** — Rendu SVG du calepinage

Affiche en SVG :
- Les fonds de pièce (polygones noirs)
- Les carreaux via `<clipPath>` (les carreaux sont dessinés "infinis", le clipPath les masque hors pièce)
- Les carreaux entiers dans la couleur configurée, les coupés en gris zinc
- Les murs et portes (lignes colorées)
- Les cotes dimensionnelles (`DimLine`) quand la pose est STRAIGHT à 0° et que l'option est activée

Le composant `DimLine` dessine une ligne de cote SVG avec extrémités en T, ligne principale, et un label dans un rectangle arrondi.

**`TilingControls.tsx`** — Panneau de paramètres droite

Contient tous les champs de configuration :
- Largeur et longueur du carreau (en mm)
- Largeur du joint
- Sélecteur du mode de pose (3 boutons)
- Angle de coupe (uniquement pour CHEVRON, validé entre 15° et 75°)
- Décalage de rang (uniquement pour STRAIGHT : 0 %, 33 %, 50 %)

Chaque champ numérique valide la saisie **au blur (perte de focus) ou à la touche Entrée**. Si la valeur est invalide, elle est réinitialisée à la valeur courante de la config.

---

### Composant quantitatif (`quantities/`)

**`QuantitiesPanel.tsx`**

Appelle `analyzeQuantities` et affiche :
- Un résumé (carreaux entiers, coupes, total, à commander)
- Un tableau détaillé des coupes par groupe de dimensions identiques
- Les informations de chute et de réutilisation

---

### Composant résultats (`results/`)

**`ResultsPanel.tsx`**

Affiche le résumé rapide des statistiques de calepinage : carreaux entiers / coupés / total / à commander / surface / pourcentage de chute. Apparaît dans la barre latérale du calepinage.

---

## 11. Les tests automatiques

Les fichiers `.test.ts` contiennent des **tests unitaires** vérifiables automatiquement avec `npm test`.

| Fichier de test | Ce qu'il teste |
|---|---|
| `polygon.test.ts` | Les fonctions géométriques (distance, aire, intersection…) |
| `clipping.test.ts` | La classification WHOLE/CUT/OUTSIDE des carreaux |
| `tilingEngine.test.ts` | La génération correcte de grilles de carreaux |
| `formatters.test.ts` | La mise en forme des valeurs (cm, m²) |

Pour lancer les tests : `npm test`  
Pour les lancer en mode surveillance (relance automatique) : `npm run test:watch`

---

## 12. Flux de données complet

```
Utilisateur dessine une pièce
        │
        ▼
PlanEditor (composant)
  ├─ detecte clic → calcule position (snapPos)
  ├─ appelle updateRoom() du store
  └─ le store sauvegarde dans IndexedDB
        │
        ▼
DrawingCanvas reçoit les nouvelles données
  └─ re-render SVG (React le fait automatiquement)
        │
        ▼
Utilisateur bascule sur l'onglet Calepinage
        │
        ▼
TilingEditor monte
  └─ useMemo appelle computeTilingMultiRoom(rooms, config)
        │
        ▼
tilingEngine.ts
  ├─ buildGrid ou buildHerringbonePositions
  ├─ pour chaque carreau : classifyTile / classifyPolygonTile
  └─ retourne { tiles: Tile[], stats: TilingStats }
        │
        ▼
TilingCanvas reçoit tiles + config
  └─ dessine en SVG avec clipPath
        │
ResultsPanel reçoit stats
  └─ affiche les comptages
        │
        ▼
Utilisateur bascule sur Quantitatif
        │
        ▼
QuantitiesPanel
  └─ appelle analyzeQuantities(rooms, config)
        ├─ computeCutDimensions pour chaque coupe
        ├─ optimizeReuse (algorithme de réutilisation des chutes)
        └─ groupCuts → tableau de commande
```

---

## 13. Guide de maintenance rapide

### Modifier la marge de commande (ex. passer de 10 % à 15 %)

Fichier : [src/constants/businessRules.ts](src/constants/businessRules.ts)  
Ligne : `export const ORDER_MARGIN_RATIO = 0.10;`  
Changer `0.10` en `0.15`.

### Modifier la configuration par défaut d'un nouveau projet

Fichier : [src/constants/tileDefaults.ts](src/constants/tileDefaults.ts)  
Modifier les valeurs dans `DEFAULT_TILING_CONFIG`.

### Ajouter un nouveau mode de pose

1. Dans [src/types/tiling.ts](src/types/tiling.ts) : ajouter le nom à `TileLayout`
2. Dans [src/constants/tileDefaults.ts](src/constants/tileDefaults.ts) : ajouter une entrée dans `LAYOUT_PRESETS`
3. Dans [src/engine/tiling/tilingEngine.ts](src/engine/tiling/tilingEngine.ts) : ajouter un bloc `if (layout === 'NOUVEAU_MODE')` dans `computeTiling` et `computeTilingMultiRoom`

### Ajouter une couleur dans les presets

Fichier : [src/constants/tileDefaults.ts](src/constants/tileDefaults.ts)  
Ajouter un code hexadécimal dans le tableau `COLOR_PRESETS`.

### Modifier l'épaisseur de mur par défaut

Fichier : [src/constants/businessRules.ts](src/constants/businessRules.ts)  
Ligne : `export const WALL_THICKNESS_MM = 100;`

### Ajouter un champ à la configuration de calepinage

1. [src/types/tiling.ts](src/types/tiling.ts) : ajouter la propriété dans `TilingConfig`
2. [src/constants/tileDefaults.ts](src/constants/tileDefaults.ts) : ajouter la valeur par défaut dans `DEFAULT_TILING_CONFIG`
3. [src/store/projectStore.ts](src/store/projectStore.ts) dans `migrateProject` : ajouter `newField: rawConfig.newField ?? defaultValue` pour la compatibilité avec les anciens projets
4. [src/components/tiling/TilingControls.tsx](src/components/tiling/TilingControls.tsx) : ajouter le contrôle dans l'interface
5. [src/engine/tiling/tilingEngine.ts](src/engine/tiling/tilingEngine.ts) : utiliser la valeur dans les calculs

### Comprendre pourquoi un carreau est classé CUT au lieu de WHOLE

Le fichier à consulter est [src/engine/geometry/clipping.ts](src/engine/geometry/clipping.ts), fonction `classifyTile`. Un carreau est WHOLE si ses 4 coins sont dans la pièce **et** qu'aucun sommet de la pièce n'est à l'intérieur du carreau (cas d'un angle rentrant). La logique porte spéciale exclut les points aux extrémités des segments de porte de ce test.

---

*Document généré le 2026-04-24 pour la version du projet sur la branche `claude/analyze-test-coverage-053gw`.*
