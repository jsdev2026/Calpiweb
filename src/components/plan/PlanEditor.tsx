// src/components/plan/PlanEditor.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import { useProjectStore, selectActiveProject, selectRooms, selectDoorOpenings } from '@/store/projectStore';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { dragOffset, normalizeOffset, originOffset, snapOffset } from '@/engine/tiling/layoutOrigin';
import { TileLayer } from '@/components/tiling/TileLayer';
import { TileSettingsSheet } from '@/components/tiling/TileSettingsSheet';
import { QuantitiesSheet } from '@/components/quantities/QuantitiesSheet';
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

export type WorkspaceMode = 'PLAN' | 'TILING' | 'QUANTITIES';

interface PlanEditorProps {
  onNavigateBack?: () => void;
  /** Plan 2D, Calepinage et Quantitatif partagent la même vue (zoom / position). */
  mode?: WorkspaceMode;
  onModeChange?: (mode: WorkspaceMode) => void;
  readOnly?: boolean;
}

export const PlanEditor = ({ onNavigateBack, mode = 'PLAN', onModeChange, readOnly = false }: PlanEditorProps) => {
  const wallEngine           = useProjectStore((s) => selectActiveProject(s)?.wallEngine);
  const wallThickness        = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const wallRoomNames        = useProjectStore((s) => selectActiveProject(s)?.wallEngine?.wallRoomNames ?? {});
  const addWall              = useProjectStore((s) => s.addWall);
  const removeWall           = useProjectStore((s) => s.removeWall);
  const updateWall           = useProjectStore((s) => s.updateWall);
  const addNode              = useProjectStore((s) => s.addNode);
  const updateNode           = useProjectStore((s) => s.updateNode);
  const mergeNodes           = useProjectStore((s) => s.mergeNodes);
  const initWallEngine       = useProjectStore((s) => s.initWallEngine);
  const setWallThickness     = useProjectStore((s) => s.setWallThickness);
  const renameWallRoom       = useProjectStore((s) => s.renameWallRoom);
  const addWallExcludedZone    = useProjectStore((s) => s.addWallExcludedZone);
  const removeWallExcludedZone = useProjectStore((s) => s.removeWallExcludedZone);
  const updateExcludeZoneNode  = useProjectStore((s) => s.updateExcludeZoneNode);
  const splitWall              = useProjectStore((s) => s.splitWall);
  const connectNodeToWall      = useProjectStore((s) => s.connectNodeToWall);
  const restoreSnapshot      = useProjectStore((s) => s.restoreSnapshot);
  const storedConfig         = useProjectStore((s) => selectActiveProject(s)?.config ?? DEFAULT_TILING_CONFIG);
  const setConfig            = useProjectStore((s) => s.setConfig);
  const rooms                = useProjectStore(selectRooms);
  const doorOpenings         = useProjectStore(useShallow(selectDoorOpenings));

  // ── Calepinage / quantitatif ────────────────────────────────────────────
  const showTiles = mode !== 'PLAN';
  // Valeur « en direct » pendant un glisser — enregistrée au lâcher uniquement
  const [liveConfig, setLiveConfig] = useState<TilingConfig | null>(null);
  const config = liveConfig ?? storedConfig;
  const [moveMode, setMoveMode] = useState(false);
  const [tileSheetOpen, setTileSheetOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [qtySheetOpen, setQtySheetOpen] = useState(false);
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);

  const result = useMemo(
    () => (showTiles ? analyzeQuantities(rooms, config, wallThickness, doorOpenings) : null),
    [showTiles, rooms, config, wallThickness, doorOpenings],
  );

  useEffect(() => { if (mode !== 'TILING') setMoveMode(false); }, [mode]);

  // Recadrage : en Calepinage / Quantitatif, la pièce est centrée dans la zone
  // laissée libre par le panneau (bas sur mobile, droite sur ordinateur).
  const sheetOpen = mode === 'TILING' ? tileSheetOpen : qtySheetOpen;
  useEffect(() => {
    if (mode === 'PLAN') return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const wide = window.matchMedia('(min-width: 768px), (pointer: fine)').matches;
    const reserveRight = wide ? 370 : 0;
    const reserveBottom = wide ? 0 : sheetOpen ? window.innerHeight * 0.46 + 90 : 90;
    const view = computeInitialView(
      selectRooms(useProjectStore.getState()),
      Math.max(120, rect.width - reserveRight),
      Math.max(120, rect.height - reserveBottom),
    );
    if (!view) return;
    setScale(view.scale);
    setPan(view.pan);
  }, [mode, sheetOpen]);

  const liveRef = useRef<TilingConfig | null>(null);

  const handleTileDrag = useCallback((dx: number, dy: number) => {
    const base = liveRef.current ?? storedConfig;
    const next = { ...base, ...dragOffset(base, dx, dy) };
    liveRef.current = next;
    setLiveConfig(next);
  }, [storedConfig]);

  const handleTileDragEnd = useCallback(() => {
    const live = liveRef.current;
    liveRef.current = null;
    if (live) {
      // Aimantation : accroche la pose à l'angle ou au centre si on en est proche
      const targets = [
        originOffset('CORNER', rooms, live, wallThickness, doorOpenings),
        originOffset('CENTER', rooms, live, wallThickness, doorOpenings),
      ];
      const snapped = snapOffset(live, normalizeOffset(live, live.offsetX, live.offsetY), targets);
      setConfig({ ...live, ...snapped });
    }
    setLiveConfig(null);
  }, [rooms, wallThickness, doorOpenings, setConfig]);

  const handleOrigin = useCallback((origin: 'CORNER' | 'CENTER') => {
    setConfig({ ...storedConfig, ...originOffset(origin, rooms, storedConfig, wallThickness, doorOpenings) });
  }, [storedConfig, rooms, wallThickness, doorOpenings, setConfig]);

  const [scale, setScale]   = useState(0.1);
  const [pan,   setPan]     = useState<Point>({ x: 0, y: 0 });
  const [tool,  setTool]    = useState<PlanTool>('SELECT');
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
      if (mode !== 'PLAN') { if (e.key === 'Escape') setMoveMode(false); return; }
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
  }, [handleUndo, handleRedo, onNavigateBack, mode]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="relative flex flex-1 overflow-hidden"
        style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}
      >
        {mode === 'PLAN' && (
          <>
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
          </>
        )}

        {mode === 'TILING' && result && (
          <TileSettingsSheet
            config={config}
            onChange={setConfig}
            result={result}
            open={tileSheetOpen}
            onOpenChange={setTileSheetOpen}
            moveMode={moveMode}
            onMoveModeChange={(on) => { setMoveMode(on); if (on) setTileSheetOpen(false); }}
            onOrigin={handleOrigin}
            onShowQuantities={() => onModeChange?.('QUANTITIES')}
            readOnly={readOnly}
          />
        )}
        {mode === 'TILING' && moveMode && (
          <button
            type="button"
            onClick={() => setMoveMode(false)}
            className="absolute left-1/2 top-3 z-20 flex min-h-[44px] -translate-x-1/2 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white shadow-lg"
            style={{ background: 'var(--accent)' }}
          >
            Glissez pour déplacer la pose · Terminer
          </button>
        )}
        {mode === 'QUANTITIES' && result && (
          <QuantitiesSheet
            result={result}
            config={config}
            onChange={setConfig}
            open={qtySheetOpen}
            onOpenChange={setQtySheetOpen}
            onHighlight={setHighlightGroup}
            readOnly={readOnly}
          />
        )}

        <WallDrawingCanvas
          viewOnly={showTiles}
          worldLayer={showTiles && result ? (
            <TileLayer
              rooms={rooms}
              result={result}
              config={config}
              wallThickness={wallThickness}
              doorOpenings={doorOpenings}
              showCutLabels={mode === 'QUANTITIES'}
              highlightGroup={mode === 'QUANTITIES' ? highlightGroup : null}
            />
          ) : undefined}
          onViewDrag={mode === 'TILING' && moveMode && !readOnly ? handleTileDrag : null}
          onViewDragEnd={handleTileDragEnd}
          walls={wallEngine?.walls ?? []}
          nodes={wallEngine?.nodes ?? []}
          tool={(showTiles ? 'SELECT' : tool) as 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE' | 'LOCK'}
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
          wallThickness={wallThickness}
          excludedZones={wallEngine?.excludedZones ?? []}
          onAddExcludedZone={addWallExcludedZone}
          onRemoveExcludedZone={removeWallExcludedZone}
          onUpdateExcludeZoneNode={updateExcludeZoneNode}
          onSplitWall={splitWall}
          onConnectNodeToWall={connectNodeToWall}
          wallRoomNames={wallRoomNames}
          onRenameRoom={renameWallRoom}
        />
      </div>
    </div>
  );
};
