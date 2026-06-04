# UX Fixes — Nommer les pièces + Échap SELECT + Portes calepinage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trois corrections indépendantes : renommage des pièces auto-détectées dans le bandeau latéral, basculement de l'outil sur SELECT à l'appui d'Échap, et affichage des carreaux entiers dans les ouvertures de porte lors du calepinage.

**Architecture:** Feature 1 — `wallRoomNames` dans le store + double-clic inline dans `WallRoomPanel`. Feature 2 — une ligne dans le listener `keydown` de `PlanEditor`. Feature 3 — nouveau type `DoorOpening`, sélecteur `selectDoorOpenings`, ajout d'un paramètre optionnel à `computeTilingMultiRoom` et `analyzeQuantities`, intégration dans `TilingEditor`.

**Tech Stack:** TypeScript, React, Zustand, Vitest.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/types/project.ts` | Ajouter `wallRoomNames?: Record<string, string>` dans `wallEngine` |
| `src/types/wall.ts` | Ajouter interface `DoorOpening` |
| `src/store/projectStore.ts` | `renameWallRoom` action, `selectRooms` avec noms, `restoreSnapshot` preserve noms, `selectDoorOpenings` |
| `src/components/plan/WallRoomPanel.tsx` | UI de renommage inline |
| `src/components/plan/PlanEditor.tsx` | `Escape` → `setTool('SELECT')` |
| `src/engine/tiling/tilingEngine.ts` | Paramètre `doorOpenings` dans `computeTilingMultiRoom` |
| `src/engine/tiling/tilingEngine.test.ts` | Tests portes |
| `src/engine/quantities/quantityEngine.ts` | Passer `doorOpenings` à `computeTilingMultiRoom` |
| `src/components/tiling/TilingEditor.tsx` | Sélectionner `doorOpenings` et les passer |

---

## Task 1 : Échap → outil SELECT

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx:151-166`

- [ ] **Step 1 : Modifier le listener keydown dans PlanEditor**

Ouvrir `src/components/plan/PlanEditor.tsx`. Trouver le `useEffect` autour de la ligne 151 qui contient le listener `keydown` (gère `Ctrl+Z` et `Ctrl+Y`). Ajouter la ligne `Escape` :

```ts
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      if (pastRef.current.length > 0) handleUndo();
      else if (onNavigateBack) onNavigateBack();
    }
    if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
      e.preventDefault();
      if (futureRef.current.length > 0) handleRedo();
    }
    if (e.key === 'Escape') setTool('SELECT');
  };
  window.addEventListener('keydown', down);
  return () => window.removeEventListener('keydown', down);
}, [handleUndo, handleRedo, onNavigateBack]);
```

- [ ] **Step 2 : Vérification TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 3 : Test manuel**

Lancer `npm run dev`. Sélectionner l'outil WALL, appuyer sur Échap → le bouton SELECT doit s'activer dans la barre d'outils. Faire de même depuis DOOR et EXCLUDE.

- [ ] **Step 4 : Commit**

```
git add src/components/plan/PlanEditor.tsx
git commit -m "feat(plan): Escape bascule toujours vers l'outil SELECT"
```

---

## Task 2 : Nommer les pièces auto-détectées

**Files:**
- Modify: `src/types/project.ts`
- Modify: `src/store/projectStore.ts`
- Modify: `src/components/plan/WallRoomPanel.tsx`

### Contexte

`wallsToRooms` génère des pièces avec `id: faceId(cycle.nodeIds)` — un hash djb2 stable des nœuds triés. Il génère aussi `name: 'Pièce ${idx+1}'`. Pour persister un nom saisi, on stocke `wallRoomNames: Record<roomId, string>` dans `wallEngine` et on écrase `room.name` dans `selectRooms`.

`restoreSnapshot` remplace entièrement `wallEngine` lors du undo/redo — il faut préserver `wallRoomNames` car les noms ne font pas partie de l'historique.

- [ ] **Step 1 : Écrire les tests qui doivent échouer**

Dans `src/store/projectStore.ts`, les tests pour `selectRooms` n'existent pas encore. Créer `src/store/wallRoomNames.test.ts` :

