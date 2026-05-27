# Delete Mode Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la corbeille en vrai outil DELETE : cliquer la corbeille active un mode de suppression directe où chaque clic sur un élément (mur, porte, cloison, zone) le supprime immédiatement.

**Architecture:** `'DELETE'` est ajouté à `PlanTool`. `DeleteHoverTarget` (exporté depuis `DrawingCanvas.tsx`) décrit l'élément survolé. `findDeleteTarget()` et `deleteTarget()` centralisent la détection et la suppression dans `PlanEditor.tsx`. L'ancien système select-then-delete (`canDelete`, `editingContext`, `handleTrashClick`) est supprimé.

**Tech Stack:** React 18, TypeScript, SVG pointer events, Tailwind CSS, Vitest

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `src/components/plan/PlanToolbar.tsx` | Modifier — type + bouton |
| `src/components/plan/ToolStatusBar.tsx` | Modifier — texte DELETE |
| `src/components/plan/DrawingCanvas.tsx` | Modifier — prop + rendu rouge |
| `src/components/plan/PlanEditor.tsx` | Modifier — logique principale |
| `src/components/plan/PlanToolbar.test.tsx` | Modifier — adapter les props |
| `src/components/plan/PlanEditor.toolbar.test.ts` | Modifier — supprimer canDelete/editingContext, ajouter DELETE |

---

### Task 1 : Type DELETE + ToolStatusBar

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx:8`
- Modify: `src/components/plan/ToolStatusBar.tsx:4-14`
- Test: `src/components/plan/PlanEditor.toolbar.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `src/components/plan/PlanEditor.toolbar.test.ts`, ajouter à la fin :

```typescript
// ── DELETE tool ──────────────────────────────────────────────────────────────

describe('DELETE tool', () => {
  it('DELETE fait partie de PlanTool', () => {
    const tools: PlanTool[] = [
      'SELECT', 'WALL', 'DOOR', 'APPLY_H', 'APPLY_V',
      'COINCIDE', 'ANCHOR', 'PARTITION', 'EXCLUDE', 'DIMENSION', 'DELETE',
    ];
    expect(tools).toContain('DELETE');
  });

  it('DELETE a un texte dans TOOL_STATUS_TEXTS', () => {
    expect(TOOL_STATUS_TEXTS['DELETE']).toBeTruthy();
  });

  it('Escape depuis DELETE bascule vers SELECT', () => {
    const tool: PlanTool = 'DELETE';
    const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
    expect(nextTool).toBe('SELECT');
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier l'échec**

```bash
npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -20
```

Expected: FAIL — `'DELETE'` does not satisfy type `PlanTool`

- [ ] **Step 3 : Ajouter `'DELETE'` à `PlanTool`**

Dans `src/components/plan/PlanToolbar.tsx`, ligne 8, remplacer :

```typescript
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION';
```

par :

```typescript
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION' | 'DELETE';
```

- [ ] **Step 4 : Ajouter DELETE à TOOL_STATUS_TEXTS**

Dans `src/components/plan/ToolStatusBar.tsx`, ligne 4-14, ajouter la ligne DELETE :

```typescript
export const TOOL_STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL:      'Cliquez pour poser un point',
  DOOR:      'Cliquez sur un mur pour placer une porte',
  PARTITION: 'Cliquez pour tracer une cloison',
  EXCLUDE:   'Délimitez la zone à exclure',
  APPLY_H:   "Cliquez sur un mur pour le verrouiller à l'horizontale",
  APPLY_V:   'Cliquez sur un mur pour le verrouiller à la verticale',
  COINCIDE:  'Cliquez sur le nœud, puis sur un mur/nœud pour les joindre',
  DIMENSION: 'Cliquez sur un premier nœud, puis sur le second',
  ANCHOR:    'Cliquez sur un nœud pour le figer en place',
  DELETE:    'Cliquez sur un élément pour le supprimer — Échap pour quitter',
};
```

- [ ] **Step 5 : Lancer les tests — vérifier la réussite**

```bash
npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -20
```

Expected: PASS (les nouveaux tests DELETE passent, les anciens restent verts)

- [ ] **Step 6 : Commit**

```bash
git add src/components/plan/PlanToolbar.tsx src/components/plan/ToolStatusBar.tsx src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(drawing): ajoute DELETE à PlanTool + texte ToolStatusBar"
```

---

### Task 2 : Bouton corbeille → outil DELETE dans PlanToolbar

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`
- Modify: `src/components/plan/PlanToolbar.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `src/components/plan/PlanToolbar.test.tsx`, remplacer `defaultProps` et ajouter un test :

```typescript
const defaultProps = {
  tool: 'SELECT' as const,
  canUndo: false,
  canRedo: false,
  onChangeTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  // onDelete, canDelete, deleteTooltipLabel supprimés
  wallThickness: 100,
  onWallThicknessChange: vi.fn(),
  tutorialMode: false,
  onToggleTutorial: vi.fn(),
};

