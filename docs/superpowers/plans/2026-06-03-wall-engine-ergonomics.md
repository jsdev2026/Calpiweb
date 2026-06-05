# Wall Engine — Ergonomie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre `WallDrawingCanvas` aussi agréable que le canvas legacy : viewport partagé avec PlanEditor, wheel zoom, touch pinch-to-zoom, ortho Shift, Ctrl no-snap, Escape/Enter, panel raccourcis.

**Architecture:** Suppression des states internes `scale`/`pan` de `WallDrawingCanvas`, remplacés par des props venant de `PlanEditor` (identique au pattern `DrawingCanvas`). Des refs mutable `scaleRef`/`panRef` évitent les stale closures dans les handlers wheel et touch. Keyboard et touch ajoutés directement dans le composant.

**Tech Stack:** TypeScript, React 18, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-06-03-wall-engine-ergonomics-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/WallDrawingCanvas.tsx` | **Modifier** — 4 tâches successives |
| `src/components/plan/PlanEditor.tsx` | **Modifier** — passer 4 props viewport (Task 1 uniquement) |

---

### Task 1 : Lift du viewport — props + scaleRef/panRef + wheel/pan

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`
- Modify: `src/components/plan/PlanEditor.tsx`

Contexte : `WallDrawingCanvas` a actuellement `useState(0.5)` et `useState({x:200,y:200})` en interne. Cette tâche les remplace par des props et met à jour tous les usages (`setScale` → `onScaleChange`, `setPan` → `onPanChange`). Le wheel zoom existant (lignes 90–106) est conservé mais réécrit pour utiliser des refs afin d'éviter les stale closures.

- [ ] **Step 1.1 : Mettre à jour l'interface `WallDrawingCanvasProps`**

Dans `src/components/plan/WallDrawingCanvas.tsx`, remplacer l'interface (lignes 24–35) :

```typescript
interface WallDrawingCanvasProps {
  walls: Wall[];
  nodes: WallNode[];
  tool: PlanTool;
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
  onAddNode: (node: WallNode) => void;
  onUpdateNode: (id: string, patch: { x?: number; y?: number }) => void;
  onMergeNodes: (keepId: string, dropId: string) => void;
  onPushHistory: () => void;
  scale: number;
  pan: Point;
  onScaleChange: (s: number) => void;
  onPanChange: (p: Point) => void;
}
```

- [ ] **Step 1.2 : Mettre à jour la signature du composant**

Remplacer les lignes 45–49 :

```typescript
export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
  scale, pan, onScaleChange, onPanChange,
}: WallDrawingCanvasProps) => {
```

- [ ] **Step 1.3 : Supprimer les states internes + ajouter les refs mutable**

Supprimer les lignes 51–52 :
```typescript
// SUPPRIMER ces deux lignes :
const [scale, setScale] = useState(0.5);
const [pan,   setPan]   = useState<Point>({ x: 200, y: 200 });
```

Ajouter immédiatement après `const svgRef = useRef<SVGSVGElement | null>(null);` (ligne 50) :

```typescript
// Refs mutable pour wheel/touch — évitent les stale closures
const scaleRef = useRef(scale);
const panRef   = useRef(pan);
scaleRef.current = scale; // toujours à jour pendant le rendu
panRef.current   = pan;
```

- [ ] **Step 1.4 : Réécrire le wheel zoom useEffect**

Remplacer les lignes 89–106 (le `useEffect` existant pour le wheel) :

```typescript
// Wheel zoom — centré sur curseur, non-passive
useEffect(() => {
  const svg = svgRef.current;
  if (!svg) return;
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = svg.getBoundingClientRect();
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
    const s = scaleRef.current;
    const p = panRef.current;
    const ns = Math.max(0.005, Math.min(4, s * factor));
    const np = { x: ox - (ox - p.x) * (ns / s), y: oy - (oy - p.y) * (ns / s) };
    scaleRef.current = ns;
    panRef.current   = np;
    onScaleChange(ns);
    onPanChange(np);
  };
  svg.addEventListener('wheel', onWheel, { passive: false });
  return () => svg.removeEventListener('wheel', onWheel);
}, [onScaleChange, onPanChange]);
```

- [ ] **Step 1.5 : Remplacer `setPan` dans `handlePointerMove`**

Dans `handlePointerMove` (ligne ~214–220), remplacer :
```typescript
// AVANT
if (isPanning && panStart.current) {
  const sp = getSvgPos(e);
  setPan({
    x: panStart.current.panX + (sp.x - panStart.current.clientX),
    y: panStart.current.panY + (sp.y - panStart.current.clientY),
  });
  return;
}

// APRÈS
if (isPanning && panStart.current) {
  const sp = getSvgPos(e);
  onPanChange({
    x: panStart.current.panX + (sp.x - panStart.current.clientX),
    y: panStart.current.panY + (sp.y - panStart.current.clientY),
  });
  return;
}
```

