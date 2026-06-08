# Édition des AutoCotations — Design

**Date :** 2026-06-05

## Contexte

Le système `AutoCotation` calcule automatiquement des côtes sur le périmètre extérieur et intérieur de chaque pièce dans l'éditeur de plan (`WallDrawingCanvas`). Ces côtes sont actuellement affichées en lecture seule (`pointer-events-none`). L'objectif est de les rendre éditables : cliquer sur un label → panneau flottant → saisir une nouvelle valeur → le mur se déplace physiquement.

Le système manuel `TilingDimension` (session précédente) est abandonné côté UI : le bouton "Côtes" est masqué dans `TilingEditor`. Le code reste en place (archivé).

## Contrainte technique

`AutoCotation` contient `wallId`, `side`, `anchor1`, `anchor2`. Le mur correspondant donne directement `node1Id` et `node2Id` — pas de snap nécessaire contrairement à l'ancien système.

## Règle d'ancrage

**`node1` est toujours fixe. `node2` se déplace** le long de la direction normalisée du mur (`normalize(node2 - node1)`).

## Calcul du déplacement

La valeur affichée dans le label est la distance anchor1→anchor2 (pas nécessairement la distance nœud à nœud). La conversion :

| `side` | Formule | Raison |
|--------|---------|--------|
| `exterior` | `node_dist = label_mm − thickness` | Les coins du polygone extérieur débordent de `t/2` de chaque côté |
| `interior` | `node_dist = label_mm + thickness` | Les coins intérieurs sont en retrait de `t/2` de chaque côté |
| `isolated` | `node_dist = label_mm` | `anchor1 = node1`, `anchor2 = node2` (direct) |

Approximation exacte pour les coins à 90°, acceptable pour les autres angles.

Position finale de `node2` :

```ts
const dir = normalize(node2 - node1);
const newNode2 = { x: node1.x + dir.x * node_dist, y: node1.y + dir.y * node_dist };
```

## Architecture

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `src/components/plan/AutoCotationPanel.tsx` | Panneau flottant d'édition + fonction pure `computeNewNode2` |
| `src/components/plan/AutoCotationPanel.test.ts` | Tests unitaires de `computeNewNode2` |

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/components/plan/WallDrawingCanvas.tsx` | État `selectedCot`, labels cliquables, rendu du panneau |
| `src/components/tiling/TilingEditor.tsx` | Masquer le bouton "Côtes" (ancien système) |

## Détail d'implémentation

### `AutoCotationPanel.tsx`

Props :

```ts
interface AutoCotationPanelProps {
  cot: AutoCotation;       // wallId, side, label, anchor1, anchor2
  wall: Wall;              // node1Id, node2Id, thickness
  nodes: WallNode[];
  onApply: (nodeId: string, newPos: Point) => void;
  onClose: () => void;
}
```

Fonction pure exportée (testable isolément) :

```ts
export function computeNewNode2(
  wall: Wall,
  nodes: WallNode[],
  newLabelMm: number,
  side: AutoCotation['side'],
): Point {
  const n1 = nodes.find((n) => n.id === wall.node1Id)!;
  const n2 = nodes.find((n) => n.id === wall.node2Id)!;
  const dx = n2.x - n1.x, dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dir = { x: dx / len, y: dy / len };

  const t = wall.thickness;
  const nodeDist =
    side === 'exterior' ? newLabelMm - t :
    side === 'interior' ? newLabelMm + t :
    newLabelMm;

  return { x: n1.x + dir.x * nodeDist, y: n1.y + dir.y * nodeDist };
}
```

Logique `handleApply` :

```ts
const mm = cmToMm(parseFloat(rawValue));
if (isNaN(mm) || mm <= 0) return; // validation minimale
const newPos = computeNewNode2(wall, nodes, mm, cot.side);
onApply(wall.node2Id, newPos);
onClose();
```

Rendu :

```
CÔTE SÉLECTIONNÉE                           [✕]
[EXT]  Mur sélectionné
Longueur  [ 32.0 ] cm    [Appliquer ↵]
Ancre fixe : nœud 1    Déplace : nœud 2
```

Position : panneau HTML absolu, ancré en haut à droite du canvas (`position: absolute; top: 1rem; right: 1rem`).

### `WallDrawingCanvas.tsx`

Nouvel état :

```tsx
const [selectedCot, setSelectedCot] =
  useState<{ wallId: string; side: AutoCotation['side'] } | null>(null);
```

Dans le rendu des autoCotations, le **groupe parent** reste `pointer-events-none`, mais le groupe `<g>` du label reçoit `pointerEvents: 'auto'` et un `onClick` :

```tsx
<g
  onClick={() => setSelectedCot({ wallId: c.wallId, side: c.side })}
  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
>
  {/* pill label */}
</g>
```

Rendu du panneau (après la balise SVG, dans le div parent) :

```tsx
{selectedCot && (() => {
  const cot = autoCotations.find(
    (c) => c.wallId === selectedCot.wallId && c.side === selectedCot.side
  );
  const wall = walls.find((w) => w.id === selectedCot.wallId);
  return cot && wall ? (
    <AutoCotationPanel
      key={`${selectedCot.wallId}-${selectedCot.side}`}
      cot={cot}
      wall={wall}
      nodes={nodes}
      onApply={(nodeId, newPos) => {
        onPushHistory();
        onUpdateNode(nodeId, newPos);
        setSelectedCot(null);
      }}
      onClose={() => setSelectedCot(null)}
    />
  ) : null;
})()}
```

Désélection : Échap (dans `handleKeyDown` existant) ajoute `setSelectedCot(null)`.

### `TilingEditor.tsx`

Supprimer l'entrée "Côtes" dans le tableau de l'outil actif (ou conditionner à `false`). Le reste du code `TilingDimension` est inchangé.

## UX

- Clic sur un label vert ou bleu → panneau d'édition en haut à droite
- Entrée ou "Appliquer" → `node2` se déplace, panneau se ferme
- Échap ou ✕ → désélection sans modification
- Valeur invalide (≤ 0) : bouton désactivé, aucune action
- `key={wallId+side}` sur le panneau pour forcer un remount si l'utilisateur clique une autre côte sans fermer

## Tests

- `AutoCotationPanel.test.ts` : `computeNewNode2` — 3 cas (exterior, interior, isolated)
- Tests existants `wallCotation.test.ts` : inchangés (8 tests passent)

## Contraintes non couvertes (hors périmètre v1)

- Validation que le nouveau `node_dist` ne rende pas le mur négatif
- Formule exacte pour coins non-rectangulaires (approximation actuelle suffisante)
- Côtes des murs partagés entre deux pièces (les deux côtés sont édités via le même mur)
