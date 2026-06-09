# Quantitatifs — Refonte précision et consommables — Design Spec

## Objectif

Corriger les deux sources de sur-estimation du calcul de carreaux (algorithme de réemploi trop restrictif, marge non calibrée) et ajouter les consommables de pose (colle, joint, croisillons) avec des valeurs par défaut éditables.

---

## Section 1 — Correction du calcul des carreaux

### 1.1 Algorithme de réemploi des chutes (`assignOffcuts.ts`)

**Problème actuel :** `canReuseFor` rejette des réemplois valides car la tolérance dimensionnelle de 5mm est trop stricte. Un carreleur peut réemployer une chute avec jusqu'à ~10mm de différence (précision réaliste d'une coupe sur chantier).

**Correction :**
- Tolérance dimensionnelle : `CUT_TOLERANCE_MM` passe de **5mm à 10mm**
- Les 4 rotations (0°, 90°, 180°, 270°) sont conservées — elles couvrent tous les cas pour un carreau rectangulaire
- La contrainte de bord d'origine est **maintenue** : les arêtes d'usine (factory edges) doivent toujours faire face aux carreaux adjacents ; seules les arêtes coupées peuvent faire face aux murs/bords
- Le seuil de viabilité chute (`MIN_CHUTE_MM = 50mm`) est inchangé — conforme aux pratiques du marché

**Impact attendu :** augmentation du taux de réemploi → réduction du nombre de carreaux neufs nécessaires pour les chutes.

### 1.2 Marge de sécurité auto-calibrée

**Problème actuel :** marge fixe de 10% quelle que soit la pose. Excessive pour une pose droite simple, insuffisante pour du chevron.

**Nouvelle logique :**

| Type de pose | Marge par défaut |
|---|---|
| Droite (`angle === 0`, layout `straight`) | 5% |
| Diagonal (`angle === 45`) | 10% |
| Chevron / arête-de-poisson (`layout === 'chevron'` ou `'herringbone'`) | 15% |

La marge est calculée dans `quantityEngine.ts` à partir de `config.angle` et `config.layout`. Elle est exposée dans `QuantityResult.margin` (nombre décimal, ex. `0.05`).

**Override manuel :** le carreleur peut saisir une marge personnalisée dans l'interface (ex. 20% pour un chantier complexe). Ce override est stocké dans `TilingConfig.marginOverride?: number`. S'il est défini, il prend le dessus sur la marge auto.

```typescript
// Calcul dans quantityEngine.ts
function computeMargin(config: TilingConfig): number {
  if (config.marginOverride !== undefined) return config.marginOverride;
  if (config.layout === 'chevron' || config.layout === 'herringbone') return 0.15;
  if (config.angle === 45) return 0.10;
  return 0.05;
}
```

`toOrder` reste : `ceil(totalTiles × (1 + margin))`

---

## Section 2 — Consommables

### 2.1 Nouveau champ : épaisseur du carreau

Ajout dans `TilingConfig` :

```typescript
tileThickness?: number; // mm, défaut 10
```

Ce champ est nécessaire pour la formule du joint (ISO 13007). Il est saisi dans le panneau quantitatifs (pas dans la config carrelage) car c'est une donnée de chantier, pas de design.

### 2.2 Nouveau type : `Consumables`

```typescript
// src/engine/quantities/types.ts
interface ConsumableItem {
  totalKg: number;       // quantité totale en kg (ou unités pour croisillons)
  bags: number;          // nombre de conditionnements (arrondi au-dessus)
  bagSize: number;       // taille d'un conditionnement (kg ou unités)
  rendement: number;     // rendement unitaire (kg/m² ou unités/carreau)
}

interface Consumables {
  colle: ConsumableItem;
  joint: ConsumableItem;
  croisillons: ConsumableItem; // totalKg = total unités, bags = sachets
}
```

`QuantityResult` est étendu :

```typescript
interface QuantityResult {
  // ... champs existants ...
  margin: number;          // marge appliquée (ex. 0.05)
  consumables: Consumables;
}
```

### 2.3 Formules de calcul

#### Colle

```
rendement_défaut = 4 kg/m²   (colle C2 standard)
total_kg = surface_m² × rendement
bags = ceil(total_kg / bag_size)   // bag_size défaut = 25 kg
```

#### Joint (formule ISO 13007)

```
rendement (kg/m²) = ((L + l) / (L × l)) × e × j × ρ × 1.05

  L = tileW en mm
  l = tileH en mm
  e = tileThickness en mm (défaut 10)
  j = joint en mm (déjà dans TilingConfig)
  ρ = 1.6 kg/dm³ (densité joint ciment standard)

total_kg = rendement × surface_m²
bags = ceil(total_kg / bag_size)   // bag_size défaut = 5 kg
```

#### Croisillons

