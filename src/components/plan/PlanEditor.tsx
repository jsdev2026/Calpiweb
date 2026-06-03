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

// ── computeInitialView ─────────────────────────────────────────────────────
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

// ── Component ──────────────────────────────────────────────────────────────

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
