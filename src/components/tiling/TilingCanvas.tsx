'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import { partitionToPolygon } from '@/engine/tiling/tilingEngine';

interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
}

const DimLine = ({ x1, y1, x2, y2, label, perpOffset = 500 }: DimLineProps) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return null;
  const nx = -dy / len, ny = dx / len;
  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;
  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const tLen = 120;

  return (
    <g className="pointer-events-none">
      <line x1={x1} y1={y1} x2={dlx1 + ox * 0.15} y2={dly1 + oy * 0.15} stroke="#475569" strokeWidth={18} strokeDasharray="60,40" />
      <line x1={x2} y1={y2} x2={dlx2 + ox * 0.15} y2={dly2 + oy * 0.15} stroke="#475569" strokeWidth={18} strokeDasharray="60,40" />
      <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke="#64748b" strokeWidth={22} />
      <line x1={dlx1 - nx * tLen} y1={dly1 - ny * tLen} x2={dlx1 + nx * tLen} y2={dly1 + ny * tLen} stroke="#64748b" strokeWidth={22} />
      <line x1={dlx2 - nx * tLen} y1={dly2 - ny * tLen} x2={dlx2 + nx * tLen} y2={dly2 + ny * tLen} stroke="#64748b" strokeWidth={22} />
      <g transform={`translate(${midX}, ${midY}) rotate(${ang})`}>
        <rect x="-280" y="-210" width="560" height="240" fill="#0f172a" rx="50" />
        <text x="0" y="-65" textAnchor="middle" fontSize="145" fill="#94a3b8" fontWeight="bold">
          {label}
        </text>
      </g>
    </g>
  );
};

interface TilingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  rooms: Room[];
  tiles: Tile[];
  config: TilingConfig;
  scale: number;
  pan: Point;
  showDimensions: boolean;
  wallThickness: number;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
}

