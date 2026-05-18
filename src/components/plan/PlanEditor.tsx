'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '@/types/plan';
import type { Constraint, EdgeType, PointRef, Room } from '@/types/project';
import { distance, getPointOnSegment } from '@/engine/geometry/polygon';
import { SNAP_GRID_MM, CLOSING_TOLERANCE_MM, DOOR_DEFAULT_WIDTH_MM } from '@/constants/businessRules';
import { screenToWorld } from '@/utils/units';
import { generateId } from '@/utils/id';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { buildAndSolve, solveAndValidate } from '@/engine/constraints/solver';
import { analyzeDOF, ptKey } from '@/engine/constraints/dofAnalyzer';
import { PlanToolbar, type PlanTool } from './PlanToolbar';
import { DimensionEditor } from './DimensionEditor';
import { WallEdgeEditor } from './WallEdgeEditor';
import { RoomTabs } from './RoomTabs';
import {
  DrawingCanvas,
  type EditingEdgeState, type HoveredEdge, type SnapPreview,
  type HoveredZoneEdge, type EditingZoneEdge, type HoveredPartitionEdge,
  type PartitionDimLine,
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

// ── Component ──────────────────────────────────────────────────────────────

export const PlanEditor = ({ onNavigateBack }: { onNavigateBack?: () => void }) => {
  const rooms = useProjectStore((s) => selectActiveProject(s)?.rooms ?? []);
  const constraints = useProjectStore((s) => selectActiveProject(s)?.constraints ?? []);
  const wallThickness = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoom = useProjectStore((s) => s.addRoom);
  const removeRoom = useProjectStore((s) => s.removeRoom);
  const renameRoom = useProjectStore((s) => s.renameRoom);
  const addConstraint = useProjectStore((s) => s.addConstraint);
  const removeConstraint = useProjectStore((s) => s.removeConstraint);
  const updateConstraintValue = useProjectStore((s) => s.updateConstraintValue);
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

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => rooms[0]?.id ?? null);
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [tool, setTool] = useState<PlanTool>(() => (rooms[0]?.points.length ?? 0) >= 3 ? 'SELECT' : 'WALL');
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Dragging
  const [draggedVertex, setDraggedVertex] = useState<{ roomId: string; idx: number } | null>(null);
  const [draggedZoneVertex, setDraggedZoneVertex] = useState<{ parentRoomId: string; zoneId: string; idx: number } | null>(null);
  const [draggedPartitionVertex, setDraggedPartitionVertex] = useState<{ parentRoomId: string; partitionId: string; idx: number } | null>(null);

  // Editing
  const [editingEdge, setEditingEdge] = useState<EditingEdgeState | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingZoneEdge, setEditingZoneEdge] = useState<EditingZoneEdge | null>(null);
  const [editZoneEdgeValue, setEditZoneEdgeValue] = useState('');
  const [editingPartition, setEditingPartition] = useState<{ roomId: string; partitionId: string } | null>(null);
  const [editPartitionValue, setEditPartitionValue] = useState('');
  const [editingPartitionThickness, setEditingPartitionThickness] = useState<{ roomId: string; partitionId: string } | null>(null);
  const [editThicknessValue, setEditThicknessValue] = useState('');
  const [editingThicknessEdge, setEditingThicknessEdge] = useState<{ roomId: string; edgeIndex: number } | null>(null);
  const [editThicknessEdgeValue, setEditThicknessEdgeValue] = useState('');
  const [editingPartitionDimension, setEditingPartitionDimension] = useState<{ fromRef: PointRef; toRef: PointRef } | null>(null);
  const [editPartitionDimValue, setEditPartitionDimValue] = useState('');
  const [editingPartitionDimType, setEditingPartitionDimType] = useState<'H_DISTANCE' | 'V_DISTANCE'>('H_DISTANCE');
  const [editingEdgeConstraintType, setEditingEdgeConstraintType] = useState<'LENGTH' | 'H_DISTANCE' | 'V_DISTANCE'>('H_DISTANCE');
  const [editingEdgeThicknessValue, setEditingEdgeThicknessValue] = useState('');
  const [dimensionSource, setDimensionSource] = useState<{ roomId: string; idx: number } | null>(null);

  // Hover
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdge | null>(null);
  const [hoveredZoneEdge, setHoveredZoneEdge] = useState<HoveredZoneEdge | null>(null);
  const [hoveredPartitionEdge, setHoveredPartitionEdge] = useState<HoveredPartitionEdge | null>(null);

  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const [originPoint, setOriginPoint] = useState<Point | null>(null);
  const [coincideSource, setCoincideSource] = useState<{ roomId: string; idx: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [violationFlash, setViolationFlash] = useState(false);
  const [partitionOrigin, setPartitionOrigin] = useState<Point | null>(null);
  const [excludePoints, setExcludePoints] = useState<Point[]>([]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });
  const historyRef = useRef(history);
  const roomsRef = useRef(rooms);
  const constraintsRef = useRef(constraints);
  const violationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasViolatingDragRef = useRef(false);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { constraintsRef.current = constraints; }, [constraints]);

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
    setHistory((prev) => [{
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
    }, ...prev.slice(0, 49)]);
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
        setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
        setEditingPartitionThickness(null); setEditingThicknessEdge(null); setEditingPartitionDimension(null);
        setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
        setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (historyRef.current.length > 0) handleUndo();
        else if (onNavigateBack) onNavigateBack();
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
    if (editingThicknessEdge !== null) { setEditingThicknessEdge(null); return; }
    if (editingPartitionDimension !== null) { setEditingPartitionDimension(null); return; }
    if (draggedVertex !== null || draggedZoneVertex !== null || draggedPartitionVertex !== null) return;
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    // ── DIMENSION (vertex handlers handle the actual logic) ──
    if (tool === 'DIMENSION') return;

    // ── THICKNESS ──
    if (tool === 'THICKNESS') {
      const wallEdge = findNearestWallEdge(raw);
      if (wallEdge) {
        const room = rooms.find((r) => r.id === wallEdge.roomId); if (!room) return;
        const currentThickness = room.edgeThicknesses?.[wallEdge.edgeIndex] ?? wallThickness;
        setEditingThicknessEdge({ roomId: wallEdge.roomId, edgeIndex: wallEdge.edgeIndex });
        setEditThicknessEdgeValue((currentThickness / 10).toFixed(0));
        return;
      }
      const partEdge = findNearestPartitionEdge(raw);
      if (partEdge) {
        const part = rooms.find((r) => r.id === partEdge.roomId)?.partitions?.find((p) => p.id === partEdge.partitionId);
        if (!part) return;
        setEditingPartitionThickness({ roomId: partEdge.roomId, partitionId: partEdge.partitionId });
        setEditThicknessValue((part.thickness / 10).toFixed(0));
        return;
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

    if (e.button === 1 || tool === 'SELECT' || e.button === 2) { setIsPanning(true); return; }

    // ── WALL ──
    if (tool === 'WALL') {
      if (!activeRoom) return;
      const refPt = activeRoom.points[activeRoom.points.length - 1];
      const { point: snapped } = snapPos(raw, refPt);
      const pts = activeRoom.points;
      if (canCloseActiveRoom && distance(snapped, pts[0]!) < CLOSING_TOLERANCE_MM) { setTool('SELECT'); return; }
      pushHistory(); updateRoom(activeRoom.id, [...pts, snapped], [...activeRoom.edges, 'WALL']);
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

    if (tool === 'DOOR') setHoveredEdge(findNearestEdgeOfType(raw, 'DOOR') ?? findNearestWallEdge(raw));
    else if (tool === 'APPLY_H' || tool === 'APPLY_V') {
      setHoveredEdge(findNearestWallEdge(raw));
      setHoveredZoneEdge(findNearestZoneEdge(raw));
      setHoveredPartitionEdge(findNearestPartitionEdge(raw));
    } else if (tool === 'THICKNESS') {
      setHoveredEdge(findNearestWallEdge(raw));
      setHoveredPartitionEdge(findNearestPartitionEdge(raw));
      setHoveredZoneEdge(null);
    } else {
      setHoveredEdge(null); setHoveredZoneEdge(null); setHoveredPartitionEdge(null);
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

  const handleEdgePointerDown = (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool !== 'SELECT') return;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) { setEditingEdge({ roomId, edgeIndex }); setEditValue((dist / 10).toFixed(1)); return; }
    const n = room.points.length;
    const a = edgeIndex, b = (edgeIndex + 1) % n;
    const ec = constraints.filter((c) => {
      if (c.pts.length < 2) return false;
      const [p0, p1] = [c.pts[0]!, c.pts[1]!];
      if (p0.roomId !== roomId || p1.roomId !== roomId) return false;
      return (p0.vertexIdx === a && p1.vertexIdx === b) || (p0.vertexIdx === b && p1.vertexIdx === a);
    });
    const hDist = ec.find((c) => c.type === 'H_DISTANCE');
    const vDist = ec.find((c) => c.type === 'V_DISTANCE');
    const lenC = ec.find((c) => c.type === 'LENGTH');
    let cType: 'LENGTH' | 'H_DISTANCE' | 'V_DISTANCE' = 'H_DISTANCE';
    let value = dist;
    if (hDist && typeof hDist.value === 'number') { cType = 'H_DISTANCE'; value = hDist.value; }
    else if (vDist && typeof vDist.value === 'number') { cType = 'V_DISTANCE'; value = vDist.value; }
    else if (lenC && typeof lenC.value === 'number') { cType = 'LENGTH'; value = lenC.value; }
    else {
      const p1 = room.points[edgeIndex], p2 = room.points[(edgeIndex + 1) % n];
      if (p1 && p2) {
        cType = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y) ? 'H_DISTANCE' : 'V_DISTANCE';
        value = cType === 'H_DISTANCE' ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y);
      }
    }
    setEditingEdgeConstraintType(cType);
    setEditingEdge({ roomId, edgeIndex });
    setEditValue((value / 10).toFixed(1));
    const currentThickness = room.edgeThicknesses?.[edgeIndex] ?? wallThickness;
    setEditingEdgeThicknessValue((currentThickness / 10).toFixed(0));
  };

  const handleVertexPointerDown = (roomId: string, index: number) => (e: ReactPointerEvent) => {
    if (tool === 'THICKNESS') return; // let click propagate to handlePointerDown
    e.stopPropagation();
    if (tool === 'DIMENSION') {
      if (!dimensionSource) { setDimensionSource({ roomId, idx: index }); return; }
      if (dimensionSource.roomId === roomId && dimensionSource.idx === index) { setDimensionSource(null); return; }
      const fromRef = ref(dimensionSource.roomId, dimensionSource.idx);
      const toRef = ref(roomId, index);
      const fromPt = resolveRef(rooms, fromRef);
      const toPt = rooms.find((r) => r.id === roomId)?.points[index];
      if (!fromPt || !toPt) { setDimensionSource(null); return; }
      const absDx = Math.abs(toPt.x - fromPt.x), absDy = Math.abs(toPt.y - fromPt.y);
      const dimType: 'H_DISTANCE' | 'V_DISTANCE' = absDx >= absDy ? 'H_DISTANCE' : 'V_DISTANCE';
      setEditingPartitionDimType(dimType);
      setEditingPartitionDimension({ fromRef, toRef });
      setEditPartitionDimValue(((dimType === 'H_DISTANCE' ? absDx : absDy) / 10).toFixed(1));
      setDimensionSource(null); return;
    }
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
    if (tool === 'THICKNESS') return;
    e.stopPropagation();
    if (tool === 'DIMENSION') {
      if (!dimensionSource) { setDimensionSource({ roomId: partitionId, idx }); return; }
      if (dimensionSource.roomId === partitionId && dimensionSource.idx === idx) { setDimensionSource(null); return; }
      const fromRef = ref(dimensionSource.roomId, dimensionSource.idx);
      const toRef = ref(partitionId, idx);
      const fromPt = resolveRef(rooms, fromRef);
      const part = rooms.find((r) => r.id === parentRoomId)?.partitions?.find((p) => p.id === partitionId);
      const toPt = part ? (idx === 0 ? part.p1 : part.p2) : undefined;
      if (!fromPt || !toPt) { setDimensionSource(null); return; }
      const absDx = Math.abs(toPt.x - fromPt.x), absDy = Math.abs(toPt.y - fromPt.y);
      const dimType: 'H_DISTANCE' | 'V_DISTANCE' = absDx >= absDy ? 'H_DISTANCE' : 'V_DISTANCE';
      setEditingPartitionDimType(dimType);
      setEditingPartitionDimension({ fromRef, toRef });
      setEditPartitionDimValue(((dimType === 'H_DISTANCE' ? absDx : absDy) / 10).toFixed(1));
      setDimensionSource(null); return;
    }
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
    if (tool === 'THICKNESS') return;
    e.stopPropagation();
    if (tool === 'DIMENSION') {
      if (!dimensionSource) { setDimensionSource({ roomId: zoneId, idx }); return; }
      if (dimensionSource.roomId === zoneId && dimensionSource.idx === idx) { setDimensionSource(null); return; }
      const fromRef = ref(dimensionSource.roomId, dimensionSource.idx);
      const toRef = ref(zoneId, idx);
      const fromPt = resolveRef(rooms, fromRef);
      const zone = rooms.find((r) => r.id === parentRoomId)?.excludedZones?.find((z) => z.id === zoneId);
      const toPt = zone?.points[idx];
      if (!fromPt || !toPt) { setDimensionSource(null); return; }
      const absDx = Math.abs(toPt.x - fromPt.x), absDy = Math.abs(toPt.y - fromPt.y);
      const dimType: 'H_DISTANCE' | 'V_DISTANCE' = absDx >= absDy ? 'H_DISTANCE' : 'V_DISTANCE';
      setEditingPartitionDimType(dimType);
      setEditingPartitionDimension({ fromRef, toRef });
      setEditPartitionDimValue(((dimType === 'H_DISTANCE' ? absDx : absDy) / 10).toFixed(1));
      setDimensionSource(null); return;
    }
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

  /** Remove all dimension constraints (LENGTH/H_DISTANCE/V_DISTANCE) on a given edge. */
  const edgeDimConstraintIds = (roomId: string, eIdx: number, n: number): string[] => {
    const a = eIdx, b = (eIdx + 1) % n;
    return constraints
      .filter((c) => {
        if (c.type !== 'LENGTH' && c.type !== 'H_DISTANCE' && c.type !== 'V_DISTANCE') return false;
        if (c.pts.length < 2) return false;
        const [p0, p1] = [c.pts[0]!, c.pts[1]!];
        if (p0.roomId !== roomId || p1.roomId !== roomId) return false;
        return (p0.vertexIdx === a && p1.vertexIdx === b) || (p0.vertexIdx === b && p1.vertexIdx === a);
      })
      .map((c) => c.id);
  };

  const releaseEdgeDimension = () => {
    if (!editingEdge) return;
    const room = rooms.find((r) => r.id === editingEdge.roomId); if (!room) return;
    const ids = edgeDimConstraintIds(editingEdge.roomId, editingEdge.edgeIndex, room.points.length);
    if (ids.length === 0) { setEditingEdge(null); return; }
    const newCs = constraints.filter((c) => !ids.includes(c.id));
    pushHistory();
    ids.forEach((id) => removeConstraint(id));
    runSolver(null, undefined, newCs);
    setEditingEdge(null);
  };

  const submitDimension = () => {
    if (!editingEdge) return;
    const valCm = parseFloat(editValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingEdge(null); return; }
    const room = rooms.find((r) => r.id === editingEdge.roomId); if (!room) { setEditingEdge(null); return; }
    const n = room.points.length, eIdx = editingEdge.edgeIndex;
    const p1Ref = ref(room.id, eIdx), p2Ref = ref(room.id, (eIdx + 1) % n);
    const valueMm = valCm * 10;
    const cType = editingEdgeConstraintType;
    // Remove all existing dimension constraints on this edge (any type) before adding the new one.
    const oldIds = edgeDimConstraintIds(editingEdge.roomId, eIdx, n);
    const csWithoutOld = constraints.filter((c) => !oldIds.includes(c.id));
    const newId = generateId();
    const newCs = [...csWithoutOld, { id: newId, type: cType as Constraint['type'], pts: [p1Ref, p2Ref], value: valueMm }];
    if (!validateAndSolve(newCs)) { flashViolation(); setEditingEdge(null); return; }
    pushHistory();
    oldIds.forEach((id) => removeConstraint(id));
    addConstraint({ id: newId, type: cType as Constraint['type'], pts: [p1Ref, p2Ref], value: valueMm });
    // Update edge thickness if changed
    const thickCm = parseFloat(editingEdgeThicknessValue);
    if (!isNaN(thickCm) && thickCm > 0) {
      const thickMm = thickCm * 10;
      const currentThick = room.edgeThicknesses?.[eIdx] ?? wallThickness;
      if (Math.abs(thickMm - currentThick) > 0.5) setEdgeThickness(editingEdge.roomId, eIdx, thickMm);
    }
    setEditingEdge(null);
  };

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

  const submitThicknessEdge = () => {
    if (!editingThicknessEdge) return;
    const valCm = parseFloat(editThicknessEdgeValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingThicknessEdge(null); return; }
    pushHistory();
    setEdgeThickness(editingThicknessEdge.roomId, editingThicknessEdge.edgeIndex, valCm * 10);
    setEditingThicknessEdge(null);
  };

  const submitPartitionDimensionToElement = () => {
    if (!editingPartitionDimension) return;
    const valCm = parseFloat(editPartitionDimValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingPartitionDimension(null); return; }
    const { fromRef, toRef } = editingPartitionDimension;
    const valueMm = valCm * 10;
    const existing = constraints.find((c) =>
      (c.type === 'LENGTH' || c.type === 'H_DISTANCE' || c.type === 'V_DISTANCE') &&
      c.pts.length >= 2 &&
      ((c.pts[0]!.roomId === fromRef.roomId && c.pts[0]!.vertexIdx === fromRef.vertexIdx && c.pts[1]!.roomId === toRef.roomId && c.pts[1]!.vertexIdx === toRef.vertexIdx) ||
       (c.pts[0]!.roomId === toRef.roomId && c.pts[0]!.vertexIdx === toRef.vertexIdx && c.pts[1]!.roomId === fromRef.roomId && c.pts[1]!.vertexIdx === fromRef.vertexIdx))
    );
    const cType = existing?.type ?? editingPartitionDimType;
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
    setHistory((prev) => {
      if (!prev.length) return prev;
      const [entry, ...rest] = prev;
      restoreSnapshot(entry!.rooms, entry!.constraints);
      return rest;
    });
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

  const handleAddRoom = () => { const id = addRoom(); setActiveRoomId(id); setTool('WALL'); };
  const handleRemoveRoom = (roomId: string) => {
    removeRoom(roomId);
    if (activeRoomId === roomId) setActiveRoomId(rooms.find((r) => r.id !== roomId)?.id ?? null);
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

  let thicknessEdgeEditorScreen: { x: number; y: number } | undefined;
  if (editingThicknessEdge) {
    const room = rooms.find((r) => r.id === editingThicknessEdge.roomId);
    if (room) {
      const p1 = room.points[editingThicknessEdge.edgeIndex];
      const p2 = room.points[(editingThicknessEdge.edgeIndex + 1) % room.points.length];
      if (p1 && p2) thicknessEdgeEditorScreen = { x: ((p1.x + p2.x) / 2) * scale + pan.x, y: ((p1.y + p2.y) / 2) * scale + pan.y };
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
    <div className="relative flex flex-1 overflow-hidden" style={{ background: 'var(--canvas-bg)' }}>
      {violationFlash && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950/90 px-4 py-2 text-sm font-medium text-red-300 shadow-xl backdrop-blur-sm">
          Contrainte impossible à satisfaire
        </div>
      )}

      <PlanToolbar
        tool={tool} canUndo={history.length > 0}
        onChangeTool={(t) => { setTool(t); setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]); setEditingThicknessEdge(null); setEditingPartitionDimension(null); }}
        onUndo={handleUndo} onClearRoom={handleClearRoom}
      />

      <RoomTabs rooms={rooms} activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId} onAddRoom={handleAddRoom}
        onRemoveRoom={handleRemoveRoom} onRenameRoom={renameRoom} />

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
        style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}>
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>Raccourcis</p>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5" style={{ color: 'var(--text2)' }}>
          <span>Fermer la forme</span><span className="text-right font-semibold text-orange-500/80">↵ Entrée</span>
          <span>Orthogonalité</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>⇧ Maj</kbd>
          <span>Sans aimantation</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl</kbd>
          <span>Annuler</span><kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Z</kbd>
          <span>Cote / H / V</span><span className="text-right font-semibold text-orange-500/80">Clic mur/cloison/zone</span>
          <span>Ancrer nœud</span><span className="text-right font-semibold text-violet-500/80">Outil 📌</span>
          <span>Suppr. cloison/zone</span><span className="text-right font-semibold" style={{ color: 'var(--muted)' }}>Clic dessus</span>
        </div>
      </div>

      {editingEdge !== null && (() => {
        const room = rooms.find((r) => r.id === editingEdge.roomId);
        const n = room?.points.length ?? 0;
        const hasExisting = n > 0 && edgeDimConstraintIds(editingEdge.roomId, editingEdge.edgeIndex, n).length > 0;
        // Show popup above unless too close to top (popup ~170px tall + 48px header)
        const above = editorScreen === undefined || editorScreen.y > 220;
        const handleConstraintTypeChange = (t: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH') => {
          setEditingEdgeConstraintType(t);
          if (room) {
            const p1 = room.points[editingEdge.edgeIndex];
            const p2 = room.points[(editingEdge.edgeIndex + 1) % n];
            if (p1 && p2) {
              const newVal = t === 'H_DISTANCE' ? Math.abs(p2.x - p1.x)
                : t === 'V_DISTANCE' ? Math.abs(p2.y - p1.y)
                : distance(p1, p2);
              setEditValue((newVal / 10).toFixed(1));
            }
          }
        };
        return (
          <WallEdgeEditor
            screenX={editorScreen?.x} screenY={editorScreen?.y}
            above={above}
            dimValue={editValue} onDimChange={setEditValue}
            constraintType={editingEdgeConstraintType} onConstraintTypeChange={handleConstraintTypeChange}
            thicknessValue={editingEdgeThicknessValue} onThicknessChange={setEditingEdgeThicknessValue}
            hasExistingConstraint={hasExisting}
            onRelease={releaseEdgeDimension}
            onSubmit={submitDimension} onCancel={() => setEditingEdge(null)} />
        );
      })()}
      {editingZoneEdge !== null && (
        <DimensionEditor screenX={zoneEditorScreen?.x} screenY={zoneEditorScreen?.y}
          value={editZoneEdgeValue} onChange={setEditZoneEdgeValue}
          onSubmit={submitZoneEdgeDimension} onCancel={() => setEditingZoneEdge(null)} />
      )}
      {editingPartition !== null && (
        <DimensionEditor screenX={partitionEditorScreen?.x} screenY={partitionEditorScreen?.y}
          value={editPartitionValue} onChange={setEditPartitionValue}
          onSubmit={submitPartitionDimension} onCancel={() => setEditingPartition(null)} />
      )}
      {editingPartitionThickness !== null && (
        <DimensionEditor screenX={partitionThicknessEditorScreen?.x} screenY={partitionThicknessEditorScreen?.y}
          value={editThicknessValue} onChange={setEditThicknessValue}
          onSubmit={submitPartitionThickness} onCancel={() => setEditingPartitionThickness(null)} />
      )}
      {editingThicknessEdge !== null && (
        <DimensionEditor screenX={thicknessEdgeEditorScreen?.x} screenY={thicknessEdgeEditorScreen?.y}
          value={editThicknessEdgeValue} onChange={setEditThicknessEdgeValue}
          onSubmit={submitThicknessEdge} onCancel={() => setEditingThicknessEdge(null)} />
      )}
      {editingPartitionDimension !== null && (
        <DimensionEditor screenX={partitionDimEditorScreen?.x} screenY={partitionDimEditorScreen?.y}
          value={editPartitionDimValue} onChange={setEditPartitionDimValue}
          onSubmit={submitPartitionDimensionToElement} onCancel={() => setEditingPartitionDimension(null)} />
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
        dimensionSource={dimensionSource}
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
      />
    </div>
  );
};
