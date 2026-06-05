# UX Fixes — Nommer les pièces + Échap → SELECT + Portes dans le calepinage

**Date :** 2026-06-04

## Périmètre

Trois améliorations indépendantes :

1. **Nommer les pièces** — renommage inline dans `WallRoomPanel`
2. **Échap → SELECT** — la touche Échap bascule toujours vers l'outil Sélectionner
3. **Portes dans le calepinage** — les carreaux entiers qui tiennent dans l'ouverture de porte sont affichés

---

## Feature 1 — Nommer les pièces dans le bandeau latéral

### Problème

`WallRoomPanel` affiche les pièces auto-détectées par `wallsToRooms`. Chaque pièce a un ID stable (`faceId` = hash djb2 des nœuds triés), mais `wallsToRooms` génère toujours `name: 'Pièce ${idx + 1}'` sans tenir compte d'un nom saisi par l'utilisateur. Aucune interface de renommage n'existe dans ce panneau.

### Solution

#### Store

Ajouter `wallRoomNames: Record<string, string>` dans `WallEngine` (interface + état initial).

Ajouter action `renameWallRoom(roomId: string, name: string) => void` :
```ts
renameWallRoom: (roomId, name) => {
  set((s) => updateActive(s, (we) => ({
    ...we,
    wallRoomNames: { ...(we.wallRoomNames ?? {}), [roomId]: name },
  })));
},
```

#### Sélecteur `selectRooms`

Après `wallsToRooms`, écraser `room.name` si une entrée existe :
```ts
export function selectRooms(s: ProjectState): Room[] {
  const we = s.projects[s.activeId]?.wallEngine;
  if (!we) return [...];
  const rooms = wallsToRooms(we.walls, we.nodes, we.excludedZones ?? []);
  const names = we.wallRoomNames ?? {};
  return rooms.map((r) => names[r.id] ? { ...r, name: names[r.id] } : r);
}
```

#### `WallRoomPanel` — UI de renommage

Double-clic sur le nom de la pièce → `<input>` inline.  
`Enter` ou `onBlur` → commite → appelle `renameWallRoom`.  
`Escape` → annule sans sauvegarder.

Pattern identique à `RoomTabs.startRename` / `commitRename` déjà existant.

L'affichage nominal : `room.name` (qui vaut désormais le nom saisi ou `'Pièce ${idx + 1}'` par défaut).

#### Comportement si le nœud disparaît

Si les nœuds définissant la pièce sont supprimés, l'ID change → l'entrée dans `wallRoomNames` devient orpheline. Elle n'a aucun effet (la pièce n'existe plus). Pas de nettoyage automatique nécessaire en V1.

---

## Feature 2 — Touche Échap → outil "Sélectionner"

### Problème

`Escape` dans `WallDrawingCanvas` annule la chaîne de dessin en cours mais ne bascule pas l'outil sur SELECT (state `tool` dans `PlanEditor`).

### Solution

Dans `PlanEditor.tsx`, l'écouteur `keydown` existant (qui gère déjà `Ctrl+Z` / `Ctrl+Y`) reçoit une ligne supplémentaire :

```ts
if (e.key === 'Escape') setTool('SELECT');
```

Les deux écouteurs (`PlanEditor` + `WallDrawingCanvas`) coexistent : `WallDrawingCanvas` annule la chaîne en cours, `PlanEditor` bascule l'outil — comportement combiné correct pour tous les outils (WALL, DOOR, EXCLUDE...).

Aucune régression possible : `setTool('SELECT')` est idempotent si l'outil est déjà SELECT.

---

## Feature 3 — Portes dans le calepinage

### Problème

Le moteur de calepinage génère des carreaux clippés au polygone de chaque pièce. Les murs `isDoor: true` forment une frontière opaque — aucun carreau n'apparaît dans le passage de porte, même si des carreaux entiers tiendraient dans l'ouverture.

### Comportement attendu

