# Plan Editor UX Improvements — Design Spec

**Goal:** Améliorer l'intuitivité du bandeau pour les novices, ajouter le redo, et rendre la liste des pièces draggable avec snap en 3 zones, sans alourdir l'UX pour les utilisateurs initiés.

**Architecture:** 3 features indépendantes, zéro dépendance entre elles. Pas de bibliothèque externe. Tout le code reste dans `src/components/plan/`.

**Tech Stack:** React, TypeScript, lucide-react (icônes existantes + `Redo2`, `GripVertical`), localStorage pour la persistance de position.

---

## Feature 1 — Tooltips riches pour les outils du bandeau

### Composant `ToolTooltip`

Nouveau composant dans `src/components/plan/ToolTooltip.tsx`.

**Comportement :**
- Apparaît **600 ms après** l'entrée de la souris sur le bouton (délai via `setTimeout`, annulé au `mouseLeave`)
- Positionné à droite du bouton via `getBoundingClientRect()` + `position: fixed`
- Disparaît **immédiatement** au départ de la souris
- Contenu : nom court (gras) + description d'une ligne

**Interface :**
```tsx
interface ToolTooltipProps {
  label: string;
  description: string;
  children: React.ReactNode;
}
```

**Textes par outil :**

| Outil | label | description |
|---|---|---|
| SELECT | Sélectionner | Déplacer un nœud ou un segment |
| WALL | Tracer des murs | Cliquez pour poser des points, Entrée pour fermer |
| DOOR | Placer une porte | Cliquez sur un mur pour y insérer une ouverture |
| PARTITION | Cloison (pointillés) | Trace une séparation visuelle non porteuse |
| EXCLUDE | Zone non carrelée | Délimite une surface à exclure du carrelage |
| APPLY_H | Contrainte horizontale | Fixe la distance horizontale d'un mur |
| APPLY_V | Contrainte verticale | Fixe la distance verticale d'un mur |
| COINCIDE | Coïncidence | Aligne deux nœuds ou colle un nœud à un mur |
| DIMENSION | Cotation | Mesure ou contraint la distance entre deux nœuds |
| THICKNESS | Épaisseur | Modifie l'épaisseur d'un mur ou d'une cloison |
| ANCHOR | Ancrer un nœud | Fige un point pour qu'il ne soit pas déplacé |
| Undo | Annuler | Ctrl+Z — revenir à l'état précédent |
| Redo | Rétablir | Ctrl+Y — rétablir l'action annulée |
| Clear | Effacer la pièce | Supprime tous les points de la pièce active |

**Implémentation :**
- Les textes sont définis dans un objet `TOOL_TOOLTIPS` statique dans `PlanToolbar.tsx`
- `ToolTooltip` utilise un `useState<boolean>` + `useRef<ReturnType<typeof setTimeout>>` pour gérer le délai
- Le panneau tooltip est rendu via `createPortal` dans `document.body` pour éviter les clipping issues du conteneur parent overflow

---

## Feature 2 — Redo (Ctrl+Y + bouton)

### Refactoring du modèle d'historique dans `PlanEditor.tsx`

**Avant :**
```ts
const [history, setHistory] = useState<HistoryEntry[]>([]);
```

**Après :**
```ts
const [past,   setPast]   = useState<HistoryEntry[]>([]);
const [future, setFuture] = useState<HistoryEntry[]>([]);
```

**`pushHistory()`** — appelée avant toute action utilisateur :
```ts
const pushHistory = useCallback(() => {
  const snapshot = { rooms: deepCloneRooms(rooms), constraints: [...constraints] };
  setPast(prev => [snapshot, ...prev].slice(0, 50)); // limite à 50 états
  setFuture([]);
}, [rooms, constraints]);
```

**`handleUndo()`** :
```ts
const handleUndo = () => {
  setPast(prev => {
    if (!prev.length) return prev;
    const [entry, ...rest] = prev;
    // Sauvegarder l'état courant dans future avant de restaurer
    const current = { rooms: deepCloneRooms(rooms), constraints: [...constraints] };
    setFuture(f => [current, ...f]);
    restoreSnapshot(entry!.rooms, entry!.constraints);
    return rest;
  });
};
```

**`handleRedo()`** — nouvelle fonction :
```ts
const handleRedo = () => {
  setFuture(prev => {
    if (!prev.length) return prev;
    const [entry, ...rest] = prev;
    const current = { rooms: deepCloneRooms(rooms), constraints: [...constraints] };
    setPast(p => [current, ...p]);
    restoreSnapshot(entry!.rooms, entry!.constraints);
    return rest;
  });
};
```

**Raccourcis clavier** — dans le `useEffect` existant qui gère `Ctrl+Z` :
```ts
if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); handleRedo(); }
```

**Props `PlanToolbar` :**
```ts
interface PlanToolbarProps {
  // ...existant...
  canRedo: boolean;
  onRedo: () => void;
}
```

