# Plan Editor UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des tooltips riches pour les outils du bandeau, implémenter le redo (Ctrl+Y), et rendre la liste des pièces draggable avec snap en 3 zones.

**Architecture:** 4 tâches indépendantes. Aucune dépendance entre elles — elles peuvent être livrées dans n'importe quel ordre. Pas de bibliothèque externe. React + TypeScript + lucide-react uniquement.

**Tech Stack:** React 18, TypeScript, Vitest + @testing-library/react, lucide-react, localStorage (persistance zone drag).

---

## File Map

| Fichier | Action |
|---|---|
| `src/components/plan/ToolTooltip.tsx` | Créer |
| `src/components/plan/ToolTooltip.test.tsx` | Créer |
| `src/components/plan/PlanToolbar.tsx` | Modifier — ajouter `ToolTooltip`, `TOOL_TOOLTIPS`, props `canRedo`/`onRedo`, bouton Redo |
| `src/components/plan/PlanEditor.tsx` | Modifier — historique `past`/`future`, `handleRedo`, Ctrl+Y, intégration `RoomPanel` |
| `src/components/plan/useDraggableSnap.ts` | Créer |
| `src/components/plan/useDraggableSnap.test.ts` | Créer |
| `src/components/plan/RoomPanel.tsx` | Créer (remplace `RoomTabs` dans le rendu) |
| `src/components/plan/RoomTabs.tsx` | Inchangé (RoomPanel l'importe) |

---

## Task 1 : Composant ToolTooltip

**Files:**
- Create: `src/components/plan/ToolTooltip.tsx`
- Create (test): `src/components/plan/ToolTooltip.test.tsx`

- [ ] **Step 1 : Écrire le test en échec**

```tsx
// src/components/plan/ToolTooltip.test.tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ToolTooltip } from './ToolTooltip';

afterEach(() => vi.useRealTimers());

describe('ToolTooltip', () => {
  it('ne montre pas le tooltip immédiatement au survol', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button').parentElement!);
    expect(screen.queryByText('Une description')).toBeNull();
  });

  it('affiche le tooltip après 600 ms', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button').parentElement!);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Outil')).toBeDefined();
    expect(screen.getByText('Une description')).toBeDefined();
  });

  it('masque le tooltip au départ de la souris', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    const wrapper = screen.getByRole('button').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('Une description')).toBeNull();
  });

  it('annule le timer si la souris part avant 600 ms', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    const wrapper = screen.getByRole('button').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.mouseLeave(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByText('Une description')).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour confirmer qu'il échoue**

```bash
npx vitest run src/components/plan/ToolTooltip.test.tsx
```
Expected: FAIL — `Cannot find module './ToolTooltip'`

- [ ] **Step 3 : Créer `ToolTooltip.tsx`**

```tsx
// src/components/plan/ToolTooltip.tsx
'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToolTooltipProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

export const ToolTooltip = ({ label, description, children }: ToolTooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setPos({ top: r.top, left: r.right + 8 });
      }
      setVisible(true);
    }, 600);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div ref={wrapRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-xl px-3 py-2 text-xs shadow-xl"
            style={{
              top: pos.top,
              left: pos.left,
              background: 'var(--surf)',
              border: '1px solid var(--bdr)',
              maxWidth: 220,
            }}
          >
            <p className="mb-0.5 font-bold" style={{ color: 'var(--text)' }}>{label}</p>
            <p style={{ color: 'var(--text2)' }}>{description}</p>
          </div>,
          document.body,
        )}
    </div>
  );
};
```

- [ ] **Step 4 : Lancer les tests pour confirmer qu'ils passent**

```bash
npx vitest run src/components/plan/ToolTooltip.test.tsx
```
Expected: 4 tests PASS

- [ ] **Step 5 : Intégrer `ToolTooltip` dans `PlanToolbar.tsx`**

Ajouter en haut du fichier :
```tsx
import { ToolTooltip } from './ToolTooltip';
```

Ajouter juste avant le `export const PlanToolbar` :
```tsx
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
  THICKNESS: { label: 'Épaisseur',               description: "Modifie l'épaisseur d'un mur ou d'une cloison" },
  ANCHOR:    { label: 'Ancrer un nœud',          description: 'Fige un point pour qu\'il ne soit pas déplacé' },
  undo:      { label: 'Annuler',                 description: 'Ctrl+Z — revenir à l\'état précédent' },
  redo:      { label: 'Rétablir',                description: 'Ctrl+Y — rétablir l\'action annulée' },
  clear:     { label: 'Effacer la pièce',        description: 'Supprime tous les points de la pièce active' },
} as const;
```

Envelopper chaque bouton avec `<ToolTooltip>`. Exemple pour SELECT (faire de même pour tous les boutons) :
```tsx
<ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
  <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon"
    onClick={() => onChangeTool('SELECT')} title="Sélectionner / Déplacer">
    <MousePointer2 size={18} />
  </Button>
