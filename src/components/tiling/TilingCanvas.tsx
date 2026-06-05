'use client';

import type { PointerEvent as ReactPointerEvent, RefObject, ReactNode, MouseEvent } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import type { WallPolygon } from '@/engine/geometry/wallGeometry';
import { getBoundingBox, insetRoomPolygon } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import { partitionToPolygon } from '@/engine/tiling/tilingEngine';
import { DimLine } from './DimLine';

interface TilingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  rooms: Room[];
  tiles: Tile[];
  config: TilingConfig;
  scale: number;
  pan: Point;
  activeTool: 'pan' | 'dimension';
  wallThickness: number;
  dimensionLayer: ReactNode;
  doorOpenings?: DoorOpening[];
  wallPolygons?: WallPolygon[];
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onClick: (e: MouseEvent<SVGSVGElement>) => void;
}

function doorRectPath(door: DoorOpening): string {
  const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = (-dy / L) * (door.thickness / 2), py = (dx / L) * (door.thickness / 2);
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x   + px, y: door.to.y   + py },
    { x: door.to.x   - px, y: door.to.y   - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}

export const TilingCanvas = ({
  svgRef,
  rooms,
  tiles,
  config,
  scale,
  pan,
  activeTool,
  wallThickness,
  dimensionLayer,
  doorOpenings = [],
  wallPolygons = [],
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}: TilingCanvasProps) => {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints.length > 0 ? allPoints : [{ x: 0, y: 0 }]);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  // Reference dimensions: only for straight layout at angle = 0
  const canShowDims = activeTool === 'dimension' && config.angle === 0 && config.layout === 'STRAIGHT';
  const effectiveAngle = config.angle;

  return (
    <svg
      ref={svgRef}
      className={`h-full w-full ${activeTool === 'dimension' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onClick}
      onContextMenu={(e) => { if (activeTool === 'dimension') e.preventDefault(); }}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        <defs>
          <clipPath id="tiledClip" clipPathUnits="userSpaceOnUse">
            <path
              clipRule="evenodd"
              fillRule="evenodd"
              d={[
                ...validRooms.map((r) =>
                  `M ${insetRoomPolygon(r, wallThickness).map((p) => `${p.x},${p.y}`).join(' L ')} Z`
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
                ...doorOpenings.map(doorRectPath).filter(Boolean),
              ].join(' ')}
            />
          </clipPath>
        </defs>

        {validRooms.map((room) => (
          <polygon
            key={`bg-${room.id}`}
            points={insetRoomPolygon(room, wallThickness).map((p) => `${p.x},${p.y}`).join(' ')}
            fill="var(--tile-joint)"
          />
        ))}

        {doorOpenings.map((door, i) => {
          const path = doorRectPath(door);
          if (!path) return null;
          return <path key={`door-bg-${i}`} d={path} fill="var(--tile-joint)" />;
        })}

        <g clipPath="url(#tiledClip)">
          <g transform={`rotate(${effectiveAngle}, ${centerX}, ${centerY})`}>
            {tiles.map((tile) =>
              tile.points ? (
                <polygon
                  key={tile.id}
                  points={tile.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={tile.type === 'WHOLE' ? config.color : 'var(--tile-cut-bg)'}
                />
              ) : (
                <rect
                  key={tile.id}
                  x={tile.rect.x}
                  y={tile.rect.y}
                  width={tile.rect.w}
                  height={tile.rect.h}
                  fill={tile.type === 'WHOLE' ? config.color : 'var(--tile-cut-bg)'}
                />
              )
            )}
          </g>
        </g>

        {/* Wall polygons — même géométrie que le plan editor */}
        {wallPolygons.map((poly) => {
          if (!poly.points.length) return null;
          return (
            <polygon
              key={`wall-${poly.wallId}`}
              points={poly.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="var(--canvas-wall)"
              className="pointer-events-none"
            />
          );
        })}

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
          const offset = 600;
          return (
            <g key={`dims-${room.id}`}>
              <DimLine
                x1={rb.minX} y1={rb.minY}
                x2={rb.maxX} y2={rb.minY}
                label={formatCm(roomW)}
                perpOffset={-offset}
              />
              <DimLine
                x1={rb.maxX} y1={rb.minY}
                x2={rb.maxX} y2={rb.maxY}
                label={formatCm(roomH)}
                perpOffset={offset}
              />
            </g>
          );
        })}
        {dimensionLayer}
      </g>
    </svg>
  );
};