- [ ] **Step 1.6 : Passer les 4 props viewport dans PlanEditor**

Dans `src/components/plan/PlanEditor.tsx`, trouver le `<WallDrawingCanvas ...>` (autour de la ligne 1873) et ajouter les 4 props :

```typescript
{wallEngine !== undefined ? (
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
) : (
```

- [ ] **Step 1.7 : Lancer les tests et vérifier TypeScript**

```
npx vitest run
npx tsc --noEmit
```

Résultat attendu : 341 tests PASS, aucune erreur TypeScript. Si TypeScript signale des usages résiduels de `setScale`/`setPan`, les remplacer par `onScaleChange`/`onPanChange`.

- [ ] **Step 1.8 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — viewport partagé via props (lift scale/pan)"
```

---

### Task 2 : Keyboard — Shift (ortho), Ctrl (no snap), Escape, Enter

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

Contexte : ajouter `isShiftPressed`/`isCtrlPressed`, un useEffect clavier sur `window`, une fonction `applyOrtho`, une callback `tryCloseChain`. Mettre à jour `handlePointerDown` et `handlePointerMove` pour appliquer ortho + no-snap.

- [ ] **Step 2.1 : Ajouter les états Shift et Ctrl**

Après la ligne `const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);`, ajouter :

```typescript
const [isShiftPressed, setIsShiftPressed] = useState(false);
const [isCtrlPressed,  setIsCtrlPressed]  = useState(false);
```

- [ ] **Step 2.2 : Ajouter la fonction `applyOrtho`**

Avant `handlePointerDown`, ajouter cette fonction (juste après les helpers `hitTestWall`/`hitTestNode`) :

```typescript
function applyOrtho(cursor: Point, ref: Point): Point {
  const dx = Math.abs(cursor.x - ref.x);
  const dy = Math.abs(cursor.y - ref.y);
  return dx > dy ? { x: cursor.x, y: ref.y } : { x: ref.x, y: cursor.y };
}
```

- [ ] **Step 2.3 : Ajouter `tryCloseChain`**

Après la définition de `submitThickness`, ajouter :

```typescript
const tryCloseChain = useCallback(() => {
  if (!chain || chain.nodeIds.length < 2) return;
  const firstId = chain.nodeIds[0]!;
  const lastId  = chain.nodeIds[chain.nodeIds.length - 1]!;
  if (firstId === lastId) return; // déjà fermé
  onPushHistory();
  onAddWall({ id: generateId(), node1Id: lastId, node2Id: firstId, thickness: chain.thickness });
  setChain(null);
}, [chain, onAddWall, onPushHistory]);
```

- [ ] **Step 2.4 : Ajouter le useEffect clavier sur `window`**

Après le `useEffect(() => { setSelectedWallId(null)... }, [tool])` existant, ajouter :

```typescript
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'Shift')   setIsShiftPressed(true);
    if (e.key === 'Control') setIsCtrlPressed(true);
    if (e.key === 'Escape') {
      setChain(null);
      setSelectedWallId(null);
      setEditingWallId(null);
    }
    if (e.key === 'Enter') tryCloseChain();
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
}, [tryCloseChain]);
```

- [ ] **Step 2.5 : Mettre à jour `handlePointerDown`**

Remplacer le corps de `handlePointerDown` par cette version qui applique ortho + Ctrl no-snap. Seules les premières lignes changent (les blocs `tool === 'SELECT'` et `tool === 'DELETE'` restent identiques) :

```typescript
const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    setIsPanning(true);
    const sp = getSvgPos(e);
    panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;

  let world = getWorldPos(e);

  // Ortho : contraindre au H/V par rapport au dernier nœud si Shift enfoncé
  if (isShiftPressed && chain && chain.nodeIds.length > 0) {
    const lastId   = chain.nodeIds[chain.nodeIds.length - 1]!;
    const lastNode = nodes.find((n) => n.id === lastId);
    if (lastNode) world = applyOrtho(world, { x: lastNode.x, y: lastNode.y });
  }

  const snap = isCtrlPressed
    ? null
    : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
  const pt = snap?.point ?? world;

  if (tool === 'WALL') {
    if (!chain) {
      let nodeId: string;
      if (snap?.type === 'endpoint' && snap.nodeId) {
        nodeId = snap.nodeId;
      } else {
        nodeId = generateId();
        onAddNode({ id: nodeId, x: pt.x, y: pt.y });
      }
      setChain({ nodeIds: [nodeId], thickness: DEFAULT_THICKNESS });
    } else {
      const prevNodeId = chain.nodeIds[chain.nodeIds.length - 1]!;
      const prevNode = nodes.find((n) => n.id === prevNodeId);
      if (!prevNode) return;
      if (dist({ x: prevNode.x, y: prevNode.y }, pt) < 1) return;

      let targetNodeId: string;
      if (snap?.type === 'endpoint' && snap.nodeId) {
        targetNodeId = snap.nodeId;
      } else {
        targetNodeId = generateId();
        onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
      }

      onPushHistory();
      onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });

      const startId = chain.nodeIds[0]!;
      if (targetNodeId === startId) {
        setChain(null);
      } else {
        setChain({ ...chain, nodeIds: [...chain.nodeIds, targetNodeId] });
      }
    }
    return;
  }

  if (tool === 'SELECT') {
    const hitNode = hitTestNode(world);
    if (hitNode) {
      setDraggingNodeId(hitNode.id);
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    const hit = hitTestWall(world);
    setSelectedWallId(hit?.id ?? null);
    if (hit) {
      setEditingWallId(hit.id);
      setEditThickness(hit.thickness.toFixed(1));
    } else {
      setEditingWallId(null);
    }
    return;
  }

  if (tool === 'DELETE') {
    const hit = hitTestWall(world);
    if (hit) { onPushHistory(); onRemoveWall(hit.id); }
  }
};
```

- [ ] **Step 2.6 : Mettre à jour `handlePointerMove`**

Remplacer le corps de `handlePointerMove` :

```typescript
const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
  if (isPanning && panStart.current) {
    const sp = getSvgPos(e);
    onPanChange({
      x: panStart.current.panX + (sp.x - panStart.current.clientX),
      y: panStart.current.panY + (sp.y - panStart.current.clientY),
    });
    return;
  }

  let world = getWorldPos(e);

  if (draggingNodeId) {
    const otherNodes = nodes.filter((n) => n.id !== draggingNodeId);
    const snapWalls  = walls.filter((w) => w.node1Id !== draggingNodeId && w.node2Id !== draggingNodeId);
    const snap = isCtrlPressed
      ? null
      : snapToWalls(world, snapWalls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    const pt = snap?.point ?? world;
    dragSnapRef.current = snap;
    onUpdateNode(draggingNodeId, { x: pt.x, y: pt.y });
    setCursor(pt);
    return;
  }

  // Ortho : contraindre au H/V par rapport au dernier nœud si Shift + chaîne active
  if (isShiftPressed && chain && chain.nodeIds.length > 0) {
    const lastId   = chain.nodeIds[chain.nodeIds.length - 1]!;
    const lastNode = nodes.find((n) => n.id === lastId);
    if (lastNode) world = applyOrtho(world, { x: lastNode.x, y: lastNode.y });
  }

  const snap = isCtrlPressed
    ? null
    : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
  setCursor(snap?.point ?? world);
  setSnapResult(snap);
};
```

- [ ] **Step 2.7 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : 341 tests PASS.

- [ ] **Step 2.8 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — Shift ortho, Ctrl no-snap, Escape/Enter"
```

