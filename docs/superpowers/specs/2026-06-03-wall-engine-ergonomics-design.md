# Intégration moteur murs — Sous-projet 2 : Ergonomie

**Date :** 2026-06-03
**Périmètre :** Sous-projet 2 de 5 — rendre le canvas du moteur de murs aussi agréable à utiliser que le canvas legacy.

---

## Problème

`WallDrawingCanvas` gère son propre état `scale`/`pan` en interne (valeurs hardcodées : scale=0.5, pan={200,200}), indépendant de `PlanEditor`. Les features ergonomiques du canvas legacy (wheel zoom, pinch-to-zoom, ortho, Escape/Enter, raccourcis clavier) sont absentes ou partielles.

---

## Décision

**Option A — Props de PlanEditor** : supprimer `scale`/`pan` internes de `WallDrawingCanvas`, les recevoir en props depuis `PlanEditor`. Toutes les features ergonomiques manquantes sont ajoutées à `WallDrawingCanvas`. Pattern identique à `DrawingCanvas`.

---

## Architecture

### 1 — Lift du viewport

**Avant** — état interne indépendant :
```typescript
// WallDrawingCanvas.tsx
const [scale, setScale] = useState(0.5);
const [pan, setPan]     = useState<Point>({ x: 200, y: 200 });
```

**Après** — props de PlanEditor :
```typescript
interface WallDrawingCanvasProps {
  // props existantes inchangées
  walls: Wall[];
  nodes: WallNode[];
  tool: 'WALL' | 'SELECT' | 'DELETE';
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
  onAddNode: (node: WallNode) => void;
  onUpdateNode: (id: string, patch: { x?: number; y?: number }) => void;
  onMergeNodes: (keepId: string, dropId: string) => void;
  onPushHistory: () => void;
  // NOUVELLES props viewport
  scale: number;
  pan: Point;
  onScaleChange: (s: number) => void;
  onPanChange: (p: Point) => void;
}
```

**PlanEditor** passe ses propres states (déjà existants) :
```typescript
<WallDrawingCanvas
  walls={wallEngine.walls}
  nodes={wallEngine.nodes}
  tool={tool as 'WALL' | 'SELECT' | 'DELETE'}
  scale={scale}
  pan={pan}
  onScaleChange={setScale}
  onPanChange={setPan}
  onAddWall={addWall}
  onRemoveWall={removeWall}
  onUpdateWall={updateWall}
  onAddNode={addNode}
  onUpdateNode={updateNode}
  onMergeNodes={mergeNodes}
  onPushHistory={pushHistory}
/>
```

### 2 — Wheel zoom centré curseur

Identique au handler de `PlanEditor` (useEffect sur `svgRef` avec `passive: false`) :

```typescript
useEffect(() => {
  const svg = svgRef.current;
  if (!svg) return;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    let ns = scale * (dir > 0 ? 1.15 : 1 / 1.15);
    ns = Math.max(0.005, Math.min(ns, 4));
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    onScaleChange(ns);
    onPanChange({ x: mx - (mx - pan.x) * (ns / scale), y: my - (my - pan.y) * (ns / scale) });
  };
  svg.addEventListener('wheel', onWheel, { passive: false });
  return () => svg.removeEventListener('wheel', onWheel);
}, [scale, pan, onScaleChange, onPanChange]);
```

### 3 — Touch : pinch-to-zoom + pan 1 doigt

Le composant `WallDrawingCanvas` gère ses propres événements touch sur son SVG, identiquement à `PlanEditor` :

- **2 doigts** (`onTouchStart` avec `e.touches.length === 2`) : pinch-to-zoom. Stocker distance initiale et midpoint, puis `onTouchMove` calcule le ratio et met à jour scale/pan.
- **1 doigt en mode SELECT** : pan libre. Stocker position initiale `panStart`, puis `onTouchMove` translate le pan.
- **Tap court** : pas d'action supplémentaire en mode SELECT (le clic pointer existant suffit).

Implémentation : un `touchRef` local dans `WallDrawingCanvas` (pattern identique à `PlanEditor.touchRef`).

### 4 — Keyboard : Shift, Ctrl, Escape, Enter

