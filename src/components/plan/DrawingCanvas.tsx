'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Room, Constraint } from '@/types/project';
import type { Point } from '@/types/plan';
import { angle, distance } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import type { DOFMap } from '@/engine/constraints/dofAnalyzer';
import { ptKey } from '@/engine/constraints/dofAnalyzer';
import type { PlanTool } from './PlanToolbar';

export interface HoveredEdge { roomId: string; edgeIndex: number; t: number; }
export interface EditingEdgeState { roomId: string; edgeIndex: number; }
export interface SnapPreview { point: Point; type: 'vertex' | 'edge'; }

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
  constraints: Constraint[];
  coincideSource: { roomId: string; idx: number } | null;
  dofMap: DOFMap;
  canCloseActiveRoom: boolean;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onEdgePointerDown: (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => void;
  onVertexPointerDown: (roomId: string, index: number) => (e: ReactPointerEvent) => void;
  onConstraintRemove: (id: string) => void;
}

/** Returns all constraints touching both endpoints of a room edge (in either direction). */
function edgeConstraints(room: Room, edgeIdx: number, constraints: Constraint[]): Constraint[] {
  const n = room.points.length;
  const a = edgeIdx;
  const b = (edgeIdx + 1) % n;
  return constraints.filter((c) => {
    if (c.pts.length < 2) return false;
    const r0 = c.pts[0]!.roomId === room.id;
    const r1 = c.pts[1]!.roomId === room.id;
    if (!r0 || !r1) return false;
    const v0 = c.pts[0]!.vertexIdx;
    const v1 = c.pts[1]!.vertexIdx;
    return (v0 === a && v1 === b) || (v0 === b && v1 === a);
  });
}

