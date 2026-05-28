'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '@/types/plan';
import type { Constraint, DimConstraintType, EdgeType, PointRef, Room } from '@/types/project';
import { distance, getPointOnSegment } from '@/engine/geometry/polygon';
import { SNAP_GRID_MM, CLOSING_TOLERANCE_MM, DOOR_DEFAULT_WIDTH_MM } from '@/constants/businessRules';
import { screenToWorld } from '@/utils/units';
import { generateId } from '@/utils/id';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { buildAndSolve, solveAndValidate } from '@/engine/constraints/solver';
import { analyzeDOF, ptKey } from '@/engine/constraints/dofAnalyzer';
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
import { findNearestVertexSnapImpl, computeDimDisplayedValue } from '@/engine/constraints/vertexSnap';
import { PlanToolbar, type PlanTool } from './PlanToolbar';
import { ToolStatusBar } from './ToolStatusBar';
import { DimensionEditor } from './DimensionEditor';
import { DimensionPopup } from './DimensionPopup';
import { WallEdgeEditor } from './WallEdgeEditor';
import { RoomPanel } from './RoomPanel';
import { RoomTabs } from './RoomTabs';
import { useDraggableSnap } from './useDraggableSnap';
import {
  DrawingCanvas,
  type EditingEdgeState, type HoveredEdge, type SnapPreview,
  type HoveredZoneEdge, type EditingZoneEdge, type HoveredPartitionEdge,
  type PartitionDimLine,
  type DeleteHoverTarget,
  type FaceSnapPoint,
} from './DrawingCanvas';

// ── History ────────────────────────────────────────────────────────────────

interface HistoryEntry { rooms: Room[]; constraints: Constraint[]; }

// ── Pure geometry helpers ──────────────────────────────────────────────────

function deepCloneRooms(rooms: Room[]): Room[] {
  return rooms.map((r) => ({
    ...r,
    points: r.points.map((p) => ({ ...p })),
    edges: [...r.edges],
    partitions: (r.partitions ?? []).map((pt) => ({ ...pt, p1: { ...pt.p1 }, p2: { ...pt.p2 } })),
    excludedZones: (r.excludedZones ?? []).map((z) => ({ ...z, points: z.points.map((p) => ({ ...p })) })),
  }));
}

/**
 * Build the flat list passed to the constraint solver:
 *   real rooms + zones-as-virtual-rooms + partitions-as-virtual-rooms
 * Virtual IDs: zone.id / partition.id used as "roomId" in PointRef.
 */
function resolveRef(rooms: Room[], r: PointRef): Point | undefined {
  const room = rooms.find((ro) => ro.id === r.roomId);
  if (room) return room.points[r.vertexIdx];
  for (const ro of rooms) {
    const zone = (ro.excludedZones ?? []).find((z) => z.id === r.roomId);
    if (zone) return zone.points[r.vertexIdx];
    const part = (ro.partitions ?? []).find((p) => p.id === r.roomId);
    if (part) return r.vertexIdx === 0 ? part.p1 : part.p2;
  }
  return undefined;
}

function withVirtualRooms(rooms: Room[]): Room[] {
  return [
    ...rooms,
    ...rooms.flatMap((r) =>
      (r.excludedZones ?? []).map((z) => ({
        id: z.id,
        points: z.points,
        edges: z.points.map(() => 'WALL' as EdgeType),
        partitions: [],
        excludedZones: [],
      }))
    ),
    ...rooms.flatMap((r) =>
      (r.partitions ?? []).map((p) => ({
        id: p.id,
        points: [p.p1, p.p2],
        edges: ['WALL' as EdgeType],
        partitions: [],
        excludedZones: [],
      }))
    ),
  ];
}

function findZoneParent(rooms: Room[], zoneId: string): { parentRoomId: string } | null {
  for (const r of rooms) {
    if ((r.excludedZones ?? []).some((z) => z.id === zoneId)) return { parentRoomId: r.id };
  }
  return null;
}

function findPartitionParent(rooms: Room[], partitionId: string): { parentRoomId: string } | null {
  for (const r of rooms) {
    if ((r.partitions ?? []).some((p) => p.id === partitionId)) return { parentRoomId: r.id };
  }
  return null;
}

/**
 * Return a new rooms array with a single vertex moved to newPt.
 * Works for room vertices, zone vertices, and partition endpoints.
 */
function snapVertex(rooms: Room[], id: string, vertexIdx: number, newPt: Point): Room[] {
  // Room vertex
  if (rooms.some((r) => r.id === id)) {
    return rooms.map((r) => {
      if (r.id !== id) return r;
      const pts = [...r.points];
      pts[vertexIdx] = newPt;
      return { ...r, points: pts };
    });
  }
  // Zone vertex
  if (rooms.some((r) => (r.excludedZones ?? []).some((z) => z.id === id))) {
    return rooms.map((r) => ({
      ...r,
      excludedZones: (r.excludedZones ?? []).map((z) => {
        if (z.id !== id) return z;
        const pts = [...z.points];
        pts[vertexIdx] = newPt;
        return { ...z, points: pts };
      }),
    }));
  }
  // Partition vertex (0 = p1, 1 = p2)
  return rooms.map((r) => ({
    ...r,
    partitions: (r.partitions ?? []).map((p) => {
      if (p.id !== id) return p;
      return vertexIdx === 0 ? { ...p, p1: newPt } : { ...p, p2: newPt };
    }),
  }));
}

function removeDoorFromRoom(room: Room, doorEdgeIdx: number): { points: Point[]; edges: EdgeType[] } | null {
  const { points: pts, edges } = room;
  const n = pts.length;
  if (n < 5 || edges[doorEdgeIdx] !== 'DOOR') return null;
  const prev = (doorEdgeIdx - 1 + n) % n, next = (doorEdgeIdx + 1) % n;
  if (edges[prev] !== 'WALL' || edges[next] !== 'WALL') return null;
  const keep = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => i !== doorEdgeIdx && i !== next));
  return { points: pts.filter((_, i) => keep.has(i)), edges: edges.filter((_, i) => keep.has(i)) as EdgeType[] };
}

function findCoincidentWallEdge(rooms: Room[], excludeId: string, p1: Point, p2: Point, tol = 15) {
  for (const room of rooms) {
    if (room.id === excludeId) continue;
    for (let i = 0; i < room.points.length; i++) {
      if ((room.edges[i] ?? 'WALL') !== 'WALL') continue;
      const q1 = room.points[i]!, q2 = room.points[(i + 1) % room.points.length]!;
      if (distance(p1, q1) < tol && distance(p2, q2) < tol) return { roomId: room.id, edgeIdx: i, reversed: false };
      if (distance(p1, q2) < tol && distance(p2, q1) < tol) return { roomId: room.id, edgeIdx: i, reversed: true };
    }
  }
  return null;
}

function findCoincidentDoorEdge(rooms: Room[], excludeId: string, dA: Point, dB: Point, tol = 15) {
  for (const room of rooms) {
    if (room.id === excludeId) continue;
    for (let i = 0; i < room.points.length; i++) {
      if ((room.edges[i] ?? 'WALL') !== 'DOOR') continue;
      const q1 = room.points[i]!, q2 = room.points[(i + 1) % room.points.length]!;
      if ((distance(dA, q1) < tol && distance(dB, q2) < tol) || (distance(dA, q2) < tol && distance(dB, q1) < tol))
        return { roomId: room.id, edgeIdx: i };
    }
  }
  return null;
}

function canCloseRoom(room: Room, allRooms: Room[]): boolean {
  const pts = room.points;
  if (pts.length < 3) return false;
  if (pts.length >= 4) return true;
  const others = allRooms.filter((r) => r.id !== room.id && r.points.length >= 3);
  if (!others.length) return false;
  for (let i = 0; i < pts.length; i++)
    if (findCoincidentWallEdge(others, '', pts[i]!, pts[(i + 1) % pts.length]!)) return true;
  return false;
}

function ref(roomId: string, vertexIdx: number): PointRef { return { roomId, vertexIdx }; }

/**
 * Calcule le scale et le pan initiaux pour centrer les pièces dans le viewport.
 * Retourne null si aucun point n'existe (canvas vide).
 */
