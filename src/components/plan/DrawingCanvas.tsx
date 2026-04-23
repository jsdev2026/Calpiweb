'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import { angle, distance } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import type { PlanTool } from './PlanToolbar';

export interface HoveredEdge {
  roomId: string;
  edgeIndex: number;
  t: number;
}

export interface EditingEdgeState {
  roomId: string;
  edgeIndex: number;
}

export interface SnapPreview {
  point: Point;
  type: 'vertex' | 'edge';
}

interface DrawingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  rooms: Room[];
  activeRoomId: string | null;
  scale: number;
  pan: Point;
  snapGrid: number;
  tool: PlanTool;
  isPanning: boolean;
  mousePos: Point;
  editingEdge: EditingEdgeState | null;
  hoveredEdge: HoveredEdge | null;
  snapPreview: SnapPreview | null;
  originPoint: Point | null;
  wallThickness: number;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onEdgePointerDown: (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => void;
  onVertexPointerDown: (roomId: string, index: number) => (e: ReactPointerEvent) => void;
}

export const DrawingCanvas = ({
  svgRef,
  rooms,
  activeRoomId,
  scale,
  pan,
  snapGrid,
  tool,
  isPanning,
  mousePos,
  editingEdge,
  hoveredEdge,
  snapPreview,
  originPoint,
  wallThickness,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onEdgePointerDown,
  onVertexPointerDown,
}: DrawingCanvasProps) => {
  const cursorClass =
    tool === 'WALL'
      ? 'cursor-crosshair'
      : tool === 'DOOR'
        ? hoveredEdge
          ? 'cursor-cell'
          : 'cursor-default'
        : isPanning
          ? 'cursor-grabbing'
          : 'cursor-grab';

  return (
    <svg
      ref={svgRef}
      className={`h-full w-full ${cursorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <pattern
          id="grid"
          width={snapGrid * scale}
          height={snapGrid * scale}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${pan.x}, ${pan.y})`}
        >
          <circle cx="1" cy="1" r="1" fill="#27272a" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        {rooms.map((room) => {
          const pts = room.points;
          const edges = room.edges;
          const isActive = room.id === activeRoomId;
          const isClosed = pts.length >= 3 && !(isActive && tool === 'WALL');
          const fillColor = isActive ? '#18181b' : '#18181b60';

          // Centroid for room label
          const centroid =
            pts.length >= 3
              ? pts.reduce(
                  (acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }),
                  { x: 0, y: 0 },
                )
              : null;

          return (
            <g key={room.id}>
              {isClosed && (
                <polygon
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={fillColor}
                  stroke="none"
                />
              )}

              {isActive && tool === 'WALL' && pts.length > 0 && (
                <line
                  x1={pts[pts.length - 1]!.x}
                  y1={pts[pts.length - 1]!.y}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="#f97316"
                  strokeWidth={25 / scale}
                  strokeDasharray={`${40 / scale},${40 / scale}`}
                />
              )}

              {pts.map((p, i) => {
                if (i === pts.length - 1 && !isClosed) return null;
                const nextP = pts[(i + 1) % pts.length]!;
                const edgeType = edges[i] ?? 'WALL';
                const isDoor = edgeType === 'DOOR';
                const isHovered =
                  hoveredEdge?.roomId === room.id && hoveredEdge.edgeIndex === i;

                return (
                  <line
                    key={`wall-${room.id}-${i}`}
                    x1={p.x}
                    y1={p.y}
                    x2={nextP.x}
                    y2={nextP.y}
                    stroke={isHovered ? '#fb923c' : isDoor ? '#f97316' : isActive ? '#ea580c' : '#52525b'}
                    strokeWidth={isDoor ? wallThickness * 0.5 : wallThickness}
                    strokeLinecap="round"
                    strokeDasharray={isDoor ? `${wallThickness * 1.2},${wallThickness * 0.8}` : undefined}
                  />
                );
              })}

              {pts.map((p, i) => {
                if (i === pts.length - 1 && !isClosed) return null;
                const nextP = pts[(i + 1) % pts.length]!;
                const dist = distance(p, nextP);
                const midX = (p.x + nextP.x) / 2;
                const midY = (p.y + nextP.y) / 2;
                let ang = angle(p, nextP) * (180 / Math.PI);
                if (ang > 90 || ang < -90) ang += 180;
                const isEditing =
                  editingEdge?.roomId === room.id && editingEdge.edgeIndex === i;
                const isDoor = (edges[i] ?? 'WALL') === 'DOOR';

                return (
                  <g
                    key={`cote-${room.id}-${i}`}
                    transform={`translate(${midX}, ${midY}) rotate(${ang})`}
                    className="cursor-pointer"
                    onPointerDown={onEdgePointerDown(room.id, i, dist)}
                  >
                    {!isEditing && (
                      <>
                        <rect
                          x="-350"
                          y="-300"
                          width="700"
                          height="250"
                          fill="#18181b"
                          rx="60"
                          stroke={isDoor ? '#f97316' : isActive ? '#3f3f46' : '#27272a'}
                          strokeWidth="20"
                        />
                        <text
                          x="0"
                          y="-130"
                          textAnchor="middle"
                          fontSize="160"
                          fontWeight="bold"
                          fill={isDoor ? '#f97316' : isActive ? '#f4f4f5' : '#71717a'}
                        >
                          {formatCm(dist)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {isActive &&
                pts.map((p, i) => {
                  const isStart = tool === 'WALL' && i === 0 && pts.length >= 3;
                  const isNearStart = isStart && distance(mousePos, pts[0]!) < 40 / scale;
                  return (
                    <circle
                      key={`point-${room.id}-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={isStart ? 400 : 180}
                      fill={isNearStart ? '#f97316' : '#27272a'}
                      stroke={isStart ? '#f97316' : '#ea580c'}
                      strokeWidth={40}
                      className="cursor-move"
                      onPointerDown={onVertexPointerDown(room.id, i)}
                    />
                  );
                })}

              {/* Room name label */}
              {centroid && isClosed && (
                <text
                  x={centroid.x}
                  y={centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="200"
                  fontWeight="bold"
                  fill={isActive ? '#71717a' : '#3f3f46'}
                  className="pointer-events-none select-none"
                >
                  {room.name ?? ''}
                </text>
              )}
            </g>
          );
        })}

        {/* Snap preview indicator */}
        {snapPreview && (
          <circle
            cx={snapPreview.point.x}
            cy={snapPreview.point.y}
            r={snapPreview.type === 'vertex' ? 250 : 180}
            fill="none"
            stroke={snapPreview.type === 'vertex' ? '#f97316' : '#fb923c'}
            strokeWidth={40}
            opacity={0.9}
            className="pointer-events-none"
          />
        )}

        {/* Origin marker */}
        {originPoint && (
          <g className="pointer-events-none">
            <line
              x1={originPoint.x - 350}
              y1={originPoint.y}
              x2={originPoint.x + 350}
              y2={originPoint.y}
              stroke="#a78bfa"
              strokeWidth={40}
            />
            <line
              x1={originPoint.x}
              y1={originPoint.y - 350}
              x2={originPoint.x}
              y2={originPoint.y + 350}
              stroke="#a78bfa"
              strokeWidth={40}
            />
            <circle cx={originPoint.x} cy={originPoint.y} r={100} fill="#a78bfa" />
          </g>
        )}
      </g>
    </svg>
  );
};
