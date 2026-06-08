# Édition de côtes avec redimensionnement physique — Design

**Date :** 2026-06-05

## Problème

Dans la vue calepinage, les côtes (`TilingDimension`) sont des annotations placées par l'utilisateur. Elles affichent la longueur mesurée mais ne sont pas éditables. L'utilisateur veut cliquer sur le label d'une côte, saisir une nouvelle valeur, et que la pièce se redimensionne physiquement en conséquence (les nœuds du plan bougent).

## Contrainte technique clé

Le snap actuel s'accroche aux sommets du *polygone inset* (pièce décalée vers l'intérieur), pas aux nœuds bruts du mur. Pour savoir quel nœud déplacer, il faut :
1. Ajouter un snap de priorité maximale sur les nœuds de mur bruts (`WallNode`)
2. Enregistrer l'ID du nœud snapé dans `TilingDimension.p2NodeId` au moment du placement

## Règle d'ancrage

**p1 est toujours fixe.** Seul le nœud de mur correspondant à p2 se déplace. Si le nœud p2 n'est pas connu (snap non-nœud), le champ est en lecture seule.

## Calcul du déplacement

| Direction | Coordonnée modifiée | Formule |
|-----------|--------------------|---------| 
| `H` (horizontal) | X seulement | `newX = p1.x + newDistance` |
| `V` (vertical) | Y seulement | `newY = p1.y + newDistance` |
| `parallel` | X et Y | `newP2 = p1 + normalize(wallDir) * newDistance` |

`newDistance` = valeur saisie en cm × 10 (conversion en unités monde, 1 unité = 1 mm).

