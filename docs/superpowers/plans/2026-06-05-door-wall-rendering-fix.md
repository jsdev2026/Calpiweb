# Fix rendu porte et murs dans le calepinage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger deux bugs visuels : (1) la porte n'est pas reconnue comme telle dans le polygone de pièce → le mur apparaît continu ; (2) le rendu des contours de murs utilise des lignes centrées au lieu de polygones épais, produisant un aspect différent du plan.

**Architecture:** Trois fichiers. `wallFaces.ts` propage `isDoor` dans le type d'arête de pièce. `TilingEditor.tsx` extrait les murs bruts du store et calcule les polygones via `computeCornerGeometry`. `TilingCanvas.tsx` remplace la boucle de `<line>` par des `<polygon>` de mur, et corrige la demi-largeur du rectangle de porte dans le clipPath (actuellement `door.thickness`, doit être `door.thickness / 2` pour éviter la cancellation evenodd).

**Tech Stack:** TypeScript, React, SVG.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/engine/geometry/wallFaces.ts` | Propager `isDoor` → `'DOOR'` dans `wallsToRooms` |
| `src/engine/geometry/wallFaces.test.ts` | Ajouter test pour la propagation `isDoor` |
| `src/components/tiling/TilingEditor.tsx` | Sélectionner `wallEngine` du store, calculer `wallPolygons`, passer à `TilingCanvas` |
| `src/components/tiling/TilingCanvas.tsx` | Ajouter prop `wallPolygons`, remplacer boucle `<line>` par polygones, corriger `doorRectPath` |

---

## Contexte technique

### `wallFaces.ts` — `wallsToRooms` actuel (lignes 128-144)

```ts
return cycles.map((cycle, idx) => {
  const facePts = cycle.nodeIds.map(id => getPos(id));
  const roomZones = excludedZones.filter(zone => {
    if (zone.points.length < 3) return false;
    const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
    const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
    return pointInPolygon({ x: cx, y: cy }, facePts);
  });
  return {
    id: faceId(cycle.nodeIds),
    name: `Pièce ${idx + 1}`,
    points: facePts,
    edges: facePts.map(() => 'WALL' as EdgeType),  // ← BUG : ignore isDoor
    partitions: [],
    excludedZones: roomZones,
  };
});
```

`FaceCycle.wallIds[i]` contient l'ID du mur entre `nodeIds[i]` et `nodeIds[(i+1) % n]`.

### `TilingCanvas.tsx` — boucle wall actuelle (lignes 160-177)

```tsx
{/* Room walls and doors */}
{validRooms.map((room) =>
  room.points.map((p, i) => {
    const nextP = room.points[(i + 1) % room.points.length]!;
    const isDoor = (room.edges[i] ?? 'WALL') === 'DOOR';
    const edgeThick = room.edgeThicknesses?.[i] ?? wallThickness;
    return (
      <line
        key={`edge-${room.id}-${i}`}
        x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y}
        stroke={isDoor ? '#f97316' : '#ea580c'}
        strokeWidth={isDoor ? edgeThick * 0.5 : edgeThick}
        strokeLinecap="round"
        strokeDasharray={isDoor ? `${edgeThick * 1.2},${edgeThick * 0.8}` : undefined}
      />
    );
  }),
)}
```

### `TilingCanvas.tsx` — `doorRectPath` actuel (lignes 30-42)

```ts
function doorRectPath(door: DoorOpening): string {
  const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = (-dy / L) * door.thickness, py = (dx / L) * door.thickness;  // ← demi-largeur = thickness (trop large)
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x   + px, y: door.to.y   + py },
    { x: door.to.x   - px, y: door.to.y   - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}