export const DrawingCanvas = ({
  svgRef, rooms, activeRoomId, scale, pan, snapGrid, tool,
  isPanning, mousePos, editingEdge, hoveredEdge, snapPreview, originPoint,
  wallThickness, constraints, coincideSource, dofMap, canCloseActiveRoom,
  onPointerDown, onPointerMove, onPointerUp,
  onEdgePointerDown, onVertexPointerDown, onConstraintRemove,
}: DrawingCanvasProps) => {
  const hoveredEdgeType = hoveredEdge
    ? (rooms.find((r) => r.id === hoveredEdge.roomId)?.edges[hoveredEdge.edgeIndex] ?? 'WALL')
    : null;

  const cursorClass =
    tool === 'WALL' || tool === 'COINCIDE' || tool === 'ANCHOR' ? 'cursor-crosshair'
      : tool === 'DOOR'
        ? (hoveredEdgeType === 'DOOR' ? 'cursor-pointer' : hoveredEdge ? 'cursor-cell' : 'cursor-default')
      : isPanning ? 'cursor-grabbing' : 'cursor-grab';

  return (
    <svg ref={svgRef} className={`h-full w-full ${cursorClass}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}>
      <defs>
        <pattern id="grid" width={snapGrid * scale} height={snapGrid * scale}
          patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x}, ${pan.y})`}>
          <circle cx="1" cy="1" r="1" fill="#27272a" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>

        {/* ── COINCIDENT connection lines (below geometry) ── */}
        {constraints.map((c) => {
          if (c.type !== 'COINCIDENT' || c.pts.length < 2) return null;
          const r1 = rooms.find((r) => r.id === c.pts[0]!.roomId);
          const r2 = rooms.find((r) => r.id === c.pts[1]!.roomId);
          const p1 = r1?.points[c.pts[0]!.vertexIdx];
          const p2 = r2?.points[c.pts[1]!.vertexIdx];
          if (!p1 || !p2) return null;
          return (
            <line key={`coin-${c.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#22c55e" strokeWidth={22} strokeDasharray={`${65},${45}`}
              opacity={0.5} className="pointer-events-none" />
          );
        })}

        {/* ══ PASS 1 — Room geometry (polygons, walls, labels, badges) ══ */}
        {rooms.map((room) => {
          const pts = room.points;
          const edges = room.edges;
          const isActive = room.id === activeRoomId;
          const isClosed = pts.length >= 3 && !(isActive && tool === 'WALL');
          const centroid = pts.length >= 3
            ? pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 })
            : null;

          return (
            <g key={`geom-${room.id}`}>
              {isClosed && (
                <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={isActive ? '#18181b' : '#18181b60'} stroke="none" />
              )}

              {/* Ghost preview line */}
              {isActive && tool === 'WALL' && pts.length > 0 && (() => {
                const px = pts[pts.length - 1]!;
                const d = distance(px, mousePos);
                const midX = (px.x + mousePos.x) / 2;
                const midY = (px.y + mousePos.y) / 2;
                let ang = Math.atan2(mousePos.y - px.y, mousePos.x - px.x) * (180 / Math.PI);
                if (ang > 90 || ang < -90) ang += 180;
                return (
                  <>
                    <line x1={px.x} y1={px.y} x2={mousePos.x} y2={mousePos.y}
                      stroke="#f97316" strokeWidth={6 / scale}
                      strokeDasharray={`${120 / scale},${80 / scale}`} opacity={0.5} />
                    {d > 50 && (
                      <g transform={`translate(${midX}, ${midY}) rotate(${ang})`} className="pointer-events-none">
                        <rect x="-270" y="-230" width="540" height="200" fill="#1c1917cc" rx="50" />
                        <text x="0" y="-100" textAnchor="middle" fontSize="130" fontWeight="600" fill="#f97316cc"
                          style={{ fontFamily: 'system-ui' }}>{formatCm(d)}</text>
                      </g>
                    )}
                  </>
                );
              })()}

              {/* Walls */}
              {pts.map((p, i) => {
                if (i === pts.length - 1 && !isClosed) return null;
                const np = pts[(i + 1) % pts.length]!;
                const isDoor = (edges[i] ?? 'WALL') === 'DOOR';
                const isHov = hoveredEdge?.roomId === room.id && hoveredEdge.edgeIndex === i;
                const ec = edgeConstraints(room, i, constraints);
                const hasH = ec.some((c) => c.type === 'HORIZONTAL');
                const hasV = ec.some((c) => c.type === 'VERTICAL');
                const hasLen = ec.some((c) => c.type === 'LENGTH');

                const color =
                  isHov && isDoor ? '#f87171'
                    : isHov ? '#fb923c'
                    : isDoor ? '#f97316'
                    : hasH || hasV ? (isActive ? '#60a5fa' : '#1d4ed8')
                    : hasLen ? (isActive ? '#fbbf24' : '#92400e')
                    : isActive ? '#ea580c' : '#52525b';

                return (
                  <line key={`wall-${room.id}-${i}`} x1={p.x} y1={p.y} x2={np.x} y2={np.y}
                    stroke={color}
                    strokeWidth={isDoor ? wallThickness * 0.5 : wallThickness}
                    strokeLinecap="round"
                    strokeDasharray={isDoor ? `${wallThickness * 1.2},${wallThickness * 0.8}` : undefined} />
                );
              })}

              {/* Dimension labels */}
              {pts.map((p, i) => {
                if (i === pts.length - 1 && !isClosed) return null;
                const np = pts[(i + 1) % pts.length]!;
                const d = distance(p, np);
                const midX = (p.x + np.x) / 2;
                const midY = (p.y + np.y) / 2;
                let ang = angle(p, np) * (180 / Math.PI);
                if (ang > 90 || ang < -90) ang += 180;
                const isEditing = editingEdge?.roomId === room.id && editingEdge.edgeIndex === i;
                const isDoor = (edges[i] ?? 'WALL') === 'DOOR';
                const ec = edgeConstraints(room, i, constraints);
                const hasH = ec.some((c) => c.type === 'HORIZONTAL');
                const hasV = ec.some((c) => c.type === 'VERTICAL');
                const hasLen = ec.some((c) => c.type === 'LENGTH');

                const border = hasLen ? '#4ade80' : hasH || hasV ? '#3b82f6' : isDoor ? '#f97316' : isActive ? '#3f3f46' : '#27272a';
                const textFill = hasLen ? '#86efac' : hasH || hasV ? '#93c5fd' : isDoor ? '#f97316' : isActive ? '#f4f4f5' : '#71717a';
                const sw = hasLen || hasH || hasV ? 28 : 20;

                return (
                  <g key={`cote-${room.id}-${i}`}
                    transform={`translate(${midX}, ${midY}) rotate(${ang})`}
                    className="cursor-pointer"
                    onPointerDown={onEdgePointerDown(room.id, i, d)}>
                    {!isEditing && (
                      <>
                        <rect x="-350" y="-300" width="700" height="250" fill="#18181b" rx="60"
                          stroke={border} strokeWidth={sw} />
                        <text x="0" y="-130" textAnchor="middle" fontSize="160" fontWeight="bold" fill={textFill}>
                          {formatCm(d)}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Constraint badges (H / V / = ) per edge */}
              {isClosed && pts.map((_, i) => {
                if (i === pts.length - 1 && !isClosed) return null;
                const ec = edgeConstraints(room, i, constraints);
                if (ec.length === 0) return null;
                const p1 = pts[i]!;
                const p2 = pts[(i + 1) % pts.length]!;
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const dx = p2.x - p1.x, dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpX = -dy / len, perpY = dx / len;
                const cx = midX + perpX * 380;
                const cy = midY + perpY * 380;

                return ec.map((c) => {
                  const isGeo = c.type === 'HORIZONTAL' || c.type === 'VERTICAL';
                  const color = isGeo ? '#3b82f6' : '#fbbf24';
                  const label = c.type === 'HORIZONTAL' ? 'H' : c.type === 'VERTICAL' ? 'V' : '=';
                  return (
                    <g key={`badge-${c.id}`} transform={`translate(${cx}, ${cy})`}
                      className="cursor-pointer"
                      onPointerDown={(e) => { e.stopPropagation(); onConstraintRemove(c.id); }}>
                      {isGeo
                        ? <circle r="130" fill={color} opacity="0.92" />
                        : <rect x="-130" y="-130" width="260" height="260" rx="55" fill={color} opacity="0.92" />}
                      <text textAnchor="middle" dominantBaseline="middle" fontSize="145" fontWeight="700"
                        fill={isGeo ? 'white' : '#1c1917'} className="pointer-events-none select-none"
                        style={{ fontFamily: 'system-ui' }}>{label}</text>
                    </g>
                  );
                });
              })}

              {/* POINT_ON_LINE tick marks */}
              {constraints.map((c) => {
                if (c.type !== 'POINT_ON_LINE' || c.pts.length < 3) return null;
                const srcRoom = rooms.find((r) => r.id === c.pts[0]!.roomId);
                const srcPt = srcRoom?.points[c.pts[0]!.vertexIdx];
                if (!srcPt) return null;
                const lineR = rooms.find((r) => r.id === c.pts[1]!.roomId);
                const lp1 = lineR?.points[c.pts[1]!.vertexIdx];
                const lp2 = lineR?.points[c.pts[2]!.vertexIdx];
                if (!lp1 || !lp2) return null;
                const dx = lp2.x - lp1.x, dy = lp2.y - lp1.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpX = -dy / len, perpY = dx / len;
                return (
                  <line key={`pol-tick-${c.id}`}
                    x1={srcPt.x - perpX * 110} y1={srcPt.y - perpY * 110}
                    x2={srcPt.x + perpX * 110} y2={srcPt.y + perpY * 110}
                    stroke="#22c55e" strokeWidth={30} strokeLinecap="round"
                    className="pointer-events-none" />
                );
              })}

              {/* Room name */}
              {centroid && isClosed && (
                <text x={centroid.x} y={centroid.y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="200" fontWeight="bold" fill={isActive ? '#71717a' : '#3f3f46'}
                  className="pointer-events-none select-none">{room.name ?? ''}</text>
              )}
            </g>
          );
        })}

        {/* ══ PASS 2 — All vertices (always above all polygons) ══ */}
        {rooms.map((room) => {
          const pts = room.points;
          const isActive = room.id === activeRoomId;

          return (
            <g key={`vtx-${room.id}`}>
              {pts.map((p, i) => {
                const dof = dofMap.get(ptKey(room.id, i));
                const isFullyCon = dof?.isFullyConstrained ?? false;
                const isPartial = !isFullyCon && ((dof?.cx ?? false) || (dof?.cy ?? false));
                const isFixed = constraints.some((c) => c.type === 'FIX' && c.pts[0]?.roomId === room.id && c.pts[0]?.vertexIdx === i);
                const isCoinSrc = coincideSource?.roomId === room.id && coincideSource.idx === i;

                const showVertex = isActive || tool === 'COINCIDE' || tool === 'ANCHOR' || isCoinSrc || isFullyCon || isPartial || isFixed;
                if (!showVertex) return null;

                const isStart = isActive && tool === 'WALL' && i === 0 && canCloseActiveRoom;
                const isNearStart = isStart && distance(mousePos, pts[0]!) < 40 / scale;

                const fill = isCoinSrc ? '#06b6d4'
                  : isFixed ? '#a78bfa'
                  : isFullyCon ? '#22c55e'
                  : isPartial ? '#f59e0b'
                  : isNearStart ? '#f97316'
                  : isActive ? '#27272a' : '#3f3f46';

                const stroke = isCoinSrc ? '#0891b2'
                  : isFixed ? '#7c3aed'
                  : isFullyCon ? '#16a34a'
                  : isPartial ? '#d97706'
                  : isStart ? '#f97316'
                  : isActive ? '#ea580c' : '#52525b';

                const r = isStart ? 260 : 90;
                // Fully-constrained vertices block drag (spec §4) — show lock cursor
                const cursor = isFullyCon ? 'cursor-not-allowed' : isActive ? 'cursor-move' : 'cursor-pointer';

                return (
                  <g key={`vtx-${room.id}-${i}`} onPointerDown={onVertexPointerDown(room.id, i)}>
                    <circle cx={p.x} cy={p.y} r={isStart ? 300 : 220}
                      fill="transparent" className={cursor} />
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={fill} stroke={stroke} strokeWidth={28}
                      className="pointer-events-none" />
                    {/* FIX indicator: small pin dot */}
                    {isFixed && (
                      <circle cx={p.x} cy={p.y} r={36} fill="#7c3aed" className="pointer-events-none" />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ── Coincide-source ring ── */}
        {coincideSource && (() => {
          const srcRoom = rooms.find((r) => r.id === coincideSource.roomId);
          const srcPt = srcRoom?.points[coincideSource.idx];
          if (!srcPt) return null;
          return (
            <circle cx={srcPt.x} cy={srcPt.y} r={220} fill="none"
              stroke="#06b6d4" strokeWidth={26} strokeDasharray={`${55},${35}`}
              opacity={0.85} className="pointer-events-none" />
          );
        })()}

        {/* ── Snap preview ── */}
        {snapPreview && (
          <circle cx={snapPreview.point.x} cy={snapPreview.point.y}
            r={snapPreview.type === 'vertex' ? 250 : 180} fill="none"
            stroke={snapPreview.type === 'vertex' ? '#f97316' : '#fb923c'}
            strokeWidth={40} opacity={0.9} className="pointer-events-none" />
        )}

        {/* ── Origin marker ── */}
        {originPoint && (
          <g className="pointer-events-none">
            <line x1={originPoint.x - 350} y1={originPoint.y} x2={originPoint.x + 350} y2={originPoint.y} stroke="#a78bfa" strokeWidth={40} />
            <line x1={originPoint.x} y1={originPoint.y - 350} x2={originPoint.x} y2={originPoint.y + 350} stroke="#a78bfa" strokeWidth={40} />
            <circle cx={originPoint.x} cy={originPoint.y} r={100} fill="#a78bfa" />
          </g>
        )}
      </g>
    </svg>
  );
};