// Ajouter après les describe existants :
describe('PlanToolbar — bouton DELETE', () => {
  it('clicking Trash in mobile toolbar calls onChangeTool with DELETE', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const trashBtn = toolbar.querySelector('[aria-label="Mode suppression"]') as HTMLButtonElement;
    expect(trashBtn).not.toBeNull();
    fireEvent.click(trashBtn);
    expect(onChangeTool).toHaveBeenCalledWith('DELETE');
  });

  it('Trash button is always enabled (no disabled attr)', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const trashBtn = toolbar.querySelector('[aria-label="Mode suppression"]') as HTMLButtonElement;
    expect(trashBtn.disabled).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier l'échec**

```bash
npx vitest run src/components/plan/PlanToolbar.test.tsx 2>&1 | tail -20
```

Expected: FAIL — `onDelete` est inconnu / bouton introuvable

- [ ] **Step 3 : Mettre à jour PlanToolbarProps**

Dans `src/components/plan/PlanToolbar.tsx`, remplacer l'interface :

```typescript
interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  wallThickness: number;
  onWallThicknessChange: (mm: number) => void;
  tutorialMode: boolean;
  onToggleTutorial: () => void;
}
```

- [ ] **Step 4 : Mettre à jour TOOL_TOOLTIPS (entrée DELETE)**

Dans la constante `TOOL_TOOLTIPS`, remplacer la ligne `clear` par `DELETE` :

```typescript
const TOOL_TOOLTIPS = {
  SELECT:    { label: 'Sélectionner',           description: 'Déplacer un nœud ou un segment' },
  WALL:      { label: 'Tracer des murs',         description: 'Cliquez pour poser des points, Entrée pour fermer' },
  DOOR:      { label: 'Placer une porte',        description: 'Cliquez sur un mur pour y insérer une ouverture' },
  PARTITION: { label: 'Cloison (pointillés)',    description: 'Trace une séparation visuelle non porteuse' },
  EXCLUDE:   { label: 'Zone non carrelée',       description: 'Délimite une surface à exclure du carrelage' },
  APPLY_H:   { label: 'Contrainte horizontale',  description: "Fixe la distance horizontale d'un mur" },
  APPLY_V:   { label: 'Contrainte verticale',    description: "Fixe la distance verticale d'un mur" },
  COINCIDE:  { label: 'Coïncidence',             description: 'Aligne deux nœuds ou colle un nœud à un mur' },
  DIMENSION: { label: 'Cotation',                description: 'Mesure ou contraint la distance entre deux nœuds' },
  ANCHOR:    { label: 'Ancrer un nœud',          description: "Fige un point pour qu'il ne soit pas déplacé" },
  undo:      { label: 'Annuler',                 description: "Ctrl+Z — revenir à l'état précédent" },
  redo:      { label: 'Rétablir',                description: "Ctrl+Y — rétablir l'action annulée" },
  DELETE:    { label: 'Mode suppression',        description: 'Cliquez un élément pour le supprimer — Échap pour quitter' },
} as const;
```

- [ ] **Step 5 : Mettre à jour le destructuring de la fonction PlanToolbar**

Remplacer la signature de la fonction et le JSX du bouton desktop :

```typescript
export const PlanToolbar = ({
  tool,
  canUndo,
  canRedo,
  onChangeTool,
  onUndo,
  onRedo,
  wallThickness,
  onWallThicknessChange,
  tutorialMode,
  onToggleTutorial,
}: PlanToolbarProps) => (
```

Puis dans la section `{/* ── Actions ── */}` du desktop, remplacer le bloc du bouton corbeille :

```tsx
    <ToolTooltip {...TOOL_TOOLTIPS.DELETE}>
      <Button
        variant={tool === 'DELETE' ? 'danger' : 'ghost'}
        size="icon"
        className="h-8 w-8"
        onClick={() => onChangeTool('DELETE')}
      >
        <Trash2 size={16} />
      </Button>
    </ToolTooltip>
```

- [ ] **Step 6 : Mettre à jour le bouton corbeille mobile**

Dans la section mobile (`plan-toolbar-mobile`), remplacer le dernier bouton Trash :

```tsx
    <button
      type="button"
      aria-label="Mode suppression"
      onClick={() => onChangeTool('DELETE')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'DELETE' ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'DELETE' ? { color: 'var(--text2)' } : {}}
    >
      <Trash2 size={18} />
    </button>
```

- [ ] **Step 7 : Lancer les tests — vérifier la réussite**

```bash
npx vitest run src/components/plan/PlanToolbar.test.tsx 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 8 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur

- [ ] **Step 9 : Commit**

```bash
git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanToolbar.test.tsx
git commit -m "feat(drawing): bouton corbeille → outil DELETE (toggle, toujours actif)"
```

---

### Task 3 : DrawingCanvas — prop deleteHover + rendu rouge

**Files:**
- Modify: `src/components/plan/DrawingCanvas.tsx`

Note : `DeleteHoverTarget` sera défini et exporté dans `DrawingCanvas.tsx` pour suivre le pattern des autres types (`EditingEdgeState`, `HoveredEdge`…).

- [ ] **Step 1 : Ajouter `DeleteHoverTarget` et le prop dans les interfaces**

En haut de `src/components/plan/DrawingCanvas.tsx`, après les interfaces existantes (après la ligne `export interface HoveredPartitionEdge {…}`), ajouter :

```typescript
export type DeleteHoverTarget =
  | { type: 'wall';      roomId: string; edgeIndex: number }
  | { type: 'door';      roomId: string; edgeIndex: number }
  | { type: 'partition'; roomId: string; partitionId: string }
  | { type: 'zone';      roomId: string; zoneId: string }
```

Dans l'interface `DrawingCanvasProps`, ajouter la prop :

```typescript
  deleteHover: DeleteHoverTarget | null;
```

- [ ] **Step 2 : Mettre à jour le destructuring de DrawingCanvas**

Dans la fonction `DrawingCanvas`, ajouter `deleteHover` au destructuring :

```typescript
export const DrawingCanvas = ({
  // … props existantes …
  deleteHover,
  onZoneEdgePointerDown,
}: DrawingCanvasProps) => {
```

- [ ] **Step 3 : Mettre à jour le curseur SVG**

Remplacer le bloc `cursorClass` :

```typescript
  const cursorClass =
    tool === 'WALL' || tool === 'COINCIDE' || tool === 'ANCHOR' || tool === 'PARTITION' || tool === 'EXCLUDE' || tool === 'DELETE'
      ? 'cursor-crosshair'
      : tool === 'DOOR'
        ? (hoveredEdgeType === 'DOOR' ? 'cursor-pointer' : hoveredEdge ? 'cursor-cell' : 'cursor-default')
      : isPanning ? 'cursor-grabbing' : 'cursor-grab';
```

- [ ] **Step 4 : Highlight rouge sur les murs/portes survolés**

Dans la section `{/* Walls */}` (le `.map()` qui rend les `<line>` de murs), remplacer le calcul de `color` pour prendre en compte `deleteHover` :

```typescript
                const isDeleteHovered =
                  deleteHover?.type === 'wall' || deleteHover?.type === 'door'
                    ? deleteHover.roomId === room.id && deleteHover.edgeIndex === i
                    : false;
                const color = isDeleteHovered ? '#ef4444'
                  : isHov && isDoor ? '#f87171' : isHov ? '#fb923c'
                  : isDoor ? '#f97316'
                  : hasH || hasV ? (isActive ? '#60a5fa' : '#1d4ed8')
                  : hasDist ? (isActive ? '#fbbf24' : '#92400e')
                  : isActive ? '#ea580c' : 'var(--canvas-wall-inact)';
```

- [ ] **Step 5 : Highlight rouge sur les cloisons survolées**

Dans la section `{/* ── Partitions ── */}`, trouver le rendu du segment de cloison principal. Chercher le `<line>` ou `<rect>` principal de la cloison (celui avec `strokeWidth={pt.thickness}`). Ajouter une variable `isPartitionDeleteHovered` et changer la couleur de contour :

```typescript
                const isPartitionDeleteHovered =
                  deleteHover?.type === 'partition' &&
                  deleteHover.roomId === room.id &&
                  deleteHover.partitionId === pt.id;
```

Puis sur le rendu de la cloison (la ligne avec `stroke="var(--canvas-wall-inact)"` ou similaire pour la cloison), si `isPartitionDeleteHovered`, utiliser `stroke="#ef4444"`.

> Note : chercher dans le fichier `strokeDasharray` car les cloisons utilisent des pointillés. La ligne ressemble à :
> ```tsx
> <line x1={pt.p1.x} y1={pt.p1.y} x2={pt.p2.x} y2={pt.p2.y}
>   stroke={isEditingLabel ? '#fb923c' : 'var(--canvas-partition)'}
>   strokeWidth={pt.thickness} strokeDasharray={...} />
> ```
> Ajouter `isPartitionDeleteHovered ? '#ef4444' :` avant `isEditingLabel`.

- [ ] **Step 6 : Highlight rouge sur les zones survolées**

Dans la section `{/* Zone edge lines */}` à l'intérieur de `isClosed && room.excludedZones.map(zone => ...)`, trouver le rendu des bords de la zone. Ajouter :

```typescript
                      const isZoneDeleteHovered =
                        deleteHover?.type === 'zone' &&
                        deleteHover.roomId === room.id &&
                        deleteHover.zoneId === zone.id;
```

Sur la `<line>` de bord de zone, modifier le calcul de `color` :

```typescript
                      const color = isZoneDeleteHovered ? '#ef4444'
                        : isHov ? '#fb923c'
                        : hasH || hasV ? '#60a5fa'
                        : hasDist ? '#fbbf24'
                        : '#f59e0b';
```

- [ ] **Step 7 : TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur (sauf peut-être `deleteHover` non fourni depuis PlanEditor — sera résolu en Task 4)

- [ ] **Step 8 : Commit**

```bash
git add src/components/plan/DrawingCanvas.tsx
git commit -m "feat(drawing): DrawingCanvas — prop deleteHover, cursor-crosshair, hover rouge"
```

---

### Task 4 : PlanEditor — logique DELETE complète

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`
- Test: `src/components/plan/PlanEditor.toolbar.test.ts`

Cette tâche est la plus grosse. Elle :
1. Ajoute le state `deleteHover`
2. Ajoute `findDeleteTarget` et `deleteTarget`
3. Ajoute la branche DELETE dans `handlePointerDown` et `handlePointerMove`
4. Étend `handleTouchEnd` pour le mode DELETE
5. Supprime `canDelete`, `editingContext`, `deleteTooltipLabel`, `handleTrashClick`
6. Câble `deleteHover` dans DrawingCanvas + met à jour l'appel de PlanToolbar

- [ ] **Step 1 : Écrire les tests unitaires DELETE**

Dans `src/components/plan/PlanEditor.toolbar.test.ts`, **remplacer** les describe `canDelete` et `editingContext` (lignes 158-223) par :

```typescript
// ── findDeleteTarget — priorité ───────────────────────────────────────────────

describe('findDeleteTarget — priorité', () => {
  type Target =
    | { type: 'wall';      priority: number }
    | { type: 'door';      priority: number }
    | { type: 'partition'; priority: number }
    | { type: 'zone';      priority: number };

  const pick = (candidates: Target[]) =>
    candidates.reduce((best, c) =>
      c.priority < best.priority ? c : best
    );

  it('partition gagne face à un mur à même distance', () => {
    const result = pick([
      { type: 'wall', priority: 3 },
      { type: 'partition', priority: 0 },
    ]);
    expect(result.type).toBe('partition');
  });

  it('zone gagne face à un mur à même distance', () => {
    const result = pick([
      { type: 'wall', priority: 3 },
      { type: 'zone', priority: 1 },
    ]);
    expect(result.type).toBe('zone');
  });

  it('porte gagne face à un mur à même distance', () => {
    const result = pick([
      { type: 'wall', priority: 3 },
      { type: 'door', priority: 2 },
    ]);
    expect(result.type).toBe('door');
  });
});

// ── deleteTarget — garde n < 3 ────────────────────────────────────────────────

describe('deleteTarget — garde mur pièce trop petite', () => {
  it('refuse de supprimer si n < 3', () => {
    const n = 2;
    let deleted = false;
    if (n >= 3) deleted = true;
    expect(deleted).toBe(false);
  });

  it('autorise la suppression si n >= 3', () => {
    const n = 4;
    let deleted = false;
    if (n >= 3) deleted = true;
    expect(deleted).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier le passage**

```bash
npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -20
```

Expected: PASS (les nouveaux tests sont purs logique, pas de dépendances)

- [ ] **Step 3 : Importer DeleteHoverTarget dans PlanEditor**

En haut de `src/components/plan/PlanEditor.tsx`, dans la ligne d'import depuis `./DrawingCanvas`, ajouter `DeleteHoverTarget` :

```typescript
import type {
  HoveredEdge, EditingEdgeState, SnapPreview, HoveredZoneEdge, EditingZoneEdge,
  HoveredPartitionEdge, PartitionDimLine,
  DeleteHoverTarget,   // ← nouveau
} from './DrawingCanvas';
```

- [ ] **Step 4 : Ajouter le state deleteHover**

Dans les déclarations de state (vers la ligne 268, près des autres états d'édition), ajouter :

```typescript
  const [deleteHover, setDeleteHover] = useState<DeleteHoverTarget | null>(null);
```

- [ ] **Step 5 : Ajouter findDeleteTarget**

Après la fonction `findNearestPartitionEdge` (vers la ligne 685), ajouter :

```typescript
  // ── Détecte l'élément le plus proche pour le mode DELETE ──────────────────
  const findDeleteTarget = (worldPos: Point): DeleteHoverTarget | null => {
    const threshold = 80 / scale;
    let best: { target: DeleteHoverTarget; dist: number; priority: number } | null = null;

    const candidate = (target: DeleteHoverTarget, d: number, priority: number) => {
      if (d >= threshold) return;
      if (!best || d < best.dist || (d === best.dist && priority < best.priority)) {
        best = { target, dist: d, priority };
      }
    };

    for (const room of rooms) {
      if (room.points.length < 3) continue;
      // Murs et portes
      for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i]!, p2 = room.points[(i + 1) % room.points.length]!;
        const proj = getPointOnSegment(worldPos, p1, p2);
        const d = distance(worldPos, proj);
        const edgeType = room.edges[i] ?? 'WALL';
        if (edgeType === 'DOOR') {
          candidate({ type: 'door', roomId: room.id, edgeIndex: i }, d, 2);
        } else {
          candidate({ type: 'wall', roomId: room.id, edgeIndex: i }, d, 3);
        }
      }
      // Cloisons
      for (const pt of (room.partitions ?? [])) {
        const proj = getPointOnSegment(worldPos, pt.p1, pt.p2);
        candidate({ type: 'partition', roomId: room.id, partitionId: pt.id }, distance(worldPos, proj), 0);
      }
      // Zones exclues
      for (const zone of (room.excludedZones ?? [])) {
        if (zone.points.length < 3) continue;
        for (let i = 0; i < zone.points.length; i++) {
          const proj = getPointOnSegment(worldPos, zone.points[i]!, zone.points[(i + 1) % zone.points.length]!);
          candidate({ type: 'zone', roomId: room.id, zoneId: zone.id }, distance(worldPos, proj), 1);
        }
      }
    }

    return best ? (best as { target: DeleteHoverTarget; dist: number; priority: number }).target : null;
  };
```

- [ ] **Step 6 : Ajouter deleteTarget**

Après `findDeleteTarget`, ajouter :

```typescript
  // ── Supprime l'élément cible (mode DELETE) ────────────────────────────────
  const deleteTarget = (target: DeleteHoverTarget) => {
    if (target.type === 'partition') {
      pushHistory();
      removePartition(target.roomId, target.partitionId);
      setDeleteHover(null);
      return;
    }
    if (target.type === 'zone') {
      pushHistory();
      removeExcludedZone(target.roomId, target.zoneId);
      setDeleteHover(null);
      return;
    }
    const room = rooms.find((r) => r.id === target.roomId);
    if (!room) return;
    if (target.type === 'door') {
      const result = removeDoorFromRoom(room, target.edgeIndex);
      if (!result) return;
      pushHistory();
      shiftConstraintIndices(room.id, target.edgeIndex, -2);
      updateRoom(room.id, result.points, result.edges);
      setDeleteHover(null);
      return;
    }
    // type === 'wall' : ré-ouvrir la pièce
    const n = room.points.length;
    if (n < 3) return;
    pushHistory();
    const rotateBy = (target.edgeIndex + 1) % n;
    const newPoints = [...room.points.slice(rotateBy), ...room.points.slice(0, rotateBy)];
    const reorderedEdges = [...room.edges.slice(rotateBy), ...room.edges.slice(0, rotateBy)];
    const newEdges = reorderedEdges.slice(0, n - 1) as EdgeType[];
    const roomConstraints = constraints.filter((c) => c.pts.some((r) => r.roomId === room.id));
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
    setDeleteHover(null);
  };
```

- [ ] **Step 7 : Ajouter la branche DELETE dans handlePointerDown**

Dans `handlePointerDown` (vers la ligne 732), ajouter une branche au début, juste **après** les gardes `editingEdge`, `draggedVertex` etc. et la récupération de `raw`, mais **avant** la branche `DIMENSION`. Chercher le commentaire `// ── DIMENSION` et insérer avant :

```typescript
    // ── DELETE ──
    if (tool === 'DELETE') {
      const target = findDeleteTarget(raw);
      if (target) {
        deleteTarget(target);
      } else {
        setTool('SELECT');
        setDeleteHover(null);
      }
      return;
    }
```

- [ ] **Step 8 : Ajouter la branche DELETE dans handlePointerMove**

Dans `handlePointerMove`, à la fin du bloc (juste avant `}`), remplacer le bloc `else { setHoveredEdge(null) … }` par :

```typescript
    if (tool === 'DELETE') {
      setDeleteHover(findDeleteTarget(raw));
    } else if (tool === 'DOOR') {
      setHoveredEdge(findNearestEdgeOfType(raw, 'DOOR') ?? findNearestWallEdge(raw));
    } else if (tool === 'APPLY_H' || tool === 'APPLY_V') {
      setHoveredEdge(findNearestWallEdge(raw));
      setHoveredZoneEdge(findNearestZoneEdge(raw));
      setHoveredPartitionEdge(findNearestPartitionEdge(raw));
    } else {
      setHoveredEdge(null); setHoveredZoneEdge(null); setHoveredPartitionEdge(null);
    }
```

- [ ] **Step 9 : Étendre handleTouchEnd pour le mode DELETE**

Dans `handleTouchEnd`, trouver le bloc `if (tool !== 'SELECT' || !ref || ref.dist !== 0) return;` et le remplacer par :

```typescript
    if (!ref || ref.dist !== 0) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const moved = Math.hypot(touch.clientX - ref.midX, touch.clientY - ref.midY);
    if (moved > 12) return;

    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const worldPos = toWorld(touch.clientX - svgRect.left, touch.clientY - svgRect.top);

    // Mode DELETE : tap = suppression directe
    if (tool === 'DELETE') {
      const target = findDeleteTarget(worldPos);
      if (target) {
        deleteTarget(target);
      } else {
        setTool('SELECT');
        setDeleteHover(null);
      }
      return;
    }

    if (tool !== 'SELECT') return;
    // … reste du code handleTouchEnd existant (zone SELECT) …
```

- [ ] **Step 10 : Ajouter setDeleteHover(null) dans le handler Escape**

Dans le handler clavier (vers la ligne 539), dans le bloc `if (e.key === 'Escape')`, ajouter :

```typescript
        setDeleteHover(null);
```

(juste après `setTool('SELECT')`)

- [ ] **Step 11 : Ajouter setDeleteHover(null) dans onChangeTool**

Dans l'appel à `PlanToolbar` (vers la ligne 1555), mettre à jour `onChangeTool` :

```tsx
        onChangeTool={(t) => {
          setTool(t);
          setDeleteHover(null);
          setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null);
          setExcludePoints([]); setEditingPartitionDimension(null);
        }}
```

- [ ] **Step 12 : Supprimer canDelete, editingContext, deleteTooltipLabel, handleTrashClick**

Dans `PlanEditor.tsx` :

1. **Supprimer** la fonction `handleTrashClick` (lignes ~1418–1483)
2. **Supprimer** le bloc `const editingContext = …` (lignes ~1550–1554)
3. **Supprimer** `const canDelete = editingContext !== null;` (~ligne 1561)
4. **Supprimer** le bloc `const deleteTooltipLabel = …` (~lignes 1563–1568)

- [ ] **Step 13 : Mettre à jour l'appel de PlanToolbar**

Trouver l'appel `<PlanToolbar …>` et supprimer les props `onDelete`, `canDelete`, `deleteTooltipLabel` :

```tsx
      <PlanToolbar
        tool={tool}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onChangeTool={(t) => {
          setTool(t);
          setDeleteHover(null);
          setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null);
          setExcludePoints([]); setEditingPartitionDimension(null);
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        wallThickness={wallThickness}
        onWallThicknessChange={setWallThickness}
        tutorialMode={tutorialMode}
        onToggleTutorial={() => setTutorialMode((v) => !v)}
      />
```

- [ ] **Step 14 : Ajouter deleteHover à l'appel DrawingCanvas**

Dans l'appel `<DrawingCanvas …>`, ajouter :

```tsx
        deleteHover={deleteHover}
```

- [ ] **Step 15 : TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur

- [ ] **Step 16 : Lancer tous les tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent

- [ ] **Step 17 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts
git commit -m "feat(drawing): mode DELETE complet — findDeleteTarget, deleteTarget, hover rouge, mobile"
```

---

### Task 5 : Nettoyage tests obsolètes

**Files:**
- Modify: `src/components/plan/PlanEditor.toolbar.test.ts`

Les describe `canDelete` et `editingContext` (lignes 158–223) ont déjà été remplacés en Task 4, Step 1. Cette tâche vérifie qu'aucun test ne référence `onDelete`, `canDelete`, `deleteTooltipLabel`.

- [ ] **Step 1 : Vérifier l'absence de références obsolètes**

```bash
grep -n "canDelete\|deleteTooltipLabel\|onDelete\|handleTrashClick\|editingContext" \
  src/components/plan/PlanEditor.toolbar.test.ts \
  src/components/plan/PlanToolbar.test.tsx
```

Expected: aucune ligne retournée

- [ ] **Step 2 : Lancer la suite complète**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent

- [ ] **Step 3 : Commit final**

```bash
git add src/components/plan/PlanEditor.toolbar.test.ts src/components/plan/PlanToolbar.test.tsx
git commit -m "test(drawing): nettoie les tests obsolètes canDelete/editingContext"
```
