# Wall Engine — SP5 : Bascule finale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le moteur de dessin legacy (DrawingCanvas), simplifier PlanEditor à ~220 lignes, réduire PlanToolbar aux 5 outils du moteur de murs, et initialiser automatiquement wallEngine sur tous les projets.

**Architecture:** PlanEditor est entièrement réécrit (1925 → ~220 lignes) — il orchestre uniquement WallDrawingCanvas + WallRoomPanel + PlanToolbar. PlanTool passe de 11 à 5 valeurs. DrawingCanvas n'est plus importé. Tout nouveau projet obtient wallEngine d'emblée ; à l'ouverture d'un projet sans wallEngine, il est auto-initialisé.

**Tech Stack:** TypeScript, React 18, Zustand, Vitest, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-06-03-wall-engine-migration-final-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/PlanToolbar.tsx` | **Réécrire** — PlanTool simplifié + 5 boutons |
| `src/components/plan/ToolStatusBar.tsx` | **Modifier** — retirer 6 entrées |
| `src/store/projectStore.ts` | **Modifier** — create() inclut wallEngine |
| `src/components/plan/PlanEditor.tsx` | **Réécrire** — ~220 lignes, sans legacy |
| `src/components/plan/PlanEditor.toolbar.test.ts` | **Modifier** — adapter aux 5 outils |
| `src/components/plan/PlanEditor.mobile.test.tsx` | **Modifier** — adapter aux 5 outils |

---

### Task 1 : PlanToolbar — simplifier PlanTool + supprimer 6 boutons

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`

- [ ] **Step 1.1 : Réécrire entièrement `PlanToolbar.tsx`**

