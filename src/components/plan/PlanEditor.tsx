// src/components/plan/PlanEditor.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Point } from '@/types/plan';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import {
  useProjectStore,
  selectActiveProject,
  selectRooms,
  selectDoorOpenings,
} from '@/store/projectStore';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import {
  dragOffset,
  normalizeOffset,
  originOffset,
  snapOffset,
} from '@/engine/tiling/layoutOrigin';
import { TileLayer } from '@/components/tiling/TileLayer';
import { TileSettingsSheet } from '@/components/tiling/TileSettingsSheet';
import { StartTileLayer } from '@/components/tiling/StartTileLayer';
import { computeStartTiles, pickStartTile } from '@/engine/tiling/startTile';
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
  return computeFitView(
    rooms.flatMap((r) => r.points),
    viewW,
    viewH,
  );
}

/**
 * Cadre un ensemble de points dans une zone visible de viewW × viewH,
 * décalée de (offsetX, offsetY) par rapport au coin haut-gauche du canevas.
 */
export function computeFitView(
  allPoints: Point[],
  viewW: number,
  viewH: number,
  offsetX = 0,
  offsetY = 0,
): { scale: number; pan: { x: number; y: number } } | null {
  if (allPoints.length === 0) return null;

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const bboxW = maxX - minX || 1000;
  const bboxH = maxY - minY || 1000;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Marge proportionnelle : 80 px sur ordinateur, ~30 px sur smartphone
  const PADDING = Math.min(80, Math.max(24, Math.min(viewW, viewH) * 0.08));
  const newScale = Math.max(
    0.005,
    Math.min((viewW - PADDING * 2) / bboxW, (viewH - PADDING * 2) / bboxH, 0.5),
  );

  return {
    scale: newScale,
    pan: {
      x: offsetX + viewW / 2 - cx * newScale,
      y: offsetY + viewH / 2 - cy * newScale,
    },
  };
}

/**
 * Zone du canevas réellement visible : on retire les éléments posés par-dessus
 * (panneau latéral à gauche, barre d'outils mobile, panneaux en bas…) repérés par
 * l'attribut data-canvas-overlay. Mesuré dans le DOM, donc juste quelle que soit
 * la taille d'écran.
 */
