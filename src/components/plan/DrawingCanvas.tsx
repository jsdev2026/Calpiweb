'use client';

import { useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Room, Constraint, ExcludedZone, Partition, PointRef } from '@/types/project';
import type { Point } from '@/types/plan';
import { angle, distance } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import type { DOFMap } from '@/engine/constraints/dofAnalyzer';
import { ptKey } from '@/engine/constraints/dofAnalyzer';
import { constraintInteriorOffset } from '@/engine/constraints/interiorOffset';
import type { PlanTool } from './PlanToolbar';

export interface HoveredEdge { roomId: string; edgeIndex: number; t: number; }
export interface EditingEdgeState { roomId: string; edgeIndex: number; }
export interface SnapPreview { point: Point; type: 'vertex' | 'edge'; }
export interface HoveredZoneEdge { roomId: string; zoneId: string; edgeIndex: number; }
export interface EditingZoneEdge { roomId: string; zoneId: string; edgeIndex: number; }
export interface HoveredPartitionEdge { roomId: string; partitionId: string; }

export interface PartitionDimLine {
  fromRef: PointRef;
  toRef: PointRef;
  fromPt: Point;
  toPt: Point;
  dist: number;
  existingConstraintId?: string;
  constraintType?: 'LENGTH' | 'H_DISTANCE' | 'V_DISTANCE';
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
  constraints: Constraint[];
  coincideSource: { roomId: string; idx: number } | null;
  dofMap: DOFMap;
  canCloseActiveRoom: boolean;
  partitionOrigin: Point | null;
  excludePoints: Point[];
  editingPartition: { roomId: string; partitionId: string } | null;
  hoveredZoneEdge: HoveredZoneEdge | null;
  editingZoneEdge: EditingZoneEdge | null;
  hoveredPartitionEdge: HoveredPartitionEdge | null;
  partitionDimLines: PartitionDimLine[];
  editingPartitionDimension: { fromRef: PointRef; toRef: PointRef } | null;
  dimensionSource: { roomId: string; idx: number } | null;
  onPartitionDimensionPointerDown: (fromRef: PointRef, toRef: PointRef, dist: number) => (e: ReactPointerEvent) => void;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onEdgePointerDown: (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => void;
  onVertexPointerDown: (roomId: string, index: number) => (e: ReactPointerEvent) => void;
  onConstraintRemove: (id: string) => void;
  onDeletePartition: (roomId: string, partitionId: string) => void;
  onDeleteExcludedZone: (roomId: string, zoneId: string) => void;
  onPartitionLabelPointerDown: (roomId: string, partitionId: string, lengthMm: number) => (e: ReactPointerEvent) => void;
  onPartitionVertexPointerDown: (parentRoomId: string, partitionId: string, idx: number) => (e: ReactPointerEvent) => void;
  onZoneVertexPointerDown: (parentRoomId: string, zoneId: string, idx: number) => (e: ReactPointerEvent) => void;
  onZoneEdgePointerDown: (parentRoomId: string, zoneId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => void;
}

// ── Constraint helpers ─────────────────────────────────────────────────────

function edgeConstraints(room: Room, edgeIdx: number, constraints: Constraint[]): Constraint[] {
  const n = room.points.length;
  const a = edgeIdx, b = (edgeIdx + 1) % n;
  return constraints.filter((c) => {
    if (c.pts.length < 2) return false;
    const [p0, p1] = [c.pts[0]!, c.pts[1]!];
    if (p0.roomId !== room.id || p1.roomId !== room.id) return false;
    return (p0.vertexIdx === a && p1.vertexIdx === b) || (p0.vertexIdx === b && p1.vertexIdx === a);
  });
}

function zoneEdgeConstraints(zone: ExcludedZone, edgeIdx: number, constraints: Constraint[]): Constraint[] {
  const n = zone.points.length;
  const a = edgeIdx, b = (edgeIdx + 1) % n;
  return constraints.filter((c) => {
    if (c.pts.length < 2) return false;
    const [p0, p1] = [c.pts[0]!, c.pts[1]!];
    if (p0.roomId !== zone.id || p1.roomId !== zone.id) return false;
    return (p0.vertexIdx === a && p1.vertexIdx === b) || (p0.vertexIdx === b && p1.vertexIdx === a);
  });
}

function partitionEdgeConstraints(partition: Partition, constraints: Constraint[]): Constraint[] {
  return constraints.filter((c) => {
    if (c.pts.length < 2) return false;
    const [p0, p1] = [c.pts[0]!, c.pts[1]!];
    if (p0.roomId !== partition.id || p1.roomId !== partition.id) return false;
    return (p0.vertexIdx === 0 && p1.vertexIdx === 1) || (p0.vertexIdx === 1 && p1.vertexIdx === 0);
  });
}

/** Resolve a PointRef to world coords — checks rooms, their zones, and their partitions. */
function resolvePointRef(rooms: Room[], ptRef: PointRef): Point | undefined {
  const room = rooms.find((r) => r.id === ptRef.roomId);
  if (room) return room.points[ptRef.vertexIdx];
  for (const r of rooms) {
    const zone = (r.excludedZones ?? []).find((z) => z.id === ptRef.roomId);
    if (zone) return zone.points[ptRef.vertexIdx];
    const part = (r.partitions ?? []).find((p) => p.id === ptRef.roomId);
    if (part) return ptRef.vertexIdx === 0 ? part.p1 : part.p2;
  }
  return undefined;
}

// ── Vertex badge shared renderer ───────────────────────────────────────────

interface VtxProps {
  p: Point; id: string; idx: number;
  dofMap: DOFMap; constraints: Constraint[];
  coincideSource: { roomId: string; idx: number } | null;
  defaultFill: string; defaultStroke: string;
  tool: PlanTool;
  onPointerDown: (e: ReactPointerEvent) => void;
}

function VertexBadge({ p, id, idx, dofMap, constraints, coincideSource, defaultFill, defaultStroke, onPointerDown }: VtxProps) {
  const dof = dofMap.get(ptKey(id, idx));
  const isFullyCon = dof?.isFullyConstrained ?? false;
  const isPartial = !isFullyCon && ((dof?.cx ?? false) || (dof?.cy ?? false));
  const isFixed = constraints.some((c) => c.type === 'FIX' && c.pts[0]?.roomId === id && c.pts[0]?.vertexIdx === idx);
  const isCoinSrc = coincideSource?.roomId === id && coincideSource.idx === idx;

  const fill = isCoinSrc ? '#06b6d4' : isFixed ? '#a78bfa' : isFullyCon ? '#22c55e' : isPartial ? '#f59e0b' : defaultFill;
  const stroke = isCoinSrc ? '#0891b2' : isFixed ? '#7c3aed' : isFullyCon ? '#16a34a' : isPartial ? '#d97706' : defaultStroke;
  const cursor = isFullyCon ? 'cursor-not-allowed' : 'cursor-move';

  return (
    <g onPointerDown={onPointerDown}>
      <circle cx={p.x} cy={p.y} r={220} fill="transparent" className={cursor} />
      <circle cx={p.x} cy={p.y} r={90} fill={fill} stroke={stroke} strokeWidth={28} className="pointer-events-none" />
      {isFixed && <circle cx={p.x} cy={p.y} r={36} fill="#7c3aed" className="pointer-events-none" />}
    </g>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export const DrawingCanvas = ({
  svgRef, rooms, activeRoomId, scale, pan, snapGrid, tool,
  isPanning, mousePos, editingEdge, hoveredEdge, snapPreview, originPoint,
  wallThickness, constraints, coincideSource, dofMap, canCloseActiveRoom,
  partitionOrigin, excludePoints, editingPartition,
  hoveredZoneEdge, editingZoneEdge, hoveredPartitionEdge,
  partitionDimLines, editingPartitionDimension, dimensionSource,
  onPartitionDimensionPointerDown,
  onPointerDown, onPointerMove, onPointerUp,
  onEdgePointerDown, onVertexPointerDown, onConstraintRemove: _onConstraintRemove,
  onDeletePartition, onDeleteExcludedZone, onPartitionLabelPointerDown,
  onPartitionVertexPointerDown, onZoneVertexPointerDown, onZoneEdgePointerDown,
}: DrawingCanvasProps) => {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  const hoveredEdgeType = hoveredEdge
    ? (rooms.find((r) => r.id === hoveredEdge.roomId)?.edges[hoveredEdge.edgeIndex] ?? 'WALL')
    : null;

  const cursorClass =
    tool === 'WALL' || tool === 'COINCIDE' || tool === 'ANCHOR' || tool === 'PARTITION' || tool === 'EXCLUDE'
      ? 'cursor-crosshair'
      : tool === 'DOOR'
        ? (hoveredEdgeType === 'DOOR' ? 'cursor-pointer' : hoveredEdge ? 'cursor-cell' : 'cursor-default')
      : isPanning ? 'cursor-grabbing' : 'cursor-grab';

  const canCloseExclude = excludePoints.length >= 3 &&
    excludePoints[0] != null &&
    distance(mousePos, excludePoints[0]) < 40 / scale;

  const showHandles = tool === 'SELECT' || tool === 'ANCHOR' || tool === 'COINCIDE' || tool === 'DIMENSION';

  return (
    <svg ref={svgRef} className={`h-full w-full ${cursorClass}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}>
      <defs>
        <pattern id="grid" width={snapGrid * scale} height={snapGrid * scale}
          patternUnits="userSpaceOnUse" patternTransform={`translate(${pan.x}, ${pan.y})`}>
          <circle cx="1" cy="1" r="1" fill="var(--canvas-dot)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="var(--canvas-bg)" />
      <rect width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>

        {/* ── COINCIDENT connection lines ── */}
        {constraints.map((c) => {
          if (c.type !== 'COINCIDENT' || c.pts.length < 2) return null;
          const p1 = resolvePointRef(rooms, c.pts[0]!);
          const p2 = resolvePointRef(rooms, c.pts[1]!);
          if (!p1 || !p2) return null;
          return (
            <line key={`coin-${c.id}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="#22c55e" strokeWidth={22} strokeDasharray={`${65},${45}`}
              opacity={0.5} className="pointer-events-none" />
          );
        })}

        {/* ══ PASS 1 — Room geometry ══ */}
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
                  fill={isActive ? 'var(--canvas-poly-active)' : 'var(--canvas-poly-inact)'} stroke="none" />
              )}

