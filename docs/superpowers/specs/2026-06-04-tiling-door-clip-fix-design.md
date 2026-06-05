# Calepinage — Fix clip SVG pour les ouvertures de porte

**Date :** 2026-06-04

## Problème

`computeTilingMultiRoom` génère correctement des carreaux de porte (IDs `door-X-Y`, type `WHOLE`) dans le passage entre deux pièces. Ces carreaux sont dans `result.tiles` et transmis à `TilingCanvas`.

Cependant, `TilingCanvas` rend tous les carreaux à l'intérieur d'un `<clipPath id="tiledClip">` construit uniquement à partir des polygones inset des pièces. Le passage de porte est dans le GAP entre ces polygones — espace non couvert par le clip. Les carreaux de porte sont donc dessinés puis immédiatement masqués → invisibles.

## Solution

Étendre le `<clipPath>` pour inclure les rectangles des ouvertures de porte.

### Géométrie du rectangle d'ouverture

Pour une porte de nœuds `from` → `to` avec épaisseur `thickness` :

```
dir  = normalize(to - from)
perp = { x: -dir.y, y: dir.x }   // perpendiculaire

4 coins :
  P1 = from + thickness * perp
  P2 = to   + thickness * perp
  P3 = to   - thickness * perp
  P4 = from - thickness * perp
```

Le rectangle ainsi formé couvre exactement le GAP entre les deux polygones inset (chaque pièce est inset de `wallThickness` depuis la ligne centrale ; le rectangle s'étend de `±thickness` depuis la ligne centrale).

### Règle de remplissage

Le `<clipPath>` utilise `fillRule="evenodd"` et `clipRule="evenodd"`. Les rectangles d'ouverture sont **en dehors** des polygones de pièces (pas de chevauchement) → ils sont comptés 1 fois → rendus visibles. Aucun conflit avec les zones exclues ou les partitions qui sont à l'intérieur des pièces.

## Fichiers

| Fichier | Changement |
|---------|-----------|
| `src/components/tiling/TilingCanvas.tsx` | Ajouter `doorOpenings?: DoorOpening[]` à l'interface + inclure les rectangles dans le `<clipPath>` |
| `src/components/tiling/TilingEditor.tsx` | Passer `doorOpenings={doorOpenings}` à `<TilingCanvas>` |

## Détail d'implémentation

### `TilingCanvas.tsx`

Ajouter l'import :
```ts
import type { DoorOpening } from '@/types/wall';
```

Ajouter `doorOpenings?: DoorOpening[]` dans `TilingCanvasProps`.

Dans le destructuring du composant, ajouter `doorOpenings = []`.

Fonction helper inline pour calculer les 4 coins d'un rectangle d'ouverture :
```ts
function doorRect(door: DoorOpening): string {
  const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = -dy / L * door.thickness, py = dx / L * door.thickness;
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x   + px, y: door.to.y   + py },
    { x: door.to.x   - px, y: door.to.y   - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')} Z`;
}
```

Dans la construction du `d` du `<clipPath>`, ajouter après les partitions :
```ts
...doorOpenings.map(doorRect).filter(Boolean),
```

### `TilingEditor.tsx`

`doorOpenings` est déjà sélectionné via `useProjectStore(useShallow(selectDoorOpenings))`. Il suffit de le passer à `<TilingCanvas>` :
```tsx
<TilingCanvas
  ...
  doorOpenings={doorOpenings}
/>
```

## Tests

- Vérifier que `TilingCanvas` accepte `doorOpenings` sans erreur TypeScript quand le prop est absent (valeur par défaut `[]`)
- Les 383 tests existants doivent passer sans régression