```ts
import { describe, expect, it } from 'vitest';

// selectRooms est une fonction pure — on peut la tester directement
// en lui passant un état minimal.
import { selectRooms } from './projectStore';
import type { ProjectState } from './projectStore';

// Helpers
const makeNode = (id: string, x: number, y: number) => ({ id, x, y });
const makeWall = (id: string, n1: string, n2: string) => ({ id, node1Id: n1, node2Id: n2, thickness: 100 });

// Carré fermé : A(0,0) B(1000,0) C(1000,1000) D(0,1000)
const nodes = [
  makeNode('A', 0, 0), makeNode('B', 1000, 0),
  makeNode('C', 1000, 1000), makeNode('D', 0, 1000),
];
const walls = [
  makeWall('w1', 'A', 'B'), makeWall('w2', 'B', 'C'),
  makeWall('w3', 'C', 'D'), makeWall('w4', 'D', 'A'),
];

function makeState(wallRoomNames?: Record<string, string>): ProjectState {
  return {
    projects: [{
      id: 'p1', name: 'Test', status: 'new' as const,
      createdAt: 0, updatedAt: 0, rooms: [], constraints: [], notes: [],
      config: { width: 300, height: 300, joint: 3, stagger: 0, angle: 0, layout: 'STRAIGHT' as const, offsetX: 0, offsetY: 0, chevronAngle: 45 },
      wallThickness: 100,
      wallEngine: { nodes, walls, excludedZones: [], ...(wallRoomNames ? { wallRoomNames } : {}) },
    }],
    activeProjectId: 'p1',
    hydrated: true,
  } as unknown as ProjectState;
}

describe('selectRooms — noms de pièces', () => {
  it('retourne le nom par défaut quand wallRoomNames est absent', () => {
    const rooms = selectRooms(makeState());
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.name).toBe('Pièce 1');
  });

  it('applique le nom stocké dans wallRoomNames', () => {
    const rooms = selectRooms(makeState());
    const roomId = rooms[0]!.id;
    const rooms2 = selectRooms(makeState({ [roomId]: 'Salon' }));
    expect(rooms2[0]!.name).toBe('Salon');
  });

  it('conserve le nom par défaut si l\'ID n\'est pas dans wallRoomNames', () => {
    const rooms = selectRooms(makeState({ 'unknown-id': 'Xyz' }));
    expect(rooms[0]!.name).toBe('Pièce 1');
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/store/wallRoomNames.test.ts
```

Attendu : FAIL — `selectRooms` n'applique pas encore `wallRoomNames`.

- [ ] **Step 3 : Étendre le type `wallEngine` dans `src/types/project.ts`**

Trouver la ligne ~98 :

```ts
// Avant
wallEngine?: {
  nodes: WallNode[];
  walls: Wall[];
  excludedZones: WallExcludedZone[];
};

// Après
wallEngine?: {
  nodes: WallNode[];
  walls: Wall[];
  excludedZones: WallExcludedZone[];
  wallRoomNames?: Record<string, string>;
};
```

- [ ] **Step 4 : Ajouter `renameWallRoom` à l'interface `ProjectState`**

Dans `src/store/projectStore.ts`, trouver dans l'interface `ProjectState` la ligne `renameRoom: (roomId: string, name: string) => void;` (~ligne 27). Ajouter juste après :

```ts
renameWallRoom: (roomId: string, name: string) => void;
```

- [ ] **Step 5 : Implémenter `renameWallRoom` dans le store**

Trouver l'implémentation de `renameRoom` (~ligne 192) :

```ts
renameRoom: (roomId, name) => {
  get().updateActive((p) => ({
    ...p,
    rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)),
  }));
},
```

Ajouter juste après :

```ts
renameWallRoom: (roomId, name) => {
  get().updateActive((p) => {
    if (!p.wallEngine) return p;
    return {
      ...p,
      wallEngine: {
        ...p.wallEngine,
        wallRoomNames: { ...(p.wallEngine.wallRoomNames ?? {}), [roomId]: name },
      },
    };
  });
},
```

- [ ] **Step 6 : Mettre à jour `selectRooms` pour fusionner les noms**

Trouver `selectRooms` (~ligne 518) :

```ts
// Avant
export function selectRooms(s: ProjectState): Room[] {
  const project = selectActiveProject(s);
  if (!project) return [];
  const we = project.wallEngine;
  if (we !== undefined) return wallsToRooms(we.walls, we.nodes, we.excludedZones ?? []);
  return project.rooms;
}

// Après
export function selectRooms(s: ProjectState): Room[] {
  const project = selectActiveProject(s);
  if (!project) return [];
  const we = project.wallEngine;
  if (we !== undefined) {
    const rooms = wallsToRooms(we.walls, we.nodes, we.excludedZones ?? []);
    const names = we.wallRoomNames ?? {};
    return rooms.map((r) => names[r.id] ? { ...r, name: names[r.id] } : r);
  }
  return project.rooms;
}
```