</ToolTooltip>
```

Même chose pour WALL, DOOR, PARTITION, EXCLUDE, APPLY_H, APPLY_V, COINCIDE, DIMENSION, THICKNESS, ANCHOR, et les boutons Undo/Clear (utiliser `TOOL_TOOLTIPS.undo` et `TOOL_TOOLTIPS.clear`).

- [ ] **Step 6 : Lancer la suite complète**

```bash
npx vitest run
```
Expected: tous les tests passent (les tests existants ne sont pas affectés)

- [ ] **Step 7 : Commit**

```bash
git add src/components/plan/ToolTooltip.tsx src/components/plan/ToolTooltip.test.tsx src/components/plan/PlanToolbar.tsx
git commit -m "feat(plan): add rich tooltips to toolbar with 600ms delay"
```

---

## Task 2 : Redo — refactoring de l'historique

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`
- Modify: `src/components/plan/PlanToolbar.tsx`

> **Contexte :** L'historique actuel est `const [history, setHistory] = useState<HistoryEntry[]>([])` avec une ref associée. Il faut remplacer par deux piles `past` et `future` avec leurs refs.

- [ ] **Step 1 : Remplacer la déclaration de state dans `PlanEditor.tsx`**

Trouver la ligne (≈ ligne 246) :
```ts
const [history, setHistory] = useState<HistoryEntry[]>([]);
```
La remplacer par :
```ts
const [past,   setPast]   = useState<HistoryEntry[]>([]);
const [future, setFuture] = useState<HistoryEntry[]>([]);
```

- [ ] **Step 2 : Remplacer la ref et son useEffect**

Trouver (≈ ligne 307-313) :
```ts
const historyRef = useRef(history);
// ...
useEffect(() => { historyRef.current = history; }, [history]);
```
Remplacer par :
```ts
const pastRef   = useRef(past);
const futureRef = useRef(future);
// ...
useEffect(() => { pastRef.current = past; },     [past]);
useEffect(() => { futureRef.current = future; }, [future]);
```

- [ ] **Step 3 : Mettre à jour `pushHistory`**

Trouver (≈ ligne 342) :
```ts
const pushHistory = useCallback(() => {
  setHistory((prev) => [{
    rooms: deepCloneRooms(roomsRef.current),
    constraints: [...constraintsRef.current],
  }, ...prev.slice(0, 49)]);
}, []);
```
Remplacer par :
```ts
const pushHistory = useCallback(() => {
  setPast((prev) => [{
    rooms: deepCloneRooms(roomsRef.current),
    constraints: [...constraintsRef.current],
  }, ...prev.slice(0, 49)]);
  setFuture([]);
}, []);
```

- [ ] **Step 4 : Réécrire `handleUndo` et ajouter `handleRedo`**

Trouver (≈ ligne 1221) :
```ts
const handleUndo = () => {
  setHistory((prev) => {
    if (!prev.length) return prev;
    const [entry, ...rest] = prev;
    restoreSnapshot(entry!.rooms, entry!.constraints);
    return rest;
  });
};
```
Remplacer par :
```ts
const handleUndo = () => {
  const p = pastRef.current;
  if (!p.length) return;
  const [entry, ...rest] = p;
  const current: HistoryEntry = {
    rooms: deepCloneRooms(roomsRef.current),
    constraints: [...constraintsRef.current],
  };
  setFuture((f) => [current, ...f.slice(0, 49)]);
  setPast(rest);
  restoreSnapshot(entry!.rooms, entry!.constraints);
};

const handleRedo = () => {
  const f = futureRef.current;
  if (!f.length) return;
  const [entry, ...rest] = f;
  const current: HistoryEntry = {
    rooms: deepCloneRooms(roomsRef.current),
    constraints: [...constraintsRef.current],
  };
  setPast((p) => [current, ...p.slice(0, 49)]);
  setFuture(rest);
  restoreSnapshot(entry!.rooms, entry!.constraints);
};
```

