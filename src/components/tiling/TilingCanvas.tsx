'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Plan, Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';

interface TilingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  plan: Plan;
  tiles: Tile[];
  config: TilingConfig;
  scale: number;
  pan: Point;
  isDraggingGrid: boolean;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
}

export const TilingCanvas = ({
  svgRef,
  plan,
  tiles,
  config,
  scale,
  pan,
  isDraggingGrid,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: TilingCanvasProps) => {
  const pointsStr = plan.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      ref={svgRef}
      className={`h-full w-full ${isDraggingGrid ? 'cursor-grabbing' : 'cursor-grab'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        <defs>
          <clipPath id="roomClipPath">
            <polygon points={pointsStr} />
          </clipPath>
        </defs>

        <polygon points={pointsStr} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={50} />

        <g clipPath="url(#roomClipPath)">
          {tiles.map((tile) => (
            <rect
              key={tile.id}
              x={tile.rect.x}
              y={tile.rect.y}
              width={tile.rect.w}
              height={tile.rect.h}
              fill={tile.type === 'WHOLE' ? config.color : '#fbbf24'}
              stroke="#cbd5e1"
              strokeWidth={config.joint}
              opacity={0.9}
            />
          ))}
        </g>

        <polygon
          points={pointsStr}
          fill="none"
          stroke="#1e293b"
          strokeWidth={80}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