              {/* ── Excluded zones ── */}
              {isClosed && (room.excludedZones ?? []).map((zone) => {
                const isHovEdge = (zi: number) =>
                  hoveredZoneEdge?.zoneId === zone.id && hoveredZoneEdge.edgeIndex === zi;
                return (
                  <g key={`ez-${zone.id}`}>
                    <polygon points={zone.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(251,191,36,0.12)" stroke="none"
                      className={tool === 'EXCLUDE' ? 'cursor-pointer' : 'pointer-events-none'}
                      onPointerDown={tool === 'EXCLUDE'
                        ? (e) => { e.stopPropagation(); onDeleteExcludedZone(room.id, zone.id); }
                        : undefined} />
                    <clipPath id={`ez-clip-${zone.id}`}>
                      <polygon points={zone.points.map((p) => `${p.x},${p.y}`).join(' ')} />
                    </clipPath>
                    {(() => {
                      const minX = Math.min(...zone.points.map((p) => p.x));
                      const maxX = Math.max(...zone.points.map((p) => p.x));
                      const minY = Math.min(...zone.points.map((p) => p.y));
                      const maxY = Math.max(...zone.points.map((p) => p.y));
                      const step = 300;
                      const lines = [];
                      for (let d = minX + minY - (maxX - minX + maxY - minY); d < maxX + maxY; d += step) {
                        lines.push(<line key={d} x1={minX} y1={d - minX} x2={d - minY} y2={minY}
                          stroke="#f59e0b" strokeWidth={22} opacity={0.25} className="pointer-events-none" />);
                      }
                      return <g clipPath={`url(#ez-clip-${zone.id})`} className="pointer-events-none">{lines}</g>;
                    })()}
                    {/* Zone edge lines */}
                    {zone.points.map((zp, zi) => {
                      const znp = zone.points[(zi + 1) % zone.points.length]!;
                      const ec = zoneEdgeConstraints(zone, zi, constraints);
                      const hasH = ec.some((c) => c.type === 'HORIZONTAL');
                      const hasV = ec.some((c) => c.type === 'VERTICAL');
                      const hasDist = ec.some((c) => c.type === 'LENGTH' || c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE');
                      const isHov = isHovEdge(zi);
                      const color = isHov ? '#fb923c' : hasH || hasV ? '#60a5fa' : hasDist ? '#fbbf24' : '#f59e0b';
                      return (
                        <line key={`ze-${zone.id}-${zi}`} x1={zp.x} y1={zp.y} x2={znp.x} y2={znp.y}
                          stroke={color} strokeWidth={isHov ? 60 : 40}
                          strokeDasharray={isHov ? undefined : '120,80'} strokeLinecap="round"
                          className="pointer-events-none" />
                      );
                    })}
                    {/* ── Zone edge labels (no frame — halo text, shown only if room) ── */}
                    {zone.points.map((zp, zi) => {
                      const znp = zone.points[(zi + 1) % zone.points.length]!;
                      const zLen = distance(zp, znp);
                      const zmidX = (zp.x + znp.x) / 2, zmidY = (zp.y + znp.y) / 2;
                      let zAng = Math.atan2(znp.y - zp.y, znp.x - zp.x) * (180 / Math.PI);
                      if (zAng > 90 || zAng < -90) zAng += 180;
                      const zdx = znp.x - zp.x, zdy = znp.y - zp.y;
                      const zlenN = Math.sqrt(zdx * zdx + zdy * zdy) || 1;
                      const zperpOx = (-zdy / zlenN) * 260, zperpOy = (zdx / zlenN) * 260;
                      const ec = zoneEdgeConstraints(zone, zi, constraints);
                      const hasH = ec.some((c) => c.type === 'HORIZONTAL');
                      const hasV = ec.some((c) => c.type === 'VERTICAL');
                      const hDistC = ec.find((c) => c.type === 'H_DISTANCE');
                      const vDistC = ec.find((c) => c.type === 'V_DISTANCE');
                      const lenC = ec.find((c) => c.type === 'LENGTH');
                      const isEditingThis = editingZoneEdge?.zoneId === zone.id && editingZoneEdge.edgeIndex === zi;
                      if (isEditingThis) return null;
                      const zbKey = `z-${zone.id}-${zi}`;
                      const isHov = hoveredBadge === zbKey;
                      const zScreenLen = zLen * scale;
                      const hasDirC = hasH || hasV;
                      const hasDistC = !!(hDistC || vDistC || lenC);
                      const textFill = hasDistC ? '#22c55e' : hasDirC ? '#60a5fa' : '#d97706';
                      const dirIcon = hasH ? 'H ' : hasV ? 'V ' : '';
                      const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value)
                        : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value)
                        : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
                        : formatCm(zLen);
                      const mainLabel = `${dirIcon}${dimVal}`;
                      const showLabel = zScreenLen > 65 || isHov;
                      return (
                        <g key={`zbadge-${zone.id}-${zi}`}
                          transform={`translate(${zmidX + zperpOx}, ${zmidY + zperpOy}) rotate(${zAng})`}
                          onPointerEnter={() => setHoveredBadge(zbKey)}
                          onPointerLeave={() => setHoveredBadge(null)}>
                          <rect x="-500" y="-270" width="1000" height="270" fill="transparent"
                            className={tool === 'SELECT' ? 'cursor-pointer' : 'pointer-events-none'}
                            onPointerDown={tool === 'SELECT' ? onZoneEdgePointerDown(room.id, zone.id, zi, zLen) : undefined} />
                          {showLabel && (
                            <g className="pointer-events-none">
                              <text x="0" y="-10" textAnchor="middle" dominantBaseline="middle"
                                fontSize="88" fontWeight="700"
                                fill="var(--canvas-bg)" stroke="var(--canvas-bg)" strokeWidth={55} strokeLinejoin="round"
                                style={{ fontFamily: 'system-ui' }}>{mainLabel}</text>
                              <text x="0" y="-10" textAnchor="middle" dominantBaseline="middle"
                                fontSize="88" fontWeight="600" fill={textFill}
                                className="select-none" style={{ fontFamily: 'system-ui' }}>{mainLabel}</text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Ghost preview line */}
              {isActive && tool === 'WALL' && pts.length > 0 && (() => {
                const px = pts[pts.length - 1]!;
                const d = distance(px, mousePos);
                const midX = (px.x + mousePos.x) / 2, midY = (px.y + mousePos.y) / 2;
                let ang = Math.atan2(mousePos.y - px.y, mousePos.x - px.x) * (180 / Math.PI);
                if (ang > 90 || ang < -90) ang += 180;
                return (
                  <>
                    <line x1={px.x} y1={px.y} x2={mousePos.x} y2={mousePos.y}
                      stroke="#f97316" strokeWidth={6 / scale}
                      strokeDasharray={`${120 / scale},${80 / scale}`} opacity={0.5} />
                    {d > 50 && (
                      <g transform={`translate(${midX}, ${midY}) rotate(${ang})`} className="pointer-events-none">
                        <rect x="-270" y="-230" width="540" height="200" fill="var(--canvas-ghost-bg)" rx="50" />
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
                const hasDist = ec.some((c) => c.type === 'LENGTH' || c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE');
                const color = isHov && isDoor ? '#f87171' : isHov ? '#fb923c'
                  : isDoor ? '#f97316'
                  : hasH || hasV ? (isActive ? '#60a5fa' : '#1d4ed8')
                  : hasDist ? (isActive ? '#fbbf24' : '#92400e')
                  : isActive ? '#ea580c' : 'var(--canvas-wall-inact)';
                const edgeThick = room.edgeThicknesses?.[i] ?? wallThickness;
                return (
                  <line key={`wall-${room.id}-${i}`} x1={p.x} y1={p.y} x2={np.x} y2={np.y}
                    stroke={color} strokeWidth={isDoor ? edgeThick * 0.5 : edgeThick}
                    strokeLinecap="round"
                    strokeDasharray={isDoor ? `${edgeThick * 1.2},${edgeThick * 0.8}` : undefined} />
                );
              })}

              {/* ── Per-edge labels (no frame — text with halo, shown only if room) ── */}
              {pts.map((p, i) => {
                if (i === pts.length - 1 && !isClosed) return null;
                const np = pts[(i + 1) % pts.length]!;
                const edgeLen = distance(p, np);
                const midX = (p.x + np.x) / 2, midY = (p.y + np.y) / 2;
                let ang = angle(p, np) * (180 / Math.PI);
                if (ang > 90 || ang < -90) ang += 180;
                const isDoor = (edges[i] ?? 'WALL') === 'DOOR';
                const ec = edgeConstraints(room, i, constraints);
                const hasH = ec.some((c) => c.type === 'HORIZONTAL');
                const hasV = ec.some((c) => c.type === 'VERTICAL');
                const hDistC = ec.find((c) => c.type === 'H_DISTANCE');
                const vDistC = ec.find((c) => c.type === 'V_DISTANCE');
                const lenC = ec.find((c) => c.type === 'LENGTH');
                const thickOverride = room.edgeThicknesses?.[i];
                const isEditing = editingEdge?.roomId === room.id && editingEdge.edgeIndex === i;
                if (isEditing) return null;
                const badgeKey = `w-${room.id}-${i}`;
                const isHov = hoveredBadge === badgeKey;
                const screenLen = edgeLen * scale;
                const dxE = np.x - p.x, dyE = np.y - p.y;
                const lenN = Math.sqrt(dxE * dxE + dyE * dyE) || 1;
                const perpOx = (-dyE / lenN) * 260, perpOy = (dxE / lenN) * 260;
                const hasDistC = !!(hDistC || vDistC || lenC);
                const hasDirC = hasH || hasV;
                const textColor = hasDistC ? '#22c55e' : hasDirC ? '#60a5fa' : isDoor ? '#f97316' : 'var(--canvas-label-text)';
                const dirIcon = hasH ? 'H ' : hasV ? 'V ' : '';
                const hvC = hDistC ?? vDistC;
                const hvOffset = hvC ? constraintInteriorOffset(hvC, room, wallThickness) : 0;
                const dimVal = hDistC && typeof hDistC.value === 'number' ? formatCm(hDistC.value - hvOffset)
                  : vDistC && typeof vDistC.value === 'number' ? formatCm(vDistC.value - hvOffset)
                  : lenC && typeof lenC.value === 'number' ? formatCm(lenC.value)
                  : formatCm(edgeLen);
                const thickPart = thickOverride !== undefined ? ` E:${Math.round(thickOverride / 10)}` : '';
                const mainLabel = `${dirIcon}${dimVal}${thickPart}`;
                const showLabel = screenLen > 65 || isHov;
                return (
                  <g key={`badge-${room.id}-${i}`}
                    transform={`translate(${midX + perpOx}, ${midY + perpOy}) rotate(${ang})`}
                    onPointerEnter={() => setHoveredBadge(badgeKey)}
                    onPointerLeave={() => setHoveredBadge(null)}>
                    <rect x="-550" y="-280" width="1100" height="280" fill="transparent"
                      className={tool === 'SELECT' ? 'cursor-pointer' : 'pointer-events-none'}
                      onPointerDown={tool === 'SELECT' ? onEdgePointerDown(room.id, i, edgeLen) : undefined} />
                    {showLabel && (
                      <g className="pointer-events-none">
                        <text x="0" y="-10" textAnchor="middle" dominantBaseline="middle"
                          fontSize="88" fontWeight="700"
                          fill="var(--canvas-bg)" stroke="var(--canvas-bg)" strokeWidth={55} strokeLinejoin="round"
                          style={{ fontFamily: 'system-ui' }}>{mainLabel}</text>
                        <text x="0" y="-10" textAnchor="middle" dominantBaseline="middle"
                          fontSize="88" fontWeight="600" fill={textColor}
                          className="select-none" style={{ fontFamily: 'system-ui' }}>{mainLabel}</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* POINT_ON_LINE tick marks */}
              {constraints.map((c) => {
                if (c.type !== 'POINT_ON_LINE' || c.pts.length < 3) return null;
                const srcPt = resolvePointRef(rooms, c.pts[0]!);
                const lp1 = resolvePointRef(rooms, c.pts[1]!);
                const lp2 = resolvePointRef(rooms, c.pts[2]!);
                if (!srcPt || !lp1 || !lp2) return null;
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

              {/* ── Partitions ── */}
              {(room.partitions ?? []).map((pt) => {
                const pLen = distance(pt.p1, pt.p2);
                if (pLen < 1) return null;
                const midX = (pt.p1.x + pt.p2.x) / 2, midY = (pt.p1.y + pt.p2.y) / 2;
                let pAng = Math.atan2(pt.p2.y - pt.p1.y, pt.p2.x - pt.p1.x) * (180 / Math.PI);
                if (pAng > 90 || pAng < -90) pAng += 180;
                const dx = pt.p2.x - pt.p1.x, dy = pt.p2.y - pt.p1.y;
                const lenN = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpOx = (-dy / lenN) * (pt.thickness / 2 + 320);
                const perpOy = (dx / lenN) * (pt.thickness / 2 + 320);
                const isEditingLabel = editingPartition?.roomId === room.id && editingPartition.partitionId === pt.id;
                const isHov = hoveredPartitionEdge?.partitionId === pt.id;

                const ec = partitionEdgeConstraints(pt, constraints);
                const hasH = ec.some((c) => c.type === 'HORIZONTAL');
                const hasV = ec.some((c) => c.type === 'VERTICAL');
                const pHDistC = ec.find((c) => c.type === 'H_DISTANCE');
                const pVDistC = ec.find((c) => c.type === 'V_DISTANCE');
                const pLenC = ec.find((c) => c.type === 'LENGTH');
                const hasDistCP = !!(pHDistC || pVDistC || pLenC);

                // Body color follows constraint state, same logic as room walls
                const bodyColor = isHov ? '#8b5cf6'
                  : hasH || hasV ? '#3b82f6'
                  : hasDistCP ? '#d97706'
                  : '#7c3aed';
                const lineColor = isHov ? '#c4b5fd'
                  : hasH || hasV ? '#93c5fd'
                  : hasDistCP ? '#fbbf24'
                  : '#a78bfa';
                const labelText = hasDistCP ? '#22c55e' : hasH || hasV ? '#60a5fa' : '#a78bfa';

                return (
                  <g key={`part-${pt.id}`}>
                    {/* Filled body */}
                    <line x1={pt.p1.x} y1={pt.p1.y} x2={pt.p2.x} y2={pt.p2.y}
                      stroke={bodyColor} strokeWidth={pt.thickness}
                      strokeLinecap="square" className="pointer-events-none" opacity={0.25} />
                    {/* Dashed center line */}
                    <line x1={pt.p1.x} y1={pt.p1.y} x2={pt.p2.x} y2={pt.p2.y}
                      stroke={lineColor} strokeWidth={Math.max(20, pt.thickness * 0.15)}
                      strokeDasharray={`${pt.thickness * 1.2},${pt.thickness * 0.6}`}
                      strokeLinecap="round" className="pointer-events-none" />
                    {/* ── Partition label (no frame — halo text, shown only if room) ── */}
                    {!isEditingLabel && (() => {
                      const pbKey = `p-${pt.id}`;
                      const isPHov = hoveredBadge === pbKey;
                      const pScreenLen = pLen * scale;
                      const dimVal = pHDistC && typeof pHDistC.value === 'number' ? formatCm(pHDistC.value)
                        : pVDistC && typeof pVDistC.value === 'number' ? formatCm(pVDistC.value)
                        : pLenC && typeof pLenC.value === 'number' ? formatCm(pLenC.value)
                        : formatCm(pLen);
                      const dirIcon = hasH ? 'H ' : hasV ? 'V ' : '';
                      const mainLabel = `${dirIcon}${dimVal}`;
                      const showLabel = pScreenLen > 65 || isPHov;
                      return (
                        <g transform={`translate(${midX + perpOx}, ${midY + perpOy}) rotate(${pAng})`}
                          onPointerEnter={() => setHoveredBadge(pbKey)}
                          onPointerLeave={() => setHoveredBadge(null)}>
                          <rect x="-500" y="-270" width="1000" height="270" fill="transparent"
                            className={tool === 'SELECT' ? 'cursor-pointer' : 'pointer-events-none'}
                            onPointerDown={tool === 'SELECT' ? onPartitionLabelPointerDown(room.id, pt.id, pLen) : undefined} />
                          {showLabel && (
                            <g className="pointer-events-none">
                              <text x="0" y="-10" textAnchor="middle" dominantBaseline="middle"
                                fontSize="88" fontWeight="700"
                                fill="var(--canvas-bg)" stroke="var(--canvas-bg)" strokeWidth={55} strokeLinejoin="round"
                                style={{ fontFamily: 'system-ui' }}>{mainLabel}</text>
                              <text x="0" y="-10" textAnchor="middle" dominantBaseline="middle"
                                fontSize="88" fontWeight="600" fill={labelText}
                                className="select-none" style={{ fontFamily: 'system-ui' }}>{mainLabel}</text>
                            </g>
                          )}
                        </g>
                      );
                    })()}
                    {/* Wide transparent hit area for PARTITION-tool deletion */}
                    {tool === 'PARTITION' && (
                      <line x1={pt.p1.x} y1={pt.p1.y} x2={pt.p2.x} y2={pt.p2.y}
                        stroke="transparent" strokeWidth={Math.max(pt.thickness, wallThickness) * 4}
                        strokeLinecap="round" className="cursor-pointer"
                        onPointerDown={(e) => { e.stopPropagation(); onDeletePartition(room.id, pt.id); }} />
                    )}
                  </g>
                );
              })}

              {/* Room name */}
              {centroid && isClosed && (
                <text x={centroid.x} y={centroid.y} textAnchor="middle" dominantBaseline="middle"
                  fontSize="200" fontWeight="bold"
                  fill={isActive ? 'var(--canvas-name-active)' : 'var(--canvas-name-inact)'}
                  className="pointer-events-none select-none">{room.name ?? ''}</text>
              )}
            </g>
          );
        })}

        {/* ══ PARTITION DIMENSION LINES — endpoint to room vertex ══ */}
        {partitionDimLines.map((dim) => {
          const isEditing =
            editingPartitionDimension?.fromRef.roomId === dim.fromRef.roomId &&
            editingPartitionDimension.fromRef.vertexIdx === dim.fromRef.vertexIdx &&
            editingPartitionDimension.toRef.roomId === dim.toRef.roomId &&
            editingPartitionDimension.toRef.vertexIdx === dim.toRef.vertexIdx;
          const hasConstraint = !!dim.existingConstraintId;
          const key = `pdl-${dim.fromRef.roomId}-${dim.fromRef.vertexIdx}-${dim.toRef.roomId}-${dim.toRef.vertexIdx}`;
          const lineColor = hasConstraint ? '#22c55e' : '#64748b';
          const textColor = hasConstraint ? '#22c55e' : '#94a3b8';
          const cType = dim.constraintType;
          const isHDist = cType === 'H_DISTANCE';
          const isVDist = cType === 'V_DISTANCE';

          if (isHDist || isVDist) {
            // L-shape: primary axis (bold) + secondary axis (faint)
            const cornerX = isHDist ? dim.toPt.x : dim.fromPt.x;
            const cornerY = isHDist ? dim.fromPt.y : dim.toPt.y;
            const labelX = isHDist ? (dim.fromPt.x + dim.toPt.x) / 2 : dim.fromPt.x - 380;
            const labelY = isHDist ? dim.fromPt.y - 280 : (dim.fromPt.y + dim.toPt.y) / 2;
            return (
              <g key={key}>
                <line x1={dim.fromPt.x} y1={dim.fromPt.y} x2={cornerX} y2={cornerY}
                  stroke={lineColor} strokeWidth={22} strokeDasharray="70,50"
                  opacity={hasConstraint ? 0.8 : 0.4} className="pointer-events-none" />
                <line x1={cornerX} y1={cornerY} x2={dim.toPt.x} y2={dim.toPt.y}
                  stroke={lineColor} strokeWidth={14} strokeDasharray="40,30"
                  opacity={hasConstraint ? 0.35 : 0.18} className="pointer-events-none" />
                {!isEditing && (
                  <g transform={`translate(${labelX}, ${labelY})`}
                    className="cursor-pointer"
                    onPointerDown={onPartitionDimensionPointerDown(dim.fromRef, dim.toRef, dim.dist)}>
                    <rect x="-400" y="-230" width="800" height="230" fill="transparent" />
                    <text x="0" y="-60" textAnchor="middle" dominantBaseline="middle"
                      fontSize="88" fontWeight="700"
                      fill="var(--canvas-bg)" stroke="var(--canvas-bg)" strokeWidth={55} strokeLinejoin="round"
                      style={{ fontFamily: 'system-ui' }}>{isHDist ? 'H' : 'V'} {formatCm(dim.dist)}</text>
                    <text x="0" y="-60" textAnchor="middle" dominantBaseline="middle"
                      fontSize="88" fontWeight="600" fill={textColor}
                      style={{ fontFamily: 'system-ui' }}>{isHDist ? 'H' : 'V'} {formatCm(dim.dist)}</text>
                  </g>
                )}
              </g>
            );
          }

          // Legacy diagonal for LENGTH constraints
          const midX = (dim.fromPt.x + dim.toPt.x) / 2;
          const midY = (dim.fromPt.y + dim.toPt.y) / 2;
          let ang = Math.atan2(dim.toPt.y - dim.fromPt.y, dim.toPt.x - dim.fromPt.x) * (180 / Math.PI);
          if (ang > 90 || ang < -90) ang += 180;
          return (
            <g key={key}>
              <line x1={dim.fromPt.x} y1={dim.fromPt.y} x2={dim.toPt.x} y2={dim.toPt.y}
                stroke={lineColor} strokeWidth={18} strokeDasharray="60,40"
                opacity={hasConstraint ? 0.6 : 0.3} className="pointer-events-none" />
              {!isEditing && (
                <g transform={`translate(${midX}, ${midY}) rotate(${ang})`}
                  className="cursor-pointer"
                  onPointerDown={onPartitionDimensionPointerDown(dim.fromRef, dim.toRef, dim.dist)}>
                  <rect x="-400" y="-230" width="800" height="230" fill="transparent" />
                  <text x="0" y="-60" textAnchor="middle" dominantBaseline="middle"
                    fontSize="88" fontWeight="700"
                    fill="var(--canvas-bg)" stroke="var(--canvas-bg)" strokeWidth={55} strokeLinejoin="round"
                    style={{ fontFamily: 'system-ui' }}>{formatCm(dim.dist)}</text>
                  <text x="0" y="-60" textAnchor="middle" dominantBaseline="middle"
                    fontSize="88" fontWeight="600" fill={textColor}
                    style={{ fontFamily: 'system-ui' }}>{formatCm(dim.dist)}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ══ PASS 2 — Room vertices ══ */}
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
                const showVertex = isActive || tool === 'COINCIDE' || tool === 'ANCHOR' || tool === 'DIMENSION' || isCoinSrc || isFullyCon || isPartial || isFixed;
                if (!showVertex) return null;
                const isStart = isActive && tool === 'WALL' && i === 0 && canCloseActiveRoom;
                const isNearStart = isStart && distance(mousePos, pts[0]!) < 40 / scale;
                const fill = isCoinSrc ? '#06b6d4' : isFixed ? '#a78bfa' : isFullyCon ? '#22c55e'
                  : isPartial ? '#f59e0b' : isNearStart ? '#f97316' : isActive ? 'var(--canvas-vtx-default)' : 'var(--canvas-name-inact)';
                const stroke = isCoinSrc ? '#0891b2' : isFixed ? '#7c3aed' : isFullyCon ? '#16a34a'
                  : isPartial ? '#d97706' : isStart ? '#f97316' : isActive ? '#ea580c' : 'var(--canvas-wall-inact)';
                const cursor = isFullyCon ? 'cursor-not-allowed' : isActive ? 'cursor-move' : 'cursor-pointer';
                return (
                  <g key={`vtx-${room.id}-${i}`} onPointerDown={onVertexPointerDown(room.id, i)}>
                    <circle cx={p.x} cy={p.y} r={isStart ? 300 : 220} fill="transparent" className={cursor} />
                    <circle cx={p.x} cy={p.y} r={isStart ? 260 : 90} fill={fill} stroke={stroke} strokeWidth={28}
                      className="pointer-events-none" />
                    {isFixed && <circle cx={p.x} cy={p.y} r={36} fill="#7c3aed" className="pointer-events-none" />}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ══ PASS 3 — Partition vertices ══ */}
        {showHandles && rooms.map((room) =>
          (room.partitions ?? []).map((pt) => {
            const pts = [pt.p1, pt.p2];
            return pts.map((p, i) => (
              <VertexBadge key={`pvtx-${pt.id}-${i}`}
                p={p} id={pt.id} idx={i}
                dofMap={dofMap} constraints={constraints} coincideSource={coincideSource}
                defaultFill="#a78bfa" defaultStroke="#7c3aed"
                tool={tool}
                onPointerDown={onPartitionVertexPointerDown(room.id, pt.id, i)} />
            ));
          })
        )}

        {/* ══ PASS 4 — Zone vertices ══ */}
        {showHandles && rooms.map((room) =>
          (room.excludedZones ?? []).map((zone) =>
            zone.points.map((zp, zi) => (
              <VertexBadge key={`zvtx-${zone.id}-${zi}`}
                p={zp} id={zone.id} idx={zi}
                dofMap={dofMap} constraints={constraints} coincideSource={coincideSource}
                defaultFill="#fbbf24" defaultStroke="#d97706"
                tool={tool}
                onPointerDown={onZoneVertexPointerDown(room.id, zone.id, zi)} />
            ))
          )
        )}

        {/* ── Coincide-source ring ── */}
        {coincideSource && (() => {
          const srcPt = resolvePointRef(rooms, { roomId: coincideSource.roomId, vertexIdx: coincideSource.idx });
          if (!srcPt) return null;
          return (
            <circle cx={srcPt.x} cy={srcPt.y} r={220} fill="none"
              stroke="#06b6d4" strokeWidth={26} strokeDasharray={`${55},${35}`}
              opacity={0.85} className="pointer-events-none" />
          );
        })()}

        {/* ── DIMENSION ghost line — L-shape H/V preview ── */}
        {tool === 'DIMENSION' && dimensionSource && (() => {
          const srcPt = resolvePointRef(rooms, { roomId: dimensionSource.roomId, vertexIdx: dimensionSource.idx });
          if (!srcPt) return null;
          const absDx = Math.abs(mousePos.x - srcPt.x), absDy = Math.abs(mousePos.y - srcPt.y);
          const isH = absDx >= absDy;
          const primaryDist = isH ? absDx : absDy;
          const color = '#f97316';
          const cornerX = isH ? mousePos.x : srcPt.x;
          const cornerY = isH ? srcPt.y : mousePos.y;
          const midPX = (srcPt.x + cornerX) / 2, midPY = (srcPt.y + cornerY) / 2;
          const labelOffX = isH ? 0 : 400, labelOffY = isH ? -380 : 0;
          return (
            <>
              {/* Primary axis — bold */}
              <line x1={srcPt.x} y1={srcPt.y} x2={cornerX} y2={cornerY}
                stroke={color} strokeWidth={22} strokeDasharray="70,50" opacity={0.85}
                className="pointer-events-none" />
              {/* Secondary axis — faint */}
              <line x1={cornerX} y1={cornerY} x2={mousePos.x} y2={mousePos.y}
                stroke={color} strokeWidth={12} strokeDasharray="40,30" opacity={0.3}
                className="pointer-events-none" />
              <circle cx={srcPt.x} cy={srcPt.y} r={250} fill="none"
                stroke={color} strokeWidth={36} strokeDasharray="55,35"
                opacity={0.85} className="pointer-events-none" />
              {primaryDist > 50 && (
                <g transform={`translate(${midPX + labelOffX}, ${midPY + labelOffY})`} className="pointer-events-none">
                  <rect x="-300" y="-230" width="600" height="200" fill="var(--canvas-ghost-bg)" rx="50" />
                  <text x="0" y="-95" textAnchor="middle" fontSize="125" fontWeight="600" fill={`${color}cc`}
                    style={{ fontFamily: 'system-ui' }}>{isH ? 'H' : 'V'} {formatCm(primaryDist)}</text>
                </g>
              )}
            </>
          );
        })()}

        {/* ── PARTITION in-progress preview ── */}
        {tool === 'PARTITION' && partitionOrigin && (
          <>
            <line x1={partitionOrigin.x} y1={partitionOrigin.y} x2={mousePos.x} y2={mousePos.y}
              stroke="#a78bfa" strokeWidth={60} strokeDasharray="140,90" strokeLinecap="round"
              opacity={0.6} className="pointer-events-none" />
            <circle cx={partitionOrigin.x} cy={partitionOrigin.y} r={120}
              fill="#a78bfa" opacity={0.9} className="pointer-events-none" />
          </>
        )}

        {/* ── EXCLUDE in-progress polygon preview ── */}
        {tool === 'EXCLUDE' && excludePoints.length > 0 && (() => {
          const first = excludePoints[0]!;
          const last = excludePoints[excludePoints.length - 1]!;
          return (
            <>
              {excludePoints.length >= 2 && (
                <polygon points={[...excludePoints, mousePos].map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(251,191,36,0.12)" stroke="#f59e0b" strokeWidth={40}
                  strokeDasharray="100,70" className="pointer-events-none" />
              )}
              <line x1={last.x} y1={last.y} x2={mousePos.x} y2={mousePos.y}
                stroke="#f59e0b" strokeWidth={40} strokeDasharray="100,70"
                strokeLinecap="round" opacity={0.6} className="pointer-events-none" />
              {excludePoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 180 : 90}
                  fill={i === 0 ? (canCloseExclude ? '#f59e0b' : '#fbbf24') : '#fbbf24'}
                  stroke="#f59e0b" strokeWidth={28} className="pointer-events-none" />
              ))}
              {canCloseExclude && (
                <circle cx={first.x} cy={first.y} r={280} fill="none" stroke="#f59e0b"
                  strokeWidth={40} strokeDasharray="80,50" opacity={0.8} className="pointer-events-none" />
              )}
            </>
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
