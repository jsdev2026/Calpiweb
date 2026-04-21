'use client';

import { Move } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Plan, Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { computeTiling } from '@/engine/tiling/tilingEngine';
import { TilingCanvas } from './TilingCanvas';
import { TilingControls } from './TilingControls';
import { ResultsPanel } from '@/components/results/ResultsPanel';

interface TilingEditorProps {
  plan: Plan;
  config: TilingConfig;
  setConfig: (config: TilingConfig) => void;
}

export const TilingEditor = ({ plan, config, setConfig }: TilingEditorProps) => {
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDraggingGrid, setIsDraggingGrid] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const { tiles, stats } = useMemo(() => computeTiling(plan, config), [plan, config]);

  useEffect(() => {
    if (plan.length > 0 && svgRef.current) {
      const bbox = getBoundingBox(plan);
      const rect = svgRef.current.getBoundingClientRect();
      const roomW = bbox.maxX - bbox.minX;
      const roomH = bbox.maxY - bbox.minY;
      const newScale = Math.min(rect.width / (roomW + 1000), rect.height / (roomH + 1000));
      setScale(newScale);
      setPan({
        x: (rect.width - roomW * newScale) / 2 - bbox.minX * newScale,
        y: (rect.height - roomH * newScale) / 2 - bbox.minY * newScale,
      });
    }
  }, [plan]);

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 0) setIsDraggingGrid(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isDraggingGrid) {
      setConfig({
        ...config,
        offsetX: config.offsetX + e.movementX / scale,
        offsetY: config.offsetY + e.movementY / scale,
      });
    }
  };

  const handlePointerUp = () => setIsDraggingGrid(false);

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-100">
      <div className="relative flex-1 border-r border-slate-200">
        <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md bg-white/90 px-4 py-2 text-sm text-slate-700 shadow">
          <Move size={16} /> Glissez pour ajuster le point de départ
        </div>
        <TilingCanvas
          svgRef={svgRef}
          plan={plan}
          tiles={tiles}
          config={config}
          scale={scale}
          pan={pan}
          isDraggingGrid={isDraggingGrid}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      <aside className="z-20 flex w-80 flex-col gap-6 overflow-y-auto bg-white p-6 shadow-xl">
        <TilingControls config={config} onChange={setConfig} />
        <ResultsPanel stats={stats} />
      </aside>
    </div>
  );
};