---

### Task 3 : Touch — pinch-to-zoom + pan 1 doigt

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

Contexte : le composant n'a aucun gestionnaire touch. Ajouter un `touchRef` et trois handlers sur le div wrapper.

- [ ] **Step 3.1 : Ajouter `touchRef`**

Après `const panStart = useRef<...>(null);` (ligne ~54), ajouter :

```typescript
const touchRef = useRef<{
  type: '1finger' | '2finger';
  prevDist: number;
  clientX: number;
  clientY: number;
  panX: number;
  panY: number;
} | null>(null);
```

- [ ] **Step 3.2 : Ajouter les 3 handlers touch**

Après `handlePointerUp`, avant `handleKeyDown`, ajouter :

```typescript
const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const t = e.touches;
    const dx = t[1]!.clientX - t[0]!.clientX;
    const dy = t[1]!.clientY - t[0]!.clientY;
    touchRef.current = {
      type: '2finger',
      prevDist: Math.hypot(dx, dy),
      clientX: (t[0]!.clientX + t[1]!.clientX) / 2,
      clientY: (t[0]!.clientY + t[1]!.clientY) / 2,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  } else if (e.touches.length === 1 && tool === 'SELECT') {
    touchRef.current = {
      type: '1finger',
      prevDist: 0,
      clientX: e.touches[0]!.clientX,
      clientY: e.touches[0]!.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
  }
};

const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
  e.preventDefault();
  const ref = touchRef.current;
  if (!ref) return;

  if (ref.type === '2finger' && e.touches.length === 2) {
    const t = e.touches;
    const dist2 = Math.hypot(t[1]!.clientX - t[0]!.clientX, t[1]!.clientY - t[0]!.clientY);
    const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
    const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
    const svg = svgRef.current;
    if (svg && ref.prevDist > 0) {
      const ratio = dist2 / ref.prevDist;
      const rect  = svg.getBoundingClientRect();
      const mx = midX - rect.left, my = midY - rect.top;
      const s  = scaleRef.current;
      const p  = panRef.current;
      const ns = Math.max(0.005, Math.min(4, s * ratio));
      const np = { x: mx - (mx - p.x) * (ns / s), y: my - (my - p.y) * (ns / s) };
      scaleRef.current = ns;
      panRef.current   = np;
      onScaleChange(ns);
      onPanChange(np);
    }
    touchRef.current = { ...ref, prevDist: dist2, clientX: midX, clientY: midY };
  } else if (ref.type === '1finger' && e.touches.length === 1) {
    const t = e.touches[0]!;
    onPanChange({
      x: ref.panX + (t.clientX - ref.clientX),
      y: ref.panY + (t.clientY - ref.clientY),
    });
  }
};

const handleTouchEnd = () => { touchRef.current = null; };
```

