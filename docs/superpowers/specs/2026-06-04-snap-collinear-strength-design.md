# Snap — Réduction force + Aimentation colinéaire

**Date :** 2026-06-04

## Problèmes

1. **Aimantation trop forte** : H/V et Thales attirent le curseur de trop loin.
2. **Pas de snap colinéaire** : quand un mur A-B est séparé par un nœud M, il est impossible de réaligner M sur la droite (A, B). Même problème lors du dessin : impossible de prolonger colinéairement un mur existant.

## Solution

### 1 — Réduction de l'aimantation

3 constantes dans `WallDrawingCanvas.tsx` (réduction ~30 %) :

| Constante | Avant | Après |
|-----------|-------|-------|
| `HV_SNAP_PX` | 20 | 15 |
| `HV_SNAP_DRAG_PX` | 40 | 28 |
| `PERP_SNAP_PX` | 30 | 22 |

### 2 — Snap colinéaire

#### Nouvelle constante

```ts
const COLLINEAR_SNAP_PX = 12; // px écran — pendant dessin et drag
```

#### Nouvelles fonctions dans `wallSnap.ts`

**`collinearSnap`** — pendant le DESSIN : projette le curseur sur la droite INFINIE de chaque mur existant.

```ts
export function collinearSnap(
  cursor: Point,
  walls: Wall[],
  nodes: WallNode[],
  scale: number,
  snapPx: number,
): SnapResult | null {
  const r = snapPx / scale;
  let best: { point: Point; dist: number } | null = null;
  for (const wall of walls) {
    const n1 = nodes.find(n => n.id === wall.node1Id);
    const n2 = nodes.find(n => n.id === wall.node2Id);
    if (!n1 || !n2) continue;
    const dx = n2.x - n1.x, dy = n2.y - n1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const t = ((cursor.x - n1.x) * dx + (cursor.y - n1.y) * dy) / lenSq;
    const proj = { x: n1.x + t * dx, y: n1.y + t * dy };
    const d = Math.hypot(cursor.x - proj.x, cursor.y - proj.y);
    if (d < r && (!best || d < best.dist)) best = { point: proj, dist: d };
  }
  return best ? { point: best.point, type: 'collinear' } : null;
}
```

**`collinearSnapForNode`** — pendant le DRAG : projette le curseur sur la droite définie par chaque paire de nœuds adjacents du nœud déplacé.

```ts
export function collinearSnapForNode(
  cursor: Point,
  adjacentNodes: WallNode[],
  scale: number,
  snapPx: number,
): SnapResult | null {
  const r = snapPx / scale;
  let best: { point: Point; dist: number } | null = null;
  for (let i = 0; i < adjacentNodes.length; i++) {
    for (let j = i + 1; j < adjacentNodes.length; j++) {
      const A = adjacentNodes[i]!, B = adjacentNodes[j]!;
      const dx = B.x - A.x, dy = B.y - A.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1) continue;
      const t = ((cursor.x - A.x) * dx + (cursor.y - A.y) * dy) / lenSq;
      const proj = { x: A.x + t * dx, y: A.y + t * dy };
      const d = Math.hypot(cursor.x - proj.x, cursor.y - proj.y);
      if (d < r && (!best || d < best.dist)) best = { point: proj, dist: d };
    }
  }
  return best ? { point: best.point, type: 'collinear' } : null;
}
```

#### Extension du type `SnapResult`

Dans `src/types/wall.ts`, ajouter `'collinear'` à `SnapResult.type`.

#### Priorité snap pendant le DESSIN (canvas)

```
1. Endpoint snap          (inchangé)
2. Colinéaire             (nouveau — juste après endpoint)
3. Face snap              (sur le segment)
4. H/V snap               (inchangé)
```

Implémentation : appel de `collinearSnap` juste après le test endpoint dans `handlePointerDown`, avant `snapToWalls` pour les cas face/hv. Ou : appel séparé et fusion des résultats par priorité.

#### Priorité snap pendant le DRAG (canvas)

```
1. Endpoint snap                      (inchangé)
2. Adjacent axis intersection H+V     (inchangé)
3. Colinéaire adjacent                (nouveau)
4. Thales perpendiculaire             (inchangé)
5. Single-axis adjacent / fallback    (inchangé)
```

#### Indicateur visuel — ligne colinéaire

Quand `snapResult.type === 'collinear'` : afficher une ligne infinie pointillée dans la direction du mur (angle calculé depuis les extrémités du mur source).

Pour simplifier, afficher la ligne au travers du snap point dans la direction du vecteur `(n2 - n1)` normalisé, en bleu/violet (#8b5cf6) pour distinguer des guides H/V verts.

Problème : `SnapResult` ne contient pas actuellement la direction du mur. Solution : ajouter un champ optionnel `dir?: Point` à `SnapResult` pour la passer du snap au rendu.

## Fichiers

| Fichier | Changement |
|---------|-----------|
| `src/types/wall.ts` | `SnapResult.type` + `'collinear'`; `SnapResult.dir?: Point` |
| `src/engine/geometry/wallSnap.ts` | `collinearSnap`, `collinearSnapForNode` |
| `src/engine/geometry/wallSnap.test.ts` | Tests pour les deux nouvelles fonctions |
| `src/components/plan/WallDrawingCanvas.tsx` | 3 constantes réduites + appels snap + indicateur visuel |

## Tests

- `collinearSnap` sur un mur horizontal → curseur à 10px au-dessus → snap sur la droite du mur
- `collinearSnap` → curseur au-delà de l'extrémité → snap sur l'extension de la droite
- `collinearSnap` → curseur trop loin (> snapPx) → null
- `collinearSnapForNode` sur paire A(0,0)-B(200,0) → curseur à (100, 8) → snap à (100, 0)
- `collinearSnapForNode` sur paire non-horizontale → projette correctement