- [ ] **Step 7 : Préserver `wallRoomNames` dans `restoreSnapshot`**

Trouver `restoreSnapshot` (~ligne 264) :

```ts
// Avant
restoreSnapshot: (rooms, constraints, wallEngine) => {
  get().updateActive((p) => ({
    ...p,
    rooms,
    constraints,
    ...(wallEngine !== undefined ? { wallEngine } : {}),
  }));
},

// Après
restoreSnapshot: (rooms, constraints, wallEngine) => {
  get().updateActive((p) => ({
    ...p,
    rooms,
    constraints,
    ...(wallEngine !== undefined
      ? { wallEngine: { ...wallEngine, wallRoomNames: p.wallEngine?.wallRoomNames } }
      : {}),
  }));
},
```

- [ ] **Step 8 : Vérifier que les tests passent**

```
npx vitest run src/store/wallRoomNames.test.ts
```

Attendu : 3 tests PASS.

- [ ] **Step 9 : Ajouter l'UI de renommage dans `WallRoomPanel`**

Remplacer le contenu de `src/components/plan/WallRoomPanel.tsx` par :

```tsx
// src/components/plan/WallRoomPanel.tsx
'use client';

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { selectRooms } from '@/store/projectStore';
import { getPolygonArea } from '@/engine/geometry/polygon';
import { formatM2 } from '@/utils/formatters';
import type { SnapZone } from './useDraggableSnap';
import type { Room } from '@/types/project';

interface WallRoomPanelProps {
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  tutorialMode?: boolean;
}

const CANVAS_TOP_PX      = 92;
const SIDE_LEFT_NORMAL   = 72;
const SIDE_LEFT_TUTORIAL = 216;

const getPanelStyle = (zone: SnapZone, tutorialMode: boolean): React.CSSProperties => {
  if (zone === 'SIDE') return { position: 'fixed', left: tutorialMode ? SIDE_LEFT_TUTORIAL : SIDE_LEFT_NORMAL, top: CANVAS_TOP_PX + 16, zIndex: 10 };
  if (zone === 'TOP')  return { position: 'fixed', top: CANVAS_TOP_PX + 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 };
  return { position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 };
};

const getDropZoneStyle = (zone: SnapZone, tutorialMode: boolean): React.CSSProperties => {
  if (zone === 'SIDE') {
    const left = (tutorialMode ? SIDE_LEFT_TUTORIAL : SIDE_LEFT_NORMAL) - 8;
    return { position: 'fixed', left, top: CANVAS_TOP_PX + 8, width: 140, height: 200, zIndex: 9, borderRadius: 16 };
  }
  if (zone === 'TOP')  return { position: 'fixed', left: '25%', top: CANVAS_TOP_PX + 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 };
  return { position: 'fixed', left: '25%', bottom: 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 };
};

export const WallRoomPanel = ({
  zone,
  isDragging,
  onPointerDown,
  tutorialMode = false,
}: WallRoomPanelProps) => {
  const rooms = useProjectStore(selectRooms);
  const renameWallRoom = useProjectStore((s) => s.renameWallRoom);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (room: Room) => {
    setRenamingId(room.id);
    setRenameValue(room.name ?? '');
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commitRename = () => {
    if (renamingId) {
      renameWallRoom(renamingId, renameValue.trim());
      setRenamingId(null);
    }
  };

  return (
    <>
      {isDragging && (['SIDE', 'TOP', 'BOTTOM'] as SnapZone[]).map((z) => (
        <div
          key={z}
          className="pointer-events-none"
          style={{
            ...getDropZoneStyle(z, tutorialMode),
            border: '2px dashed rgba(249,115,22,0.4)',
            background: 'rgba(249,115,22,0.06)',
          }}
        />
      ))}

      <div
        className={`group ${isDragging ? '' : 'transition-all duration-150 ease-out'}`}
        style={getPanelStyle(zone, tutorialMode)}
      >
        <div
          className="absolute -right-5 top-1/2 -translate-y-1/2 flex h-8 w-5 cursor-grab items-center justify-center rounded-r-lg opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
          onPointerDown={onPointerDown}
        >
          <GripVertical size={12} style={{ color: 'var(--muted)' }} />
        </div>

        <div
          className="flex flex-col gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md"
          style={{ minWidth: 140 }}
        >
          <p
            className="px-3 pt-1 pb-0 text-[9px] font-black uppercase tracking-[0.15em]"
            style={{ color: 'var(--muted)' }}
          >
            Pièces
          </p>
          <div className="mx-2 h-px bg-gray-200 dark:bg-zinc-700" />

          {rooms.length === 0 ? (
            <p className="px-3 py-2 text-[11px] italic" style={{ color: 'var(--muted)' }}>
              Aucune pièce fermée
            </p>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="rounded-xl px-3 py-1.5">
                {renamingId === room.id ? (
                  <input
                    ref={inputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-full rounded bg-zinc-800 px-1 text-[11px] font-bold text-orange-400 outline-none"
                  />
                ) : (
                  <p
                    className="text-[11px] font-bold text-orange-500 dark:text-orange-400 cursor-pointer select-none"
                    title="Double-clic pour renommer"
                    onDoubleClick={() => startRename(room)}
                  >
                    {room.name}
                  </p>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text2)' }}>
                  {formatM2(getPolygonArea(room.points))}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
```

