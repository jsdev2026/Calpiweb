# Drawing UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trois améliorations UX sur l'outil de dessin : ancrage automatique du premier nœud, centrage de la vue à l'ouverture, et suppression contextuelle unitaire via le bouton Trash.

**Architecture:** Feature 1 modifie le handler WALL dans `PlanEditor.tsx`. Feature 2 extrait une fonction pure `computeInitialView` exportée depuis `PlanEditor.tsx` + un `useEffect` au montage. Feature 3 remplace `onClearRoom` dans `PlanToolbar.tsx` par trois nouvelles props (`onDelete`, `canDelete`, `deleteTooltipLabel`) et ajoute un handler `handleTrashClick` dans `PlanEditor.tsx`.

**Tech Stack:** TypeScript, React 18, Vitest, Tailwind CSS

---

## Contexte codebase — à lire avant de commencer

### Types clés

```ts
// src/types/project.ts
export interface PointRef {
  roomId: string;
  vertexIdx: number;   // ← c'est vertexIdx, pas index
}

export interface Constraint {
  id: string;
  type: 'LENGTH' | 'FIX' | 'H_DISTANCE' | 'V_DISTANCE' | 'COINCIDE';
  pts: PointRef[];
  value?: number | { x: number; y: number };
}

export type EdgeType = 'WALL' | 'DOOR';
```

```ts
// src/components/plan/DrawingCanvas.tsx (types exportés)
export interface EditingEdgeState { roomId: string; edgeIndex: number; } // ← edgeIndex
export interface EditingZoneEdge  { roomId: string; zoneId: string; edgeIndex: number; }
// editingPartition : { roomId: string; partitionId: string }
```

### Helpers dans PlanEditor.tsx (non exportés — déjà présents)

```ts
function ref(roomId: string, vertexIdx: number): PointRef { return { roomId, vertexIdx }; }
function removeDoorFromRoom(room, doorEdgeIdx): { points, edges } | null { ... }
```

### Store : fonctions utiles

```ts
addConstraint(c: Constraint) => void
removeConstraint(id: string) => void
updateRoom(roomId, points, edges) => void
removePartition(roomId, partitionId) => void
removeExcludedZone(roomId, zoneId) => void
generateId() => string   // import from '@/utils/id'
```

### Pattern de tests (PlanEditor)

Les tests pour `PlanEditor` sont des **tests de logique pure** — ils n'instancient pas le composant. Voir `PlanEditor.toolbar.test.ts`, `PlanEditor.dimension.test.ts`. Import pattern :

```ts
import { describe, it, expect } from 'vitest';
import type { EdgeType } from '@/types/project';
```

---

## Fichiers modifiés/créés

| Fichier | Changement |
|---|---|
| `src/components/plan/PlanEditor.tsx` | Export `computeInitialView` · auto-anchor bloc WALL · `useEffect` centrage · `handleTrashClick` · `editingContext` / `canDelete` / `deleteTooltipLabel` · props `onDelete`+`canDelete`+`deleteTooltipLabel` vers Toolbar |
| `src/components/plan/PlanToolbar.tsx` | Remplace `onClearRoom` par `onDelete`+`canDelete`+`deleteTooltipLabel` · bouton Trash disabled + tooltip dynamique |
| `src/components/plan/PlanEditor.toolbar.test.ts` | Nouveaux tests pour les 3 features |
| `src/components/plan/PlanEditor.viewport.test.ts` | **Créé** — tests `computeInitialView` |

---

