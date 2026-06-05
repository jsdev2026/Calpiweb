# Intégration moteur murs — Sous-projet 5 : Bascule finale

**Date :** 2026-06-03
**Périmètre :** Sous-projet 5 de 5 — supprimer le moteur legacy, simplifier PlanEditor/PlanToolbar, migrer automatiquement les projets existants.

---

## Décisions

1. `DrawingCanvas` n'est plus rendu. Le fichier est conservé mais n'est plus importé.
2. `PlanEditor` est réécrit (simplifié de ~1925 à ~300 lignes).
3. `PlanToolbar` perd 6 outils : `APPLY_H`, `APPLY_V`, `COINCIDE`, `ANCHOR`, `DIMENSION`, `PARTITION`.
4. Tout nouveau projet démarre avec `wallEngine` initialisé.
5. À l'ouverture d'un projet sans `wallEngine`, celui-ci est initialisé automatiquement (vide).
6. Le bouton "Nouveau moteur ✦" est supprimé.
7. `ToolStatusBar` et ses textes sont mis à jour pour les outils restants.

---

## PlanToolbar — type `PlanTool` simplifié

**Avant :**
```typescript
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V'
  | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION' | 'DELETE';
```

**Après :**
```typescript
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'EXCLUDE' | 'DELETE';
```

Les boutons supprimés du JSX : `APPLY_H`, `APPLY_V`, `COINCIDE`, `ANCHOR`, `DIMENSION`, `PARTITION`.
La version mobile est également simplifiée en conséquence.

---

## ToolStatusBar — textes mis à jour

Supprimer les entrées pour les outils retirés de `TOOL_STATUS_TEXTS`.
Ajouter les textes manquants pour `DOOR` et `EXCLUDE` s'ils ne sont pas déjà présents.

---

## PlanEditor — nouveau contenu complet

Le nouveau `PlanEditor` remplace entièrement l'actuel. Il est ~300 lignes.

### Ce qui reste

| Élément | Statut |
|---------|--------|
| `[scale, pan]` state | ✅ Garder |
| `[tool, setTool]` state | ✅ Garder (PlanTool simplifié) |
| `[past, future]` history | ✅ Garder (WallHistoryEntry seulement) |
| `wallEngineRef` | ✅ Garder |
| Store hooks wall engine | ✅ Garder |
| `pushHistory` / `handleUndo` / `handleRedo` | ✅ Garder |
| `useDraggableSnap` pour WallRoomPanel | ✅ Garder |
| `computeInitialView` (export) | ✅ Garder |
| `initWallEngine` auto au montage | ✅ Nouveau |
| `WallDrawingCanvas` (toujours rendu) | ✅ Garder |
| `WallRoomPanel` | ✅ Garder |
| `PlanToolbar` (simplifié) | ✅ Garder |
| `ToolStatusBar` | ✅ Garder |
| `tutorialMode` + toggle | ✅ Garder |
| Keyboard Ctrl+Z/Y | ✅ Garder |

### Ce qui est supprimé

| Élément | Supprimé |
|---------|----------|
| `rooms`, `constraints` store hooks | ❌ |
| `wallThickness` store hook (PlanEditor) | ❌ (géré dans WallDrawingCanvas/WallEdgeEditor) |
| Constraint solver appels | ❌ |
| `activeRoomId`, `editingEdge`, etc. | ❌ |
| Tous les handlers du DrawingCanvas legacy | ❌ |
| `DrawingCanvas` JSX + import | ❌ |
| `RoomPanel` / `RoomTabs` JSX + imports | ❌ |
| Bouton "Nouveau moteur ✦" | ❌ |
| Touch handlers wrapper (handleWrapperTouchStart etc.) | ❌ (dans WallDrawingCanvas) |
| Ortho, snapPos, findNearestEdge etc. | ❌ |
| `violationFlash` | ❌ |
| `DimensionEditor`, `DimensionPopup` JSX | ❌ |
| `WallEdgeEditor` dans PlanEditor | ❌ (reste dans WallDrawingCanvas) |
| Mobile room strip (RoomTabs horizontal) | ❌ |
| Mobile toolbar | ✅ Garder (toolbar mobile reste) |

### HistoryEntry simplifié

```typescript
interface WallHistoryEntry {
  wallEngine: {
    nodes: WallNode[];
    walls: Wall[];
    excludedZones: WallExcludedZone[];
  };
}
```

### Auto-init wallEngine

```typescript
useEffect(() => {
  if (wallEngine === undefined) initWallEngine();
}, []); // eslint-disable-line
```

### pushHistory / handleUndo / handleRedo