- [ ] **Step 10 : TypeScript + suite de tests**

```
npx tsc --noEmit
npx vitest run
```

Attendu : 0 erreurs TS, tous les tests PASS.

- [ ] **Step 11 : Commit**

```
git add src/types/project.ts src/store/projectStore.ts src/store/wallRoomNames.test.ts src/components/plan/WallRoomPanel.tsx
git commit -m "feat(wall-rooms): renommage des pièces auto-détectées dans WallRoomPanel"
```

---

## Task 3 : Portes dans le calepinage

**Files:**
- Modify: `src/types/wall.ts`
- Modify: `src/store/projectStore.ts`
- Modify: `src/engine/tiling/tilingEngine.ts`
- Modify: `src/engine/tiling/tilingEngine.test.ts`
- Modify: `src/engine/quantities/quantityEngine.ts`
- Modify: `src/components/tiling/TilingEditor.tsx`

### Contexte

`computeTilingMultiRoom` génère les carreaux pour chaque pièce sur une grille commune ancrée sur le bbox des pièces. Les murs `isDoor:true` forment une frontière opaque dans le graphe : aucun carreau n'apparaît dans le passage de porte.

L'algorithme : pour chaque ouverture de porte, parcourir la même grille (mêmes `startX/Y`, `stepX/Y`, stagger) et retenir les carreaux dont les 4 coins sont entièrement dans le rectangle de la porte (largeur du passage × `wallThickness` de chaque côté de la ligne centrale du mur). Uniquement pour `layout='STRAIGHT'` et `angle=0` en V1.

Les nœuds de la porte sont sur la ligne centrale du mur. La zone de passage s'étend de `-wallThickness` à `+wallThickness` perpendiculairement au segment de porte.

- [ ] **Step 1 : Écrire les tests qui doivent échouer**

D'abord, mettre à jour les imports en tête de `src/engine/tiling/tilingEngine.test.ts` :

```ts
// Remplacer la ligne d'import existante :
import { computeTiling } from './tilingEngine';
// Par :
import { computeTiling, computeTilingMultiRoom } from './tilingEngine';
```

Puis ajouter les deux imports de types après les imports existants :

```ts
import type { DoorOpening } from '@/types/wall';
import type { Room } from '@/types/project';
```

Puis ajouter à la fin du fichier :

```ts
describe('computeTilingMultiRoom — ouvertures de porte', () => {
  const room: Room = {
    id: 'r1',
    name: 'Test',
    points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    partitions: [],
    excludedZones: [],
  };
  const config = {
    ...DEFAULT_TILING_CONFIG,
    width: 300,
    height: 300,
    joint: 0,
    angle: 0,
    offsetX: 0,
    offsetY: 0,
    layout: 'STRAIGHT' as const,
  };

  it('génère des carreaux WHOLE dans une ouverture de porte suffisamment large', () => {
    // Door horizontal : de (0,1500) à (900,1500), wallThickness=200
    // La zone de passage s'étend de y=1300 à y=1700 (±200 de la ligne centrale)
    // Un carreau de 300mm de haut rentrant dans ±200 → possible si positionné sur y=1400
    const door: DoorOpening = { from: { x: 0, y: 1500 }, to: { x: 900, y: 1500 }, thickness: 200 };
    const result = computeTilingMultiRoom([room], config, 200, [door]);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles.length).toBeGreaterThan(0);
    expect(doorTiles.every((t) => t.type === 'WHOLE')).toBe(true);
  });

  it('ne génère aucun carreau si la largeur de porte est inférieure à la dimension du carreau', () => {
    // Ouverture 200mm < carreau 300mm → aucun carreau ne rentre
    const door: DoorOpening = { from: { x: 0, y: 1500 }, to: { x: 200, y: 1500 }, thickness: 200 };
    const result = computeTilingMultiRoom([room], config, 200, [door]);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles).toHaveLength(0);
  });

  it('sans doorOpenings, aucun carreau de porte', () => {
    const result = computeTilingMultiRoom([room], config, 200);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles).toHaveLength(0);
  });

  it('ignore les portes pour layout HERRINGBONE (V1)', () => {
    const door: DoorOpening = { from: { x: 0, y: 1500 }, to: { x: 900, y: 1500 }, thickness: 200 };
    const hbConfig = { ...config, layout: 'HERRINGBONE' as const };
    const result = computeTilingMultiRoom([room], hbConfig, 200, [door]);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/tiling/tilingEngine.test.ts
```

