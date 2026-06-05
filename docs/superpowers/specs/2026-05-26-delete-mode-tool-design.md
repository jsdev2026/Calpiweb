# Delete Mode Tool — Design Spec

**Goal:** Remplacer le comportement actuel de la corbeille (select-then-delete) par un vrai outil DELETE : cliquer la corbeille active un mode de suppression directe où chaque clic sur un élément du dessin le supprime immédiatement.

**Architecture:** DELETE devient un outil natif dans `PlanTool`, cohérent avec SELECT, WALL, DOOR, etc. La détection de l'élément cible réutilise les fonctions `findNearest*` existantes. La logique de suppression réutilise le code déjà en place (`removeDoorFromRoom`, `removePartition`, `removeExcludedZone`, rotation de points pour les murs).

**Tech Stack:** React state, TypeScript, SVG pointer events, Tailwind CSS

---

## État & Types

### Extension de `PlanTool`

```typescript
// src/components/plan/PlanToolbar.tsx
type PlanTool =
  | 'WALL' | 'SELECT' | 'DOOR' | 'EXCLUDE' | 'PARTITION'
  | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'DIMENSION'
  | 'DELETE'  // ← nouveau
```

### Nouveau type `DeleteHoverTarget`

```typescript
// src/components/plan/PlanEditor.tsx
type DeleteHoverTarget =
  | { type: 'wall';      roomId: string; edgeIndex: number }
  | { type: 'door';      roomId: string; edgeIndex: number }
  | { type: 'partition'; roomId: string; partitionId: string }
  | { type: 'zone';      roomId: string; zoneId: string }
```

### Nouveau state dans `PlanEditor`

```typescript
const [deleteHover, setDeleteHover] = useState<DeleteHoverTarget | null>(null);
```

### Suppressions

Ces éléments **disparaissent** car le concept de "sélection avant suppression" est remplacé :
- `canDelete` (boolean dérivé)
- `editingContext` ('wall' | 'door' | 'partition' | 'zone' | null)
- `deleteTooltipLabel` (string)
- `handleTrashClick` (la logique migre dans `handlePointerDown`)

> Note : `editingEdge`, `editingZoneEdge`, `editingPartition` restent — ils servent toujours à l'éditeur de dimensions en mode SELECT.

---

## Interactions Canvas

### `handlePointerMove` — branche DELETE

```
raw = toWorld(e.clientX, e.clientY)
wallEdge = findNearestEdgeOfType(raw, 'WALL')
doorEdge = findNearestEdgeOfType(raw, 'DOOR')
partition = findNearestPartitionEdge(raw)
zone = findNearestZoneEdge(raw)

Prendre le plus proche parmi les quatre.
Si trouvé → setDeleteHover(target correspondant)
Sinon    → setDeleteHover(null)
```

### `handlePointerDown` — branche DELETE

```
raw = toWorld(e.clientX, e.clientY)
Chercher l'élément le plus proche (même logique que hover)

Si trouvé :
  pushHistory()
  Supprimer l'élément selon son type :
    'wall'      → rotation points + retrait dernier segment (logique existante)
    'door'      → removeDoorFromRoom + shiftConstraintIndices (logique existante)
    'partition' → removePartition (existant)
    'zone'      → removeExcludedZone (existant)
  Rester en mode DELETE (ne pas changer l'outil)

Si rien trouvé (clic sur le vide) :
  setTool('SELECT')
  setDeleteHover(null)
```

### Sortie du mode DELETE

| Action | Résultat |
|--------|----------|
| Touche Échap | `setTool('SELECT')` (handler clavier existant) |
| Clic sur le vide du canvas | `setTool('SELECT')` |
| Clic sur un autre outil toolbar | Comportement normal existant |

Quand on quitte le mode DELETE (quelle que soit la cause), `setDeleteHover(null)` est appelé pour effacer le highlight rouge.

---

## Toolbar (`PlanToolbar.tsx`)

```tsx
// Bouton corbeille — outil toggle standard
<Button
  variant={tool === 'DELETE' ? 'danger' : 'ghost'}
  size="icon"
  className="h-8 w-8"
  onClick={() => onChangeTool('DELETE')}
>
  <Trash2 size={16} />
</Button>
```

- **Toujours cliquable** — plus de prop `disabled` ni de `canDelete`
- Visuellement actif (fond rouge/danger) quand `tool === 'DELETE'`
- Tooltip : `'Mode suppression — cliquez un élément pour le supprimer'`
- Props à retirer de `PlanToolbarProps` : `canDelete`, `deleteTooltipLabel`, `onDelete`
- Prop existante `onChangeTool` suffit

---

## DrawingCanvas (`DrawingCanvas.tsx`)

### Nouveau prop

```typescript
deleteHover: DeleteHoverTarget | null
```

### Rendu du hover rouge

- **Mur/porte survolé** : `stroke="#ef4444"` sur la `<line>` concernée (remplace la couleur normale)
- **Cloison survolée** : contour rouge sur le segment de cloison
- **Zone survolée** : bordure rouge sur les segments de la zone exclue

### Curseur

```tsx
// Dans la logique de calcul du curseur SVG
tool === 'DELETE' ? 'cursor-crosshair' : ...
```

---

## Mobile (touch)

Le mode DELETE est géré via `handleTouchEnd` (tap court en mode DELETE) :

```
Si tool === 'DELETE' et tap court (< 12px de déplacement) :
  worldPos = toWorld(touch position)
  Chercher l'élément le plus proche
  Si trouvé → supprimer (même logique que desktop)
  Si vide   → setTool('SELECT')
```

L'overlay `md:hidden mouse:hidden` déjà en place gère le routage des événements.

---

## Rayon de détection & priorité

Identique aux fonctions `findNearest*` existantes : `80 / scale` unités monde — environ 80px écran à échelle normale. Suffisant pour une cible au doigt sur mobile.

**Priorité quand plusieurs éléments sont dans le rayon :** on prend l'élément avec la **distance la plus faible**. En cas d'égalité parfaite, ordre de priorité : cloison > zone > porte > mur (du plus précis au plus structurel).

---

## Comportement des murs

Supprimer un mur en mode DELETE **ré-ouvre la pièce** au niveau de ce mur (comportement identique à l'ancienne corbeille contextuelle) : les points sont réordonnés et le dernier segment est supprimé. C'est une action destructrice intentionnelle — l'utilisateur est dans un mode explicitement dédié à la suppression.

---

## Cas limites

- **Pièce à 3 points** : supprimer un mur ramènerait à 2 points (pièce invalide) → interdire, ne rien faire (même garde que l'implémentation actuelle : `if (n < 3) return`)
- **Plusieurs éléments proches** : priorité → cloison > zone > porte > mur (du plus précis au plus structurel)
- **Undo** : `pushHistory()` avant chaque suppression — Ctrl+Z fonctionne normalement