```typescript
const pushHistory = useCallback(() => {
  const we = wallEngineRef.current;
  if (!we) return;
  setPast(prev => [{
    wallEngine: {
      nodes: [...we.nodes],
      walls: [...we.walls],
      excludedZones: [...(we.excludedZones ?? [])],
    },
  }, ...prev.slice(0, 49)]);
  setFuture([]);
}, []);

const handleUndo = useCallback(() => {
  const [entry, ...rest] = past;
  if (!entry) { if (onNavigateBack) onNavigateBack(); return; }
  const we = wallEngineRef.current;
  const current = we ? {
    wallEngine: { nodes: [...we.nodes], walls: [...we.walls], excludedZones: [...(we.excludedZones ?? [])] },
  } : null;
  if (current) setFuture(f => [current, ...f.slice(0, 49)]);
  setPast(rest);
  restoreSnapshot([], [], entry.wallEngine);
}, [past, onNavigateBack, restoreSnapshot]);

const handleRedo = useCallback(() => {
  const [entry, ...rest] = future;
  if (!entry) return;
  const we = wallEngineRef.current;
  const current = we ? {
    wallEngine: { nodes: [...we.nodes], walls: [...we.walls], excludedZones: [...(we.excludedZones ?? [])] },
  } : null;
  if (current) setPast(p => [current, ...p.slice(0, 49)]);
  setFuture(rest);
  restoreSnapshot([], [], entry.wallEngine);
}, [future, restoreSnapshot]);
```

### Centrage initial

```typescript
useEffect(() => {
  const rafId = requestAnimationFrame(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width: vw, height: vh } = svg.getBoundingClientRect();
    const rooms = selectRooms(useProjectStore.getState());
    const view = computeInitialView(rooms, vw, vh);
    if (!view) return;
    setScale(view.scale);
    setPan(view.pan);
  });
  return () => cancelAnimationFrame(rafId);
}, []); // eslint-disable-line
```

Note : `svgRef` est récupéré depuis `WallDrawingCanvas` via un `forwardRef` ou simplement supprimé — le centrage peut se baser sur `window.innerWidth`/`innerHeight` comme fallback si le svgRef n'est plus disponible dans PlanEditor.

Alternative simplifiée (sans svgRef) :
```typescript
useEffect(() => {
  const rooms = selectRooms(useProjectStore.getState());
  const view = computeInitialView(rooms, window.innerWidth, window.innerHeight - 92);
  if (!view) return;
  setScale(view.scale);
  setPan(view.pan);
}, []); // eslint-disable-line
```

---

## Migration des projets existants

`initWallEngine` dans le store vérifie déjà `p.wallEngine ?? { nodes: [], walls: [], excludedZones: [] }` — si `wallEngine` est `undefined`, il l'initialise vide. L'auto-init au montage de PlanEditor appelle cette action, ce qui couvre tous les projets existants.

Les `rooms` et `constraints` legacy restent dans `project` en base (aucun nettoyage DB en SP5) mais ne sont plus utilisés pour le dessin.

---

## Initialisation des nouveaux projets

Dans `projectStore.ts`, `create()` (ligne ~94) crée actuellement un projet avec `rooms: [...]` mais sans `wallEngine`. Modifier pour appeler `initWallEngine()` après la création, ou inclure `wallEngine` directement dans l'objet :

```typescript
const newProject: Project = {
  // ...
  rooms: [],  // vide — non utilisé en mode wall engine
  wallEngine: { nodes: [], walls: [], excludedZones: [] },  // ← AJOUTÉ
  // ...
};
```

---

## Tests à mettre à jour

| Fichier | Action |
|---------|--------|
| `PlanEditor.toolbar.test.ts` | Supprimer les références aux outils retirés (`APPLY_H`, `APPLY_V`, `COINCIDE`, `ANCHOR`, `DIMENSION`, `PARTITION`) |
| `PlanEditor.viewport.test.ts` | ✅ Aucun changement — `computeInitialView` reste identique |
| `PlanEditor.dimension.test.ts` | ✅ Aucun changement — teste des fonctions pures (`constraintFaceOffset`, etc.) qui restent dans le codebase |
| `PlanEditor.interior.test.ts` | ✅ Aucun changement — idem |
| `PlanEditor.mobile.test.tsx` | Vérifier et adapter si nécessaire |
| `DrawingCanvas.badge.test.tsx` | Supprimer ou désactiver — DrawingCanvas n'est plus rendu |

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/PlanToolbar.tsx` | **Modifier** — simplifier PlanTool + supprimer 6 boutons |
| `src/components/plan/ToolStatusBar.tsx` | **Modifier** — retirer textes des outils supprimés |
| `src/components/plan/PlanEditor.tsx` | **Réécrire** — ~300 lignes, supprimer le legacy |
| `src/store/projectStore.ts` | **Modifier** — `create()` inclut `wallEngine` d'emblée |
| `src/components/plan/PlanEditor.toolbar.test.ts` | **Modifier** — adapter aux nouveaux outils |
| `src/components/plan/DrawingCanvas.badge.test.tsx` | **Supprimer** |

---

## Hors périmètre de ce sous-projet

- Suppression physique de `DrawingCanvas.tsx` (archivé/non importé, pas supprimé)
- Nettoyage des fichiers du moteur de contraintes (`solver.ts`, `dofAnalyzer.ts`, `vertexSnap.ts`, `faceOffset.ts`) — dead code, à supprimer dans un sprint de cleanup
- Nommage persistant des pièces (reporter après SP5)