export const TilingCanvas = ({
  svgRef,
  rooms,
  tiles,
  config,
  scale,
  pan,
  showDimensions,
  wallThickness,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: TilingCanvasProps) => {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints.length > 0 ? allPoints : [{ x: 0, y: 0 }]);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  // Reference dimensions: only for straight layout at angle = 0
  const canShowDims = showDimensions && config.angle === 0 && config.layout === 'STRAIGHT';
  const stepX = config.width + config.joint;
  const stepY = config.height + config.joint;
  const effectiveAngle = config.angle;

  return (
    <svg
      ref={svgRef}
      className="h-full w-full cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        <defs>
          <clipPath id="tiledClip" clipPathUnits="userSpaceOnUse">
            <path
              clipRule="evenodd"
              fillRule="evenodd"
              d={[
                ...validRooms.map((r) =>
                  `M ${r.points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
                ),
                ...validRooms.flatMap((r) =>
                  (r.excludedZones ?? []).map((z) =>
                    `M ${z.points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
                  )
                ),
                ...validRooms.flatMap((r) =>
                  (r.partitions ?? []).map((pt) => {
                    const poly = partitionToPolygon(pt);
                    return `M ${poly.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
                  })
                ),
              ].join(' ')}
            />
          </clipPath>
        </defs>

        {validRooms.map((room) => (
          <polygon
            key={`bg-${room.id}`}
            points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="var(--surf3)"
          />
        ))}

        <g clipPath="url(#tiledClip)">
          <g transform={`rotate(${effectiveAngle}, ${centerX}, ${centerY})`}>
            {tiles.map((tile) =>
              tile.points ? (
                <polygon
                  key={tile.id}
                  points={tile.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={tile.type === 'WHOLE' ? config.color : 'var(--tile-cut-bg)'}
                  stroke="var(--tile-joint)"
                  strokeWidth={config.joint}
                />
              ) : (
                <rect
                  key={tile.id}
                  x={tile.rect.x}
                  y={tile.rect.y}
                  width={tile.rect.w}
                  height={tile.rect.h}
                  fill={tile.type === 'WHOLE' ? config.color : 'var(--tile-cut-bg)'}
                  stroke="var(--tile-joint)"
                  strokeWidth={config.joint}
                />
              )
            )}
          </g>
        </g>

        {/* Excluded zones — amber outline */}
        {validRooms.map((room) =>
          (room.excludedZones ?? []).map((zone) => (
            <polygon
              key={`ez-${zone.id}`}
              points={zone.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(251,191,36,0.10)"
              stroke="#f59e0b"
              strokeWidth={40}
              strokeDasharray="120,80"
              className="pointer-events-none"
            />
          ))
        )}

        {/* Room walls and doors */}
        {validRooms.map((room) =>
          room.points.map((p, i) => {
            const nextP = room.points[(i + 1) % room.points.length]!;
            const isDoor = (room.edges[i] ?? 'WALL') === 'DOOR';
            const edgeThick = room.edgeThicknesses?.[i] ?? wallThickness;
            return (
              <line
                key={`edge-${room.id}-${i}`}
                x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y}
                stroke={isDoor ? '#f97316' : '#ea580c'}
                strokeWidth={isDoor ? edgeThick * 0.5 : edgeThick}
                strokeLinecap="round"
                strokeDasharray={isDoor ? `${edgeThick * 1.2},${edgeThick * 0.8}` : undefined}
              />
            );
          }),
        )}

        {/* Partitions — filled polygon showing actual thickness */}
        {validRooms.map((room) =>
          (room.partitions ?? []).map((pt) => {
            const poly = partitionToPolygon(pt);
            return (
              <polygon
                key={`part-${pt.id}`}
                points={poly.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="var(--canvas-wall-inact)"
                opacity={0.85}
                stroke="#a78bfa"
                strokeWidth={20}
                className="pointer-events-none"
              />
            );
          })
        )}

        {/* Reference dimensions */}
        {canShowDims && validRooms.map((room) => {
          const pts = room.points;
          if (pts.length < 3) return null;
          const rb = getBoundingBox(pts);
          const roomW = rb.maxX - rb.minX;
          const roomH = rb.maxY - rb.minY;

          // Find tile cut sizes at room boundary
          const tilesInX = tiles.filter(
            (t) => t.rect.x < rb.maxX && t.rect.x + t.rect.w > rb.minX,
          );
          const tilesInY = tiles.filter(
            (t) => t.rect.y < rb.maxY && t.rect.y + t.rect.h > rb.minY,
          );

          const leftTileX = tilesInX.length > 0 ? Math.min(...tilesInX.map((t) => t.rect.x)) : rb.minX;
          const topTileY = tilesInY.length > 0 ? Math.min(...tilesInY.map((t) => t.rect.y)) : rb.minY;

          // Cut at left = visible width of first tile column
          const leftCut = leftTileX < rb.minX ? (leftTileX + config.width - rb.minX) : 0;
          // Cut at top = visible height of first tile row
          const topCut = topTileY < rb.minY ? (topTileY + config.height - rb.minY) : 0;

          // Full tiles repeat
          const fullCountX = leftCut > 0
            ? Math.floor((roomW - leftCut) / stepX)
            : Math.floor(roomW / stepX);
          const lastCutX = roomW - (leftCut > 0 ? leftCut : 0) - fullCountX * stepX;

          const fullCountY = topCut > 0
            ? Math.floor((roomH - topCut) / stepY)
            : Math.floor(roomH / stepY);
          const lastCutY = roomH - (topCut > 0 ? topCut : 0) - fullCountY * stepY;

          const offset = 600;

          return (
            <g key={`dims-${room.id}`}>
              {/* Room total width */}
              <DimLine
                x1={rb.minX} y1={rb.minY}
                x2={rb.maxX} y2={rb.minY}
                label={formatCm(roomW)}
                perpOffset={-offset}
              />
              {/* Room total height */}
              <DimLine
                x1={rb.maxX} y1={rb.minY}
                x2={rb.maxX} y2={rb.maxY}
                label={formatCm(roomH)}
                perpOffset={offset}
              />
              {/* Left cut tile */}
              {leftCut > 10 && (
                <DimLine
                  x1={rb.minX} y1={rb.maxY + offset * 0.4}
                  x2={rb.minX + leftCut} y2={rb.maxY + offset * 0.4}
                  label={formatCm(leftCut)}
                  perpOffset={offset * 0.6}
                />
              )}
              {/* Right cut tile */}
              {lastCutX > 10 && lastCutX < config.width - 10 && (
                <DimLine
                  x1={rb.maxX - lastCutX} y1={rb.maxY + offset * 0.4}
                  x2={rb.maxX} y2={rb.maxY + offset * 0.4}
                  label={formatCm(lastCutX)}
                  perpOffset={offset * 0.6}
                />
              )}
              {/* Top cut tile */}
              {topCut > 10 && (
                <DimLine
                  x1={rb.minX - offset * 0.4} y1={rb.minY}
                  x2={rb.minX - offset * 0.4} y2={rb.minY + topCut}
                  label={formatCm(topCut)}
                  perpOffset={-offset * 0.6}
                />
              )}
              {/* Bottom cut tile */}
              {lastCutY > 10 && lastCutY < config.height - 10 && (
                <DimLine
                  x1={rb.minX - offset * 0.4} y1={rb.maxY - lastCutY}
                  x2={rb.minX - offset * 0.4} y2={rb.maxY}
                  label={formatCm(lastCutY)}
                  perpOffset={-offset * 0.6}
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};