export function visibleCanvasArea(container: HTMLElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const c = container.getBoundingClientRect();
  let top = c.top;
  let bottom = c.bottom;
  let left = c.left;
  let right = c.right;
  container.querySelectorAll<HTMLElement>('[data-canvas-overlay]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return; // masqué (display:none)
    const fullWidth = r.width >= c.width * 0.9;
    if (fullWidth && r.top > c.top + c.height / 2) bottom = Math.min(bottom, r.top);
    else if (fullWidth) top = Math.max(top, r.bottom);
    // Panneau latéral (ordinateur) : seulement s'il occupe une bonne partie de la hauteur
    else if (r.height > c.height * 0.4) {
      if (r.right < c.left + c.width / 2) left = Math.max(left, r.right);
      else if (r.left > c.left + c.width / 2) right = Math.min(right, r.left);
    }
  });
  return {
    x: left - c.left,
    y: top - c.top,
    w: Math.max(120, right - left),
    h: Math.max(120, bottom - top),
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

export const PlanEditor = ({
  onNavigateBack,
  mode = 'PLAN',
  onModeChange,
  readOnly = false,
}: PlanEditorProps) => {
  const wallEngine = useProjectStore((s) => selectActiveProject(s)?.wallEngine);
  const wallThickness = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const wallRoomNames = useProjectStore(
    (s) => selectActiveProject(s)?.wallEngine?.wallRoomNames ?? {},
  );
  const addWall = useProjectStore((s) => s.addWall);
  const removeWall = useProjectStore((s) => s.removeWall);
  const updateWall = useProjectStore((s) => s.updateWall);
  const addNode = useProjectStore((s) => s.addNode);
  const updateNode = useProjectStore((s) => s.updateNode);
  const mergeNodes = useProjectStore((s) => s.mergeNodes);
  const initWallEngine = useProjectStore((s) => s.initWallEngine);
  const setWallThickness = useProjectStore((s) => s.setWallThickness);
  const renameWallRoom = useProjectStore((s) => s.renameWallRoom);
  const addWallExcludedZone = useProjectStore((s) => s.addWallExcludedZone);
  const removeWallExcludedZone = useProjectStore((s) => s.removeWallExcludedZone);
  const updateExcludeZoneNode = useProjectStore((s) => s.updateExcludeZoneNode);
  const splitWall = useProjectStore((s) => s.splitWall);
  const connectNodeToWall = useProjectStore((s) => s.connectNodeToWall);
  const restoreSnapshot = useProjectStore((s) => s.restoreSnapshot);
  const storedConfig = useProjectStore(
    (s) => selectActiveProject(s)?.config ?? DEFAULT_TILING_CONFIG,
  );
  const setConfig = useProjectStore((s) => s.setConfig);
  const rooms = useProjectStore(selectRooms);
  const doorOpenings = useProjectStore(useShallow(selectDoorOpenings));

  // ── Calepinage / quantitatif ────────────────────────────────────────────
  const showTiles = mode !== 'PLAN';
  // Valeur « en direct » pendant un glisser — enregistrée au lâcher uniquement
  const [liveConfig, setLiveConfig] = useState<TilingConfig | null>(null);
  const config = liveConfig ?? storedConfig;
  // Le Calepinage s'ouvre sur le plan : panneau replié par défaut
  const [tileSheetOpen, setTileSheetOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [qtySheetOpen, setQtySheetOpen] = useState(false);
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);
  const [gestureHint, setGestureHint] = useState(false);
  // Mode « choisir le carreau de départ » : un appui sur un carreau le désigne
  const [pickingStart, setPickingStart] = useState(false);

  const result = useMemo(
    () => (showTiles ? analyzeQuantities(rooms, config, wallThickness, doorOpenings) : null),
    [showTiles, rooms, config, wallThickness, doorOpenings],
  );

  // Carreau de départ coté (repère de pose pour le chantier)
  const startMarks = useMemo(
    () =>
      result && config.showStartTile
        ? computeStartTiles(rooms, result.tiles, config, wallThickness)
        : [],
    [result, config, rooms, wallThickness],
  );

  const handlePickStart = useCallback(() => {
    setPickingStart(true);
    setTileSheetOpen(false); // libère le plan sur smartphone
  }, []);

  const handleStartTap = useCallback(
    (world: Point) => {
      if (!result) return;
      const picked = pickStartTile(world, rooms, result.tiles, storedConfig);
      if (!picked) return; // appui hors des carreaux : on reste en mode choix
      setConfig({ ...storedConfig, showStartTile: true, startTile: picked });
      setPickingStart(false);
    },
    [result, rooms, storedConfig, setConfig],
  );

  // On quitte le mode choix en changeant d'onglet
  useEffect(() => {
    if (mode !== 'TILING') setPickingStart(false);
  }, [mode]);

  // Aide gestuelle affichée quelques secondes à l'entrée du Calepinage
  useEffect(() => {
    if (mode !== 'TILING') return;
    setGestureHint(true);
    const t = setTimeout(() => setGestureHint(false), 4500);
    return () => clearTimeout(t);
  }, [mode]);

  // Recadrage : à l'ouverture et à chaque changement d'onglet (Plan 2D / Calepinage /
  // Quantitatif) ou de panneau, le plan est centré dans la zone réellement visible
  // (hors barre d'outils mobile et panneaux posés sur le canevas).
  const sheetOpen =
    mode === 'TILING' ? tileSheetOpen : mode === 'QUANTITIES' ? qtySheetOpen : false;
  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const state = useProjectStore.getState();
    const nodes = selectActiveProject(state)?.wallEngine?.nodes ?? [];
    const points =
      nodes.length > 0
        ? nodes.map((n) => ({ x: n.x, y: n.y }))
        : selectRooms(state).flatMap((r) => r.points);
    const area = visibleCanvasArea(el);
    const view = computeFitView(points, area.w, area.h, area.x, area.y);
    if (!view) return;
    setScale(view.scale);
    setPan(view.pan);
  }, []);

  useEffect(() => {
    // Attendre la mise en page (panneaux affichés / masqués) avant de mesurer
    const id = requestAnimationFrame(fitView);
    return () => cancelAnimationFrame(id);
  }, [mode, sheetOpen, fitView]);

  const liveRef = useRef<TilingConfig | null>(null);

  const handleTileDrag = useCallback(
    (dx: number, dy: number) => {
      const base = liveRef.current ?? storedConfig;
      const next = { ...base, ...dragOffset(base, dx, dy) };
      liveRef.current = next;
      setLiveConfig(next);
    },
    [storedConfig],
  );

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

  // Un 2e doigt transforme le geste en zoom / déplacement du plan :
  // on annule le léger déplacement de pose fait par le 1er doigt.
  const handleTileDragCancel = useCallback(() => {
    liveRef.current = null;
    setLiveConfig(null);
  }, []);

  const handleOrigin = useCallback(
    (origin: 'CORNER' | 'CENTER') => {
      setConfig({
        ...storedConfig,
        ...originOffset(origin, rooms, storedConfig, wallThickness, doorOpenings),
      });
    },
    [storedConfig, rooms, wallThickness, doorOpenings, setConfig],
  );

  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [tool, setTool] = useState<PlanTool>('SELECT');
  const [tutorialMode, setTutorialMode] = useState(false);
  const [past, setPast] = useState<WallHistoryEntry[]>([]);
  const [future, setFuture] = useState<WallHistoryEntry[]>([]);

  const wallEngineRef = useRef(wallEngine);
  const pastRef = useRef(past);
  const futureRef = useRef(future);
  useEffect(() => {
    wallEngineRef.current = wallEngine;
  }, [wallEngine]);
  useEffect(() => {
    pastRef.current = past;
  }, [past]);
  useEffect(() => {
    futureRef.current = future;
  }, [future]);

  const {
    zone: roomZone,
    isDragging: roomDragging,
    handlePointerDown: handleRoomPointerDown,
  } = useDraggableSnap({ storageKey: 'calpiweb-room-panel-zone', defaultZone: 'SIDE' });

  // Auto-init wallEngine si manquant (migration projets legacy)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wallEngine === undefined) initWallEngine();
  }, []);

  // ── History ────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    const we = wallEngineRef.current;
    if (!we) return;
    setPast((prev) => [
      {
        wallEngine: {
          nodes: [...we.nodes],
          walls: [...we.walls],
          excludedZones: [...(we.excludedZones ?? [])],
        },
      },
      ...prev.slice(0, 49),
    ]);
    setFuture([]);
  }, []);

  const handleUndo = useCallback(() => {
    const [entry, ...rest] = pastRef.current;
    if (!entry) {
      if (onNavigateBack) onNavigateBack();
      return;
    }
    const we = wallEngineRef.current;
    if (we) {
      setFuture((f) => [
        {
          wallEngine: {
            nodes: [...we.nodes],
            walls: [...we.walls],
            excludedZones: [...(we.excludedZones ?? [])],
          },
        },
        ...f.slice(0, 49),
      ]);
    }
    setPast(rest);
    restoreSnapshot([], [], entry.wallEngine);
  }, [onNavigateBack, restoreSnapshot]);

  const handleRedo = useCallback(() => {
    const [entry, ...rest] = futureRef.current;
    if (!entry) return;
    const we = wallEngineRef.current;
    if (we) {
      setPast((p) => [
        {
          wallEngine: {
            nodes: [...we.nodes],
            walls: [...we.walls],
            excludedZones: [...(we.excludedZones ?? [])],
          },
        },
        ...p.slice(0, 49),
      ]);
    }
    setFuture(rest);
    restoreSnapshot([], [], entry.wallEngine);
  }, [restoreSnapshot]);

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (mode !== 'PLAN') return;
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (pastRef.current.length > 0) handleUndo();
        else if (onNavigateBack) onNavigateBack();
      }
      if (
        (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
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
            <div className="hidden mouse:block md:block">
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
            onOrigin={handleOrigin}
            onShowQuantities={() => onModeChange?.('QUANTITIES')}
            onPickStart={handlePickStart}
            readOnly={readOnly}
          />
        )}
        {mode === 'TILING' && pickingStart && (
          <div
            role="status"
            data-testid="pick-start-hint"
            className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-3.5 pr-1.5 text-[12.5px] font-semibold text-white shadow-lg"
            style={{ background: '#f97316' }}
          >
            Touchez le carreau de départ
            <button
              type="button"
              onClick={() => setPickingStart(false)}
              className="rounded-full bg-white/25 px-2.5 py-1 text-[12px] font-semibold hover:bg-white/35"
            >
              Annuler
            </button>
          </div>
        )}
        {mode === 'TILING' && gestureHint && !readOnly && !pickingStart && (
          <div
            role="status"
            data-testid="gesture-hint"
            className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-medium shadow-md"
            style={{
              background: 'var(--surf)',
              border: '1px solid var(--bdr)',
              color: 'var(--text2)',
            }}
          >
            1 doigt : déplacer les carreaux · 2 doigts : déplacer le plan
          </div>
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
          worldLayer={
            showTiles && result ? (
              <TileLayer
                rooms={rooms}
                result={result}
                config={config}
                wallThickness={wallThickness}
                doorOpenings={doorOpenings}
                showCutLabels={mode === 'QUANTITIES'}
                highlightGroup={mode === 'QUANTITIES' ? highlightGroup : null}
              />
            ) : undefined
          }
          worldOverlay={
            showTiles && result ? <StartTileLayer marks={startMarks} scale={scale} /> : undefined
          }
          onViewDrag={mode === 'TILING' && !readOnly && !pickingStart ? handleTileDrag : null}
          onViewTap={mode === 'TILING' && pickingStart ? handleStartTap : null}
          onViewDragEnd={handleTileDragEnd}
          onViewDragCancel={handleTileDragCancel}
          walls={wallEngine?.walls ?? []}
          nodes={wallEngine?.nodes ?? []}
          tool={
            (showTiles ? 'SELECT' : tool) as
              | 'WALL'
              | 'SELECT'
              | 'DELETE'
              | 'DOOR'
              | 'EXCLUDE'
              | 'LOCK'
          }
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