**Bouton Redo dans le bandeau :**
- Icône `Redo2` (lucide-react) placée juste à droite du bouton Undo
- Même style `Button variant="ghost" size="icon"`
- `disabled={!canRedo}`

**Panel des raccourcis** (bas droite de l'écran) — ajout d'une ligne :
```
Rétablir    Ctrl+Y
```

---

## Feature 3 — Liste des pièces draggable avec snap en 3 zones

### Hook `useDraggableSnap`

Nouveau fichier : `src/components/plan/useDraggableSnap.ts`

```ts
export type SnapZone = 'SIDE' | 'TOP' | 'BOTTOM';

interface UseDraggableSnapOptions {
  storageKey: string;
  defaultZone: SnapZone;
}

export function useDraggableSnap({ storageKey, defaultZone }: UseDraggableSnapOptions): {
  zone: SnapZone;
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  nearestZone: SnapZone | null;  // zone la plus proche pendant le drag (pour l'illumination forte)
}
```

**Logique interne :**
- `zone` initialisé depuis `localStorage.getItem(storageKey)` ou `defaultZone`
- Sur `pointerdown` sur la poignée : active le drag, capture le pointer
- Sur `pointermove` : calcule la zone cible (la plus proche parmi les 3 centres de zones) → expose `activeZones` pour l'illumination des cibles
- Sur `pointerup` : snappe vers la zone cible, persiste dans localStorage, termine le drag
- Les centres de zones sont calculés à partir des dimensions de la fenêtre (`window.innerWidth`, `window.innerHeight`)

**Centres de zones (référence) :**
- `SIDE` : `{ x: 80, y: 160 }` (à droite du bandeau, ~4 boutons depuis le haut)
- `TOP` : `{ x: window.innerWidth / 2, y: 40 }`
- `BOTTOM` : `{ x: window.innerWidth / 2, y: window.innerHeight - 40 }`

### Composant `RoomPanel`

Le composant `RoomTabs` est **renommé `RoomPanel`** et reçoit une prop supplémentaire :

```ts
interface RoomPanelProps extends RoomTabsProps {
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}
```

**Layout selon la zone :**
- `SIDE` : flex-col, boutons empilés verticalement (même style que les boutons du bandeau), bouton `+` en bas
- `TOP` / `BOTTOM` : flex-row, layout horizontal actuel conservé

**Poignée de drag :**
- Icône `GripVertical` (lucide-react), visible uniquement au `hover` du panneau (`opacity-0 group-hover:opacity-100`)
- `cursor: grab` / `cursor: grabbing` pendant le drag
- `pointerdown` sur la poignée déclenche le drag

**Zones cibles illuminées pendant le drag :**
- 3 zones cibles `<DropZoneIndicator>` (composant inline simple) apparaissent en surbrillance légère (`border-dashed border-orange-400/50 bg-orange-500/10`) quand `isDragging === true`
- La zone correspondant à `nearestZone` est mise en évidence avec `border-solid border-orange-500`

**Transition de snap :**
- CSS `transition: all 150ms ease-out` sur le conteneur du panneau
- Appliqué uniquement quand `isDragging === false` (pour éviter le lag pendant le drag libre)

### Intégration dans `PlanEditor.tsx`

```tsx
const { zone, isDragging, handlePointerDown, nearestZone } = useDraggableSnap({
  storageKey: 'calpiweb-room-panel-zone',
  defaultZone: 'SIDE',
});

// Remplacer <RoomTabs ...> par :
<RoomPanel
  {...roomTabsProps}
  zone={zone}
  isDragging={isDragging}
  onPointerDown={handlePointerDown}
/>
{isDragging && <DropZoneOverlay nearestZone={nearestZone} />}
```

`DropZoneOverlay` est un composant inline dans `PlanEditor.tsx` qui affiche les 3 zones cibles en `position:fixed` pendant le drag.

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `src/components/plan/PlanToolbar.tsx` | Modifié — ajout `ToolTooltip`, bouton Redo, props canRedo/onRedo |
| `src/components/plan/ToolTooltip.tsx` | Créé — composant tooltip avec délai |
| `src/components/plan/PlanEditor.tsx` | Modifié — historique past/future, handleRedo, Ctrl+Y, intégration RoomPanel |
| `src/components/plan/RoomPanel.tsx` | Renommé depuis RoomTabs + prop zone/drag |
| `src/components/plan/useDraggableSnap.ts` | Créé — hook drag avec snap |

## Tests

- `PlanToolbar.test.tsx` — vérifier que le tooltip n'apparaît pas avant 600ms, disparaît au mouseLeave
- `PlanEditor` history — vérifier que undo/redo/pushHistory maintiennent la cohérence past/future
- `useDraggableSnap` — vérifier le calcul de zone cible et la persistance localStorage
