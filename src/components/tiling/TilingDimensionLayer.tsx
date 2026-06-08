'use client';

import type { MouseEvent, PointerEvent } from 'react';
import type { TilingDimension, DimDirection } from '@/types/tilingDimension';
import type { Point } from '@/types/plan';
import type { SnapResult } from '@/engine/tiling/snapTiling';
import type { DimPreview } from '@/hooks/useTilingDimension';
import { formatCm } from '@/utils/formatters';
import { DimLine } from './DimLine';

interface TilingDimensionLayerProps {
  activeTool: 'pan' | 'dimension';
  dimensions: TilingDimension[];
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  scale: number;
  livePerpOverride: { id: string; perpOffset: number } | null;
  onContextMenu: (dimId: string) => void;
  onDimDragStart: (
    id: string,
    nx: number, ny: number,
    startPerp: number,
    e: PointerEvent<SVGGElement>,
  ) => void;
  onSelect?: (id: string) => void;
}

interface ProjectedDim {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset: number;
}

function projectDim(
  p1: Point,
  p2: Point,
  direction: DimDirection,
  parallelAngle: number | undefined,
  perpOffset: number,
): ProjectedDim {
  if (direction === 'H') {
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p1.y, label: formatCm(Math.abs(p2.x - p1.x)), perpOffset };
  }
  if (direction === 'V') {
    return { x1: p1.x, y1: p1.y, x2: p1.x, y2: p2.y, label: formatCm(Math.abs(p2.y - p1.y)), perpOffset };
  }
  const angle = parallelAngle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const proj = (p2.x - p1.x) * cos + (p2.y - p1.y) * sin;
  return {
    x1: p1.x, y1: p1.y,
    x2: p1.x + proj * cos, y2: p1.y + proj * sin,
    label: formatCm(Math.abs(proj)),
    perpOffset,
  };
}

function hasLength(pd: ProjectedDim): boolean {
  return Math.hypot(pd.x2 - pd.x1, pd.y2 - pd.y1) >= 10;
}

export const TilingDimensionLayer = ({
  activeTool,
  dimensions,
  hoverSnap,
  preview,
  scale,
  livePerpOverride,
  onContextMenu,
  onDimDragStart,
  onSelect,
}: TilingDimensionLayerProps) => {
  return (
    <g>
      {/* Snap indicator */}
      {activeTool === 'dimension' && hoverSnap && (
        <circle
          cx={hoverSnap.point.x}
          cy={hoverSnap.point.y}
          r={40 / scale}
          stroke="#10b981"
          strokeWidth={20 / scale}
          fill="none"
          className="pointer-events-none"
        />
      )}

      {/* Preview dimension (during picking_end) */}
      {preview && (() => {
        const pd = projectDim(preview.p1, preview.p2, preview.direction, preview.parallelAngle, preview.perpOffset);
        if (!hasLength(pd)) return null;
        return (
          <g className="pointer-events-none" opacity={0.6}>
            <DimLine x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2} label={pd.label} perpOffset={pd.perpOffset} scale={scale} />
          </g>
        );
      })()}

      {/* Placed dimensions */}
      {dimensions.map((dim) => {
        const effectivePerp = livePerpOverride?.id === dim.id ? livePerpOverride.perpOffset : dim.perpOffset;
        const pd = projectDim(dim.p1, dim.p2, dim.direction, dim.parallelAngle, effectivePerp);
        if (!hasLength(pd)) return null;
        return (
          <DimLine
            key={dim.id}
            x1={pd.x1} y1={pd.y1} x2={pd.x2} y2={pd.y2}
            label={pd.label}
            perpOffset={effectivePerp}
            scale={scale}
            onContextMenu={(e: MouseEvent<SVGGElement>) => {
              e.preventDefault();
              onContextMenu(dim.id);
            }}
            onPointerDown={(e: PointerEvent<SVGGElement>) => {
              e.stopPropagation();
              const { x1, y1, x2, y2 } = pd;
              const segLen = Math.hypot(x2 - x1, y2 - y1);
              if (segLen < 1) return;
              const snx = -(y2 - y1) / segLen;
              const sny =  (x2 - x1) / segLen;
              onDimDragStart(dim.id, snx, sny, effectivePerp, e);
            }}
            onLabelClick={onSelect ? () => onSelect(dim.id) : undefined}
          />
        );
      })}
    </g>
  );
};