## Architecture

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/types/tilingDimension.ts` | Ajouter `p2NodeId?: string` |
| `src/engine/tiling/snapTiling.ts` | Ajouter `nodeId?: string` à `SnapResult` ; ajouter snap priorité 0 sur `WallNode[]` |
| `src/hooks/useTilingDimension.ts` | Accepter `WallNode[]` ; passer à `snapToTiling` ; enregistrer `p2NodeId` à la création |
| `src/store/projectStore.ts` | Ajouter action `updateTilingDimension(id, patch: Partial<TilingDimension>)` |
| `src/components/tiling/DimLine.tsx` | Ajouter prop `onLabelClick?: () => void` sur la pill label |
| `src/components/tiling/TilingDimensionLayer.tsx` | Ajouter props `onSelect?: (id: string) => void` et `nodes?: WallNode[]` |
| `src/components/tiling/TilingEditor.tsx` | Gérer `selectedDimId: string \| null`, passer `nodes` et `onSelect` ; afficher le panneau |

### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `src/components/tiling/DimPropertiesPanel.tsx` | Panneau de propriétés d'une côte sélectionnée |

## Détail d'implémentation

### `src/types/tilingDimension.ts`

```ts
export interface TilingDimension {
  id: string;
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
  perpOffset: number;
  p2NodeId?: string; // ID du WallNode snapé en p2, si disponible
}
```

### `src/engine/tiling/snapTiling.ts`

Ajouter `nodeId?: string` à `SnapResult` :
```ts
export interface SnapResult {
  point: Point;
  kind: 'wall-node' | 'wall-vertex' | 'wall-midpoint' | 'tile-corner' | 'tile-midpoint';
  nodeId?: string;
}
```

Ajouter paramètre optionnel `nodes: WallNode[] = []` à `snapToTiling`. Avant les snaps existants (priorité 0, la plus haute) :
```ts
// Priority 0: wall-node (nœuds de mur bruts)
for (const node of nodes) {
  considerWithId({ x: node.x, y: node.y }, 'wall-node', 0, node.id);
}
```

La fonction `consider` existante est étendue avec un `nodeId` optionnel.

### `src/hooks/useTilingDimension.ts`

Ajouter `nodes: WallNode[]` comme paramètre. Passer à `snapToTiling`. À la création de la côte :
```ts
const dim: TilingDimension = {
  id: generateId(),
  p1,
  p2: target,
  direction: dir,
  ...(parallelAngle !== undefined ? { parallelAngle } : {}),
  perpOffset,
  ...(snap?.nodeId ? { p2NodeId: snap.nodeId } : {}),
};
```

### `src/store/projectStore.ts`

Nouvelle action :
```ts
updateTilingDimension: (id, patch) => get().updateActive((p) => ({
  tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
    d.id === id ? { ...d, ...patch } : d
  ),
})),
```

### `src/components/tiling/DimLine.tsx`

Ajouter `onLabelClick?: () => void`. Sur le groupe label (`<g transform="translate...">`), ajouter :
```tsx
onClick={(e) => { e.stopPropagation(); onLabelClick?.(); }}
style={{ cursor: onLabelClick ? 'pointer' : undefined }}
```

### `src/components/tiling/DimPropertiesPanel.tsx`

Props :
```ts
interface DimPropertiesPanelProps {
  dim: TilingDimension;
  nodes: WallNode[];
  onClose: () => void;
}
```

Logique :
- Valeur affichée : `formatCm(projectedLength)`, convertie en nombre pour le champ
- Si `dim.p2NodeId` absent : champ en lecture seule + note "Ancrez p2 sur un nœud de mur pour éditer"
- Bouton Appliquer (et touche Entrée) :
  1. Convertir la valeur cm → unités monde (`valeur * 10`)
  2. Calculer `newP2` selon `dim.direction` (le signe préserve la direction de placement) :
     - `H` : `{ x: dim.p1.x + Math.sign(dim.p2.x - dim.p1.x) * newDist, y: dim.p2.y }`
     - `V` : `{ x: dim.p2.x, y: dim.p1.y + Math.sign(dim.p2.y - dim.p1.y) * newDist }`
     - `parallel` : `{ x: dim.p1.x + Math.cos(dim.parallelAngle!) * newDist, y: dim.p1.y + Math.sin(dim.parallelAngle!) * newDist }`
  3. Appeler `updateNode(dim.p2NodeId, newP2)` (store)
  4. Appeler `updateTilingDimension(dim.id, { p2: newP2 })` (store)
  5. Appeler `onClose()`

Contenu affiché :
```
CÔTE SÉLECTIONNÉE                         [✕]
Longueur  [  320  ] cm    [Appliquer ↵]
Direction  Horizontal (H)
Ancre fixe  p1 (première ancre placée)
```

### `src/components/tiling/TilingDimensionLayer.tsx`

Ajouter props `onSelect?: (id: string) => void` et `nodes?: WallNode[]`.  
Dans le rendu de chaque `DimLine`, passer :
```tsx
onLabelClick={onSelect ? () => onSelect(dim.id) : undefined}
```

### `src/components/tiling/TilingEditor.tsx`

- Ajouter `const [selectedDimId, setSelectedDimId] = useState<string | null>(null)`
- Désélectionner quand on quitte le mode Côtes (dans le `useEffect` sur `activeTool`)
- Récupérer `wallEngine?.nodes` (déjà disponible via `wallEngine`)
- Passer à `TilingDimensionLayer` :
  ```tsx
  onSelect={setSelectedDimId}
  nodes={wallEngine?.nodes ?? []}
  ```
- Dans le sidebar droit (au-dessus de `TilingControls`) :
  ```tsx
  {selectedDimId && (() => {
    const dim = dimensions.find(d => d.id === selectedDimId);
    return dim ? (
      <DimPropertiesPanel
        dim={dim}
        nodes={wallEngine?.nodes ?? []}
        onClose={() => setSelectedDimId(null)}
      />
    ) : null;
  })()}
  ```

## UX

- La sélection est disponible **uniquement en mode Côtes** (bouton actif)
- Clic sur le label → sélectionne (même si une drag était en cours, le stopPropagation évite les conflits)
- Clic hors du panneau ou `✕` → désélectionne
- Quitter le mode Côtes (Échap ou clic bouton) → désélectionne

## Contraintes non couvertes

- **Dimension négative ou nulle** : valider que la valeur saisie > 0 ; afficher une erreur sinon
- **Résistance à l'inversion** : si `newDist < 0`, rejeter (le nœud ne peut pas passer de l'autre côté de p1)
- **Côte `parallel` sans `parallelAngle`** : impossible par construction (le hook l'assigne toujours)

## Tests

- `snapTiling` : un snap sur un WallNode retourne `kind: 'wall-node'` et `nodeId` correct
- `useTilingDimension` : la côte créée avec snap sur un WallNode contient `p2NodeId`
- `DimPropertiesPanel` : soumettre une valeur appelle `updateNode` avec les bonnes coordonnées (direction H, V, parallel)
- `projectStore` : `updateTilingDimension` met à jour `p2` sans toucher aux autres champs