Attendu : FAIL — `computeTilingMultiRoom` ne prend pas encore de paramètre `doorOpenings`.

- [ ] **Step 3 : Ajouter `DoorOpening` dans `src/types/wall.ts`**

Ajouter à la fin du fichier, après `AutoCotation` :

```ts
export interface DoorOpening {
  from: Point;       // nœud 1 du mur porte (coords monde)
  to: Point;         // nœud 2 du mur porte (coords monde)
  thickness: number; // épaisseur du mur (mm)
}
```

- [ ] **Step 4 : Ajouter `selectDoorOpenings` dans `src/store/projectStore.ts`**

Ajouter l'import en tête de fichier :

```ts
import type { Wall, WallNode, WallExcludedZone, DoorOpening } from '@/types/wall';
```

(remplacer la ligne d'import existante de `@/types/wall`)

Puis à la fin du fichier, après `selectRooms` :

```ts
export function selectDoorOpenings(s: ProjectState): DoorOpening[] {
  const project = selectActiveProject(s);
  if (!project?.wallEngine) return [];
  const { walls, nodes } = project.wallEngine;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return walls
    .filter((w) => w.isDoor)
    .flatMap((w) => {
      const n1 = nodeMap.get(w.node1Id);
      const n2 = nodeMap.get(w.node2Id);
      if (!n1 || !n2) return [];
      return [{ from: { x: n1.x, y: n1.y }, to: { x: n2.x, y: n2.y }, thickness: w.thickness }];
    });
}
```

- [ ] **Step 5 : Mettre à jour `computeTilingMultiRoom` dans `src/engine/tiling/tilingEngine.ts`**

Ajouter l'import en tête (remplacer la ligne 1-6 existante) :

```ts
import type { Point } from '@/types/plan';
import type { EdgeType, ExcludedZone, Partition, Room } from '@/types/project';
import type { Tile, TileType, TilingConfig, TilingResult } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { getBoundingBox, distance, rotatePoint, getPolygonArea, pointInPolygon, getIntersection, insetRoomPolygon } from '@/engine/geometry/polygon';
import { classifyTile, classifyPolygonTile } from '@/engine/geometry/clipping';
import { computeStats } from './cutCalculator';
```

Modifier la signature de `computeTilingMultiRoom` (ligne ~270) :

```ts
// Avant
export const computeTilingMultiRoom = (rooms: Room[], config: TilingConfig, wallThickness = 0): TilingResult => {

// Après
export const computeTilingMultiRoom = (rooms: Room[], config: TilingConfig, wallThickness = 0, doorOpenings: DoorOpening[] = []): TilingResult => {
```

Dans le bloc `if (layout === 'STRAIGHT')` de `computeTilingMultiRoom`, trouver la fin de la boucle principale (le `rowIndex += 1;` final) et ajouter le bloc des carreaux de porte juste avant la fermeture du bloc `if (layout === 'STRAIGHT')` :

```ts
  // Carreaux dans les ouvertures de porte (STRAIGHT, angle = 0 uniquement)
  if (angle === 0 && doorOpenings.length > 0) {
    for (const door of doorOpenings) {
      const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
      const L = Math.sqrt(dx * dx + dy * dy);
      if (L < 1) continue;
      const dirX = dx / L, dirY = dy / L;
      const perpX = -dirY, perpY = dirX;
      const halfGap = wallThickness;
      let ri = 0;
      for (let y = startY - stepY; y < endY + stepY; y += stepY) {
        const rowStagger = (ri % 2) * (stepX * staggerRatio);
        for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
          const corners = [
            { x, y }, { x: x + width, y },
            { x: x + width, y: y + height }, { x, y: y + height },
          ];
          const fits = corners.every((c) => {
            const t = (c.x - door.from.x) * dirX + (c.y - door.from.y) * dirY;
            const s = (c.x - door.from.x) * perpX + (c.y - door.from.y) * perpY;
            return t >= 0 && t <= L && Math.abs(s) <= halfGap;
          });
          if (fits) {
            const id = `door-${x.toFixed(0)}-${y.toFixed(0)}`;
            if (!tiles.some((t) => t.id === id)) {
              tiles.push({ id, rect: { x, y, w: width, h: height }, type: 'WHOLE' as const });
            }
          }
        }
        ri++;
      }
    }
  }
```

Le bloc `if (layout === 'STRAIGHT')` complet ressemble à ceci (pour avoir le contexte d'insertion) :

```ts
if (layout === 'STRAIGHT') {
  const staggerRatio = stagger / 100;
  const allTestPoints = testRooms.flatMap((r) => r.testPoints);
  const testBbox = getBoundingBox(allTestPoints);
  const { startX, startY, endX, endY, stepX, stepY } = buildGrid(testBbox, config);
  let rowIndex = 0;

  for (let y = startY - stepY; y < endY + stepY; y += stepY) {
    const rowStagger = (rowIndex % 2) * (stepX * staggerRatio);
    for (let x = startX - stepX - rowStagger; x < endX + stepX; x += stepX) {
      const rect = { x, y, w: width, h: height };
      let bestType: TileType = 'OUTSIDE';
      for (const { testPoints, edges } of testRooms) {
        const t = classifyTile(rect, testPoints, edges);
        if (t === 'WHOLE') { bestType = 'WHOLE'; break; }
        if (t === 'CUT') bestType = 'CUT';
      }
      if (bestType !== 'OUTSIDE') {
        tiles.push({ id: `${x.toFixed(0)}-${y.toFixed(0)}`, rect, type: bestType });
      }
    }
    rowIndex += 1;
  }

  // ← INSÉRER ICI le bloc "Carreaux dans les ouvertures de porte" ci-dessus
}
```

- [ ] **Step 6 : Vérifier que les tests passent**

```
npx vitest run src/engine/tiling/tilingEngine.test.ts
```

Attendu : 7 tests PASS (3 existants + 4 nouveaux).

- [ ] **Step 7 : Mettre à jour `analyzeQuantities` dans `src/engine/quantities/quantityEngine.ts`**

Ajouter l'import :

```ts
import type { DoorOpening } from '@/types/wall';
```

Modifier la signature :

```ts
// Avant
export function analyzeQuantities(rooms: Room[], config: TilingConfig, wallThickness = 0): QuantityResult {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config, wallThickness);

// Après
export function analyzeQuantities(rooms: Room[], config: TilingConfig, wallThickness = 0, doorOpenings: DoorOpening[] = []): QuantityResult {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const { tiles, stats } = computeTilingMultiRoom(rooms, config, wallThickness, doorOpenings);
```

- [ ] **Step 8 : Mettre à jour `TilingEditor` pour passer les ouvertures de porte**

Dans `src/components/tiling/TilingEditor.tsx`, ajouter l'import :

```ts
import { useProjectStore, selectActiveProject, selectDoorOpenings } from '@/store/projectStore';
```

(remplacer la ligne d'import du store existante)

Puis dans le corps du composant, juste après la ligne `const dimensions = ...` (~ligne 88), ajouter :

```ts
const doorOpenings = useProjectStore(selectDoorOpenings);
```

Et modifier le `useMemo` (~ligne 86) qui calcule `result` :

```ts
// Avant
const result = useMemo(() => analyzeQuantities(rooms, config, wallThickness), [rooms, config, wallThickness]);

// Après
const result = useMemo(
  () => analyzeQuantities(rooms, config, wallThickness, doorOpenings),
  [rooms, config, wallThickness, doorOpenings],
);
```

- [ ] **Step 9 : TypeScript + suite complète**

```
npx tsc --noEmit
npx vitest run
```

Attendu : 0 erreurs TS, tous les tests PASS.

- [ ] **Step 10 : Commit**

```
git add src/types/wall.ts src/store/projectStore.ts src/engine/tiling/tilingEngine.ts src/engine/tiling/tilingEngine.test.ts src/engine/quantities/quantityEngine.ts src/components/tiling/TilingEditor.tsx
git commit -m "feat(tiling): carreaux entiers dans les ouvertures de porte (STRAIGHT, angle=0)"
```