## Task 1 : Auto-anchor premier nœud

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx` (bloc WALL dans `handlePointerDown`, ~ligne 752)
- Test: `src/components/plan/PlanEditor.toolbar.test.ts` (append)

### Contexte : où insérer

Dans `handlePointerDown`, le bloc WALL commence vers la ligne 752 :

```tsx
if (tool === 'WALL') {
  if (!activeRoom) return;
  const refPt = activeRoom.points[activeRoom.points.length - 1];
  const { point: snapped } = snapPos(raw, refPt);
  const pts = activeRoom.points;
  if (canCloseActiveRoom && distance(snapped, pts[0]!) < CLOSING_TOLERANCE_MM) { setTool('SELECT'); return; }
  pushHistory(); updateRoom(activeRoom.id, [...pts, snapped], [...activeRoom.edges, 'WALL']);
  return;
}
```

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `src/components/plan/PlanEditor.toolbar.test.ts` :

```ts
// ── Auto-anchor premier nœud ────────────────────────────────────────────────

describe('auto-anchor premier nœud', () => {
  it('devrait ancrer quand pièce 0, point 0', () => {
    const isFirstRoom = true;
    const isFirstPoint = true;
    const shouldAutoAnchor = isFirstRoom && isFirstPoint;
    expect(shouldAutoAnchor).toBe(true);
  });

  it('ne devrait pas ancrer pour la deuxième pièce', () => {
    const isFirstRoom = false;
    const isFirstPoint = true;
    const shouldAutoAnchor = isFirstRoom && isFirstPoint;
    expect(shouldAutoAnchor).toBe(false);
  });

  it('ne devrait pas ancrer pour le deuxième point de la pièce 0', () => {
    const isFirstRoom = true;
    const isFirstPoint = false;
    const shouldAutoAnchor = isFirstRoom && isFirstPoint;
    expect(shouldAutoAnchor).toBe(false);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests passent déjà (logique triviale)**

```bash
cd /workspaces/Calpiweb && npm test -- --run --reporter=verbose src/components/plan/PlanEditor.toolbar.test.ts
```

Expected: PASS (ces tests valident une condition booléenne).

- [ ] **Step 3 : Implémenter l'auto-anchor dans PlanEditor.tsx**

Remplacer le bloc WALL dans `handlePointerDown` :

```tsx
// ── WALL ──
if (tool === 'WALL') {
  if (!activeRoom) return;
  const refPt = activeRoom.points[activeRoom.points.length - 1];
  const { point: snapped } = snapPos(raw, refPt);
  const pts = activeRoom.points;
  if (canCloseActiveRoom && distance(snapped, pts[0]!) < CLOSING_TOLERANCE_MM) { setTool('SELECT'); return; }
  pushHistory();
  updateRoom(activeRoom.id, [...pts, snapped], [...activeRoom.edges, 'WALL']);
  // Auto-ancrage : premier nœud de la première pièce uniquement
  if (rooms.indexOf(activeRoom) === 0 && pts.length === 0) {
    addConstraint({ id: generateId(), type: 'FIX', pts: [ref(activeRoom.id, 0)], value: { x: snapped.x, y: snapped.y } });
  }
  return;
}
```

- [ ] **Step 4 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb && npm test -- --run 2>&1 | tail -8
```

Expected: `Tests  NNN passed (NNN)` sans aucune failure.

- [ ] **Step 5 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(drawing): ancrage automatique du premier nœud de la première pièce"
```

---

## Task 2 : Centrage de la vue à l'ouverture

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx` (export `computeInitialView` + nouveau `useEffect`)
- Create: `src/components/plan/PlanEditor.viewport.test.ts`

### Remarque importante

`computeInitialView` doit être exportée **en dehors du composant**, après les helpers existants (ligne ~185), pour être testable. Elle ne dépend d'aucun hook.

- [ ] **Step 1 : Créer le fichier de test avec les tests qui échouent**

Créer `src/components/plan/PlanEditor.viewport.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import type { Room } from '@/types/project';
import { computeInitialView } from './PlanEditor';

const makeRoom = (pts: { x: number; y: number }[]): Room => ({
  id: 'r1',
  points: pts,
  edges: pts.map(() => 'WALL' as const),
  partitions: [],
  excludedZones: [],
});

describe('computeInitialView', () => {
  it('retourne null si aucune pièce', () => {
    expect(computeInitialView([], 800, 600)).toBeNull();
  });

  it('retourne null si les pièces n\'ont pas de points', () => {
    const rooms: Room[] = [makeRoom([])];
    expect(computeInitialView(rooms, 800, 600)).toBeNull();
  });

  it('centre la bounding box dans le viewport', () => {
    // Pièce 1000×1000 mm centrée en (500, 500)
    const rooms = [makeRoom([
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { x: 1000, y: 1000 }, { x: 0, y: 1000 },
    ])];
    const result = computeInitialView(rooms, 800, 600);
    expect(result).not.toBeNull();
    // Centre monde (500, 500) doit mapper au centre viewport (400, 300)
    expect(result!.pan.x + 500 * result!.scale).toBeCloseTo(400);
    expect(result!.pan.y + 500 * result!.scale).toBeCloseTo(300);
  });

  it('scale plafonné à 0.5', () => {
    // Pièce minuscule → scale serait > 0.5 sans cap
    const rooms = [makeRoom([
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 10 }, { x: 0, y: 10 },
    ])];
    const result = computeInitialView(rooms, 800, 600);
    expect(result!.scale).toBeLessThanOrEqual(0.5);
  });

  it('gère un seul point (bbox dégénérée → fallback 1000×1000)', () => {
    const rooms = [makeRoom([{ x: 500, y: 400 }])];
    const result = computeInitialView(rooms, 800, 600);
    expect(result).not.toBeNull();
    // Le fallback évite une division par zéro
    expect(result!.scale).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent (import manquant)**

```bash
cd /workspaces/Calpiweb && npm test -- --run src/components/plan/PlanEditor.viewport.test.ts 2>&1 | grep -E "FAIL|Error|passed|failed"
```

Expected: FAIL — `computeInitialView` n'est pas encore exportée.

- [ ] **Step 3 : Exporter `computeInitialView` depuis PlanEditor.tsx**

Ajouter après `function ref(...)` (~ligne 183), **avant** le composant :

```tsx
/**
 * Calcule le scale et le pan initiaux pour centrer les pièces dans le viewport.
 * Retourne null si aucun point n'existe (canvas vide).
 */
export function computeInitialView(
  rooms: Room[],
  viewW: number,
  viewH: number,
): { scale: number; pan: { x: number; y: number } } | null {
  const allPoints = rooms.flatMap((r) => r.points);
  if (allPoints.length === 0) return null;

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bboxW = maxX - minX || 1000;
  const bboxH = maxY - minY || 1000;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const PADDING = 80;
  const newScale = Math.min(
    (viewW - PADDING * 2) / bboxW,
    (viewH - PADDING * 2) / bboxH,
    0.5,
  );

  return {
    scale: newScale,
    pan: { x: viewW / 2 - cx * newScale, y: viewH / 2 - cy * newScale },
  };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npm test -- --run src/components/plan/PlanEditor.viewport.test.ts 2>&1 | tail -6
```

Expected: `Tests  5 passed (5)`.

- [ ] **Step 5 : Ajouter le `useEffect` de centrage dans PlanEditor**

Dans le composant `PlanEditor`, après les `useEffect` existants (~ligne 344), ajouter :

```tsx
// ── Centrage initial sur les pièces existantes ────────────────────────────
useEffect(() => {
  requestAnimationFrame(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { width: vw, height: vh } = svg.getBoundingClientRect();
    const view = computeInitialView(rooms, vw, vh);
    if (!view) return;
    setScale(view.scale);
    setPan(view.pan);
  });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Le commentaire `eslint-disable` est intentionnel : on veut que cet effet ne tourne qu'au montage, pas à chaque changement de `rooms`.

- [ ] **Step 6 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb && npm test -- --run 2>&1 | tail -8
```

Expected: tous les tests passent.

- [ ] **Step 7 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.viewport.test.ts
git commit -m "feat(drawing): centrage automatique de la vue à l'ouverture du plan"
```

---

## Task 3 : Suppression contextuelle (bouton Trash)

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx` (props + bouton Trash)
- Modify: `src/components/plan/PlanEditor.tsx` (handler + dérivations + passage des props)
- Test: `src/components/plan/PlanEditor.toolbar.test.ts` (append)

### Vue d'ensemble de la feature

Le bouton Trash :
- Est **disabled** quand `canDelete === false`
- Affiche un **tooltip dynamique** via `deleteTooltipLabel`
- Appelle `onDelete()` qui dispatche selon le contexte :

| `editingContext` | Action dans `handleTrashClick` |
|---|---|
| `'partition'` | `removePartition(roomId, partitionId)` |
| `'zone'` | `removeExcludedZone(roomId, zoneId)` |
| `'door'` | `removeDoorFromRoom(room, edgeIndex)` + `updateRoom` |
| `'wall'` | Rotation des points + suppression edge + `updateRoom` + `setTool('WALL')` |

### Partie A — Tests (écrire d'abord)

- [ ] **Step 1 : Ajouter les tests dans PlanEditor.toolbar.test.ts**

Ajouter à la fin du fichier :

```ts
// ── canDelete ────────────────────────────────────────────────────────────────

describe('canDelete', () => {
  it('false quand aucun état d\'édition actif', () => {
    const editingEdge = null, editingPartition = null, editingZoneEdge = null;
    const canDelete = !!(editingEdge ?? editingPartition ?? editingZoneEdge);
    expect(canDelete).toBe(false);
  });

  it('true quand editingEdge est défini', () => {
    const editingEdge = { roomId: 'r1', edgeIndex: 2 };
    const canDelete = !!(editingEdge ?? null ?? null);
    expect(canDelete).toBe(true);
  });

  it('true quand editingPartition est défini', () => {
    const editingEdge = null;
    const editingPartition = { roomId: 'r1', partitionId: 'p1' };
    const canDelete = !!(editingEdge ?? editingPartition ?? null);
    expect(canDelete).toBe(true);
  });
});

// ── editingContext ────────────────────────────────────────────────────────────

describe('editingContext', () => {
  it('\'partition\' quand editingPartition est défini', () => {
    const editingPartition = { roomId: 'r1', partitionId: 'p1' };
    const editingZoneEdge = null;
    const editingEdge = null;
    const ctx =
      editingPartition ? 'partition'
      : editingZoneEdge ? 'zone'
      : editingEdge
        ? (('WALL' as EdgeType) === 'DOOR' ? 'door' : 'wall')
        : null;
    expect(ctx).toBe('partition');
  });

  it('\'zone\' quand editingZoneEdge est défini', () => {
    const editingPartition = null;
    const editingZoneEdge = { roomId: 'r1', zoneId: 'z1', edgeIndex: 0 };
    const editingEdge = null;
    const ctx =
      editingPartition ? 'partition'
      : editingZoneEdge ? 'zone'
      : editingEdge
        ? (('WALL' as EdgeType) === 'DOOR' ? 'door' : 'wall')
        : null;
    expect(ctx).toBe('zone');
  });

  it('\'wall\' quand editingEdge WALL', () => {
    const edgeType: EdgeType = 'WALL';
    const ctx = edgeType === 'DOOR' ? 'door' : 'wall';
    expect(ctx).toBe('wall');
  });

  it('\'door\' quand editingEdge DOOR', () => {
    const edgeType: EdgeType = 'DOOR';
    const ctx = edgeType === 'DOOR' ? 'door' : 'wall';
    expect(ctx).toBe('door');
  });
});

// ── Réouverture pièce (wall delete) ──────────────────────────────────────────

describe('réouverture pièce sur suppression mur', () => {
  it('rotation correcte des points pour edge 1 sur pièce [A,B,C,D]', () => {
    const points = [
      { x: 0,   y: 0   },   // A=0
      { x: 100, y: 0   },   // B=1
      { x: 100, y: 100 },   // C=2
      { x: 0,   y: 100 },   // D=3
    ];
    const edges: EdgeType[] = ['WALL', 'WALL', 'WALL', 'WALL'];
    // Supprimer edge B→C (index 1) → rotateBy = (1+1)%4 = 2
    const splitIdx = 1;
    const n = points.length;
    const rotateBy = (splitIdx + 1) % n;
    const newPoints = [...points.slice(rotateBy), ...points.slice(0, rotateBy)];
    const reordered = [...edges.slice(rotateBy), ...edges.slice(0, rotateBy)];
    const newEdges = reordered.slice(0, n - 1);

    // Nouvel ordre : [C, D, A, B]
    expect(newPoints[0]).toEqual({ x: 100, y: 100 }); // C
    expect(newPoints[1]).toEqual({ x: 0,   y: 100 }); // D
    expect(newPoints[2]).toEqual({ x: 0,   y: 0   }); // A
    expect(newPoints[3]).toEqual({ x: 100, y: 0   }); // B
    expect(newEdges.length).toBe(3);
  });

  it('rotation index contrainte : ancien vertexIdx j → (j - rotateBy + n) % n', () => {
    const n = 4, rotateBy = 2;
    // vertexIdx 0 → (0 - 2 + 4) % 4 = 2
    expect((0 - rotateBy + n) % n).toBe(2);
    // vertexIdx 2 → (2 - 2 + 4) % 4 = 0
    expect((2 - rotateBy + n) % n).toBe(0);
    // vertexIdx 3 → (3 - 2 + 4) % 4 = 1
    expect((3 - rotateBy + n) % n).toBe(1);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests passent (logique pure)**

```bash
cd /workspaces/Calpiweb && npm test -- --run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -6
```

Expected: tous les tests du fichier passent.

### Partie B — PlanToolbar.tsx

- [ ] **Step 3 : Mettre à jour PlanToolbar.tsx**

Remplacer l'interface, la destructuration, le tooltip `clear`, et les deux boutons Trash :

**Interface** — remplacer `onClearRoom: () => void` par :
```tsx
interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleteTooltipLabel: string;
  wallThickness: number;
  onWallThicknessChange: (mm: number) => void;
  tutorialMode: boolean;
  onToggleTutorial: () => void;
}
```

**Tooltip `clear`** — mettre à jour la description :
```tsx
clear: { label: 'Supprimer l\'élément', description: 'Supprime le mur, porte, cloison ou zone sélectionné' },
```

**Destructuration** — remplacer `onClearRoom,` par `onDelete, canDelete, deleteTooltipLabel,`

**Bouton Trash desktop** (vers ligne 263) — remplacer :
```tsx
<ToolTooltip label="Supprimer l'élément" description={deleteTooltipLabel}>
  <Button variant="danger" size="icon" className="h-8 w-8" onClick={onDelete} disabled={!canDelete}>
    <Trash2 size={16} />
  </Button>
</ToolTooltip>
```

**Bouton Trash mobile** (vers ligne 403) — remplacer :
```tsx
<Button variant="danger" size="icon" className="h-10 w-10 shrink-0" onClick={onDelete} disabled={!canDelete}>
  <Trash2 size={18} />
</Button>
```

Note : `ToolTooltip` n'est pas ajouté sur mobile (aucun survol sur mobile).

### Partie C — PlanEditor.tsx

- [ ] **Step 4 : Ajouter les dérivations `editingContext`, `canDelete`, `deleteTooltipLabel` dans PlanEditor**

Juste avant le `return (` final (vers ligne 1360), ajouter :

```tsx
// ── Contexte de suppression contextuelle ─────────────────────────────────────
const editingContext: 'wall' | 'door' | 'partition' | 'zone' | null =
  editingPartition ? 'partition'
  : editingZoneEdge ? 'zone'
  : editingEdge
    ? (
        (rooms.find((r) => r.id === editingEdge.roomId)?.edges[editingEdge.edgeIndex] ?? 'WALL') === 'DOOR'
          ? 'door'
          : 'wall'
      )
  : null;

const canDelete = editingContext !== null;

const deleteTooltipLabel =
  editingContext === 'wall'       ? 'Supprimer ce mur'
  : editingContext === 'door'     ? 'Supprimer cette porte'
  : editingContext === 'partition' ? 'Supprimer cette cloison'
  : editingContext === 'zone'     ? 'Supprimer cette zone'
  : 'Sélectionnez un élément pour le supprimer';
```

- [ ] **Step 5 : Ajouter `handleTrashClick` dans PlanEditor**

Après `handleAddRoom` (~ligne 1304), ajouter :

```tsx
const handleTrashClick = () => {
  if (!editingContext) return;
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
    const edgeType = room.edges[editingEdge.edgeIndex] ?? 'WALL';

    if (edgeType === 'DOOR') {
      const result = removeDoorFromRoom(room, editingEdge.edgeIndex);
      if (result) {
        shiftConstraintIndices(room.id, editingEdge.edgeIndex, -2);
        updateRoom(room.id, result.points, result.edges);
      }
      setEditingEdge(null);
      return;
    }

    // ── Ré-ouvrir la pièce (supprimer ce mur) ──
    const n = room.points.length;
    if (n < 3) return;

    const rotateBy = (editingEdge.edgeIndex + 1) % n;
    const newPoints = [...room.points.slice(rotateBy), ...room.points.slice(0, rotateBy)];
    const reorderedEdges = [...room.edges.slice(rotateBy), ...room.edges.slice(0, rotateBy)];
    const newEdges = reorderedEdges.slice(0, n - 1) as EdgeType[];

    // Mettre à jour les indices de contraintes (rotation)
    const roomConstraints = constraints.filter((c) =>
      c.pts.some((r) => r.roomId === room.id),
    );
    roomConstraints.forEach((c) => {
      removeConstraint(c.id);
      addConstraint({
        ...c,
        pts: c.pts.map((r) =>
          r.roomId === room.id
            ? { ...r, vertexIdx: (r.vertexIdx - rotateBy + n) % n }
            : r,
        ),
      });
    });

    updateRoom(room.id, newPoints, newEdges);
    setEditingEdge(null);
    setTool('WALL');
  }
};
```

- [ ] **Step 6 : Mettre à jour le JSX — passer les nouvelles props à PlanToolbar**

Localiser `<PlanToolbar` (vers ligne 1404) et remplacer `onClearRoom={handleClearRoom}` par :

```tsx
onDelete={handleTrashClick}
canDelete={canDelete}
deleteTooltipLabel={deleteTooltipLabel}
```

- [ ] **Step 7 : Supprimer handleClearRoom de l'interface (optionnel cleanup)**

`handleClearRoom` n'est plus appelé nulle part. Il peut rester (il ne nuit pas) ou être supprimé. Si vous le supprimez, gardez `clearPartitionsAndZones` car il est utilisé dans `handleClearRoom`.

> **Note :** `handleClearRoom` est safe à garder — il sera utile si on veut réexposer la suppression complète via un autre chemin. Ne pas supprimer.

- [ ] **Step 8 : Lancer tous les tests**

```bash
cd /workspaces/Calpiweb && npm test -- --run 2>&1 | tail -8
```

Expected: tous les tests passent. Si erreurs TypeScript : vérifier que `onClearRoom` a bien été retiré de l'interface ET de la destructuration de PlanToolbar.

- [ ] **Step 9 : Vérifier qu'il n'y a plus de référence à onClearRoom**

```bash
grep -rn "onClearRoom" /workspaces/Calpiweb/src/
```

Expected: aucune ligne.

- [ ] **Step 10 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanToolbar.tsx src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(drawing): suppression contextuelle unitaire (mur/porte/cloison/zone) via bouton Trash"
```

---

## Vérification finale

```bash
cd /workspaces/Calpiweb && npm test -- --run 2>&1 | tail -5
```

Expected: `Test Files  37 passed (37)` (36 existants + 1 nouveau `PlanEditor.viewport.test.ts`), 0 failure.

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur TypeScript.
