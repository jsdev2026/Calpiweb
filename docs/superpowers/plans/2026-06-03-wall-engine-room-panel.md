# Wall Engine — SP4 : WallRoomPanel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les pièces auto-détectées (nom + surface) dans un panel read-only au style identique à RoomPanel, visible quand le moteur de murs est actif.

**Architecture:** Nouveau composant `WallRoomPanel` qui duplique le conteneur visuel de `RoomPanel` (draggable, même style) mais liste les rooms issues de `selectRooms` en lecture seule. PlanEditor conditionne l'affichage : `wallEngine !== undefined` → `WallRoomPanel`, sinon → `RoomPanel`.

**Tech Stack:** TypeScript, React 18, Tailwind CSS, Zustand

**Spec:** `docs/superpowers/specs/2026-06-03-wall-engine-room-panel-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/WallRoomPanel.tsx` | **Créer** |
| `src/components/plan/PlanEditor.tsx` | **Modifier** — conditionner RoomPanel / WallRoomPanel |

---

### Task 1 : Créer `WallRoomPanel.tsx`

**Files:**
- Create: `src/components/plan/WallRoomPanel.tsx`

- [ ] **Step 1.1 : Créer le fichier complet**

```typescript
// src/components/plan/WallRoomPanel.tsx
'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { selectRooms } from '@/store/projectStore';
import { getPolygonArea } from '@/engine/geometry/polygon';
import { formatM2 } from '@/utils/formatters';
import type { SnapZone } from './useDraggableSnap';

interface WallRoomPanelProps {
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  tutorialMode?: boolean;
}

// Copie locale de la logique de positionnement de RoomPanel
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
        {/* Poignée drag */}
        <div
          className="absolute -right-5 top-1/2 -translate-y-1/2 flex h-8 w-5 cursor-grab items-center justify-center rounded-r-lg opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
          onPointerDown={onPointerDown}
        >
          <GripVertical size={12} style={{ color: 'var(--muted)' }} />
        </div>

        {/* Contenu */}
        <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md"
          style={{ minWidth: 140 }}>

          <p className="px-3 pt-1 pb-0 text-[9px] font-black uppercase tracking-[0.15em]"
             style={{ color: 'var(--muted)' }}>
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
                <p className="text-[11px] font-bold text-orange-500 dark:text-orange-400">
                  {room.name ?? 'Pièce'}
                </p>
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

- [ ] **Step 1.2 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Résultat attendu : 0 erreurs TypeScript sur le nouveau fichier.

- [ ] **Step 1.3 : Commit**

```bash
git add src/components/plan/WallRoomPanel.tsx
git commit -m "feat(wall-engine): WallRoomPanel — panel read-only pièces + surface"
```

---

### Task 2 : Brancher dans PlanEditor

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx`

- [ ] **Step 2.1 : Ajouter l'import**

Au début de `PlanEditor.tsx`, ajouter l'import de `WallRoomPanel` :

```typescript
import { WallRoomPanel } from './WallRoomPanel';
```

- [ ] **Step 2.2 : Conditionner le RoomPanel**

Localiser le bloc existant (ligne ~1774) :

```typescript
<div className="hidden md:block mouse:block">
  <RoomPanel
    rooms={rooms}
    activeRoomId={activeRoomId}
    onSelectRoom={setActiveRoomId}
    onAddRoom={handleAddRoom}
    onRemoveRoom={handleRemoveRoom}
    onRenameRoom={renameRoom}
    onClearRoom={handleClearRoom}
    zone={roomZone}
    isDragging={roomDragging}
    onPointerDown={handleRoomPointerDown}
    tutorialMode={tutorialMode}
  />
</div>
```

Remplacer par :

```typescript
<div className="hidden md:block mouse:block">
  {wallEngine !== undefined ? (
    <WallRoomPanel
      zone={roomZone}
      isDragging={roomDragging}
      onPointerDown={handleRoomPointerDown}
      tutorialMode={tutorialMode}
    />
  ) : (
    <RoomPanel
      rooms={rooms}
      activeRoomId={activeRoomId}
      onSelectRoom={setActiveRoomId}
      onAddRoom={handleAddRoom}
      onRemoveRoom={handleRemoveRoom}
      onRenameRoom={renameRoom}
      onClearRoom={handleClearRoom}
      zone={roomZone}
      isDragging={roomDragging}
      onPointerDown={handleRoomPointerDown}
      tutorialMode={tutorialMode}
    />
  )}
</div>
```

- [ ] **Step 2.3 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : **344 tests PASS**.

- [ ] **Step 2.4 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Résultat attendu : **0 erreurs**.

- [ ] **Step 2.5 : Commit**

```bash
git add src/components/plan/PlanEditor.tsx
git commit -m "feat(wall-engine): PlanEditor — WallRoomPanel quand moteur de murs actif"
```

---

### Task 3 : Validation finale

- [ ] **Step 3.1 : Suite complète**

```
npx vitest run
```

Résultat attendu : **344 tests PASS, 0 failures**.

- [ ] **Step 3.2 : Checklist manuelle**

1. Mode legacy (sans moteur de murs) → `RoomPanel` avec add/rename/delete visible ✓
2. Activer moteur de murs ("Nouveau moteur ✦") → `WallRoomPanel` s'affiche ✓
3. Aucun mur dessiné → "Aucune pièce fermée" ✓
4. Dessiner un rectangle fermé → "Pièce 1 / XX,XX m²" affiché ✓
5. Dessiner deux rectangles fermés → deux entrées ✓
6. Panel draggable via poignée hover ✓
7. Mode dark → visuel cohérent ✓