```
// totalTiles = carreaux effectivement posés (avant marge)
total_unités = ceil(totalTiles × 1.2)
sachets = ceil(total_unités / bag_size)   // bag_size défaut = 200 unités
```

### 2.4 Paramètres éditables

Le carreleur peut modifier dans l'interface :

| Paramètre | Défaut | Modifiable |
|---|---|---|
| Rendement colle (kg/m²) | 4 | ✓ |
| Taille sac colle (kg) | 25 | ✓ |
| Rendement joint (kg/m²) | calculé ISO | ✓ (override) |
| Taille sac joint (kg) | 5 | ✓ |
| Taille sachet croisillons (unités) | 200 | ✓ |
| Épaisseur carreau (mm) | 10 | ✓ |

Ces paramètres sont stockés dans `TilingConfig` (sous `consumableParams?: ConsumableParams`) pour être persistés avec le projet.

```typescript
interface ConsumableParams {
  colleRendement?: number;       // kg/m², défaut 4
  colleBagSize?: number;         // kg, défaut 25
  jointRendement?: number;       // kg/m², si défini override ISO
  jointBagSize?: number;         // kg, défaut 5
  croisillonsBagSize?: number;   // unités, défaut 200
  tileThickness?: number;        // mm, défaut 10
}
```

---

## Section 3 — Interface

### 3.1 Panneau quantitatifs (`QuantitiesPanel.tsx`)

**Structure (Option A — bloc consommables sous le résumé) :**

```
┌──────────────────────────────────────────────────┐
│ RÉSUMÉ                                           │
│  142 carreaux    12,4 m²    Marge : 5% [✏]      │
├──────────────────────────────────────────────────┤
│ ▼ CONSOMMABLES              [épaisseur: 10mm ✏] │
│  Colle C2   3 sacs    4 kg/m² [✏]  25kg/sac [✏] │
│  Joint 3mm  2 sacs    0,8 kg/m² [✏] 5kg/sac [✏] │
│  Croisil.   2 sachets 200/sachet [✏]             │
├──────────────────────────────────────────────────┤
│ Vue plan SVG                                     │
├──────────────────────────────────────────────────┤
│ Groupes de coupe                                 │
└──────────────────────────────────────────────────┘
```

- Le bloc "Consommables" est plié par défaut, déplié au clic (état local React)
- La marge s'affiche avec un crayon `[✏]` ouvrant un petit input inline
- Chaque rendement et taille de sac est éditable inline via un input numérique

### 3.2 Rapport imprimé (`QuantitiesPrintView.tsx`)

Ajout d'une section **"Récapitulatif chantier"** en tête du rapport, avant les sections par pièce :

```
┌────────────────────────────────────────────┐
│ RÉCAPITULATIF CHANTIER                     │
│  Surface totale : 12,4 m²                  │
│  Carreaux à commander : 142 (marge +5%)    │
│  Colle : 3 sacs × 25 kg                   │
│  Joint : 2 sacs × 5 kg                    │
│  Croisillons : 2 sachets × 200 unités      │
│  Épaisseur carreau : 10 mm                 │
└────────────────────────────────────────────┘
```

Le reste du rapport (sections par pièce, groupes de coupe) reste inchangé.

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/types/tiling.ts` | Ajouter `marginOverride?: number` et `consumableParams?: ConsumableParams` à `TilingConfig` |
| `src/constants/businessRules.ts` | Ajouter `MARGIN_STRAIGHT`, `MARGIN_DIAGONAL`, `MARGIN_CHEVRON` |
| `src/engine/quantities/constants.ts` | `CUT_TOLERANCE_MM` : 5 → 10 |
| `src/engine/quantities/assignOffcuts.ts` | Vérifier que la tolérance est correctement appliquée dans `canReuseFor` |
| `src/engine/quantities/types.ts` | Ajouter `ConsumableItem`, `Consumables`, étendre `QuantityResult` |
| `src/engine/quantities/quantityEngine.ts` | Ajouter `computeMargin()`, `computeConsumables()`, exposer dans `QuantityResult` |
| `src/components/quantities/QuantitiesPanel.tsx` | Affichage marge + bloc consommables éditables |
| `src/components/quantities/QuantitiesPrintView.tsx` | Section "Récapitulatif chantier" en tête |
| `src/engine/quantities/quantityEngine.integration.test.ts` | Tests marge auto par type de pose |
| `src/engine/quantities/assignOffcuts.test.ts` | Tests réemploi avec tolérance 10mm |

---

## Hors périmètre

- Calcul du coût matière (prix au m² ou à l'unité)
- Estimation du temps de pose ou coût main-d'œuvre
- Distinction carrelage mural / sol (même logique)
- Optimisation de nesting géométrique des chutes
- Croisillons autopositionnants (système DLS/LLS) — même calcul d'unités
