# Drawing UX Improvements — Design Spec

## Goal

Trois améliorations UX sur l'outil de dessin de plan : ancrage automatique du premier nœud, centrage de la vue à l'ouverture, et suppression contextuelle unitaire depuis le bouton Trash.

## Architecture

Trois features indépendantes. Un seul fichier principal modifié : `PlanEditor.tsx`. Un fichier secondaire : `PlanToolbar.tsx` (tooltip + état disabled du bouton Trash).

**Tech Stack :** TypeScript, React 18, Vitest, Tailwind CSS

---

## Feature 1 — Ancrage automatique du premier nœud

### Fichier

`src/components/plan/PlanEditor.tsx` — handler `handlePointerDown`, bloc `tool === 'WALL'`

### Déclencheur

Quand **toutes** ces conditions sont vraies :
- `tool === 'WALL'`
- La pièce active est la première du projet (`rooms.indexOf(activeRoom) === 0`)
- `activeRoom.points.length === 0` (aucun point posé, c'est le tout premier)

### Action

Après `updateRoom(activeRoom.id, [snapped], [])`, ajouter automatiquement une contrainte FIX :

```tsx
addConstraint({
  id: generateId(),
  type: 'FIX',
  pts: [ref(activeRoom.id, 0)],
  value: { x: snapped.x, y: snapped.y },
});
```

### Feedback visuel

L'icône 📌 s'affiche déjà sur les nœuds FIX — aucun ajout nécessaire.

---

## Feature 2 — Centrage de la vue à l'ouverture

### Fichier

`src/components/plan/PlanEditor.tsx` — nouveau `useEffect` au montage

### Déclencheur

`useEffect` avec dépendances vides `[]` — s'exécute une seule fois au montage du composant.

### Condition

Si aucune pièce n'a de points → ne rien faire (garder `scale: 0.1, pan: {x:0, y:0}`).

### Calcul

```ts
// Collecter tous les points de toutes les pièces
const allPoints = rooms.flatMap((r) => r.points);
if (allPoints.length === 0) return;

// Bounding box
const xs = allPoints.map((p) => p.x);
const ys = allPoints.map((p) => p.y);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const bboxW = maxX - minX || 1000; // fallback si un seul point
const bboxH = maxY - minY || 1000;
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;

// Dimensions du viewport SVG
const svg = svgRef.current;
if (!svg) return;
const { width: vw, height: vh } = svg.getBoundingClientRect();

// Scale pour faire tenir la bbox avec 80px de marge de chaque côté
const PADDING = 80;
const newScale = Math.min(
  (vw - PADDING * 2) / bboxW,
  (vh - PADDING * 2) / bboxH,
  0.5,  // cap maximal
);

// Pan pour centrer
const newPan = {
  x: vw / 2 - cx * newScale,
  y: vh / 2 - cy * newScale,
};

setScale(newScale);
setPan(newPan);
```

Le `useEffect` utilise `requestAnimationFrame` pour garantir que `svgRef.current` a ses dimensions réelles après le premier rendu :

```tsx
useEffect(() => {
  requestAnimationFrame(() => {
    // ... calcul ci-dessus
  });
}, []);
```

---

## Feature 3 — Suppression contextuelle (bouton Trash)

### Principe

Le bouton Trash dans la toolbar est **disabled** quand aucun état d'édition n'est actif. Quand il est actif, il supprime l'élément sélectionné sans jamais supprimer la pièce entière.

La suppression de pièce entière reste accessible via le `×` dans les onglets de pièces (RoomTabs) — elle n'est plus déclenchée par la toolbar.

### Fichiers

- `src/components/plan/PlanToolbar.tsx` — tooltip dynamique + prop `canDelete: boolean`
- `src/components/plan/PlanEditor.tsx` — handler `handleTrashClick` + ré-ouverture de pièce

### Props PlanToolbar

```tsx
// Nouveau
canDelete: boolean;
onDelete: () => void;
```

`onClearRoom` est **conservé** (utilisé par RoomTabs uniquement — à vérifier) mais le bouton Trash de la toolbar appelle `onDelete`.

> **Note :** Après vérification, `onClearRoom` n'est passé qu'à `PlanToolbar`. Il sera remplacé par `onDelete` + `canDelete`. La suppression de pièce entière depuis la toolbar disparaît.

### État disabled

```tsx
const canDelete = !!(editingEdge ?? editingPartition ?? editingZoneEdge);
```

### Handler `handleTrashClick` dans PlanEditor.tsx

```tsx
const handleTrashClick = () => {
  if (!activeRoom) return;
  pushHistory();

  // ── Partition ──
  if (editingPartition) {
    removePartition(editingPartition.roomId, editingPartition.partitionId);
    setEditingPartition(null);
    return;
  }

  // ── Zone exclue ──
  if (editingZoneEdge) {
    removeExcludedZone(editingZoneEdge.roomId, editingZoneEdge.zoneId);
    setEditingZoneEdge(null);
    return;
  }

  // ── Mur ou porte ──
  if (editingEdge) {
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (!room) return;
    const edgeType = room.edges[editingEdge.edgeIdx] ?? 'WALL';

    if (edgeType === 'DOOR') {
      // Supprimer la porte
      const result = removeDoorFromRoom(room, editingEdge.edgeIdx);
      if (result) updateRoom(room.id, result.points, result.edges);
      setEditingEdge(null);
      return;
    }

    // ── Ré-ouvrir la pièce au niveau de ce mur ──
    const n = room.points.length;
    if (n < 3) return; // sécurité
    const splitIdx = editingEdge.edgeIdx;

    // Rotation : le nouveau premier point est points[(splitIdx+1) % n]
    const rotateBy = (splitIdx + 1) % n;
    const newPoints = [
      ...room.points.slice(rotateBy),
      ...room.points.slice(0, rotateBy),
    ];
    // Edges : tous sauf l'edge splitIdx, réordonnés selon la rotation
    const oldEdges = room.edges;
    const reorderedEdges = [
      ...oldEdges.slice(rotateBy),
      ...oldEdges.slice(0, rotateBy),
    ];
    // Supprimer le dernier edge (qui correspond à l'edge supprimé après rotation)
    const newEdges = reorderedEdges.slice(0, n - 1);

    // Mettre à jour les indices de contraintes selon la rotation
    // Ancien index j → nouveau index (j - rotateBy + n) % n
    constraints
      .filter((c) => c.pts.some((r) => r.roomId === room.id))
      .forEach((c) => {
        const newPts = c.pts.map((r) =>
          r.roomId === room.id
            ? { ...r, index: (r.index - rotateBy + n) % n }
            : r,
        );
        // updateConstraintPts n'existe pas — on supprime et recrée
        removeConstraint(c.id);
        addConstraint({ ...c, pts: newPts });
      });

    updateRoom(room.id, newPoints, newEdges as EdgeType[]);
    setEditingEdge(null);
    setTool('WALL');
  }
};
```

### Tooltip dynamique dans PlanToolbar.tsx

```tsx
const deleteTooltip = editingContext === 'wall'   ? 'Supprimer ce mur'
                    : editingContext === 'door'   ? 'Supprimer cette porte'
                    : editingContext === 'partition' ? 'Supprimer cette cloison'
                    : editingContext === 'zone'   ? 'Supprimer cette zone'
                    : 'Sélectionnez un élément pour le supprimer';
```

`editingContext` est une prop dérivée dans `PlanEditor.tsx` :

```tsx
const editingContext =
  editingPartition ? 'partition'
  : editingZoneEdge ? 'zone'
  : editingEdge
    ? ((activeRoom?.edges[editingEdge.edgeIdx] ?? 'WALL') === 'DOOR' ? 'door' : 'wall')
  : null;
```

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/components/plan/PlanEditor.tsx` | Auto-anchor premier nœud · `useEffect` centrage · `handleTrashClick` · prop `canDelete` + `onDelete` vers PlanToolbar |
| `src/components/plan/PlanToolbar.tsx` | `canDelete` + `onDelete` props · tooltip dynamique · bouton Trash disabled |

---

## Tests à couvrir

- Feature 1 : pose du premier point en pièce 0 → contrainte FIX créée automatiquement
- Feature 1 : pose du premier point en pièce 1 (deuxième pièce) → pas de FIX automatique
- Feature 2 : `computeInitialView` avec points → retourne scale et pan corrects
- Feature 2 : `computeInitialView` sans points → retourne undefined (pas de modification)
- Feature 3 : `handleTrashClick` avec `editingPartition` → partition supprimée, état réinitialisé
- Feature 3 : `handleTrashClick` avec `editingZoneEdge` → zone supprimée
- Feature 3 : `handleTrashClick` avec `editingEdge` WALL → pièce ré-ouverte, points réordonnés, outil WALL
- Feature 3 : `handleTrashClick` avec `editingEdge` DOOR → porte supprimée
- Feature 3 : `canDelete` false quand aucun état d'édition → bouton disabled