```typescript
const [isShiftPressed, setIsShiftPressed] = useState(false);
const [isCtrlPressed,  setIsCtrlPressed]  = useState(false);

useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'Shift')   setIsShiftPressed(true);
    if (e.key === 'Control') setIsCtrlPressed(true);
    if (e.key === 'Escape') {
      setChain(null);
      setSelectedWallId(null);
    }
    if (e.key === 'Enter' && chain && chain.nodeIds.length >= 2) {
      // Tenter de fermer la chaîne sur le premier nœud
      // (logique identique au clic sur nœud de départ)
      tryCloseChain();
    }
  };
  const up = (e: KeyboardEvent) => {
    if (e.key === 'Shift')   setIsShiftPressed(false);
    if (e.key === 'Control') setIsCtrlPressed(false);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup',   up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup',   up);
  };
}, [chain]);
```

**Ortho (Shift)** : lors du calcul du snapResult pendant le dessin, si `isShiftPressed`, contraindre la position du curseur au H/V par rapport au dernier nœud de la chaîne :

```typescript
function applyOrtho(cursor: Point, ref: Point): Point {
  const dx = Math.abs(cursor.x - ref.x);
  const dy = Math.abs(cursor.y - ref.y);
  return dx > dy ? { x: cursor.x, y: ref.y } : { x: ref.x, y: cursor.y };
}
// Appelé dans handlePointerMove si isShiftPressed et chain actif
```

**Ctrl = no snap** : court-circuiter l'appel à `snapToWalls` — si `isCtrlPressed`, retourner `null` directement (pas de snap) et laisser le snap grille seul :

```typescript
const snapResult = isCtrlPressed
  ? null
  : snapToWalls(worldPos, walls, nodes, scale, chain);
```

`snapToWalls` elle-même n'est pas modifiée — son interface existante est conservée.

### 5 — Panel raccourcis clavier

Même carte bottom-right que le canvas legacy, adaptée aux shortcuts du moteur de murs :

```typescript
{/* Affiché en mode desktop (hidden md:block) */}
<div className="pointer-events-none absolute bottom-5 right-5 z-10 hidden md:block mouse:block rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
  style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}>
  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>Raccourcis</p>
  <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5" style={{ color: 'var(--text2)' }}>
    <span>Annuler la chaîne</span><kbd>Échap</kbd>
    <span>Orthogonalité</span><kbd>⇧ Maj</kbd>
    <span>Sans aimantation</span><kbd>Ctrl</kbd>
    <span>Annuler</span><kbd>Ctrl+Z</kbd>
    <span>Rétablir</span><kbd>Ctrl+Y</kbd>
  </div>
</div>
```

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/WallDrawingCanvas.tsx` | **Modifier** — supprimer scale/pan internes, ajouter props + wheel + touch + keyboard + shortcuts panel |
| `src/components/plan/PlanEditor.tsx` | **Modifier** — passer scale/pan/handlers à WallDrawingCanvas |

---

## Tests

- `src/components/plan/WallDrawingCanvas` n'a pas de test file existant → pas de tests unitaires requis pour ce sous-projet (composant UI pur, testé manuellement).
- Lancer `npx vitest run` après modification pour confirmer aucune régression sur les 341 tests existants.

### Validation manuelle (checklist)
1. Activer moteur de murs → wheel zoom centré sur curseur ✓
2. Changer d'onglet (Calepinage) et revenir → viewport conservé (pan/scale inchangés) ✓
3. Dessiner un mur → presser Shift → le segment se verrouille H ou V ✓
4. Presser Ctrl pendant dessin → pas de snap au endpoint ni à la face ✓
5. Presser Escape → chaîne annulée ✓
6. Sur mobile (touch) : pinch-to-zoom 2 doigts ✓, pan 1 doigt en SELECT ✓
7. Panel raccourcis visible en desktop ✓

---

## Hors périmètre de ce sous-projet

- ToolStatusBar (déjà rendu par PlanEditor en dehors du switch canvas)
- Ancre / FIX constraints pour les nœuds (sous-projet 3)
- Gestion des pièces / RoomPanel dans le moteur de murs (sous-projet 4)
- Suppression du moteur legacy (sous-projet 5)