```typescript
// src/components/plan/PlanToolbar.tsx
'use client';

import { DoorOpen, HelpCircle, MousePointer2, PenTool, Redo2, Square, Trash2, Undo } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToolTooltip } from './ToolTooltip';
import { WallThicknessControl } from './WallThicknessControl';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'EXCLUDE' | 'DELETE';

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

const TOOL_TOOLTIPS = {
  SELECT:  { label: 'Sélectionner',      description: 'Déplacer un nœud ou sélectionner un mur' },
  WALL:    { label: 'Tracer des murs',    description: 'Cliquez pour poser des points' },
  DOOR:    { label: 'Porte / Ouverture',  description: 'Cliquez sur un mur pour y insérer une ouverture' },
  EXCLUDE: { label: 'Zone non carrelée',  description: 'Délimitez la surface à exclure du carrelage' },
  undo:    { label: 'Annuler',            description: "Ctrl+Z — revenir à l'état précédent" },
  redo:    { label: 'Rétablir',           description: "Ctrl+Y — rétablir l'action annulée" },
  DELETE:  { label: 'Mode suppression',   description: 'Cliquez un élément pour le supprimer — Échap pour quitter' },
} as const;

const TB_CARD = 'bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800';

export const PlanToolbar = ({
  tool, canUndo, canRedo, onChangeTool, onUndo, onRedo,
  wallThickness, onWallThicknessChange, tutorialMode, onToggleTutorial,
}: PlanToolbarProps) => (
  <>
  <div
    className={`absolute left-4 top-4 z-10 hidden md:flex mouse:flex flex-col gap-0.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md ${tutorialMode ? 'overflow-visible' : 'overflow-y-auto'}`}
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: tutorialMode ? undefined : 'calc(100vh - 108px)', scrollbarWidth: 'none' }}>

    {/* Tutorial toggle */}
    <button
      type="button"
      aria-label="Mode tutorial"
      onClick={onToggleTutorial}
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
        tutorialMode
          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
          : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
    >
      <HelpCircle size={15} />
    </button>
    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    {/* Drawing tools */}
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
        <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('SELECT')}>
          <MousePointer2 size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Sélectionner</span>}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.WALL}>
        <Button variant={tool === 'WALL' ? 'active' : 'tool'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('WALL')}>
          <PenTool size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Tracer des murs</span>}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.DOOR}>
        <Button variant={tool === 'DOOR' ? 'active' : 'tool'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('DOOR')}>
          <DoorOpen size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Porte / Ouverture</span>}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.EXCLUDE}>
        <button type="button" onClick={() => onChangeTool('EXCLUDE')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            tool === 'EXCLUDE'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
              : `${TB_CARD} hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300`
          }`}
          style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
          <Square size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Zone non carrelée</span>}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    <ToolTooltip {...TOOL_TOOLTIPS.undo}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo}><Undo size={16} /></Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.redo}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo}><Redo2 size={16} /></Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.DELETE}>
      <Button variant={tool === 'DELETE' ? 'danger' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('DELETE')}>
        <Trash2 size={16} />
      </Button>
    </ToolTooltip>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
    <WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} />
  </div>

  {/* Mobile: toolbar horizontal */}
  <div
    data-testid="plan-toolbar-mobile"
    className="absolute bottom-20 md:bottom-0 left-0 right-0 z-20 flex md:hidden mouse:hidden items-center gap-1 overflow-x-auto border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 px-2 py-2 backdrop-blur-md"
    style={{ scrollbarWidth: 'none' }}
  >
    <button type="button" aria-label="Sélectionner" onClick={() => onChangeTool('SELECT')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'SELECT' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
      style={tool !== 'SELECT' ? { color: 'var(--text2)' } : {}}><MousePointer2 size={18} /></button>
    <button type="button" aria-label="Tracer des murs" onClick={() => onChangeTool('WALL')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'WALL' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
      style={tool !== 'WALL' ? { color: 'var(--text2)' } : {}}><PenTool size={18} /></button>
    <button type="button" aria-label="Porte" onClick={() => onChangeTool('DOOR')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'DOOR' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
      style={tool !== 'DOOR' ? { color: 'var(--text2)' } : {}}><DoorOpen size={18} /></button>
    <button type="button" aria-label="Zone non carrelée" onClick={() => onChangeTool('EXCLUDE')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'EXCLUDE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : TB_CARD}`}
      style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}><Square size={18} /></button>
    <div className="ml-auto mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />
    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onUndo} disabled={!canUndo}><Undo size={18} /></Button>
    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onRedo} disabled={!canRedo}><Redo2 size={18} /></Button>
    <button type="button" aria-label="Mode suppression" onClick={() => onChangeTool('DELETE')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'DELETE' ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : TB_CARD}`}
      style={tool !== 'DELETE' ? { color: 'var(--text2)' } : {}}><Trash2 size={18} /></button>
  </div>
  </>
);
```

- [ ] **Step 1.2 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : des erreurs TypeScript dans les tests qui référencent les outils supprimés (APPLY_H, PARTITION, etc.) — normal, seront corrigés en Task 5.

- [ ] **Step 1.3 : Commit**

```bash
git add src/components/plan/PlanToolbar.tsx
git commit -m "feat(wall-engine): PlanToolbar — PlanTool simplifié (5 outils)"
```

---

### Task 2 : ToolStatusBar — retirer les entrées obsolètes

**Files:**
- Modify: `src/components/plan/ToolStatusBar.tsx`

- [ ] **Step 2.1 : Réécrire `ToolStatusBar.tsx`**

```typescript
// src/components/plan/ToolStatusBar.tsx
'use client';
import type { PlanTool } from './PlanToolbar';

export const TOOL_STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL:    'Cliquez pour poser un point',
  DOOR:    'Cliquez sur un mur pour placer une porte',
  EXCLUDE: 'Délimitez la zone à exclure du carrelage',
  DELETE:  'Cliquez sur un élément pour le supprimer — Échap pour quitter',
};

export const ToolStatusBar = ({ tool }: { tool: PlanTool }) => {
  const text = TOOL_STATUS_TEXTS[tool];
  if (!text) return null;
  return (
    <div
      data-testid="tool-status-bar"
      className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 md:block mouse:block"
    >
      <span
        className="rounded-full px-3 py-1 text-xs backdrop-blur-sm"
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--bdr)',
          color: 'var(--text2)',
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

- [ ] **Step 2.2 : Commit**

```bash
git add src/components/plan/ToolStatusBar.tsx
git commit -m "feat(wall-engine): ToolStatusBar — retirer textes outils legacy"
```

---

### Task 3 : projectStore — create() inclut wallEngine

**Files:**
- Modify: `src/store/projectStore.ts`

- [ ] **Step 3.1 : Mettre à jour `create()`**

Localiser `create: async (data) => {` (ligne ~101). Dans l'objet `newProject`, effectuer deux changements :

```typescript
// AVANT
rooms: [{ id: generateId(), points: [], edges: [], partitions: [], excludedZones: [] }],

// APRÈS
rooms: [],   // vide — dessin via le moteur de murs
wallEngine: { nodes: [], walls: [], excludedZones: [] },  // ← AJOUTER
```

Note : la ligne `wallEngine` doit être ajoutée après `rooms`, avant `config`.

- [ ] **Step 3.2 : Lancer les tests**

```
npx vitest run src/store/projectStore.test.ts
```

Résultat attendu : tous les tests du store passent.

- [ ] **Step 3.3 : Commit**

```bash
git add src/store/projectStore.ts
git commit -m "feat(wall-engine): projectStore — create() initialise wallEngine d'emblée"
```

---

### Task 4 : PlanEditor — réécriture complète

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

Contexte : le fichier actuel fait 1925 lignes. Il est entièrement remplacé par la version ci-dessous (~220 lignes). `computeInitialView` est conservé et exporté (utilisé par les tests de viewport).

- [ ] **Step 4.1 : Réécrire entièrement `PlanEditor.tsx`**

```typescript
// src/components/plan/PlanEditor.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import { useProjectStore, selectActiveProject, selectRooms } from '@/store/projectStore';
import { PlanToolbar, type PlanTool } from './PlanToolbar';
import { ToolStatusBar } from './ToolStatusBar';
import { WallDrawingCanvas } from './WallDrawingCanvas';
import { WallRoomPanel } from './WallRoomPanel';
import { useDraggableSnap } from './useDraggableSnap';

// ── History ────────────────────────────────────────────────────────────────

interface WallHistoryEntry {
  wallEngine: {
    nodes: WallNode[];
    walls: Wall[];
    excludedZones: WallExcludedZone[];
  };
}

// ── computeInitialView ────────────────────────────────────────────────────
// Exporté pour les tests (PlanEditor.viewport.test.ts)

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
  const newScale = Math.max(
    0.005,
    Math.min(
      (viewW - PADDING * 2) / bboxW,
      (viewH - PADDING * 2) / bboxH,
      0.5,
    ),
  );

  return {
    scale: newScale,
    pan: { x: viewW / 2 - cx * newScale, y: viewH / 2 - cy * newScale },
  };
}

// ── Component ─────────────────────────────────────────────────────────────

export const PlanEditor = ({ onNavigateBack }: { onNavigateBack?: () => void }) => {
  const wallEngine           = useProjectStore((s) => selectActiveProject(s)?.wallEngine);
  const wallThickness        = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const addWall              = useProjectStore((s) => s.addWall);
  const removeWall           = useProjectStore((s) => s.removeWall);
  const updateWall           = useProjectStore((s) => s.updateWall);
  const addNode              = useProjectStore((s) => s.addNode);
  const updateNode           = useProjectStore((s) => s.updateNode);
  const mergeNodes           = useProjectStore((s) => s.mergeNodes);
  const initWallEngine       = useProjectStore((s) => s.initWallEngine);
  const setWallThickness     = useProjectStore((s) => s.setWallThickness);
  const addWallExcludedZone    = useProjectStore((s) => s.addWallExcludedZone);
  const removeWallExcludedZone = useProjectStore((s) => s.removeWallExcludedZone);
  const restoreSnapshot      = useProjectStore((s) => s.restoreSnapshot);

  const [scale, setScale]   = useState(0.1);
  const [pan,   setPan]     = useState<Point>({ x: 0, y: 0 });
  const [tool,  setTool]    = useState<PlanTool>('WALL');
  const [tutorialMode, setTutorialMode] = useState(false);
  const [past,   setPast]   = useState<WallHistoryEntry[]>([]);
  const [future, setFuture] = useState<WallHistoryEntry[]>([]);

  const wallEngineRef = useRef(wallEngine);
  const pastRef       = useRef(past);
  const futureRef     = useRef(future);
  useEffect(() => { wallEngineRef.current = wallEngine; }, [wallEngine]);
  useEffect(() => { pastRef.current   = past;   }, [past]);
  useEffect(() => { futureRef.current = future; }, [future]);

  const { zone: roomZone, isDragging: roomDragging, handlePointerDown: handleRoomPointerDown } =
    useDraggableSnap({ storageKey: 'calpiweb-room-panel-zone', defaultZone: 'SIDE' });

  // Auto-init wallEngine si manquant (migration projets legacy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (wallEngine === undefined) initWallEngine(); }, []);

  // Centrage initial sur le contenu existant
  useEffect(() => {
    const rooms = selectRooms(useProjectStore.getState());
    const view = computeInitialView(rooms, window.innerWidth, window.innerHeight - 92);
    if (!view) return;
    setScale(view.scale);
    setPan(view.pan);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── History ────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    const we = wallEngineRef.current;
    if (!we) return;
    setPast((prev) => [{
      wallEngine: {
        nodes: [...we.nodes],
        walls: [...we.walls],
        excludedZones: [...(we.excludedZones ?? [])],
      },
    }, ...prev.slice(0, 49)]);
    setFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    const [entry, ...rest] = pastRef.current;
    if (!entry) { if (onNavigateBack) onNavigateBack(); return; }
    const we = wallEngineRef.current;
    if (we) {
      setFuture((f) => [{
        wallEngine: { nodes: [...we.nodes], walls: [...we.walls], excludedZones: [...(we.excludedZones ?? [])] },
      }, ...f.slice(0, 49)]);
    }
    setPast(rest);
    restoreSnapshot([], [], entry.wallEngine);
  }, [onNavigateBack, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const [entry, ...rest] = futureRef.current;
    if (!entry) return;
    const we = wallEngineRef.current;
    if (we) {
      setPast((p) => [{
        wallEngine: { nodes: [...we.nodes], walls: [...we.walls], excludedZones: [...(we.excludedZones ?? [])] },
      }, ...p.slice(0, 49)]);
    }
    setFuture(rest);
    restoreSnapshot([], [], entry.wallEngine);
  }, [restoreSnapshot]);

  // Ctrl+Z / Ctrl+Y
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
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [handleUndo, handleRedo, onNavigateBack]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        className="relative flex flex-1 overflow-hidden"
        style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}
      >
        <ToolStatusBar tool={tool} />
        <PlanToolbar
          tool={tool}
          canUndo={past.length > 0}
          canRedo={future.length > 0}
          onChangeTool={setTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          wallThickness={wallThickness}
          onWallThicknessChange={setWallThickness}
          tutorialMode={tutorialMode}
          onToggleTutorial={() => setTutorialMode((v) => !v)}
        />
        <div className="hidden md:block mouse:block">
          <WallRoomPanel
            zone={roomZone}
            isDragging={roomDragging}
            onPointerDown={handleRoomPointerDown}
            tutorialMode={tutorialMode}
          />
        </div>
        <WallDrawingCanvas
          walls={wallEngine?.walls ?? []}
          nodes={wallEngine?.nodes ?? []}
          tool={tool as 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE'}
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
          excludedZones={wallEngine?.excludedZones ?? []}
          onAddExcludedZone={addWallExcludedZone}
          onRemoveExcludedZone={removeWallExcludedZone}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 4.2 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : la majorité des tests passent. Des erreurs TypeScript peuvent subsister dans les tests qui référencent des outils supprimés — corrigés en Task 5.

- [ ] **Step 4.3 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx
git commit -m "feat(wall-engine): PlanEditor — réécriture complète (suppression moteur legacy)"
```

---

### Task 5 : Tests — adapter aux 5 outils

**Files:**
- Modify: `src/components/plan/PlanEditor.toolbar.test.ts`
- Modify: `src/components/plan/PlanEditor.mobile.test.tsx`

- [ ] **Step 5.1 : Mettre à jour `PlanEditor.toolbar.test.ts`**

**Changement 1** — ligne 9-11, `nonSelectTools` :
```typescript
// AVANT
const nonSelectTools: PlanTool[] = [
  'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
  'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR', 'DELETE',
];
// APRÈS
const nonSelectTools: PlanTool[] = ['WALL', 'DOOR', 'EXCLUDE', 'DELETE'];
```

**Changement 2** — supprimer le test `'COINCIDE a un texte'` (lignes 50-52).

**Changement 3** — `drawingTools` (lignes 54-63) :
```typescript
// AVANT
const drawingTools: Array<keyof typeof TOOL_STATUS_TEXTS> = [
  'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
  'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
];
// APRÈS
const drawingTools: Array<keyof typeof TOOL_STATUS_TEXTS> = ['WALL', 'DOOR', 'EXCLUDE', 'DELETE'];
```

**Changement 4** — test `'THICKNESS n\'est pas dans la liste'` (lignes 107-114) :
```typescript
it('THICKNESS n\'est pas dans la liste des outils valides', () => {
  const tools: PlanTool[] = ['SELECT', 'WALL', 'DOOR', 'EXCLUDE', 'DELETE'];
  // @ts-expect-error — 'THICKNESS' was removed from PlanTool
  const thickness: PlanTool = 'THICKNESS';
  expect(tools).not.toContain(thickness);
});
```

**Changement 5** — test `DELETE tool` (lignes 257-261) :
```typescript
it('DELETE fait partie de PlanTool', () => {
  const tools: PlanTool[] = ['SELECT', 'WALL', 'DOOR', 'EXCLUDE', 'DELETE'];
  expect(tools).toContain('DELETE');
});
```

- [ ] **Step 5.2 : Mettre à jour `PlanEditor.mobile.test.tsx`**

Ligne 7 — mettre à jour `tools` :
```typescript
// AVANT
const tools: PlanTool[] = ['WALL', 'DOOR', 'PARTITION', 'EXCLUDE', 'APPLY_H', 'APPLY_V',
                           'DIMENSION', 'COINCIDE', 'ANCHOR'];
// APRÈS
const tools: PlanTool[] = ['WALL', 'DOOR', 'EXCLUDE', 'DELETE'];
```

- [ ] **Step 5.3 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : **tous les tests passent, 0 failure**.

- [ ] **Step 5.4 : Commit**

```bash
git add src/components/plan/PlanEditor.toolbar.test.ts src/components/plan/PlanEditor.mobile.test.tsx
git commit -m "test(wall-engine): adapter tests toolbar et mobile aux 5 outils"
```

---

### Task 6 : Régression + vérification TypeScript finale

- [ ] **Step 6.1 : Suite complète**

```
npx vitest run
```

Résultat attendu : **tous les tests PASS, 0 failures**.

- [ ] **Step 6.2 : TypeScript strict**

```
npx tsc --noEmit
```

Résultat attendu : **0 erreurs**.

- [ ] **Step 6.3 : Checklist manuelle**

1. Ouvrir un projet existant (sans wallEngine) → `WallDrawingCanvas` s'affiche, wallEngine auto-initialisé ✓
2. Créer un nouveau projet → démarre directement en mode dessin de murs ✓
3. Bouton "Nouveau moteur ✦" n'apparaît plus ✓
4. Toolbar : exactement 5 outils (SELECT, WALL, DOOR, EXCLUDE, DELETE) + Undo/Redo/WallThickness ✓
5. Dessiner des murs → calepinage + quantitatif fonctionnels ✓
6. Ctrl+Z / Ctrl+Y → undo/redo fonctionnels ✓
7. WallRoomPanel visible en desktop ✓