```

Le gap entre les deux polygones inset (±wallThickness/2 de la ligne centrale) est de `wallThickness` au total. Le rectangle doit avoir demi-largeur = `door.thickness / 2`, non `door.thickness`.

### `WallPolygon` type (wallGeometry.ts lignes 5-9)

```ts
export interface WallPolygon {
  wallId: string;
  points: Point[];
}
```

### `computeCornerGeometry` (wallGeometry.ts ligne 60)

```ts
export function computeCornerGeometry(walls: Wall[], nodes: WallNode[]): WallPolygon[]
```

Déjà utilisée dans `WallDrawingCanvas.tsx` avec `walls.filter(w => !w.isDoor)`.

### `TilingEditor.tsx` — store selectors actuels (lignes 87-94)

```ts
const doorOpenings = useProjectStore(useShallow(selectDoorOpenings));
// ...
const dimensions = useProjectStore((s) => selectActiveProject(s)?.tilingDimensions ?? []);
```

---

## Task 1 : Propager `isDoor` dans `wallsToRooms`

**Files:**
- Modify: `src/engine/geometry/wallFaces.ts:128-144`
- Modify: `src/engine/geometry/wallFaces.test.ts` (ajouter 1 test)

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `src/engine/geometry/wallFaces.test.ts`, après le `describe('wallsToRooms — excludedZones', ...)` block (ligne ~119), ajouter un nouveau describe :

```ts
describe('wallsToRooms — isDoor propagation', () => {
  it('marque l\'arête porte comme DOOR dans le tableau edges de la pièce', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20, isDoor: true },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(1);
    const doorCount = rooms[0]!.edges.filter(e => e === 'DOOR').length;
    const wallCount = rooms[0]!.edges.filter(e => e === 'WALL').length;
    expect(doorCount).toBe(1);
    expect(wallCount).toBe(3);
  });

  it('deux pièces partageant un mur porte — les deux pièces ont une arête DOOR', () => {
    // 6 nodes: a(0,0) b(100,0) c(200,0) d(200,100) e(100,100) f(0,100)
    // Room gauche : a-b-e-f   Room droite : b-c-d-e
    const nodes = [
      nd('a', 0, 0), nd('b', 100, 0), nd('c', 200, 0),
      nd('d', 200, 100), nd('e', 100, 100), nd('f', 0, 100),
    ];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'w4', node1Id: 'd', node2Id: 'e', thickness: 20 },
      { id: 'w5', node1Id: 'e', node2Id: 'b', thickness: 20, isDoor: true },
      { id: 'w6', node1Id: 'e', node2Id: 'f', thickness: 20 },
      { id: 'w7', node1Id: 'f', node2Id: 'a', thickness: 20 },
    ];
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(2);
    const totalDoorEdges = rooms.reduce((sum, r) => sum + r.edges.filter(e => e === 'DOOR').length, 0);
    expect(totalDoorEdges).toBe(2); // chaque pièce voit l'arête porte comme DOOR
  });
});
```

- [ ] **Step 2 : Vérifier que le test échoue**

```
npx vitest run src/engine/geometry/wallFaces.test.ts --reporter=verbose
```

Attendu : FAIL sur les 2 nouveaux tests (`doorCount` vaut 0 au lieu de 1).

- [ ] **Step 3 : Implémenter la propagation `isDoor`**

Dans `src/engine/geometry/wallFaces.ts`, modifier `wallsToRooms` :

Avant la ligne `const cycles = wallFaceCycles(walls, nodes);` (ligne 115), ajouter :

```ts
const wallMap = new Map(walls.map(w => [w.id, w]));
```

Remplacer la ligne `edges: facePts.map(() => 'WALL' as EdgeType),` (ligne 140) par :

```ts
edges: cycle.wallIds.map(wid => (wallMap.get(wid)?.isDoor ? 'DOOR' : 'WALL') as EdgeType),
```

La fonction complète `wallsToRooms` après modification (lignes 107-145) :

```ts
export function wallsToRooms(
  walls: Wall[],
  nodes: WallNode[],
  excludedZones: WallExcludedZone[] = [],
): Room[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const getPos = (id: string) => { const n = nodeMap.get(id)!; return { x: n.x, y: n.y }; };
  const wallMap = new Map(walls.map(w => [w.id, w]));

  const cycles = wallFaceCycles(walls, nodes);

  // Tri top-left → bottom-right pour nommage stable
  cycles.sort((a, b) => {
    const ptsA = a.nodeIds.map(getPos);
    const ptsB = b.nodeIds.map(getPos);
    const cya = ptsA.reduce((s, p) => s + p.y, 0) / ptsA.length;
    const cyb = ptsB.reduce((s, p) => s + p.y, 0) / ptsB.length;
    if (Math.abs(cya - cyb) > 1) return cya - cyb;
    return (ptsA.reduce((s, p) => s + p.x, 0) / ptsA.length) -
           (ptsB.reduce((s, p) => s + p.x, 0) / ptsB.length);
  });

  return cycles.map((cycle, idx) => {
    const facePts = cycle.nodeIds.map(id => getPos(id));
    const roomZones = excludedZones.filter(zone => {
      if (zone.points.length < 3) return false;
      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      return pointInPolygon({ x: cx, y: cy }, facePts);
    });
    return {
      id: faceId(cycle.nodeIds),
      name: `Pièce ${idx + 1}`,
      points: facePts,
      edges: cycle.wallIds.map(wid => (wallMap.get(wid)?.isDoor ? 'DOOR' : 'WALL') as EdgeType),
      partitions: [],
      excludedZones: roomZones,
    };
  });
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts --reporter=verbose
```

Attendu : PASS sur tous les tests (anciens + 2 nouveaux).

- [ ] **Step 5 : Suite complète**

```
npx vitest run
```

Attendu : tous les tests PASS (383+2 = 385).

- [ ] **Step 6 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 7 : Commit**

```
git add src/engine/geometry/wallFaces.ts src/engine/geometry/wallFaces.test.ts
git commit -m "fix(wall): propager isDoor dans wallsToRooms — arête porte correctement typée DOOR"
```

---

## Task 2 : Remplacer le rendu murs + corriger doorRectPath dans TilingCanvas

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx`
- Modify: `src/components/tiling/TilingCanvas.tsx`

Cette tâche :
1. Ajoute un sélecteur `wallEngine` dans `TilingEditor`, calcule `wallPolygons` via `computeCornerGeometry`, les passe à `TilingCanvas`
2. Dans `TilingCanvas` : remplace la boucle `<line>` par des `<polygon>` de mur (identique au plan editor), corrige la demi-largeur de `doorRectPath` (`door.thickness → door.thickness / 2`)

Il n'existe pas de test unitaire pour le rendu SVG — vérification visuelle uniquement. Les tests à exécuter sont les tests de régression existants.

- [ ] **Step 1 : Modifier `TilingEditor.tsx` — sélecteur wallEngine + wallPolygons**

Ajouter l'import suivant après l'import `selectActiveProject` (ligne 13) :

```ts
import { computeCornerGeometry } from '@/engine/geometry/wallGeometry';
```

Après la ligne `const doorOpenings = useProjectStore(useShallow(selectDoorOpenings));` (ligne 87), ajouter :

```ts
const wallEngine = useProjectStore(s => selectActiveProject(s)?.wallEngine);
const wallPolygons = useMemo(
  () => computeCornerGeometry((wallEngine?.walls ?? []).filter(w => !w.isDoor), wallEngine?.nodes ?? []),
  [wallEngine],
);
```

Dans le JSX `<TilingCanvas ...>` (ligne ~254), ajouter le prop `wallPolygons` :

```tsx
<TilingCanvas
  svgRef={svgRef}
  rooms={rooms}
  tiles={result.tiles}
  config={config}
  scale={scale}
  pan={pan}
  activeTool={activeTool}
  wallThickness={wallThickness}
  dimensionLayer={dimensionLayer}
  doorOpenings={doorOpenings}
  wallPolygons={wallPolygons}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onClick={handleClick}
/>
```

- [ ] **Step 2 : Modifier `TilingCanvas.tsx` — import + interface + prop**

Ajouter l'import `WallPolygon` après l'import `DoorOpening` (ligne 7) :

```ts
import type { WallPolygon } from '@/engine/geometry/wallGeometry';
```

Dans `TilingCanvasProps` (après `doorOpenings?: DoorOpening[];`), ajouter :

```ts
wallPolygons?: WallPolygon[];
```

Dans le destructuring du composant (après `doorOpenings = [],`), ajouter :

```ts
wallPolygons = [],
```

- [ ] **Step 3 : Corriger `doorRectPath` demi-largeur**

Remplacer dans `doorRectPath` (ligne 34) :

```ts
// Avant :
const px = (-dy / L) * door.thickness, py = (dx / L) * door.thickness;
// Après :
const px = (-dy / L) * (door.thickness / 2), py = (dx / L) * (door.thickness / 2);
```

La fonction `doorRectPath` corrigée :

```ts
function doorRectPath(door: DoorOpening): string {
  const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = (-dy / L) * (door.thickness / 2), py = (dx / L) * (door.thickness / 2);
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x   + px, y: door.to.y   + py },
    { x: door.to.x   - px, y: door.to.y   - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}
```

- [ ] **Step 4 : Remplacer la boucle `<line>` par des polygones de mur**

Remplacer le bloc `{/* Room walls and doors */}` (lignes 160-177) par :

```tsx
{/* Wall polygons — même géométrie que le plan editor */}
{wallPolygons.map((poly) => {
  if (!poly.points.length) return null;
  return (
    <polygon
      key={`wall-${poly.wallId}`}
      points={poly.points.map((p) => `${p.x},${p.y}`).join(' ')}
      fill="var(--canvas-wall)"
    />
  );
})}
```

Les murs `isDoor` ne sont PAS dans `wallPolygons` (filtrés dans TilingEditor) → ouverture visible naturellement.

- [ ] **Step 5 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 6 : Suite de tests**

```
npx vitest run
```

Attendu : tous les tests PASS (le changement est purement visuel/SVG).

- [ ] **Step 7 : Commit**

```
git add src/components/tiling/TilingCanvas.tsx src/components/tiling/TilingEditor.tsx
git commit -m "fix(tiling): polygones de mur identiques au plan + doorRectPath demi-largeur corrigée"
```