- [ ] **Step 3.3 : Mettre à jour le div wrapper**

Remplacer la ligne du div wrapper (ligne ~308) :

```typescript
// AVANT
<div className="relative h-full w-full overflow-hidden bg-[#1a1c24]" tabIndex={0}>

// APRÈS
<div
  className="relative h-full w-full overflow-hidden bg-[#1a1c24]"
  tabIndex={0}
  style={{ touchAction: 'none' }}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
```

- [ ] **Step 3.4 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : 341 tests PASS.

- [ ] **Step 3.5 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — pinch-to-zoom + pan 1 doigt (touch)"
```

---

### Task 4 : Panel raccourcis clavier

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

Contexte : ajouter la même carte de raccourcis que le canvas legacy, adaptée aux shortcuts du moteur de murs. Visible uniquement sur desktop.

- [ ] **Step 4.1 : Ajouter le panel après le popup `WallEdgeEditor`**

Dans la section `return`, après le bloc `{editingWall && editingScreen && (...)}`, ajouter avant le `</div>` de fermeture du wrapper :

```typescript
{/* Panel raccourcis — desktop uniquement */}
<div
  className="pointer-events-none absolute bottom-5 right-5 z-10 hidden md:block mouse:block rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
  style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}
>
  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>Raccourcis</p>
  <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5" style={{ color: 'var(--text2)' }}>
    <span>Annuler la chaîne</span>
    <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Échap</kbd>
    <span>Orthogonalité</span>
    <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>⇧ Maj</kbd>
    <span>Sans aimantation</span>
    <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl</kbd>
    <span>Annuler</span>
    <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Z</kbd>
    <span>Rétablir</span>
    <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Y</kbd>
  </div>
</div>
```

- [ ] **Step 4.2 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : 341 tests PASS.

- [ ] **Step 4.3 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(wall-engine): WallDrawingCanvas — panel raccourcis clavier"
```

---

### Task 5 : Régression complète + vérification TypeScript

**Files:** aucun nouveau fichier

- [ ] **Step 5.1 : Suite complète**

```
npx vitest run
```

Résultat attendu : **341 tests PASS, 0 failures**.

- [ ] **Step 5.2 : TypeScript strict**

```
npx tsc --noEmit
```

Résultat attendu : **aucune erreur de type**.

- [ ] **Step 5.3 : Checklist de validation manuelle**

Activer le moteur de murs (bouton "Nouveau moteur ✦" en bas à droite), puis vérifier :

1. **Viewport partagé** : changer d'onglet (Calepinage) et revenir → pan/scale conservés.
2. **Wheel zoom** : molette → zoom centré sur le curseur, comme le canvas legacy.
3. **Shift ortho** : dessiner un mur, presser Shift → le preview se verrouille horizontalement ou verticalement par rapport au dernier nœud.
4. **Ctrl no-snap** : presser Ctrl pendant dessin → aucun snap endpoint/face/hv (juste positionnement libre).
5. **Escape** : annuler une chaîne en cours → chaîne disparaît.
6. **Enter** : chaîne avec ≥ 2 nœuds → crée le mur de fermeture.
7. **Touch pinch** : sur appareil tactile (ou Chrome DevTools mobile), 2 doigts → pinch-to-zoom.
8. **Touch pan** : 1 doigt en mode SELECT → pan.
9. **Panel raccourcis** : visible en bas à droite en mode desktop.

- [ ] **Step 5.4 : Commit si ajustements mineurs**

```bash
git add src/components/plan/WallDrawingCanvas.tsx src/components/plan/PlanEditor.tsx
git commit -m "fix(wall-engine): ajustements ergonomie après validation manuelle"
```