- [ ] **Step 5 : Ajouter le raccourci Ctrl+Y dans le `useEffect` clavier**

Trouver (≈ ligne 404) :
```ts
if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
  e.preventDefault();
  if (historyRef.current.length > 0) handleUndo();
  else if (onNavigateBack) onNavigateBack();
}
```
Remplacer par :
```ts
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
```

- [ ] **Step 6 : Mettre à jour l'usage de `PlanToolbar` dans le JSX**

Trouver (≈ ligne 1331) :
```tsx
<PlanToolbar
  tool={tool} canUndo={history.length > 0}
  onChangeTool={...}
  onUndo={handleUndo} onClearRoom={handleClearRoom}
/>
```
Remplacer par :
```tsx
<PlanToolbar
  tool={tool}
  canUndo={past.length > 0}
  canRedo={future.length > 0}
  onChangeTool={(t) => { setTool(t); setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]); setEditingThicknessEdge(null); setEditingPartitionDimension(null); }}
  onUndo={handleUndo}
  onRedo={handleRedo}
  onClearRoom={handleClearRoom}
/>
```

- [ ] **Step 7 : Mettre à jour `PlanToolbar.tsx` — props et bouton Redo**

Ajouter `Redo2` aux imports lucide :
```tsx
import { ..., Redo2, Undo } from 'lucide-react';
```

Mettre à jour l'interface :
```tsx
interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearRoom: () => void;
}
```

Mettre à jour la destructuration :
```tsx
export const PlanToolbar = ({
  tool,
  canUndo,
  canRedo,
  onChangeTool,
  onUndo,
  onRedo,
  onClearRoom,
}: PlanToolbarProps) => (
```

Remplacer la section Actions (les deux boutons Undo + Trash) par :
```tsx
{/* ── Actions ── */}
<ToolTooltip {...TOOL_TOOLTIPS.undo}>
  <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
    <Undo size={18} />
  </Button>
</ToolTooltip>
<ToolTooltip {...TOOL_TOOLTIPS.redo}>
  <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
    <Redo2 size={18} />
  </Button>
</ToolTooltip>
<ToolTooltip {...TOOL_TOOLTIPS.clear}>
  <Button variant="danger" size="icon" onClick={onClearRoom} title="Effacer la pièce active">
    <Trash2 size={18} />
  </Button>
</ToolTooltip>
```

- [ ] **Step 8 : Ajouter Ctrl+Y dans le panel des raccourcis (`PlanEditor.tsx`)**

Trouver :
```tsx
<span>Annuler</span><kbd ...>Ctrl+Z</kbd>
```
Ajouter juste après :
```tsx
<span>Rétablir</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Y</kbd>
```

- [ ] **Step 9 : Lancer la suite de tests**

```bash
npx vitest run
```
Expected: tous les tests passent

- [ ] **Step 10 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx src/components/plan/PlanToolbar.tsx
git commit -m "feat(plan): add redo with past/future history stacks and Ctrl+Y shortcut"
```

---

## Task 3 : Hook `useDraggableSnap`

**Files:**
- Create: `src/components/plan/useDraggableSnap.ts`
- Create (test): `src/components/plan/useDraggableSnap.test.ts`

- [ ] **Step 1 : Écrire les tests en échec**

```ts
// src/components/plan/useDraggableSnap.test.ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useDraggableSnap } from './useDraggableSnap';