export function computeInitialView(
  rooms: Room[],
  viewW: number,
  viewH: number,
): { scale: number; pan: { x: number; y: number } } | null {
  const allPoints = rooms.flatMap((r) => r.points);
  if (allPoints.length === 0) return null;

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const bboxW = maxX - minX || 1000;
  const bboxH = maxY - minY || 1000;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const PADDING = 80;
  const newScale = Math.max(
    0.005,
    Math.min(
      (viewW - PADDING * 2) / bboxW,
      (viewH - PADDING * 2) / bboxH,
      0.5,
    ),
  );

  return {
    scale: newScale,
    pan: { x: viewW / 2 - cx * newScale, y: viewH / 2 - cy * newScale },
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export const PlanEditor = ({ onNavigateBack }: { onNavigateBack?: () => void }) => {
  const rooms = useProjectStore((s) => selectActiveProject(s)?.rooms ?? []);
  const constraints = useProjectStore((s) => selectActiveProject(s)?.constraints ?? []);
  const wallThickness = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const setWallThickness = useProjectStore((s) => s.setWallThickness);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoom = useProjectStore((s) => s.addRoom);
  const removeRoom = useProjectStore((s) => s.removeRoom);
  const renameRoom = useProjectStore((s) => s.renameRoom);
  const addConstraint = useProjectStore((s) => s.addConstraint);
  const removeConstraint = useProjectStore((s) => s.removeConstraint);
  const updateConstraintValue = useProjectStore((s) => s.updateConstraintValue);
  const updateConstraintDisplayOffset = useProjectStore((s) => s.updateConstraintDisplayOffset);
  const shiftConstraintIndices = useProjectStore((s) => s.shiftConstraintIndices);
  const restoreSnapshot = useProjectStore((s) => s.restoreSnapshot);
  const addPartition = useProjectStore((s) => s.addPartition);
  const updatePartition = useProjectStore((s) => s.updatePartition);
  const removePartition = useProjectStore((s) => s.removePartition);
  const updatePartitionThickness = useProjectStore((s) => s.updatePartitionThickness);
  const setEdgeThickness = useProjectStore((s) => s.setEdgeThickness);
  const addExcludedZone = useProjectStore((s) => s.addExcludedZone);
  const removeExcludedZone = useProjectStore((s) => s.removeExcludedZone);
  const updateExcludedZonePoints = useProjectStore((s) => s.updateExcludedZonePoints);
  const clearPartitionsAndZones = useProjectStore((s) => s.clearPartitionsAndZones);
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    [],
  );

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => rooms[0]?.id ?? null);
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [tool, setTool] = useState<PlanTool>(() => (rooms[0]?.points.length ?? 0) >= 3 ? 'SELECT' : 'WALL');
  const [tutorialMode, setTutorialMode] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Dragging
  const [draggedVertex, setDraggedVertex] = useState<{ roomId: string; idx: number } | null>(null);
  const [draggedZoneVertex, setDraggedZoneVertex] = useState<{ parentRoomId: string; zoneId: string; idx: number } | null>(null);
  const [draggedPartitionVertex, setDraggedPartitionVertex] = useState<{ parentRoomId: string; partitionId: string; idx: number } | null>(null);

  // Editing
  const [editingEdge, setEditingEdge] = useState<EditingEdgeState | null>(null);
  const [editingZoneEdge, setEditingZoneEdge] = useState<EditingZoneEdge | null>(null);
  const [editZoneEdgeValue, setEditZoneEdgeValue] = useState('');
  const [editingPartition, setEditingPartition] = useState<{ roomId: string; partitionId: string } | null>(null);
  const [editPartitionValue, setEditPartitionValue] = useState('');
  const [editingPartitionThickness, setEditingPartitionThickness] = useState<{ roomId: string; partitionId: string } | null>(null);
  const [editThicknessValue, setEditThicknessValue] = useState('');
  const [editingPartitionDimension, setEditingPartitionDimension] = useState<{ fromRef: PointRef; toRef: PointRef } | null>(null);
  const [editPartitionDimValue, setEditPartitionDimValue] = useState('');
  const [editingPartitionDimType] = useState<'H_DISTANCE' | 'V_DISTANCE'>('H_DISTANCE');
  const [editingEdgeThicknessValue, setEditingEdgeThicknessValue] = useState('');
  const [faceSnapHover, setFaceSnapHover]   = useState<FaceSnapPoint | null>(null);
  const [dimensionSource, setDimensionSource] = useState<{
    ref:      PointRef;
    worldPos: Point;
  } | null>(null);
  const [dimTypeSelection, setDimTypeSelection] = useState<{
    from: { ref: PointRef; worldPos: Point };
    to:   { ref: PointRef; worldPos: Point };
  } | null>(null);
  const [dimensionPopup, setDimensionPopup] = useState<{
    fromRef:  PointRef;
    toRef:    PointRef;
    dimType:  'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';
    value:    string;
  } | null>(null);

  // Hover
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdge | null>(null);
  const [hoveredZoneEdge, setHoveredZoneEdge] = useState<HoveredZoneEdge | null>(null);
  const [hoveredPartitionEdge, setHoveredPartitionEdge] = useState<HoveredPartitionEdge | null>(null);
  const [deleteHover, setDeleteHover] = useState<DeleteHoverTarget | null>(null);

  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const [originPoint, setOriginPoint] = useState<Point | null>(null);
  const [coincideSource, setCoincideSource] = useState<{ roomId: string; idx: number } | null>(null);
  const [past,   setPast]   = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [violationFlash, setViolationFlash] = useState(false);
  const [partitionOrigin, setPartitionOrigin] = useState<Point | null>(null);
  const [excludePoints, setExcludePoints] = useState<Point[]>([]);

  const { zone: roomZone, isDragging: roomDragging, handlePointerDown: handleRoomPointerDown } =
    useDraggableSnap({ storageKey: 'calpiweb-room-panel-zone', defaultZone: 'SIDE' });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const touchRef = useRef<{ dist: number; midX: number; midY: number; panX: number; panY: number } | null>(null);

  // ── Touch handlers ─────────────────────────────────────────────────────────

  // Overlay : pan 1-doigt (SELECT uniquement)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches;
    touchRef.current = { dist: 0, midX: t[0]!.clientX, midY: t[0]!.clientY, panX: pan.x, panY: pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches;
    if (!touchRef.current || t.length !== 1 || touchRef.current.dist !== 0) return;
    const dx = t[0]!.clientX - touchRef.current.midX;
    const dy = t[0]!.clientY - touchRef.current.midY;
    setPan({ x: touchRef.current.panX + dx, y: touchRef.current.panY + dy });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const ref = touchRef.current;
    touchRef.current = null;

    // Tap detection: short tap → activate nearest element
    if (!ref || ref.dist !== 0) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const moved = Math.hypot(touch.clientX - ref.midX, touch.clientY - ref.midY);
    if (moved > 12) return; // was a pan, not a tap

    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const worldPos = toWorld(touch.clientX - svgRect.left, touch.clientY - svgRect.top);

    // Mode DELETE : tap = suppression directe
    if (tool === 'DELETE') {
      const target = findDeleteTarget(worldPos);
      if (target) {
        deleteTarget(target);
      } else {
        setTool('SELECT');
        setDeleteHover(null);
      }
      return;
    }

    if (tool !== 'SELECT') return;

    // Nearest wall or door edge → open WallEdgeEditor (enables Trash button)
    const wallEdge = findNearestWallEdge(worldPos) ?? findNearestEdgeOfType(worldPos, 'DOOR');
    if (wallEdge) {
      const tapRoom = rooms.find((r) => r.id === wallEdge.roomId);
      const tapN = tapRoom?.points.length ?? 0;
      const edgeDist = tapRoom && tapN > 0
        ? distance(tapRoom.points[wallEdge.edgeIndex]!, tapRoom.points[(wallEdge.edgeIndex + 1) % tapN]!)
        : 0;
      // Re-use the full edge-activation logic (constraint lookup, dim value, thickness)
      tapActivateEdge(wallEdge.roomId, wallEdge.edgeIndex, edgeDist);
      return;
    }

    // Nearest zone edge → open zone-edge dimension editor (enables Trash button)
    const zoneEdge = findNearestZoneEdge(worldPos);
    if (zoneEdge) {
      const tapZone = rooms.find((r) => r.id === zoneEdge.roomId)
        ?.excludedZones?.find((z) => z.id === zoneEdge.zoneId);
      if (tapZone) {
        const zLen = distance(
          tapZone.points[zoneEdge.edgeIndex]!,
          tapZone.points[(zoneEdge.edgeIndex + 1) % tapZone.points.length]!,
        );
        setEditingZoneEdge({ roomId: zoneEdge.roomId, zoneId: zoneEdge.zoneId, edgeIndex: zoneEdge.edgeIndex });
        setEditZoneEdgeValue((zLen / 10).toFixed(1));
        setEditingEdge(null); setEditingPartition(null);
      }
      return;
    }

    // Nearest partition → open thickness editor
    const partEdge = findNearestPartitionEdge(worldPos);
    if (partEdge) {
      const tapPart = rooms.find((r) => r.id === partEdge.roomId)
        ?.partitions?.find((p) => p.id === partEdge.partitionId);
      if (tapPart) {
        setEditingPartitionThickness({ roomId: partEdge.roomId, partitionId: partEdge.partitionId });
        setEditThicknessValue((tapPart.thickness / 10).toFixed(0));
      }
      return;
    }

    // Tap on empty canvas → close all editors
    setEditingEdge(null);
    setEditingZoneEdge(null);
    setEditingPartition(null);
  };

  // Wrapper : pinch-zoom 2 doigts (tous outils)
  const handleWrapperTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const t = e.touches;
    const dx = t[1]!.clientX - t[0]!.clientX;
    const dy = t[1]!.clientY - t[0]!.clientY;
    touchRef.current = {
      dist: Math.hypot(dx, dy),
      midX: (t[0]!.clientX + t[1]!.clientX) / 2,
      midY: (t[0]!.clientY + t[1]!.clientY) / 2,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleWrapperTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length !== 2 || !touchRef.current || touchRef.current.dist === 0) return;
    const t = e.touches;
    const dx = t[1]!.clientX - t[0]!.clientX;
    const dy = t[1]!.clientY - t[0]!.clientY;
    const dist = Math.hypot(dx, dy);
    const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
    const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
    const svg = svgRef.current;
    if (svg) {
      const ratio = dist / touchRef.current.dist;
      const rect = svg.getBoundingClientRect();
      const mx = midX - rect.left;
      const my = midY - rect.top;
      setScale((s) => {
        const ns = Math.max(0.005, Math.min(s * ratio, 4));
        setPan((p) => ({ x: mx - (mx - p.x) * (ns / s), y: my - (my - p.y) * (ns / s) }));
        return ns;
      });
    }
    touchRef.current = { dist, midX, midY, panX: pan.x, panY: pan.y };
  };

  const handleWrapperTouchEnd = () => {
    if (touchRef.current && touchRef.current.dist > 0) touchRef.current = null;
  };

  const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const pastRef   = useRef(past);
  const futureRef = useRef(future);
  const roomsRef = useRef(rooms);
  const constraintsRef = useRef(constraints);
  const violationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasViolatingDragRef = useRef(false);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { pastRef.current = past; },     [past]);
  useEffect(() => { futureRef.current = future; }, [future]);
  useEffect(() => { constraintsRef.current = constraints; }, [constraints]);

  // ── Centrage initial sur les pièces existantes ────────────────────────────
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const { width: vw, height: vh } = svg.getBoundingClientRect();
      const view = computeInitialView(rooms, vw, vh);
      if (!view) return;
      setScale(view.scale);
      setPan(view.pan);
    });
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── DOF (virtual rooms = rooms + zones + partitions) ──────────────────────

  const dofMap = analyzeDOF(withVirtualRooms(rooms), constraints);

  // ── Dimension lines: only for existing cross-entity LENGTH constraints ───────

  const partitionDimLines = (() => {
    const lines: PartitionDimLine[] = [];
    for (const c of constraints) {
      const isDist = c.type === 'LENGTH' || c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE';
      if (!isDist || c.pts.length < 2) continue;
      const [p1r, p2r] = [c.pts[0]!, c.pts[1]!];
      if (p1r.roomId === p2r.roomId) continue; // same entity — shown in edge badge
      const p1pt = resolveRef(rooms, p1r);
      const p2pt = resolveRef(rooms, p2r);
      if (!p1pt || !p2pt) continue;
      const dist = c.type === 'H_DISTANCE' ? Math.abs(p2pt.x - p1pt.x)
        : c.type === 'V_DISTANCE' ? Math.abs(p2pt.y - p1pt.y)
        : distance(p1pt, p2pt);
      lines.push({ fromRef: p1r, toRef: p2r, fromPt: p1pt, toPt: p2pt, dist, existingConstraintId: c.id, constraintType: c.type as 'LENGTH' | 'H_DISTANCE' | 'V_DISTANCE' });
    }
    return lines;
  })();

  // ── History ───────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    setPast((prev) => [{
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
    }, ...prev.slice(0, 49)]);
    setFuture([]);
  }, []);

  // ── Solver: applies updates to rooms, zones, and partitions ───────────────

  const applyVirtualUpdates = useCallback((baseRooms: Room[], solved: Map<string, Point[]>) => {
    for (const [id, newPts] of solved.entries()) {
      const realRoom = baseRooms.find((r) => r.id === id);
      if (realRoom) { updateRoom(id, newPts, realRoom.edges); continue; }
      const zoneInfo = findZoneParent(baseRooms, id);
      if (zoneInfo) { updateExcludedZonePoints(zoneInfo.parentRoomId, id, newPts); continue; }
      const partInfo = findPartitionParent(baseRooms, id);
      if (partInfo && newPts[0] && newPts[1]) updatePartition(partInfo.parentRoomId, id, newPts[0], newPts[1]);
    }
  }, [updateRoom, updateExcludedZonePoints, updatePartition]);

  const runSolver = useCallback((fixKey: string | null = null, overrideRooms?: Room[], cs?: Constraint[]) => {
    const base = overrideRooms ?? roomsRef.current;
    applyVirtualUpdates(base, buildAndSolve(withVirtualRooms(base), cs ?? constraintsRef.current, fixKey));
  }, [applyVirtualUpdates]);

  const validateAndSolve = useCallback((cs: Constraint[], fixKey: string | null = null, overrideRooms?: Room[]): boolean => {
    const base = overrideRooms ?? roomsRef.current;
    const { points, violatedIds } = solveAndValidate(withVirtualRooms(base), cs, fixKey);
    if (violatedIds.length > 0) return false;
    applyVirtualUpdates(base, points);
    return true;
  }, [applyVirtualUpdates]);

  const flashViolation = useCallback(() => {
    setViolationFlash(true);
    if (violationTimerRef.current) clearTimeout(violationTimerRef.current);
    violationTimerRef.current = setTimeout(() => setViolationFlash(false), 700);
  }, []);

  // ── DIMENSION vertex-snap helpers ────────────────────────────────────────

  const findNearestVertexSnap = useCallback((cursor: Point): FaceSnapPoint | null => {
    return findNearestVertexSnapImpl(cursor, rooms, scale, wallThickness);
  }, [rooms, scale, wallThickness]);

  const openDimensionPopup = useCallback((
    fromRef: PointRef,
    toRef: PointRef,
    fromWorld: Point,
    toWorld: Point,
    forcedType?: DimConstraintType,
  ) => {
    const dx = Math.abs(toWorld.x - fromWorld.x);
    const dy = Math.abs(toWorld.y - fromWorld.y);
    const dimType: DimConstraintType =
      forcedType ?? (dx >= dy ? 'H_DISTANCE' : 'V_DISTANCE');

    // Check for existing constraint between these vertices
    const existing = constraints.find((c) =>
      (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
        c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
       (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
        c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
    );

    let displayedValue: number;
    const resolvedDimType = existing ? (existing.type as DimConstraintType) : dimType;

    if (existing && typeof existing.value === 'number') {
      const room = rooms.find(r => r.id === fromRef.roomId);
      const syntheticC = { ...existing, pts: [fromRef, toRef] };
      const offset = room ? constraintFaceOffset(syntheticC, room, wallThickness) : 0;
      displayedValue = (existing.value - offset) / 10;
    } else {
      displayedValue = computeDimDisplayedValue(fromWorld, toWorld, dimType);
    }

    setDimensionPopup({
      fromRef,
      toRef,
      dimType: resolvedDimType,
      value: displayedValue.toFixed(1),
    });
  }, [constraints, rooms, wallThickness]);

  const handleDimTypeSelect = useCallback((type: DimConstraintType) => {
    if (!dimTypeSelection) return;
    openDimensionPopup(
      dimTypeSelection.from.ref,
      dimTypeSelection.to.ref,
      dimTypeSelection.from.worldPos,
      dimTypeSelection.to.worldPos,
      type,
    );
    setDimTypeSelection(null);
  }, [dimTypeSelection, openDimensionPopup]);

  const handleDimensionClick = useCallback((c: Constraint) => {
    setDimTypeSelection(null);
    const fromRef = c.pts[0]!;
    const toRef   = c.pts[1]!;
    const fromRoom = rooms.find(r => r.id === fromRef.roomId);
    const toRoom   = rooms.find(r => r.id === toRef.roomId);
    const fromVertex = fromRoom?.points[fromRef.vertexIdx];
    const toVertex   = toRoom?.points[toRef.vertexIdx];
    if (!fromVertex || !toVertex) return;
    openDimensionPopup(fromRef, toRef, fromVertex, toVertex);
  }, [rooms, openDimensionPopup]);

  const handleDimOffsetChange = useCallback((id: string, offset: number) => {
    pushHistory();
    updateConstraintDisplayOffset(id, offset);
  }, [pushHistory, updateConstraintDisplayOffset]);

  const submitDimensionPopup = useCallback(() => {
    if (!dimensionPopup) return;
    const { fromRef, toRef, dimType, value } = dimensionPopup;
    const displayedMm = parseFloat(value) * 10;
    if (isNaN(displayedMm) || displayedMm <= 0) { setDimensionPopup(null); return; }

    const room = rooms.find(r => r.id === fromRef.roomId);
    const syntheticC = { id: '', type: dimType as 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH', pts: [fromRef, toRef] };
    const offset = room ? constraintFaceOffset(syntheticC as import('@/types/project').Constraint, room, wallThickness) : 0;
    const storedMm = displayedMm + offset;

    // Find and remove existing constraint between these vertices
    const existingId = constraints.find((c) =>
      (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
        c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
       (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
        c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
    )?.id;

    const newId = generateId();
    const newCs = (existingId ? constraints.filter(c => c.id !== existingId) : [...constraints]);
    newCs.push({ id: newId, type: dimType as 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH', pts: [fromRef, toRef], value: storedMm });

    if (!validateAndSolve(newCs)) { flashViolation(); setDimensionPopup(null); return; }

    pushHistory();
    if (existingId) removeConstraint(existingId);
    addConstraint({ id: newId, type: dimType as 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH', pts: [fromRef, toRef], value: storedMm });
    setDimensionPopup(null);
  }, [dimensionPopup, constraints, rooms, wallThickness, validateAndSolve, flashViolation, pushHistory, addConstraint, removeConstraint]);

  const releaseDimensionPopup = useCallback(() => {
    if (!dimensionPopup) return;
    const { fromRef, toRef } = dimensionPopup;
    const existingId = constraints.find((c) =>
      (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx &&
        c.pts[1]!.roomId === toRef.roomId   && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
       (c.pts[0]!.roomId === toRef.roomId   && c.pts[0]!.vertexIdx === toRef.vertexIdx &&
        c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
    )?.id;
    if (existingId) {
      pushHistory();
      removeConstraint(existingId);
      runSolver();
    }
    setDimensionPopup(null);
  }, [dimensionPopup, constraints, pushHistory, removeConstraint, runSolver]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeRoomId || !rooms.find((r) => r.id === activeRoomId))
      setActiveRoomId(rooms[0]?.id ?? null);
  }, [rooms, activeRoomId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Control') setIsCtrlPressed(true);
      if (e.key === 'Enter') {
        if (tool === 'WALL') { setTool('SELECT'); return; }
        if (tool === 'EXCLUDE' && excludePoints.length >= 3 && activeRoomId) {
          pushHistory(); addExcludedZone(activeRoomId, [...excludePoints]); setExcludePoints([]);
        }
      }
      if (e.key === 'Escape') {
        setTool('SELECT');
        setDeleteHover(null);
        setTutorialMode(false);
        setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
        setEditingPartitionThickness(null); setEditingPartitionDimension(null);
        setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
        setCoincideSource(null); setDimensionSource(null); setFaceSnapHover(null); setDimensionPopup(null); setDimTypeSelection(null); setPartitionOrigin(null); setExcludePoints([]);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (pastRef.current.length > 0) handleUndo();
        else if (onNavigateBack) onNavigateBack();
      }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
          (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        if (futureRef.current.length > 0) handleRedo();
      }
      if (e.key === '?') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          setTutorialMode((v) => !v);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === 'Control') setIsCtrlPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, excludePoints, activeRoomId]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      let ns = scale * (dir > 0 ? 1.15 : 1 / 1.15);
      ns = Math.max(0.005, Math.min(ns, 4));
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setScale(ns);
      setPan({ x: mx - (mx - pan.x) * (ns / scale), y: my - (my - pan.y) * (ns / scale) });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [scale, pan]);

  // ── Utilities ─────────────────────────────────────────────────────────────

  const toWorld = (sx: number, sy: number): Point => ({
    x: screenToWorld(sx, scale, pan.x),
    y: screenToWorld(sy, scale, pan.y),
  });

  const applyOrtho = (pt: Point, refPt: Point): Point => {
    const dx = Math.abs(pt.x - refPt.x), dy = Math.abs(pt.y - refPt.y);
    if (isShiftPressed || dx < 60 || dy < 60) return dx > dy ? { x: pt.x, y: refPt.y } : { x: refPt.x, y: pt.y };
    return pt;
  };

  const snapPos = useCallback((raw: Point, refPt?: Point): { point: Point; preview: SnapPreview | null } => {
    if (!isCtrlPressed) {
      // Snap to room vertices, zone vertices, partition endpoints
      for (const room of rooms) {
        for (const p of room.points)
          if (distance(raw, p) < 30 / scale) return { point: { ...p }, preview: { point: { ...p }, type: 'vertex' } };
        for (const z of (room.excludedZones ?? []))
          for (const p of z.points)
            if (distance(raw, p) < 30 / scale) return { point: { ...p }, preview: { point: { ...p }, type: 'vertex' } };
        for (const pt of (room.partitions ?? []))
          for (const p of [pt.p1, pt.p2])
            if (distance(raw, p) < 30 / scale) return { point: { ...p }, preview: { point: { ...p }, type: 'vertex' } };
      }
      // Snap to edges
      for (const room of rooms) {
        if (room.points.length >= 3) {
          for (let i = 0; i < room.points.length; i++) {
            const proj = getPointOnSegment(raw, room.points[i]!, room.points[(i + 1) % room.points.length]!);
            if (distance(raw, proj) < 18 / scale) return { point: { ...proj }, preview: { point: { ...proj }, type: 'edge' } };
          }
        }
        for (const z of (room.excludedZones ?? []))
          if (z.points.length >= 3)
            for (let i = 0; i < z.points.length; i++) {
              const proj = getPointOnSegment(raw, z.points[i]!, z.points[(i + 1) % z.points.length]!);
              if (distance(raw, proj) < 18 / scale) return { point: { ...proj }, preview: { point: { ...proj }, type: 'edge' } };
            }
        for (const pt of (room.partitions ?? [])) {
          const proj = getPointOnSegment(raw, pt.p1, pt.p2);
          if (distance(raw, proj) < 18 / scale) return { point: { ...proj }, preview: { point: { ...proj }, type: 'edge' } };
        }
      }
    }
    const gs: Point = { x: Math.round(raw.x / SNAP_GRID_MM) * SNAP_GRID_MM, y: Math.round(raw.y / SNAP_GRID_MM) * SNAP_GRID_MM };
    return { point: refPt ? applyOrtho(gs, refPt) : gs, preview: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, scale, isCtrlPressed, isShiftPressed]);

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const canCloseActiveRoom = activeRoom ? canCloseRoom(activeRoom, rooms) : false;

  const findNearestEdgeOfType = (worldPos: Point, type: EdgeType): HoveredEdge | null => {
    let best: HoveredEdge | null = null, bestDist = 80 / scale;
    for (const room of rooms) {
      if (room.points.length < 2) continue;
      const limit = room.points.length >= 3 ? room.points.length : room.points.length - 1;
      for (let i = 0; i < limit; i++) {
        if ((room.edges[i] ?? 'WALL') !== type) continue;
        const proj = getPointOnSegment(worldPos, room.points[i]!, room.points[(i + 1) % room.points.length]!);
        const d = distance(worldPos, proj);
        if (d < bestDist) { bestDist = d; best = { roomId: room.id, edgeIndex: i, t: proj.t }; }
      }
    }
    return best;
  };
  const findNearestWallEdge = (worldPos: Point) => findNearestEdgeOfType(worldPos, 'WALL');

  const findNearestZoneEdge = (worldPos: Point): HoveredZoneEdge | null => {
    let best: HoveredZoneEdge | null = null, bestDist = 80 / scale;
    for (const room of rooms)
      for (const zone of (room.excludedZones ?? []))
        if (zone.points.length >= 3)
          for (let i = 0; i < zone.points.length; i++) {
            const proj = getPointOnSegment(worldPos, zone.points[i]!, zone.points[(i + 1) % zone.points.length]!);
            const d = distance(worldPos, proj);
            if (d < bestDist) { bestDist = d; best = { roomId: room.id, zoneId: zone.id, edgeIndex: i }; }
          }
    return best;
  };

  const findNearestPartitionEdge = (worldPos: Point): HoveredPartitionEdge | null => {
    let best: HoveredPartitionEdge | null = null, bestDist = 80 / scale;
    for (const room of rooms)
      for (const pt of (room.partitions ?? [])) {
        const proj = getPointOnSegment(worldPos, pt.p1, pt.p2);
        const d = distance(worldPos, proj);
        if (d < bestDist) { bestDist = d; best = { roomId: room.id, partitionId: pt.id }; }
      }
    return best;
  };

  // ── Détecte l'élément le plus proche pour le mode DELETE ──────────────────
  const findDeleteTarget = (worldPos: Point): DeleteHoverTarget | null => {
    const threshold = 80 / scale;
    let best: { target: DeleteHoverTarget; dist: number; priority: number } | null = null;

    const candidate = (target: DeleteHoverTarget, d: number, priority: number) => {
      if (d >= threshold) return;
      if (!best || d < best.dist || (d === best.dist && priority < best.priority)) {
        best = { target, dist: d, priority };
      }
    };

    for (const room of rooms) {
      if (room.points.length < 3) continue;
      // Murs et portes
      for (let i = 0; i < room.points.length; i++) {
        const p1 = room.points[i]!, p2 = room.points[(i + 1) % room.points.length]!;
        const proj = getPointOnSegment(worldPos, p1, p2);
        const d = distance(worldPos, proj);
        const edgeType = room.edges[i] ?? 'WALL';
        if (edgeType === 'DOOR') {
          candidate({ type: 'door', roomId: room.id, edgeIndex: i }, d, 2);
        } else {
          candidate({ type: 'wall', roomId: room.id, edgeIndex: i }, d, 3);
        }
      }
      // Cloisons
      for (const pt of (room.partitions ?? [])) {
        const proj = getPointOnSegment(worldPos, pt.p1, pt.p2);
        candidate({ type: 'partition', roomId: room.id, partitionId: pt.id }, distance(worldPos, proj), 0);
      }
      // Zones exclues
      for (const zone of (room.excludedZones ?? [])) {
        if (zone.points.length < 3) continue;
        for (let i = 0; i < zone.points.length; i++) {
          const proj = getPointOnSegment(worldPos, zone.points[i]!, zone.points[(i + 1) % zone.points.length]!);
          candidate({ type: 'zone', roomId: room.id, zoneId: zone.id }, distance(worldPos, proj), 1);
        }
      }
    }

    return best ? (best as { target: DeleteHoverTarget; dist: number; priority: number }).target : null;
  };

  // ── Supprime l'élément cible (mode DELETE) ────────────────────────────────
  const deleteTarget = (target: DeleteHoverTarget) => {
    if (target.type === 'partition') {
      pushHistory();
      removePartition(target.roomId, target.partitionId);
      setDeleteHover(null);
      return;
    }
    if (target.type === 'zone') {
      pushHistory();
      removeExcludedZone(target.roomId, target.zoneId);
      setDeleteHover(null);
      return;
    }
    const room = rooms.find((r) => r.id === target.roomId);
    if (!room) return;
    if (target.type === 'door') {
      const result = removeDoorFromRoom(room, target.edgeIndex);
      if (!result) return;
      pushHistory();
      shiftConstraintIndices(room.id, target.edgeIndex, -2);
      updateRoom(room.id, result.points, result.edges);
      setDeleteHover(null);
      return;
    }
    // type === 'wall' : ré-ouvrir la pièce
    const n = room.points.length;
    if (n < 3) return;
    pushHistory();
    const rotateBy = (target.edgeIndex + 1) % n;
    const newPoints = [...room.points.slice(rotateBy), ...room.points.slice(0, rotateBy)];
    const reorderedEdges = [...room.edges.slice(rotateBy), ...room.edges.slice(0, rotateBy)];
    const newEdges = reorderedEdges.slice(0, n - 1) as EdgeType[];
    const roomConstraints = constraints.filter((c) => c.pts.some((r) => r.roomId === room.id));
    roomConstraints.forEach((c) => {
      removeConstraint(c.id);
      addConstraint({
        ...c,
        pts: c.pts.map((r) =>
          r.roomId === room.id
            ? { ...r, vertexIdx: (r.vertexIdx - rotateBy + n) % n }
            : r,
        ),
      });
    });
    updateRoom(room.id, newPoints, newEdges);
    setDeleteHover(null);
  };

  // ── Constraint helpers ────────────────────────────────────────────────────

  const findConstraint = (type: Constraint['type'], r1: PointRef, r2?: PointRef) =>
    constraints.find((c) => {
      if (c.type !== type) return false;
      if (!r2) return c.pts[0]?.roomId === r1.roomId && c.pts[0]?.vertexIdx === r1.vertexIdx;
      const [a, b] = [c.pts[0]!, c.pts[1]!];
      return (
        (a.roomId === r1.roomId && a.vertexIdx === r1.vertexIdx && b.roomId === r2.roomId && b.vertexIdx === r2.vertexIdx) ||
        (a.roomId === r2.roomId && a.vertexIdx === r2.vertexIdx && b.roomId === r1.roomId && b.vertexIdx === r1.vertexIdx)
      );
    });

  // ── Generic: apply H/V constraint on any edge (room, zone, or partition) ──

  const applyHVConstraint = (
    type: 'HORIZONTAL' | 'VERTICAL',
    p1Ref: PointRef,
    p2Ref: PointRef,
  ) => {
    const existing = findConstraint(type, p1Ref, p2Ref);
    if (existing) {
      const newCs = constraints.filter((c) => c.id !== existing.id);
      pushHistory(); removeConstraint(existing.id); runSolver(null, undefined, newCs);
    } else {
      const newC: Constraint = { id: generateId(), type, pts: [p1Ref, p2Ref] };
      if (!validateAndSolve([...constraints, newC])) { flashViolation(); return; }
      pushHistory(); addConstraint(newC);
    }
  };

  // ── Generic: COINCIDE handler (works for any source/target pair) ──────────

  const applyCoincidenct = (
    srcId: string, srcIdx: number,
    tgtId: string, tgtIdx: number,
    tgtPt: Point,
  ) => {
    const newC: Constraint = { id: generateId(), type: 'COINCIDENT', pts: [ref(srcId, srcIdx), ref(tgtId, tgtIdx)] };
    const snapped = snapVertex(rooms, srcId, srcIdx, { ...tgtPt });
    if (!validateAndSolve([...constraints, newC], null, snapped)) { flashViolation(); setCoincideSource(null); return; }
    pushHistory(); addConstraint(newC); setCoincideSource(null);
  };

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (editingEdge !== null) { setEditingEdge(null); return; }
    if (editingZoneEdge !== null) { setEditingZoneEdge(null); return; }
    if (editingPartition !== null) { setEditingPartition(null); return; }
    if (editingPartitionThickness !== null) { setEditingPartitionThickness(null); return; }
    if (editingPartitionDimension !== null) { setEditingPartitionDimension(null); return; }
    if (draggedVertex !== null || draggedZoneVertex !== null || draggedPartitionVertex !== null) return;
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    // ── DELETE ──
    if (tool === 'DELETE') {
      const target = findDeleteTarget(raw);
      if (target) {
        deleteTarget(target);
      } else {
        setTool('SELECT');
        setDeleteHover(null);
      }
      return;
    }

    // ── DIMENSION ──
    if (tool === 'DIMENSION') {
      // Un clic canvas annule les 3 prévisualisations (les previews SVG utilisent stopPropagation)
      if (dimTypeSelection) {
        setDimTypeSelection(null);
        return;
      }
      if (!dimensionSource) {
        if (faceSnapHover) {
          setDimensionSource({
            ref: {
              roomId: faceSnapHover.roomId,
              vertexIdx: faceSnapHover.vertexIdx,
              face: faceSnapHover.face,
            },
            worldPos: faceSnapHover.worldPos,
          });
        }
        return;
      }
      // Second click
      if (faceSnapHover) {
        // Guard: ignore same vertex+face as source (zero-distance dimension)
        const samePoint =
          faceSnapHover.roomId   === dimensionSource.ref.roomId &&
          faceSnapHover.vertexIdx === dimensionSource.ref.vertexIdx &&
          faceSnapHover.face      === dimensionSource.ref.face;
        if (!samePoint) {
          setDimTypeSelection({
            from: dimensionSource,
            to: {
              ref: {
                roomId: faceSnapHover.roomId,
                vertexIdx: faceSnapHover.vertexIdx,
                face: faceSnapHover.face,
              },
              worldPos: faceSnapHover.worldPos,
            },
          });
          setDimensionSource(null);
        }
      } else {
        setDimensionSource(null);
      }
      return;
    }

    // ── PARTITION ──
    if (tool === 'PARTITION') {
      const { point: snapped } = snapPos(raw);
      if (!partitionOrigin) { setPartitionOrigin(snapped); }
      else {
        if (!activeRoomId) return;
        pushHistory(); addPartition(activeRoomId, partitionOrigin, snapped, wallThickness); setPartitionOrigin(null);
      }
      return;
    }

    // ── EXCLUDE — double-click to close ──
    if (tool === 'EXCLUDE') {
      const { point: snapped } = snapPos(raw);
      const now = Date.now(), last = lastClickRef.current;
      const isDouble = now - last.time < 350 && distance({ x: last.x, y: last.y }, snapped) < 60 / scale;
      lastClickRef.current = { time: now, x: snapped.x, y: snapped.y };
      if (isDouble) {
        if (excludePoints.length >= 3 && activeRoomId) {
          pushHistory(); addExcludedZone(activeRoomId, [...excludePoints]); setExcludePoints([]);
        }
        return;
      }
      setExcludePoints((prev) => [...prev, snapped]);
      return;
    }

    // ── APPLY_H / APPLY_V — room walls, zone edges, partition edges ──
    if (tool === 'APPLY_H' || tool === 'APPLY_V') {
      const type = tool === 'APPLY_H' ? 'HORIZONTAL' : 'VERTICAL';
      const wallEdge = findNearestWallEdge(raw);
      if (wallEdge) {
        const room = rooms.find((r) => r.id === wallEdge.roomId);
        if (!room) return;
        const n = room.points.length;
        applyHVConstraint(type, ref(room.id, wallEdge.edgeIndex), ref(room.id, (wallEdge.edgeIndex + 1) % n));
        return;
      }
      const zoneEdge = findNearestZoneEdge(raw);
      if (zoneEdge) {
        const zone = rooms.find((r) => r.id === zoneEdge.roomId)?.excludedZones?.find((z) => z.id === zoneEdge.zoneId);
        if (!zone) return;
        const n = zone.points.length;
        applyHVConstraint(type, ref(zone.id, zoneEdge.edgeIndex), ref(zone.id, (zoneEdge.edgeIndex + 1) % n));
        return;
      }
      const partEdge = findNearestPartitionEdge(raw);
      if (partEdge) {
        applyHVConstraint(type, ref(partEdge.partitionId, 0), ref(partEdge.partitionId, 1));
      }
      return;
    }

    // ── COINCIDE: canvas click → POINT_ON_LINE on wall / zone / partition edge ──
    if (tool === 'COINCIDE' && coincideSource) {
      const srcRef = ref(coincideSource.roomId, coincideSource.idx);

      const wallEdge = findNearestWallEdge(raw);
      const zoneEdge = !wallEdge ? findNearestZoneEdge(raw) : null;
      const partEdge = !wallEdge && !zoneEdge ? findNearestPartitionEdge(raw) : null;

      let lp1: Point | undefined, lp2: Point | undefined;
      let lineRef1: PointRef | undefined, lineRef2: PointRef | undefined;

      if (wallEdge) {
        const tgtRoom = rooms.find((r) => r.id === wallEdge.roomId);
        if (tgtRoom) {
          const n = tgtRoom.points.length;
          lp1 = tgtRoom.points[wallEdge.edgeIndex]; lp2 = tgtRoom.points[(wallEdge.edgeIndex + 1) % n];
          lineRef1 = ref(tgtRoom.id, wallEdge.edgeIndex); lineRef2 = ref(tgtRoom.id, (wallEdge.edgeIndex + 1) % n);
        }
      } else if (zoneEdge) {
        const zone = rooms.find((r) => r.id === zoneEdge.roomId)?.excludedZones?.find((z) => z.id === zoneEdge.zoneId);
        if (zone) {
          const n = zone.points.length;
          lp1 = zone.points[zoneEdge.edgeIndex]; lp2 = zone.points[(zoneEdge.edgeIndex + 1) % n];
          lineRef1 = ref(zone.id, zoneEdge.edgeIndex); lineRef2 = ref(zone.id, (zoneEdge.edgeIndex + 1) % n);
        }
      } else if (partEdge) {
        const part = rooms.find((r) => r.id === partEdge.roomId)?.partitions?.find((p) => p.id === partEdge.partitionId);
        if (part) {
          lp1 = part.p1; lp2 = part.p2;
          lineRef1 = ref(part.id, 0); lineRef2 = ref(part.id, 1);
        }
      }

      if (lp1 && lp2 && lineRef1 && lineRef2) {
        const proj = getPointOnSegment(snapPos(raw).point, lp1, lp2);
        const newC: Constraint = { id: generateId(), type: 'POINT_ON_LINE', pts: [srcRef, lineRef1, lineRef2] };
        const snapped = snapVertex(rooms, coincideSource.roomId, coincideSource.idx, { x: proj.x, y: proj.y });
        if (!validateAndSolve([...constraints, newC], null, snapped)) { flashViolation(); }
        else { pushHistory(); addConstraint(newC); }
      }
      setCoincideSource(null);
      return;
    }
    if (tool === 'COINCIDE') return;

    // ── SELECT — clic sur une cloison → édition épaisseur ──
    if (tool === 'SELECT' && e.button === 0) {
      const partEdge = findNearestPartitionEdge(raw);
      if (partEdge) {
        const part = rooms
          .find((r) => r.id === partEdge.roomId)
          ?.partitions?.find((p) => p.id === partEdge.partitionId);
        if (part) {
          setEditingPartitionThickness({ roomId: partEdge.roomId, partitionId: partEdge.partitionId });
          setEditThicknessValue((part.thickness / 10).toFixed(0));
          return;
        }
      }
    }

    if (e.button === 1 || tool === 'SELECT' || e.button === 2) { setIsPanning(true); return; }

    // ── WALL ──
    if (tool === 'WALL') {
      if (!activeRoom) return;
      const refPt = activeRoom.points[activeRoom.points.length - 1];
      const { point: snapped } = snapPos(raw, refPt);
      const pts = activeRoom.points;
      if (canCloseActiveRoom && distance(snapped, pts[0]!) < CLOSING_TOLERANCE_MM) { setTool('SELECT'); return; }
      pushHistory();
      updateRoom(activeRoom.id, [...pts, snapped], [...activeRoom.edges, 'WALL']);
      // Auto-ancrage : premier nœud de la première pièce uniquement
      if (rooms.indexOf(activeRoom) === 0 && pts.length === 0) {
        if (!findConstraint('FIX', ref(activeRoom.id, 0))) {
          addConstraint({ id: generateId(), type: 'FIX', pts: [ref(activeRoom.id, 0)], value: { x: snapped.x, y: snapped.y } });
        }
      }
      return;
    }

    // ── DOOR ──
    if (tool === 'DOOR') {
      const nearDoor = findNearestEdgeOfType(raw, 'DOOR');
      if (nearDoor) {
        const tgtRoom = rooms.find((r) => r.id === nearDoor.roomId);
        if (tgtRoom) {
          const dA = tgtRoom.points[nearDoor.edgeIndex]!;
          const dB = tgtRoom.points[(nearDoor.edgeIndex + 1) % tgtRoom.points.length]!;
          const result = removeDoorFromRoom(tgtRoom, nearDoor.edgeIndex);
          if (result) {
            pushHistory(); shiftConstraintIndices(tgtRoom.id, nearDoor.edgeIndex, -2);
            updateRoom(tgtRoom.id, result.points, result.edges);
            const coinc = findCoincidentDoorEdge(rooms, tgtRoom.id, dA, dB);
            if (coinc) {
              const other = rooms.find((r) => r.id === coinc.roomId);
              if (other) { shiftConstraintIndices(other.id, coinc.edgeIdx, -2); const or = removeDoorFromRoom(other, coinc.edgeIdx); if (or) updateRoom(other.id, or.points, or.edges); }
            }
          }
        }
        return;
      }
      const edge = hoveredEdge ?? findNearestWallEdge(raw);
      if (!edge) return;
      const tgtRoom = rooms.find((r) => r.id === edge.roomId);
      if (!tgtRoom || tgtRoom.points.length < 2) return;
      const { points: pts, edges } = tgtRoom;
      const i = edge.edgeIndex;
      const p1 = pts[i]!, p2 = pts[(i + 1) % pts.length]!;
      const edgeLen = distance(p1, p2);
      const doorW = Math.min(DOOR_DEFAULT_WIDTH_MM, edgeLen * 0.9);
      const halfW = doorW / 2;
      const tCenter = Math.min(1 - halfW / edgeLen, Math.max(halfW / edgeLen, edge.t));
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const cos = Math.cos(ang), sin = Math.sin(ang), cd = tCenter * edgeLen;
      const dA: Point = { x: p1.x + cos * (cd - halfW), y: p1.y + sin * (cd - halfW) };
      const dB: Point = { x: p1.x + cos * (cd + halfW), y: p1.y + sin * (cd + halfW) };
      pushHistory(); shiftConstraintIndices(tgtRoom.id, i, 2);
      updateRoom(tgtRoom.id, [...pts.slice(0, i + 1), dA, dB, ...pts.slice(i + 1)],
        [...edges.slice(0, i), 'WALL', 'DOOR', 'WALL', ...edges.slice(i + 1)] as EdgeType[]);
      const coinc = findCoincidentWallEdge(rooms, tgtRoom.id, p1, p2);
      if (coinc) {
        const other = rooms.find((r) => r.id === coinc.roomId);
        if (other) {
          const j = coinc.edgeIdx;
          const [first, second] = coinc.reversed ? [dB, dA] : [dA, dB];
          shiftConstraintIndices(other.id, j, 2);
          updateRoom(other.id, [...other.points.slice(0, j + 1), first, second, ...other.points.slice(j + 1)],
            [...other.edges.slice(0, j), 'WALL', 'DOOR', 'WALL', ...other.edges.slice(j + 1)] as EdgeType[]);
        }
      }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    // ── Drag room vertex ──
    if (draggedVertex !== null) {
      const { roomId, idx } = draggedVertex;
      const room = roomsRef.current.find((r) => r.id === roomId);
      if (!room) return;
      const { point: snapped, preview } = snapPos(raw);
      setSnapPreview(preview);
      const modified = roomsRef.current.map((r) => {
        if (r.id !== roomId) return r;
        const pts = [...r.points]; pts[idx] = snapped; return { ...r, points: pts };
      });
      const ok = validateAndSolve(constraintsRef.current, ptKey(roomId, idx), modified);
      if (!ok) { if (!wasViolatingDragRef.current) { flashViolation(); wasViolatingDragRef.current = true; } }
      else wasViolatingDragRef.current = false;
      return;
    }

    // ── Drag zone vertex ──
    if (draggedZoneVertex !== null) {
      const { parentRoomId, zoneId, idx } = draggedZoneVertex;
      const { point: snapped, preview } = snapPos(raw);
      setSnapPreview(preview);
      const modified = roomsRef.current.map((r) => {
        if (r.id !== parentRoomId) return r;
        return { ...r, excludedZones: (r.excludedZones ?? []).map((z) => { if (z.id !== zoneId) return z; const pts = [...z.points]; pts[idx] = snapped; return { ...z, points: pts }; }) };
      });
      const ok = validateAndSolve(constraintsRef.current, ptKey(zoneId, idx), modified);
      if (!ok) { if (!wasViolatingDragRef.current) { flashViolation(); wasViolatingDragRef.current = true; } }
      else wasViolatingDragRef.current = false;
      return;
    }

    // ── Drag partition vertex ──
    if (draggedPartitionVertex !== null) {
      const { parentRoomId, partitionId, idx } = draggedPartitionVertex;
      const { point: snapped, preview } = snapPos(raw);
      setSnapPreview(preview);
      const modified = roomsRef.current.map((r) => {
        if (r.id !== parentRoomId) return r;
        return { ...r, partitions: (r.partitions ?? []).map((p) => { if (p.id !== partitionId) return p; return idx === 0 ? { ...p, p1: snapped } : { ...p, p2: snapped }; }) };
      });
      const ok = validateAndSolve(constraintsRef.current, ptKey(partitionId, idx), modified);
      if (!ok) { if (!wasViolatingDragRef.current) { flashViolation(); wasViolatingDragRef.current = true; } }
      else wasViolatingDragRef.current = false;
      return;
    }

    if (isPanning) { setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY }); return; }

    const refPt = tool === 'WALL' && activeRoom ? activeRoom.points[activeRoom.points.length - 1]
      : tool === 'EXCLUDE' && excludePoints.length > 0 ? excludePoints[excludePoints.length - 1]
      : undefined;
    const { point: snapped, preview } = snapPos(raw, refPt);
    setMousePos(snapped);
    setSnapPreview(preview);

    if (tool === 'DELETE') {
      setDeleteHover(findDeleteTarget(raw));
    } else if (tool === 'DIMENSION') {
      setFaceSnapHover(findNearestVertexSnap(raw));
      setDeleteHover(null);
    } else if (tool === 'DOOR') {
      setHoveredEdge(findNearestEdgeOfType(raw, 'DOOR') ?? findNearestWallEdge(raw));
    } else if (tool === 'APPLY_H' || tool === 'APPLY_V') {
      setHoveredEdge(findNearestWallEdge(raw));
      setHoveredZoneEdge(findNearestZoneEdge(raw));
      setHoveredPartitionEdge(findNearestPartitionEdge(raw));
    } else {
      setHoveredEdge(null); setHoveredZoneEdge(null); setHoveredPartitionEdge(null);
      setDeleteHover(null);
      setFaceSnapHover(null);
    }
  };

  const handlePointerUp = () => {
    if (draggedVertex || draggedZoneVertex || draggedPartitionVertex) {
      wasViolatingDragRef.current = false;
      runSolver(null);
    }
    setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
    setIsPanning(false);
  };

  // ── Edge / vertex click handlers ──────────────────────────────────────────

  // Shared core logic: activate wall/door edge editor (used by mouse click AND mobile tap)
  const tapActivateEdge = (roomId: string, edgeIndex: number, _dist: number) => {
    const room = rooms.find((r) => r.id === roomId);
    setEditingEdge({ roomId, edgeIndex });
    const currentThickness = room?.edgeThicknesses?.[edgeIndex] ?? wallThickness;
    setEditingEdgeThicknessValue((currentThickness / 10).toFixed(0));
  };

  const handleEdgePointerDown = (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool !== 'SELECT') return;
    tapActivateEdge(roomId, edgeIndex, dist);
  };

  const handleVertexPointerDown = (roomId: string, index: number) => (e: ReactPointerEvent) => {
    // In DIMENSION mode, let the event bubble to the SVG root handler (vertex snap click)
    if (tool === 'DIMENSION') return;
    e.stopPropagation();
    if (tool === 'ANCHOR') {
      const room = rooms.find((r) => r.id === roomId); if (!room) return;
      const p = room.points[index]!, existing = findConstraint('FIX', ref(roomId, index));
      pushHistory();
      if (existing) { removeConstraint(existing.id); runSolver(); }
      else addConstraint({ id: generateId(), type: 'FIX', pts: [ref(roomId, index)], value: { x: p.x, y: p.y } });
      return;
    }
    if (tool === 'COINCIDE') {
      if (!coincideSource) {
        const existing = constraints.filter((c) => (c.type === 'COINCIDENT' || c.type === 'POINT_ON_LINE') && c.pts[0]?.roomId === roomId && c.pts[0]?.vertexIdx === index);
        if (existing.length) { pushHistory(); existing.forEach((c) => removeConstraint(c.id)); runSolver(); }
        else setCoincideSource({ roomId, idx: index });
        return;
      }
      if (coincideSource.roomId === roomId && coincideSource.idx === index) { setCoincideSource(null); return; }
      const tgtRoom = rooms.find((r) => r.id === roomId); if (!tgtRoom) { setCoincideSource(null); return; }
      const tgtPt = tgtRoom.points[index]; if (!tgtPt) { setCoincideSource(null); return; }
      applyCoincidenct(coincideSource.roomId, coincideSource.idx, roomId, index, tgtPt);
      return;
    }
    if (e.altKey) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) { const pt = room.points[index]!; setOriginPoint((prev) => prev && Math.abs(prev.x - pt.x) < 1 && Math.abs(prev.y - pt.y) < 1 ? null : pt); }
      return;
    }
    if (tool === 'WALL') {
      const room = rooms.find((r) => r.id === roomId);
      if (room && index === 0 && canCloseRoom(room, rooms)) { setTool('SELECT'); return; }
    }
    if (tool === 'SELECT') {
      const dof = dofMap.get(ptKey(roomId, index)); if (dof?.isFullyConstrained) return;
      pushHistory(); setDraggedVertex({ roomId, idx: index });
    }
  };

  // ── Partition vertex handler ───────────────────────────────────────────────

  const handlePartitionVertexPointerDown = (parentRoomId: string, partitionId: string, idx: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool === 'ANCHOR') {
      const part = rooms.find((r) => r.id === parentRoomId)?.partitions?.find((p) => p.id === partitionId); if (!part) return;
      const p = idx === 0 ? part.p1 : part.p2, existing = findConstraint('FIX', ref(partitionId, idx));
      pushHistory();
      if (existing) { removeConstraint(existing.id); runSolver(); }
      else addConstraint({ id: generateId(), type: 'FIX', pts: [ref(partitionId, idx)], value: { x: p.x, y: p.y } });
      return;
    }
    if (tool === 'COINCIDE') {
      if (!coincideSource) {
        const existing = constraints.filter((c) => (c.type === 'COINCIDENT' || c.type === 'POINT_ON_LINE') && c.pts[0]?.roomId === partitionId && c.pts[0]?.vertexIdx === idx);
        if (existing.length) { pushHistory(); existing.forEach((c) => removeConstraint(c.id)); runSolver(); }
        else setCoincideSource({ roomId: partitionId, idx });
        return;
      }
      if (coincideSource.roomId === partitionId && coincideSource.idx === idx) { setCoincideSource(null); return; }
      const part = rooms.find((r) => r.id === parentRoomId)?.partitions?.find((p) => p.id === partitionId);
      const tgtPt = part ? (idx === 0 ? part.p1 : part.p2) : undefined;
      if (!tgtPt) { setCoincideSource(null); return; }
      applyCoincidenct(coincideSource.roomId, coincideSource.idx, partitionId, idx, tgtPt);
      return;
    }
    if (e.altKey) {
      const part = rooms.find((r) => r.id === parentRoomId)?.partitions?.find((p) => p.id === partitionId);
      if (part) { const pt = idx === 0 ? part.p1 : part.p2; setOriginPoint((prev) => prev && Math.abs(prev.x - pt.x) < 1 && Math.abs(prev.y - pt.y) < 1 ? null : pt); }
      return;
    }
    if (tool === 'SELECT') {
      const dof = dofMap.get(ptKey(partitionId, idx)); if (dof?.isFullyConstrained) return;
      pushHistory(); setDraggedPartitionVertex({ parentRoomId, partitionId, idx });
    }
  };

  // ── Zone vertex handler ────────────────────────────────────────────────────

  const handleZoneVertexPointerDown = (parentRoomId: string, zoneId: string, idx: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool === 'ANCHOR') {
      const zone = rooms.find((r) => r.id === parentRoomId)?.excludedZones?.find((z) => z.id === zoneId); if (!zone) return;
      const p = zone.points[idx]!, existing = findConstraint('FIX', ref(zoneId, idx));
      pushHistory();
      if (existing) { removeConstraint(existing.id); runSolver(); }
      else addConstraint({ id: generateId(), type: 'FIX', pts: [ref(zoneId, idx)], value: { x: p.x, y: p.y } });
      return;
    }
    if (tool === 'COINCIDE') {
      if (!coincideSource) {
        const existing = constraints.filter((c) => (c.type === 'COINCIDENT' || c.type === 'POINT_ON_LINE') && c.pts[0]?.roomId === zoneId && c.pts[0]?.vertexIdx === idx);
        if (existing.length) { pushHistory(); existing.forEach((c) => removeConstraint(c.id)); runSolver(); }
        else setCoincideSource({ roomId: zoneId, idx });
        return;
      }
      if (coincideSource.roomId === zoneId && coincideSource.idx === idx) { setCoincideSource(null); return; }
      const zone = rooms.find((r) => r.id === parentRoomId)?.excludedZones?.find((z) => z.id === zoneId);
      const tgtPt = zone?.points[idx]; if (!tgtPt) { setCoincideSource(null); return; }
      applyCoincidenct(coincideSource.roomId, coincideSource.idx, zoneId, idx, tgtPt);
      return;
    }
    if (e.altKey) {
      const zone = rooms.find((r) => r.id === parentRoomId)?.excludedZones?.find((z) => z.id === zoneId);
      if (zone) { const pt = zone.points[idx]!; setOriginPoint((prev) => prev && Math.abs(prev.x - pt.x) < 1 && Math.abs(prev.y - pt.y) < 1 ? null : pt); }
      return;
    }
    if (tool === 'SELECT') {
      const dof = dofMap.get(ptKey(zoneId, idx)); if (dof?.isFullyConstrained) return;
      pushHistory(); setDraggedZoneVertex({ parentRoomId, zoneId, idx });
    }
  };

  // ── Dimension submit handlers ─────────────────────────────────────────────

  const submitThickness = useCallback(() => {
    if (!editingEdge) return;
    const thickCm = parseFloat(editingEdgeThicknessValue);
    if (isNaN(thickCm) || thickCm <= 0) { setEditingEdge(null); return; }
    const thickMm = thickCm * 10;
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (!room) { setEditingEdge(null); return; }
    const currentThick = room.edgeThicknesses?.[editingEdge.edgeIndex] ?? wallThickness;
    if (Math.abs(thickMm - currentThick) > 0.5) {
      pushHistory();
      setEdgeThickness(editingEdge.roomId, editingEdge.edgeIndex, thickMm);
    }
    setEditingEdge(null);
  }, [editingEdge, editingEdgeThicknessValue, rooms, wallThickness, pushHistory]);

  const submitZoneEdgeDimension = () => {
    if (!editingZoneEdge) return;
    const valCm = parseFloat(editZoneEdgeValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingZoneEdge(null); return; }
    const zone = rooms.find((r) => r.id === editingZoneEdge.roomId)?.excludedZones?.find((z) => z.id === editingZoneEdge.zoneId);
    if (!zone) { setEditingZoneEdge(null); return; }
    const n = zone.points.length, eIdx = editingZoneEdge.edgeIndex;
    const p1Ref = ref(zone.id, eIdx), p2Ref = ref(zone.id, (eIdx + 1) % n);
    const lengthMm = valCm * 10, existing = findConstraint('LENGTH', p1Ref, p2Ref);
    const newId = existing?.id ?? generateId();
    const newCs = existing ? constraints.map((c) => c.id === existing.id ? { ...c, value: lengthMm } : c)
      : [...constraints, { id: newId, type: 'LENGTH' as const, pts: [p1Ref, p2Ref], value: lengthMm }];
    if (!validateAndSolve(newCs)) { flashViolation(); setEditingZoneEdge(null); return; }
    pushHistory();
    if (existing) updateConstraintValue(existing.id, lengthMm);
    else addConstraint({ id: newId, type: 'LENGTH', pts: [p1Ref, p2Ref], value: lengthMm });
    setEditingZoneEdge(null);
  };

  /** Partition length → LENGTH constraint (p1 is kept fixed as anchor during solve). */
  const submitPartitionDimension = () => {
    if (!editingPartition) return;
    const valCm = parseFloat(editPartitionValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingPartition(null); return; }
    const part = rooms.find((r) => r.id === editingPartition.roomId)?.partitions?.find((p) => p.id === editingPartition.partitionId);
    if (!part) { setEditingPartition(null); return; }
    const p1Ref = ref(part.id, 0), p2Ref = ref(part.id, 1);
    const lengthMm = valCm * 10, existing = findConstraint('LENGTH', p1Ref, p2Ref);
    const newId = existing?.id ?? generateId();
    const newCs = existing ? constraints.map((c) => c.id === existing.id ? { ...c, value: lengthMm } : c)
      : [...constraints, { id: newId, type: 'LENGTH' as const, pts: [p1Ref, p2Ref], value: lengthMm }];
    // Fix p1 in place so p2 is the one that moves
    if (!validateAndSolve(newCs, ptKey(part.id, 0))) { flashViolation(); setEditingPartition(null); return; }
    pushHistory();
    if (existing) updateConstraintValue(existing.id, lengthMm);
    else addConstraint({ id: newId, type: 'LENGTH', pts: [p1Ref, p2Ref], value: lengthMm });
    setEditingPartition(null);
  };

  const submitPartitionThickness = () => {
    if (!editingPartitionThickness) return;
    const valCm = parseFloat(editThicknessValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingPartitionThickness(null); return; }
    pushHistory();
    updatePartitionThickness(editingPartitionThickness.roomId, editingPartitionThickness.partitionId, valCm * 10);
    setEditingPartitionThickness(null);
  };

  const submitPartitionDimensionToElement = () => {
    if (!editingPartitionDimension) return;
    const valCm = parseFloat(editPartitionDimValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingPartitionDimension(null); return; }
    const { fromRef, toRef } = editingPartitionDimension;
    const existing = constraints.find((c) =>
      (c.type === 'LENGTH' || c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE') &&
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx && c.pts[1]!.roomId === toRef.roomId && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
       (c.pts[0]!.roomId === toRef.roomId && c.pts[0]!.vertexIdx === toRef.vertexIdx && c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
    );
    const cType = existing?.type ?? editingPartitionDimType;
    const fromRoom = rooms.find((r) => r.id === fromRef.roomId);
    const syntheticC = { id: '', type: cType as Constraint['type'], pts: [fromRef, toRef] };
    const submitOffset = fromRoom ? constraintFaceOffset(syntheticC, fromRoom, wallThickness) : 0;
    const valueMm = valCm * 10 + submitOffset;
    const newId = existing?.id ?? generateId();
    const newCs = existing
      ? constraints.map((c) => c.id === existing.id ? { ...c, value: valueMm } : c)
      : [...constraints, { id: newId, type: cType as Constraint['type'], pts: [fromRef, toRef], value: valueMm }];
    if (!validateAndSolve(newCs)) { flashViolation(); setEditingPartitionDimension(null); return; }
    pushHistory();
    if (existing) updateConstraintValue(existing.id, valueMm);
    else addConstraint({ id: newId, type: cType as Constraint['type'], pts: [fromRef, toRef], value: valueMm });
    setEditingPartitionDimension(null);
  };

  const handlePartitionDimensionPointerDown = (fromRef: PointRef, toRef: PointRef, dist: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool !== 'SELECT') return;
    setEditingPartitionDimension({ fromRef, toRef });
    setEditPartitionDimValue((dist / 10).toFixed(1));
    setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null); setEditingPartitionThickness(null);
  };

  const handlePartitionLabelPointerDown = (roomId: string, partitionId: string, lengthMm: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    setEditingPartition({ roomId, partitionId });
    setEditPartitionValue((lengthMm / 10).toFixed(1));
    setEditingEdge(null); setEditingZoneEdge(null); setEditingPartitionThickness(null); setEditingPartitionDimension(null);
  };

  const handleZoneEdgePointerDown = (parentRoomId: string, zoneId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool !== 'SELECT') return;
    setEditingZoneEdge({ roomId: parentRoomId, zoneId, edgeIndex });
    setEditZoneEdgeValue((dist / 10).toFixed(1));
    setEditingEdge(null); setEditingPartition(null);
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleUndo = () => {
    const p = pastRef.current;
    if (!p.length) return;
    const [entry, ...rest] = p;
    const current: HistoryEntry = {
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
    };
    setFuture((f) => [current, ...f.slice(0, 49)]);
    setPast(rest);
    restoreSnapshot(entry!.rooms, entry!.constraints);
  };

  const handleRedo = () => {
    const f = futureRef.current;
    if (!f.length) return;
    const [entry, ...rest] = f;
    const current: HistoryEntry = {
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
    };
    setPast((p) => [current, ...p.slice(0, 49)]);
    setFuture(rest);
    restoreSnapshot(entry!.rooms, entry!.constraints);
  };

  const handleAddRoom = () => { const id = addRoom(); setActiveRoomId(id); setTool('WALL'); };

  const handleRemoveRoom = (roomId: string) => {
    removeRoom(roomId);
    if (activeRoomId === roomId) setActiveRoomId(rooms.find((r) => r.id !== roomId)?.id ?? null);
  };

  const handleClearRoom = () => {
    if (!activeRoom) return;
    pushHistory();
    constraints.filter((c) => c.pts.some((r) => r.roomId === activeRoom.id)).forEach((c) => removeConstraint(c.id));
    updateRoom(activeRoom.id, [], []);
    clearPartitionsAndZones(activeRoom.id);
    setTool('WALL'); setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
    setPartitionOrigin(null); setExcludePoints([]);
  };

  // ── DimensionEditor screen positions ──────────────────────────────────────

  let editorScreen: { x: number; y: number } | undefined;
  if (editingEdge) {
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (room) {
      const p1 = room.points[editingEdge.edgeIndex];
      const p2 = room.points[(editingEdge.edgeIndex + 1) % room.points.length];
      if (p1 && p2) editorScreen = { x: ((p1.x + p2.x) / 2) * scale + pan.x, y: ((p1.y + p2.y) / 2) * scale + pan.y };
    }
  }

  let zoneEditorScreen: { x: number; y: number } | undefined;
  if (editingZoneEdge) {
    const zone = rooms.find((r) => r.id === editingZoneEdge.roomId)?.excludedZones?.find((z) => z.id === editingZoneEdge.zoneId);
    if (zone) {
      const p1 = zone.points[editingZoneEdge.edgeIndex];
      const p2 = zone.points[(editingZoneEdge.edgeIndex + 1) % zone.points.length];
      if (p1 && p2) zoneEditorScreen = { x: ((p1.x + p2.x) / 2) * scale + pan.x, y: ((p1.y + p2.y) / 2) * scale + pan.y };
    }
  }

  let partitionEditorScreen: { x: number; y: number } | undefined;
  if (editingPartition) {
    const part = rooms.find((r) => r.id === editingPartition.roomId)?.partitions?.find((p) => p.id === editingPartition.partitionId);
    if (part) partitionEditorScreen = { x: ((part.p1.x + part.p2.x) / 2) * scale + pan.x, y: ((part.p1.y + part.p2.y) / 2) * scale + pan.y };
  }

  let partitionThicknessEditorScreen: { x: number; y: number } | undefined;
  if (editingPartitionThickness) {
    const part = rooms.find((r) => r.id === editingPartitionThickness.roomId)?.partitions?.find((p) => p.id === editingPartitionThickness.partitionId);
    if (part) {
      const dx = part.p2.x - part.p1.x, dy = part.p2.y - part.p1.y;
      const lenN = Math.sqrt(dx * dx + dy * dy) || 1;
      const midX = (part.p1.x + part.p2.x) / 2, midY = (part.p1.y + part.p2.y) / 2;
      partitionThicknessEditorScreen = {
        x: (midX + (dy / lenN) * (part.thickness / 2 + 280)) * scale + pan.x,
        y: (midY + (-dx / lenN) * (part.thickness / 2 + 280)) * scale + pan.y,
      };
    }
  }

  let partitionDimEditorScreen: { x: number; y: number } | undefined;
  if (editingPartitionDimension) {
    const { fromRef, toRef } = editingPartitionDimension;
    const fromPt = resolveRef(rooms, fromRef);
    const toPt = resolveRef(rooms, toRef);
    if (fromPt && toPt) partitionDimEditorScreen = { x: ((fromPt.x + toPt.x) / 2) * scale + pan.x, y: ((fromPt.y + toPt.y) / 2) * scale + pan.y };
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Mobile: room strip (non-draggable, horizontal) */}
      <div
        data-testid="mobile-room-strip"
        className="flex md:hidden mouse:hidden shrink-0 items-center overflow-x-auto border-b border-gray-200 dark:border-zinc-800 px-3 py-1"
        style={{ scrollbarWidth: 'none' }}
      >
        <RoomTabs
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onAddRoom={handleAddRoom}
          onRemoveRoom={handleRemoveRoom}
          onRenameRoom={renameRoom}
          onClearRoom={handleClearRoom}
          vertical={false}
        />
      </div>
      {/* Canvas area */}
      <div
        className="relative flex flex-1 overflow-hidden"
        style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}
        onTouchStart={handleWrapperTouchStart}
        onTouchMove={handleWrapperTouchMove}
        onTouchEnd={handleWrapperTouchEnd}
      >

      {/* Mobile: touch overlay for 1-finger pan/tap (SELECT only) — hidden on desktop (mouse:hidden) */}
      <div
        data-testid="mobile-touch-overlay"
        className="absolute inset-0 z-10 md:hidden mouse:hidden"
        style={{ touchAction: 'none', pointerEvents: (tool === 'SELECT' || tool === 'DELETE') ? 'auto' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <ToolStatusBar tool={tool} />

      {violationFlash && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950/90 px-4 py-2 text-sm font-medium text-red-300 shadow-xl backdrop-blur-sm">
          Contrainte impossible à satisfaire
        </div>
      )}

      <PlanToolbar
        tool={tool}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onChangeTool={(t) => {
          setTool(t);
          setDeleteHover(null);
          setFaceSnapHover(null);
          setDimensionSource(null);
          setDimensionPopup(null);
          setCoincideSource(null); setPartitionOrigin(null);
          setExcludePoints([]); setEditingPartitionDimension(null); setDimTypeSelection(null);
          setEditingEdge(null); setEditingZoneEdge(null);
          setEditingPartition(null); setEditingPartitionThickness(null);
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        wallThickness={wallThickness}
        onWallThicknessChange={setWallThickness}
        tutorialMode={tutorialMode}
        onToggleTutorial={() => setTutorialMode((v) => !v)}
      />

      <div className="hidden md:block mouse:block">
        <RoomPanel
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={setActiveRoomId}
          onAddRoom={handleAddRoom}
          onRemoveRoom={handleRemoveRoom}
          onRenameRoom={renameRoom}
          onClearRoom={handleClearRoom}
          zone={roomZone}
          isDragging={roomDragging}
          onPointerDown={handleRoomPointerDown}
          tutorialMode={tutorialMode}
        />
      </div>

      {/* Mobile: touch hint */}
      <div className="pointer-events-none absolute bottom-40 right-3 z-10 md:hidden mouse:hidden rounded-lg px-2.5 py-1.5 text-[10px] font-medium"
        style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)' }}>
        2 doigts : zoom
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 hidden md:block mouse:block rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
        style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}>
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>Raccourcis</p>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5" style={{ color: 'var(--text2)' }}>
          <span>Fermer la forme</span><span className="text-right font-semibold text-orange-500/80">↵ Entrée</span>
          <span>Orthogonalité</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>⇧ Maj</kbd>
          <span>Sans aimantation</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl</kbd>
          <span>Annuler</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Z</kbd>
          <span>Rétablir</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Y</kbd>
          <span>Cote / H / V</span><span className="text-right font-semibold text-orange-500/80">Clic mur/cloison/zone</span>
          <span>Ancrer nœud</span><span className="text-right font-semibold text-violet-500/80">Outil 📌</span>
          <span>Suppr. cloison/zone</span><span className="text-right font-semibold" style={{ color: 'var(--muted)' }}>Clic dessus</span>
        </div>
      </div>

      {editingEdge !== null && (() => {
        const above = editorScreen === undefined || editorScreen.y > 220;
        return (
          <WallEdgeEditor
            screenX={isTouchDevice ? undefined : editorScreen?.x}
            screenY={isTouchDevice ? undefined : editorScreen?.y}
            above={above}
            thicknessValue={editingEdgeThicknessValue}
            onThicknessChange={setEditingEdgeThicknessValue}
            hasExistingConstraint={false}
            onRelease={() => setEditingEdge(null)}
            onSubmit={submitThickness}
            onCancel={() => setEditingEdge(null)} />
        );
      })()}
      {editingZoneEdge !== null && (
        <DimensionEditor screenX={isTouchDevice ? undefined : zoneEditorScreen?.x} screenY={isTouchDevice ? undefined : zoneEditorScreen?.y}
          value={editZoneEdgeValue} onChange={setEditZoneEdgeValue}
          onSubmit={submitZoneEdgeDimension} onCancel={() => setEditingZoneEdge(null)} />
      )}
      {editingPartition !== null && (
        <DimensionEditor screenX={isTouchDevice ? undefined : partitionEditorScreen?.x} screenY={isTouchDevice ? undefined : partitionEditorScreen?.y}
          value={editPartitionValue} onChange={setEditPartitionValue}
          onSubmit={submitPartitionDimension} onCancel={() => setEditingPartition(null)} />
      )}
      {editingPartitionThickness !== null && (
        <DimensionEditor screenX={isTouchDevice ? undefined : partitionThicknessEditorScreen?.x} screenY={isTouchDevice ? undefined : partitionThicknessEditorScreen?.y}
          value={editThicknessValue} onChange={setEditThicknessValue}
          onSubmit={submitPartitionThickness} onCancel={() => setEditingPartitionThickness(null)} />
      )}
      {editingPartitionDimension !== null && (
        <DimensionEditor screenX={isTouchDevice ? undefined : partitionDimEditorScreen?.x} screenY={isTouchDevice ? undefined : partitionDimEditorScreen?.y}
          value={editPartitionDimValue} onChange={setEditPartitionDimValue}
          onSubmit={submitPartitionDimensionToElement} onCancel={() => setEditingPartitionDimension(null)} />
      )}
      {dimensionPopup && (
        <DimensionPopup
          fromFace={dimensionPopup.fromRef.face ?? 'INSIDE'}
          toFace={dimensionPopup.toRef.face ?? 'INSIDE'}
          dimType={dimensionPopup.dimType}
          onDimTypeChange={(t) => setDimensionPopup(prev => prev ? { ...prev, dimType: t } : null)}
          value={dimensionPopup.value}
          onValueChange={(v) => setDimensionPopup(prev => prev ? { ...prev, value: v } : null)}
          hasExistingConstraint={constraints.some((c) =>
            (c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE' || c.type === 'LENGTH') &&
            c.pts.length >= 2 &&
            ((c.pts[0]!.roomId === dimensionPopup.fromRef.roomId &&
              c.pts[0]!.vertexIdx === dimensionPopup.fromRef.vertexIdx &&
              c.pts[1]!.roomId === dimensionPopup.toRef.roomId &&
              c.pts[1]!.vertexIdx === dimensionPopup.toRef.vertexIdx) ||
             (c.pts[0]!.roomId === dimensionPopup.toRef.roomId &&
              c.pts[0]!.vertexIdx === dimensionPopup.toRef.vertexIdx &&
              c.pts[1]!.roomId === dimensionPopup.fromRef.roomId &&
              c.pts[1]!.vertexIdx === dimensionPopup.fromRef.vertexIdx))
          )}
          onRelease={releaseDimensionPopup}
          onSubmit={submitDimensionPopup}
          onCancel={() => setDimensionPopup(null)}
        />
      )}

      <DrawingCanvas
        svgRef={svgRef} rooms={rooms} activeRoomId={activeRoomId}
        scale={scale} pan={pan} snapGrid={SNAP_GRID_MM}
        tool={tool} isPanning={isPanning} mousePos={mousePos}
        editingEdge={editingEdge} hoveredEdge={hoveredEdge}
        snapPreview={snapPreview} originPoint={originPoint}
        wallThickness={wallThickness}
        constraints={constraints} coincideSource={coincideSource}
        dofMap={dofMap} canCloseActiveRoom={canCloseActiveRoom}
        partitionOrigin={partitionOrigin} excludePoints={excludePoints}
        editingPartition={editingPartition}
        hoveredZoneEdge={hoveredZoneEdge} editingZoneEdge={editingZoneEdge}
        hoveredPartitionEdge={hoveredPartitionEdge}
        partitionDimLines={partitionDimLines}
        editingPartitionDimension={editingPartitionDimension}
        faceSnapHover={faceSnapHover}
        dimensionSource={dimensionSource}
        deleteHover={deleteHover}
        onPartitionDimensionPointerDown={handlePartitionDimensionPointerDown}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onEdgePointerDown={handleEdgePointerDown}
        onVertexPointerDown={handleVertexPointerDown}
        onConstraintRemove={(id) => { pushHistory(); removeConstraint(id); runSolver(); }}
        onDeletePartition={(roomId, partitionId) => { pushHistory(); removePartition(roomId, partitionId); }}
        onDeleteExcludedZone={(roomId, zoneId) => { pushHistory(); removeExcludedZone(roomId, zoneId); }}
        onPartitionLabelPointerDown={handlePartitionLabelPointerDown}
        onPartitionVertexPointerDown={handlePartitionVertexPointerDown}
        onZoneVertexPointerDown={handleZoneVertexPointerDown}
        onZoneEdgePointerDown={handleZoneEdgePointerDown}
        onDimensionClick={handleDimensionClick}
        onDimOffsetChange={handleDimOffsetChange}
        dimTypeSelection={dimTypeSelection}
        onDimTypeSelect={handleDimTypeSelect}
      />
      </div>
    </div>
  );
};