Les carreaux de la grille dont la dimension s'inscrit **entièrement** dans la largeur de l'ouverture de porte (distance entre les deux nœuds de la porte) sont affichés dans la zone du passage. Les carreaux partiellement débordants ne sont pas affichés. Les joints s'alignent avec ceux de la pièce adjacente.

### Modèle de données

```ts
// src/types/wall.ts (ou src/engine/tiling/types.ts)
export interface DoorOpening {
  from: Point;      // nœud 1 du mur porte (coords monde)
  to: Point;        // nœud 2 du mur porte (coords monde)
  thickness: number; // épaisseur du mur (mm)
}
```

### Extraction des ouvertures

Dans `src/store/projectStore.ts`, nouveau sélecteur `selectDoorOpenings` :

```ts
export function selectDoorOpenings(s: ProjectState): DoorOpening[] {
  const we = s.projects[s.activeId]?.wallEngine;
  if (!we) return [];
  const nodeMap = new Map(we.nodes.map(n => [n.id, n]));
  return we.walls
    .filter(w => w.isDoor)
    .map(w => {
      const n1 = nodeMap.get(w.node1Id)!;
      const n2 = nodeMap.get(w.node2Id)!;
      return { from: { x: n1.x, y: n1.y }, to: { x: n2.x, y: n2.y }, thickness: w.thickness };
    });
}
```

### `computeDoorOpeningTiles`

Nouvelle fonction exportée dans `src/engine/tiling/tilingEngine.ts` :

```ts
export function computeDoorOpeningTiles(
  opening: DoorOpening,
  config: TileConfig,
  gridOrigin: Point,
  angle: number,
): Tile[]
```

Algorithme :
1. Calculer la direction du mur porte : `dir = normalize(to - from)`, `perp = rotate90(dir)`
2. Générer la grille de carreaux (même origine `gridOrigin`, même angle `angle`) dans le rectangle de l'ouverture : largeur = `|to - from|`, profondeur = `thickness`
3. Retenir uniquement les carreaux dont la projection sur `dir` est **entièrement** contenue dans `[0, |to - from|]` (carreau entier dans la largeur)
4. Retourner ces carreaux

L'`angle` et `gridOrigin` sont ceux de la pièce adjacente — cela garantit l'alignement des joints.

### Intégration dans le rendu

Dans le composant qui rend le calepinage (canvas ou vue dédiée) :
- Appeler `selectDoorOpenings` pour obtenir les ouvertures
- Pour chaque ouverture, appeler `computeDoorOpeningTiles` avec les paramètres de grille de la pièce adjacente
- Rendre ces carreaux avec le même style (couleur, joints) que les carreaux de pièce

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/types/wall.ts` | Ajouter `DoorOpening` interface |
| `src/store/projectStore.ts` | `wallRoomNames` dans `WallEngine`, `renameWallRoom` action, `selectRooms` mis à jour, `selectDoorOpenings` |
| `src/components/plan/WallRoomPanel.tsx` | UI de renommage inline (double-clic) |
| `src/components/plan/PlanEditor.tsx` | `Escape` → `setTool('SELECT')` |
| `src/engine/tiling/tilingEngine.ts` | `computeDoorOpeningTiles` |
| `src/engine/tiling/tilingEngine.test.ts` | Tests pour `computeDoorOpeningTiles` |

---

## Tests

- `renameWallRoom` : le nom est persisté et `selectRooms` l'applique
- `selectRooms` : sans entrée dans `wallRoomNames`, le nom par défaut est `'Pièce 1'`
- `computeDoorOpeningTiles` : ouverture de 900mm avec carreaux 300mm → 3 carreaux entiers
- `computeDoorOpeningTiles` : carreau de 600mm dans ouverture de 500mm → 0 carreaux
- `computeDoorOpeningTiles` : grille alignée avec pièce adjacente (même joints)
- `PlanEditor` Escape : quel que soit l'outil actif, Escape bascule sur SELECT
