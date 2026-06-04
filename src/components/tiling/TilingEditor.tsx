'use client';

import { Ruler } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import React from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { useProjectStore, selectActiveProject, selectDoorOpenings } from '@/store/projectStore';
import { useTilingDimension } from '@/hooks/useTilingDimension';
import { TilingCanvas } from './TilingCanvas';
import { TilingControls } from './TilingControls';
import { TilingDimensionLayer } from './TilingDimensionLayer';
import { ResultsPanel } from '@/components/results/ResultsPanel';

interface TilingEditorProps {
  rooms: Room[];
  config: TilingConfig;
  wallThickness: number;
  setConfig: (config: TilingConfig) => void;
}

export const TilingEditor = ({ rooms, config, wallThickness, setConfig }: TilingEditorProps) => {
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTool, setActiveTool] = useState<'pan' | 'dimension'>('pan');
  const [mobileTab, setMobileTab] = useState<'apercu' | 'reglages'>('apercu');
  const [dimDrag, setDimDrag] = useState<{
    id: string; nx: number; ny: number;
    startPerp: number; startMX: number; startMY: number;
  } | null>(null);
  const [livePerpOverride, setLivePerpOverride] = useState<{ id: string; perpOffset: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tilingTouchRef = useRef<{ dist: number; midX: number; midY: number; panX: number; panY: number } | null>(null);

  const handleTilingTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches;
    if (t.length === 2) {
      tilingTouchRef.current = {
        dist: Math.hypot(t[1]!.clientX - t[0]!.clientX, t[1]!.clientY - t[0]!.clientY),
        midX: (t[0]!.clientX + t[1]!.clientX) / 2,
        midY: (t[0]!.clientY + t[1]!.clientY) / 2,
        panX: pan.x, panY: pan.y,
      };
    } else if (t.length === 1) {
      tilingTouchRef.current = { dist: 0, midX: t[0]!.clientX, midY: t[0]!.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleTilingTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches;
    if (!tilingTouchRef.current) return;
    if (t.length === 2) {
      const dist = Math.hypot(t[1]!.clientX - t[0]!.clientX, t[1]!.clientY - t[0]!.clientY);
      const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
      const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
      const svg = svgRef.current;
      if (svg && tilingTouchRef.current.dist > 0) {
        const ratio = dist / tilingTouchRef.current.dist;
        const rect = svg.getBoundingClientRect();
        setScale((s) => {
          const ns = Math.max(0.005, Math.min(s * ratio, 4));
          setPan((p) => ({
            x: (midX - rect.left) - ((midX - rect.left) - p.x) * (ns / s),
            y: (midY - rect.top) - ((midY - rect.top) - p.y) * (ns / s),
          }));
          return ns;
        });
      }
      tilingTouchRef.current = { dist, midX, midY, panX: pan.x, panY: pan.y };
    } else if (t.length === 1) {
      const dx = t[0]!.clientX - tilingTouchRef.current.midX;
      const dy = t[0]!.clientY - tilingTouchRef.current.midY;
      setPan({ x: tilingTouchRef.current.panX + dx, y: tilingTouchRef.current.panY + dy });
    }
  };

  const handleTilingTouchEnd = () => { tilingTouchRef.current = null; };

  const doorOpenings = useProjectStore(selectDoorOpenings);
  const result = useMemo(
    () => analyzeQuantities(rooms, config, wallThickness, doorOpenings),
    [rooms, config, wallThickness, doorOpenings],
  );

  const dimensions = useProjectStore((s) => selectActiveProject(s)?.tilingDimensions ?? []);
  const updateTilingDimensionPerpOffset = useProjectStore((s) => s.updateTilingDimensionPerpOffset);

  const dimHook = useTilingDimension(rooms, result.tiles, wallThickness, scale, activeTool === 'dimension');

  const validRooms = rooms.filter((r) => r.points.length >= 3);

  useEffect(() => {
    if (validRooms.length > 0 && svgRef.current) {
      const allPoints = validRooms.flatMap((r) => r.points);
      const bbox = getBoundingBox(allPoints);
      const rect = svgRef.current.getBoundingClientRect();
      const roomW = bbox.maxX - bbox.minX;
      const roomH = bbox.maxY - bbox.minY;
      const newScale = Math.min(rect.width / (roomW + 1000), rect.height / (roomH + 1200));
      setScale(newScale);
      setPan({
        x: (rect.width - roomW * newScale) / 2 - bbox.minX * newScale,
        y: (rect.height - roomH * newScale) / 2 - bbox.minY * newScale,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.15;
      const dir = e.deltaY > 0 ? -1 : 1;
      let newScale = scale * (dir > 0 ? zoomFactor : 1 / zoomFactor);
      newScale = Math.max(0.005, Math.min(newScale, 4));
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setScale(newScale);
      setPan({ x: mx - (mx - pan.x) * (newScale / scale), y: my - (my - pan.y) * (newScale / scale) });
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [scale, pan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeTool === 'dimension') setActiveTool('pan');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool]);

  const toWorld = (e: { clientX: number; clientY: number }): Point | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (e.clientX - rect.left - pan.x) / scale, y: (e.clientY - rect.top - pan.y) / scale };
  };

  const handleDimDragStart = (
    id: string, nx: number, ny: number, startPerp: number,
    e: React.PointerEvent<SVGGElement>,
  ) => {
    if (!svgRef.current) return;
    e.preventDefault();
    svgRef.current.setPointerCapture(e.pointerId);
    const world = toWorld(e);
    if (!world) return;
    setDimDrag({ id, nx, ny, startPerp, startMX: world.x, startMY: world.y });
    setLivePerpOverride({ id, perpOffset: startPerp });
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool === 'dimension') return;
    if (e.button === 0) setIsDragging(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dimDrag) {
      const world = toWorld(e);
      if (!world) return;
      const delta = (world.x - dimDrag.startMX) * dimDrag.nx
                  + (world.y - dimDrag.startMY) * dimDrag.ny;
      setLivePerpOverride({ id: dimDrag.id, perpOffset: dimDrag.startPerp + delta });
      return;
    }
    if (activeTool === 'dimension') {
      const pt = toWorld(e);
      if (pt) dimHook.onPointerMove(pt);
      return;
    }
    if (isDragging) setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
  };

  const handlePointerUp = () => {
    if (dimDrag) {
      if (livePerpOverride) {
        updateTilingDimensionPerpOffset(dimDrag.id, livePerpOverride.perpOffset);
      }
      setDimDrag(null);
      setLivePerpOverride(null);
      return;
    }
    if (activeTool === 'dimension') return;
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool !== 'dimension') return;
    const pt = toWorld(e);
    if (pt) dimHook.onClick(pt, e.ctrlKey);
  };

  const dimensionLayer = (
    <TilingDimensionLayer
      activeTool={activeTool}
      dimensions={dimensions}
      hoverSnap={dimHook.hoverSnap}
      preview={dimHook.preview}
      scale={scale}
      livePerpOverride={livePerpOverride}
      onContextMenu={dimHook.onContextMenu}
      onDimDragStart={handleDimDragStart}
    />
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden dark:bg-zinc-950 bg-gray-100 md:flex-row">

      {/* Mobile tab bar */}
      <div className="flex border-b border-gray-200 dark:border-zinc-800 md:hidden" style={{ background: 'var(--surf)' }}>
        <button
          type="button"
          data-active={mobileTab === 'apercu' ? 'true' : 'false'}
          onClick={() => setMobileTab('apercu')}
          className="flex-1 py-2.5 text-[13px] font-medium transition-colors"
          style={mobileTab === 'apercu'
            ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
            : { color: 'var(--text2)', borderBottom: '2px solid transparent' }}>
          Aperçu
        </button>
        <button
          type="button"
          data-active={mobileTab === 'reglages' ? 'true' : 'false'}
          onClick={() => setMobileTab('reglages')}
          className="flex-1 py-2.5 text-[13px] font-medium transition-colors"
          style={mobileTab === 'reglages'
            ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
            : { color: 'var(--text2)', borderBottom: '2px solid transparent' }}>
          Réglages
        </button>
      </div>

      {/* Canvas area — full width on mobile (Aperçu tab), left panel on desktop */}
      <div className={`relative flex flex-1 flex-col border-r border-gray-200 dark:border-zinc-900 ${mobileTab === 'reglages' ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile touch overlay for pan + pinch-to-zoom */}
        <div
          className="absolute inset-0 z-10 md:hidden"
          style={{ touchAction: 'none' }}
          onTouchStart={handleTilingTouchStart}
          onTouchMove={handleTilingTouchMove}
          onTouchEnd={handleTilingTouchEnd}
        />
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
        />

        {/* Bottom controls: 3 rows on mobile, 1 row on desktop */}
        <div
          data-testid="controls-bar"
          className="absolute bottom-20 md:bottom-4 mouse:bottom-4 left-1/2 z-10 -translate-x-1/2 flex flex-col md:flex-row mouse:flex-row items-start md:items-center mouse:items-center gap-2 md:gap-5 mouse:gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md w-[calc(100%-2rem)] md:w-auto mouse:w-auto">
          {/* Row 1 : Côtes + Angle */}
          <div className="flex w-full items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTool((t) => t === 'dimension' ? 'pan' : 'dimension')}
              title="Placer des côtes (Échap pour quitter)"
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeTool === 'dimension'
                  ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
                  : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500'
              }`}
            >
              <Ruler size={12} /> Côtes
            </button>
            <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
            <div className="flex flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Angle</span>
              <input
                type="range" min="0" max="90" step="1"
                value={config.angle}
                onChange={(e) => setConfig({ ...config, angle: parseInt(e.target.value, 10) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
              />
              <span className="w-8 font-mono text-xs font-bold text-orange-400">{config.angle}°</span>
            </div>
          </div>
          {/* Separator Angle | Déc. (desktop only) */}
          <div className="hidden md:block h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          {/* Row 2 : Déc. X */}
          <div data-testid="dec-x-row" className="flex w-full items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Déc. X</span>
            <input
              type="range" min="0" max={config.width + config.joint} step="1"
              value={Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetX: parseInt(e.target.value, 10) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-7 font-mono text-[10px] font-bold text-orange-400">{Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}</span>
          </div>
          {/* Separator X | Y (desktop only) */}
          <div className="hidden md:block h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          {/* Row 3 : Déc. Y */}
          <div data-testid="dec-y-row" className="flex w-full items-center gap-2">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Déc. Y</span>
            <input
              type="range" min="0" max={config.height + config.joint} step="1"
              value={Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetY: parseInt(e.target.value, 10) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-7 font-mono text-[10px] font-bold text-orange-400">{Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}</span>
          </div>
        </div>
      </div>

      {/* Controls sidebar — full width on mobile (Réglages tab), right panel on desktop */}
      <aside className={`z-20 flex w-full flex-col overflow-y-auto dark:bg-zinc-900 bg-white shadow-2xl md:w-80 ${mobileTab === 'apercu' ? 'hidden md:flex' : 'flex'}`}>
        <TilingControls config={config} onChange={setConfig} />
        <ResultsPanel result={result} />
      </aside>
    </div>
  );
};
