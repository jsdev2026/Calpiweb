'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Plan, Point } from '@/types/plan';
import { angle, distance } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import { WALL_THICKNESS_MM } from '@/constants/businessRules';

interface DrawingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  plan: Plan;
  scale: number;
  pan: Point;
  snapGrid: number;
  tool: 'draw' | 'pan';
  isPanning: boolean;
  isClosed: boolean;
  mousePos: Point;
  editingEdge: number | null;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onEdgePointerDown: (edgeIndex: number, currentDistanceMm: number) => (e: ReactPointerEvent) => void;
  onVertexPointerDown: (index: number) => (e: ReactPointerEvent) => void;
}

export const DrawingCanvas = ({
  svgRef,
  plan,
  scale,
  pan,
  snapGrid,
  tool,
  isPanning,
  isClosed,
  mousePos,
  editingEdge,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onEdgePointerDown,
  onVertexPointerDown,
}: DrawingCanvasProps) => {
  const cursorClass =
    tool === 'draw' ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab';

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
          <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        {isClosed && (
          <polygon points={plan.map((p) => `${p.x},${p.y}`).join(' ')} fill="#e2e8f0" stroke="none" />
        )}

        {tool === 'draw' && plan.length > 0 && !isClosed && (
          <line
            x1={plan[plan.length - 1]!.x}
            y1={plan[plan.length - 1]!.y}
            x2={mousePos.x}
            y2={mousePos.y}
            stroke="#94a3b8"
            strokeWidth={2 / scale}
            strokeDasharray={`${5 / scale},${5 / scale}`}
          />
        )}

        {plan.map((p, i) => {
          if (i === plan.length - 1 && !isClosed) return null;
          const nextP = plan[(i + 1) % plan.length]!;
          return (
            <line
              key={`wall-${i}`}
              x1={p.x}
              y1={p.y}
              x2={nextP.x}
              y2={nextP.y}
              stroke="#1e293b"
              strokeWidth={WALL_THICKNESS_MM}
              strokeLinecap="round"
            />
          );
        })}

        {plan.map((p, i) => {
          if (i === plan.length - 1 && !isClosed) return null;
          const nextP = plan[(i + 1) % plan.length]!;
          const dist = distance(p, nextP);
          const midX = (p.x + nextP.x) / 2;
          const midY = (p.y + nextP.y) / 2;
          let ang = angle(p, nextP) * (180 / Math.PI);
          if (ang > 90 || ang < -90) ang += 180;

          const isEditing = editingEdge === i;

          return (
            <g
              key={`cote-${i}`}
              transform={`translate(${midX}, ${midY}) rotate(${ang})`}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onPointerDown={onEdgePointerDown(i, dist)}
            >
              {!isEditing && (
                <>
                  <rect
                    x="-300"
                    y="-300"
                    width="600"
                    height="200"
                    fill="white"
                    rx="50"
                    opacity="0.95"
                    stroke="#cbd5e1"
                    strokeWidth="15"
                  />
                  <text
                    x="0"
                    y="-160"
                    textAnchor="middle"
                    fontSize="140"
                    fontWeight="bold"
                    fill="#2563eb"
                  >
                    {formatCm(dist)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {plan.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r={150}
            className="cursor-move transition-colors hover:fill-blue-400"
            fill={i === 0 && tool === 'draw' && plan.length > 2 ? '#3b82f6' : '#ffffff'}
            stroke="#1e293b"
            strokeWidth={40}
            onPointerDown={onVertexPointerDown(i)}
          />
        ))}
      </g>
    </svg>
  );
};