beforeEach(() => {
  localStorage.clear();
  // jsdom ne fournit pas window.innerWidth par défaut
  Object.defineProperty(window, 'innerWidth',  { writable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
});

describe('useDraggableSnap', () => {
  it('initialise avec defaultZone si localStorage vide', () => {
    const { result } = renderHook(() =>
      useDraggableSnap({ storageKey: 'test-zone', defaultZone: 'BOTTOM' }),
    );
    expect(result.current.zone).toBe('BOTTOM');
  });

  it('restaure la zone depuis localStorage', () => {
    localStorage.setItem('test-zone', 'TOP');
    const { result } = renderHook(() =>
      useDraggableSnap({ storageKey: 'test-zone', defaultZone: 'BOTTOM' }),
    );
    expect(result.current.zone).toBe('TOP');
  });

  it('isDragging est false et nearestZone est null au départ', () => {
    const { result } = renderHook(() =>
      useDraggableSnap({ storageKey: 'test-zone', defaultZone: 'SIDE' }),
    );
    expect(result.current.isDragging).toBe(false);
    expect(result.current.nearestZone).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer les tests pour confirmer qu'ils échouent**

```bash
npx vitest run src/components/plan/useDraggableSnap.test.ts
```
Expected: FAIL — `Cannot find module './useDraggableSnap'`

- [ ] **Step 3 : Créer `useDraggableSnap.ts`**

```ts
// src/components/plan/useDraggableSnap.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type SnapZone = 'SIDE' | 'TOP' | 'BOTTOM';

function getZoneCenters(): Record<SnapZone, { x: number; y: number }> {
  const w = typeof window !== 'undefined' ? window.innerWidth  : 1280;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    SIDE:   { x: 80,    y: 160 },
    TOP:    { x: w / 2, y: 40 },
    BOTTOM: { x: w / 2, y: h - 40 },
  };
}

function computeNearestZone(x: number, y: number): SnapZone {
  const centers = getZoneCenters();
  let best: SnapZone = 'SIDE';
  let bestDist = Infinity;
  for (const [zone, c] of Object.entries(centers) as [SnapZone, { x: number; y: number }][]) {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < bestDist) { bestDist = d; best = zone; }
  }
  return best;
}

interface UseDraggableSnapOptions {
  storageKey: string;
  defaultZone: SnapZone;
}

export function useDraggableSnap({ storageKey, defaultZone }: UseDraggableSnapOptions) {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
  const [zone, setZone] = useState<SnapZone>((stored as SnapZone | null) ?? defaultZone);
  const [isDragging, setIsDragging] = useState(false);
  const [nearestZone, setNearestZone] = useState<SnapZone | null>(null);
  const isDraggingRef = useRef(isDragging);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    setNearestZone(computeNearestZone(e.clientX, e.clientY));
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const snapped = computeNearestZone(e.clientX, e.clientY);
    setZone(snapped);
    setNearestZone(null);
    setIsDragging(false);
    localStorage.setItem(storageKey, snapped);
  }, [storageKey]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup',   handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup',   handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  return { zone, isDragging, handlePointerDown, nearestZone };
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
npx vitest run src/components/plan/useDraggableSnap.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 5 : Lancer la suite complète**

```bash
npx vitest run
```
Expected: tous les tests passent

- [ ] **Step 6 : Commit**

```bash
git add src/components/plan/useDraggableSnap.ts src/components/plan/useDraggableSnap.test.ts
git commit -m "feat(plan): add useDraggableSnap hook with 3 snap zones and localStorage persistence"
```

---

## Task 4 : RoomPanel — liste des pièces draggable

**Files:**
- Create: `src/components/plan/RoomPanel.tsx`
- Modify: `src/components/plan/PlanEditor.tsx`

> **Contexte :** `RoomTabs.tsx` reste inchangé. `RoomPanel.tsx` est un nouveau composant qui importe `RoomTabs` et ajoute le drag, la poignée, les zones cibles, et la gestion de position fixe selon la zone.

- [ ] **Step 1 : Créer `RoomPanel.tsx`**

```tsx
// src/components/plan/RoomPanel.tsx
'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { RoomTabs } from './RoomTabs';
import type { SnapZone } from './useDraggableSnap';
import type { Room } from '@/types/project';

interface RoomPanelProps {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}

const PANEL_STYLE: Record<SnapZone, React.CSSProperties> = {
  SIDE:   { position: 'fixed', left: 72, top: 16, zIndex: 10 },
  TOP:    { position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 },
  BOTTOM: { position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 },
};

// Zones cibles affichées pendant le drag
const DROP_ZONE_STYLE: Record<SnapZone, React.CSSProperties> = {
  SIDE:   { position: 'fixed', left: 64,   top:  8, width: 140, height: 200, zIndex: 9, borderRadius: 16 },
  TOP:    { position: 'fixed', left: '25%', top: 4,  width: '50%', height: 56, zIndex: 9, borderRadius: 16 },
  BOTTOM: { position: 'fixed', left: '25%', bottom: 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 },
};

export const RoomPanel = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRemoveRoom,
  onRenameRoom,
  zone,
  isDragging,
  onPointerDown,
}: RoomPanelProps) => (
  <>
    {/* Zones cibles visibles pendant le drag */}
    {isDragging && (['SIDE', 'TOP', 'BOTTOM'] as SnapZone[]).map((z) => (
      <div
        key={z}
        className="pointer-events-none"
        style={{
          ...DROP_ZONE_STYLE[z],
          border: '2px dashed rgba(249,115,22,0.4)',
          background: 'rgba(249,115,22,0.06)',
        }}
      />
    ))}

    {/* Panneau principal */}
    <div
      className={`group ${isDragging ? '' : 'transition-all duration-150 ease-out'}`}
      style={PANEL_STYLE[zone]}
    >
      {/* Poignée de drag */}
      <div
        className="absolute -left-5 top-1/2 -translate-y-1/2 flex h-8 w-5 cursor-grab items-center justify-center rounded-l-lg opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
        onPointerDown={onPointerDown}
      >
        <GripVertical size={12} style={{ color: 'var(--muted)' }} />
      </div>

      {/* Contenu : RoomTabs existant (layout horizontal uniquement pour l'instant) */}
      <RoomTabs
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={onSelectRoom}
        onAddRoom={onAddRoom}
        onRemoveRoom={onRemoveRoom}
        onRenameRoom={onRenameRoom}
      />
    </div>
  </>
);
```

> **Note :** `RoomTabs` contient un `position: absolute` dans son propre wrapper — supprimer ce positionnement dans `RoomTabs.tsx` puisque `RoomPanel` gère maintenant la position. Voir étape suivante.

- [ ] **Step 2 : Retirer le positionnement absolu de `RoomTabs.tsx`**

Dans `src/components/plan/RoomTabs.tsx`, trouver :
```tsx
<div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md">
```
Remplacer par (retirer `absolute bottom-4 left-1/2 z-10 -translate-x-1/2`) :
```tsx
<div className="flex items-center gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md">
```

- [ ] **Step 3 : Mettre à jour `PlanEditor.tsx` pour utiliser `RoomPanel`**

Ajouter les imports (en haut du fichier, remplacer l'import de `RoomTabs`) :
```tsx
// Remplacer : import { RoomTabs } from './RoomTabs';
import { RoomPanel } from './RoomPanel';
import { useDraggableSnap } from './useDraggableSnap';
```

Ajouter le hook juste après les déclarations de state (vers ligne 250, dans le corps du composant) :
```ts
const { zone: roomZone, isDragging: roomDragging, handlePointerDown: handleRoomPointerDown, nearestZone: roomNearestZone } =
  useDraggableSnap({ storageKey: 'calpiweb-room-panel-zone', defaultZone: 'SIDE' });
```

Trouver le bloc `<RoomTabs ...>` dans le JSX (≈ ligne 1337) :
```tsx
<RoomTabs rooms={rooms} activeRoomId={activeRoomId}
  onSelectRoom={setActiveRoomId} onAddRoom={handleAddRoom}
  onRemoveRoom={handleRemoveRoom} onRenameRoom={renameRoom} />
```
Remplacer par :
```tsx
<RoomPanel
  rooms={rooms}
  activeRoomId={activeRoomId}
  onSelectRoom={setActiveRoomId}
  onAddRoom={handleAddRoom}
  onRemoveRoom={handleRemoveRoom}
  onRenameRoom={renameRoom}
  zone={roomZone}
  isDragging={roomDragging}
  onPointerDown={handleRoomPointerDown}
/>
```

- [ ] **Step 4 : Lancer la suite de tests**

```bash
npx vitest run
```
Expected: tous les tests passent

- [ ] **Step 5 : Vérifier visuellement dans le navigateur**

```bash
npm run dev
```
- Ouvrir l'éditeur de plan
- La liste des pièces doit apparaître à droite du bandeau (zone SIDE par défaut)
- Survoler le panneau → la poignée `⠿` apparaît à gauche
- Glisser la poignée → 3 zones cibles s'illuminent
- Relâcher sur une zone → panneau snape, position persiste au rechargement

- [ ] **Step 6 : Commit**

```bash
git add src/components/plan/RoomPanel.tsx src/components/plan/RoomTabs.tsx src/components/plan/PlanEditor.tsx
git commit -m "feat(plan): draggable room panel with 3 snap zones and localStorage persistence"
```
