'use client';

import { Ruler } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { computeTilingMultiRoom } from '@/engine/tiling/tilingEngine';
import { TilingCanvas } from './TilingCanvas';
import { TilingControls } from './TilingControls';
import { ResultsPanel } from '@/components/results/ResultsPanel';

interface TilingEditorProps {
  rooms: Room[];
  config: TilingConfig;
  setConfig: (config: TilingConfig) => void;
}

export const TilingEditor = ({ rooms, config, setConfig }: TilingEditorProps) => {
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { tiles, stats } = useMemo(() => computeTilingMultiRoom(rooms, config), [rooms, config]);

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

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 0) setIsDragging(true);
  };
  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isDragging) setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
  };
  const handlePointerUp = () => setIsDragging(false);

  return (
    <div className="flex flex-1 overflow-hidden dark:bg-zinc-950 bg-gray-100">
      <div className="relative flex flex-1 flex-col border-r border-gray-200 dark:border-zinc-900">
        <TilingCanvas
          svgRef={svgRef}
          rooms={rooms}
          tiles={tiles}
          config={config}
          scale={scale}
          pan={pan}
          showDimensions={showDimensions}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Bottom controls: angle + offsets */}
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 px-5 py-3 shadow-2xl backdrop-blur-md">
          {/* Dimensions toggle */}
          <button
            type="button"
            onClick={() => setShowDimensions((v) => !v)}
            title={config.layout !== 'STRAIGHT' || config.angle !== 0 ? 'Cotation disponible uniquement en pose droite à 0°' : 'Afficher / masquer les côtes'}
            disabled={config.layout !== 'STRAIGHT' || config.angle !== 0}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
              showDimensions
                ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
                : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500 disabled:opacity-30'
            }`}
          >
            <Ruler size={12} /> Côtes
          </button>
          <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Angle</span>
            <input
              type="range" min="0" max="90" step="1"
              value={config.angle}
              onChange={(e) => setConfig({ ...config, angle: parseInt(e.target.value, 10) })}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
            <span className="w-10 font-mono text-xs font-bold text-orange-400">{config.angle}°</span>
          </div>
          <div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Décal. X</span>
            <input
              type="range" min="0" max={config.width + config.joint} step="1"
              value={Math.round(((config.offsetX % (config.width + config.joint)) + (config.width + config.joint)) % (config.width + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetX: parseInt(e.target.value, 10) })}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-14 text-right text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">Décal. Y</span>
            <input
              type="range" min="0" max={config.height + config.joint} step="1"
              value={Math.round(((config.offsetY % (config.height + config.joint)) + (config.height + config.joint)) % (config.height + config.joint))}
              onChange={(e) => setConfig({ ...config, offsetY: parseInt(e.target.value, 10) })}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-zinc-700 accent-orange-500"
            />
          </div>
        </div>
      </div>

      <aside className="z-20 flex w-80 flex-col overflow-y-auto dark:bg-zinc-900 bg-white shadow-2xl">
        <TilingControls config={config} onChange={setConfig} />
        <ResultsPanel stats={stats} />
      </aside>
    </div>
  );
};
