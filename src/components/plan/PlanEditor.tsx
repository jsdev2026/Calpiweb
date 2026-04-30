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
import { RoomTabs } from './RoomTabs';
import { DrawingCanvas, type EditingEdgeState, type HoveredEdge, type SnapPreview } from './DrawingCanvas';

// ── History ────────────────────────────────────────────────────────────────

interface HistoryEntry { rooms: Room[]; constraints: Constraint[]; }

// ── Pure geometry helpers ──────────────────────────────────────────────────

function deepCloneRooms(rooms: Room[]): Room[] {
  return rooms.map((r) => ({ ...r, points: r.points.map((p) => ({ ...p })), edges: [...r.edges] }));
}

function removeDoorFromRoom(room: Room, doorEdgeIdx: number): { points: Point[]; edges: EdgeType[] } | null {
  const pts = room.points;
  const edges = room.edges;
  const n = pts.length;
  if (n < 5 || edges[doorEdgeIdx] !== 'DOOR') return null;
  const prevEdgeIdx = (doorEdgeIdx - 1 + n) % n;
  const nextEdgeIdx = (doorEdgeIdx + 1) % n;
  if (edges[prevEdgeIdx] !== 'WALL' || edges[nextEdgeIdx] !== 'WALL') return null;
  const keepSet = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => i !== doorEdgeIdx && i !== nextEdgeIdx));
  return {
    points: pts.filter((_, i) => keepSet.has(i)),
    edges: edges.filter((_, i) => keepSet.has(i)) as EdgeType[],
  };
}

function findCoincidentWallEdge(rooms: Room[], excludeRoomId: string, p1: Point, p2: Point, tol = 15) {
  for (const room of rooms) {
    if (room.id === excludeRoomId) continue;
    for (let i = 0; i < room.points.length; i++) {
      if ((room.edges[i] ?? 'WALL') !== 'WALL') continue;
      const q1 = room.points[i]!;
      const q2 = room.points[(i + 1) % room.points.length]!;
      if (distance(p1, q1) < tol && distance(p2, q2) < tol) return { roomId: room.id, edgeIdx: i, reversed: false };
      if (distance(p1, q2) < tol && distance(p2, q1) < tol) return { roomId: room.id, edgeIdx: i, reversed: true };
    }
  }
  return null;
}

function findCoincidentDoorEdge(rooms: Room[], excludeRoomId: string, dA: Point, dB: Point, tol = 15) {
  for (const room of rooms) {
    if (room.id === excludeRoomId) continue;
    for (let i = 0; i < room.points.length; i++) {
      if ((room.edges[i] ?? 'WALL') !== 'DOOR') continue;
      const q1 = room.points[i]!;
      const q2 = room.points[(i + 1) % room.points.length]!;
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
  const closedOthers = allRooms.filter((r) => r.id !== room.id && r.points.length >= 3);
  if (closedOthers.length === 0) return false;
  for (let i = 0; i < pts.length; i++) {
    if (findCoincidentWallEdge(closedOthers, '', pts[i]!, pts[(i + 1) % pts.length]!)) return true;
  }
  return false;
}

function ref(roomId: string, vertexIdx: number): PointRef { return { roomId, vertexIdx }; }

// ── Component ──────────────────────────────────────────────────────────────

export const PlanEditor = () => {
  const rooms = useProjectStore((s) => selectActiveProject(s)?.rooms ?? []);
  const constraints = useProjectStore((s) => selectActiveProject(s)?.constraints ?? []);
  const wallThickness = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoom = useProjectStore((s) => s.addRoom);
  const removeRoom = useProjectStore((s) => s.removeRoom);
  const renameRoom = useProjectStore((s) => s.renameRoom);
  const setWallThickness = useProjectStore((s) => s.setWallThickness);
  const addConstraint = useProjectStore((s) => s.addConstraint);
  const removeConstraint = useProjectStore((s) => s.removeConstraint);
  const updateConstraintValue = useProjectStore((s) => s.updateConstraintValue);
  const shiftConstraintIndices = useProjectStore((s) => s.shiftConstraintIndices);
  const restoreSnapshot = useProjectStore((s) => s.restoreSnapshot);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => rooms[0]?.id ?? null);
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [tool, setTool] = useState<PlanTool>(() => (rooms[0]?.points.length ?? 0) >= 3 ? 'SELECT' : 'WALL');
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [draggedVertex, setDraggedVertex] = useState<{ roomId: string; idx: number } | null>(null);
  const [editingEdge, setEditingEdge] = useState<EditingEdgeState | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdge | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const [originPoint, setOriginPoint] = useState<Point | null>(null);
  const [coincideSource, setCoincideSource] = useState<{ roomId: string; idx: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [violationFlash, setViolationFlash] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const roomsRef = useRef(rooms);
  const constraintsRef = useRef(constraints);
  const violationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasViolatingDragRef = useRef(false);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);
  useEffect(() => { constraintsRef.current = constraints; }, [constraints]);

  // ── DOF ─────────────────────────────────────────────────────────────────

  const dofMap = analyzeDOF(rooms, constraints);

  // ── History ──────────────────────────────────────────────────────────────

  const pushHistory = useCallback(() => {
    setHistory((prev) => [{
      rooms: deepCloneRooms(roomsRef.current),
      constraints: [...constraintsRef.current],
    }, ...prev.slice(0, 49)]);
  }, []);

  // ── Solver helpers ────────────────────────────────────────────────────────

  const runSolver = useCallback((fixKey: string | null = null, overrideRooms?: Room[], cs?: Constraint[]) => {
    const baseRooms = overrideRooms ?? roomsRef.current;
    const solved = buildAndSolve(baseRooms, cs ?? constraintsRef.current, fixKey);
    for (const [roomId, newPts] of solved.entries()) {
      const room = baseRooms.find((r) => r.id === roomId);
      if (room) updateRoom(roomId, newPts, room.edges);
    }
  }, [updateRoom]);

  /**
   * Simulate-then-check: solves with the given constraint list, measures residuals.
   * If all constraints are satisfied → commits solved positions and returns true.
   * If any constraint is violated → leaves store untouched and returns false.
   */
  const validateAndSolve = useCallback((
    cs: Constraint[],
    fixKey: string | null = null,
    overrideRooms?: Room[],
  ): boolean => {
    const baseRooms = overrideRooms ?? roomsRef.current;
    const { points, violatedIds } = solveAndValidate(baseRooms, cs, fixKey);
    if (violatedIds.length > 0) return false;
    for (const [roomId, newPts] of points.entries()) {
      const room = baseRooms.find((r) => r.id === roomId);
      if (room) updateRoom(roomId, newPts, room.edges);
    }
    return true;
  }, [updateRoom]);

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
      if (e.key === 'Enter' && tool === 'WALL') setTool('SELECT');
      if (e.key === 'Escape') { setEditingEdge(null); setDraggedVertex(null); setCoincideSource(null); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); handleUndo(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(false);
      if (e.key === 'Control') setIsCtrlPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

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
      for (const room of rooms) {
        for (const p of room.points) {
          if (distance(raw, p) < 30 / scale)
            return { point: { x: p.x, y: p.y }, preview: { point: { x: p.x, y: p.y }, type: 'vertex' } };
        }
      }
      for (const room of rooms) {
        if (room.points.length < 3) continue;
        for (let i = 0; i < room.points.length; i++) {
          const a = room.points[i]!, b = room.points[(i + 1) % room.points.length]!;
          const proj = getPointOnSegment(raw, a, b);
          if (distance(raw, proj) < 18 / scale)
            return { point: { x: proj.x, y: proj.y }, preview: { point: { x: proj.x, y: proj.y }, type: 'edge' } };
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

  // ── Constraint helpers ────────────────────────────────────────────────────

  /** Find an existing constraint of a given type that exactly covers two vertex refs. */
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

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (editingEdge !== null) { setEditingEdge(null); return; }
    if (draggedVertex !== null) return;
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    // ── APPLY_H / APPLY_V ──
    if (tool === 'APPLY_H' || tool === 'APPLY_V') {
      const edge = findNearestWallEdge(raw);
      if (!edge) return;
      const room = rooms.find((r) => r.id === edge.roomId);
      if (!room || room.points.length < 2) return;
      const n = room.points.length;
      const p1Ref = ref(room.id, edge.edgeIndex);
      const p2Ref = ref(room.id, (edge.edgeIndex + 1) % n);
      const type = tool === 'APPLY_H' ? 'HORIZONTAL' : 'VERTICAL';
      const existing = findConstraint(type, p1Ref, p2Ref);
      if (existing) {
        // Removing a constraint is always safe
        const newCs = constraints.filter((c) => c.id !== existing.id);
        pushHistory();
        removeConstraint(existing.id);
        runSolver(null, undefined, newCs);
      } else {
        const newC: Constraint = { id: generateId(), type, pts: [p1Ref, p2Ref] };
        if (!validateAndSolve([...constraints, newC])) { flashViolation(); return; }
        pushHistory();
        addConstraint(newC);
      }
      return;
    }

    // ── COINCIDE: canvas click → edge coincidence ──
    if (tool === 'COINCIDE' && coincideSource) {
      const edge = findNearestWallEdge(raw);
      if (edge) {
        const tgtRoom = rooms.find((r) => r.id === edge.roomId);
        if (tgtRoom) {
          const n = tgtRoom.points.length;
          const srcRef = ref(coincideSource.roomId, coincideSource.idx);
          const lp1 = tgtRoom.points[edge.edgeIndex]!;
          const lp2 = tgtRoom.points[(edge.edgeIndex + 1) % n]!;
          const proj = getPointOnSegment(snapPos(raw).point, lp1, lp2);
          // Snap source vertex to projection, then constrain
          const srcRoom = rooms.find((r) => r.id === coincideSource.roomId);
          if (srcRoom) {
            const newC: Constraint = {
              id: generateId(), type: 'POINT_ON_LINE',
              pts: [srcRef, ref(tgtRoom.id, edge.edgeIndex), ref(tgtRoom.id, (edge.edgeIndex + 1) % n)],
            };
            const snappedRooms = rooms.map((r) => {
              if (r.id !== srcRoom.id) return r;
              const pts = [...srcRoom.points];
              pts[coincideSource.idx] = { x: proj.x, y: proj.y };
              return { ...r, points: pts };
            });
            if (!validateAndSolve([...constraints, newC], null, snappedRooms)) {
              flashViolation(); setCoincideSource(null); return;
            }
            pushHistory();
            addConstraint(newC);
          }
        }
      }
      setCoincideSource(null);
      return;
    }

    if (tool === 'COINCIDE') return; // waiting for first vertex click

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
            pushHistory();
            // Shift constraints before updating room (removes dA and dB vertices)
            shiftConstraintIndices(tgtRoom.id, nearDoor.edgeIndex, -2);
            updateRoom(tgtRoom.id, result.points, result.edges);
            const coinc = findCoincidentDoorEdge(rooms, tgtRoom.id, dA, dB);
            if (coinc) {
              const otherRoom = rooms.find((r) => r.id === coinc.roomId);
              if (otherRoom) {
                shiftConstraintIndices(otherRoom.id, coinc.edgeIdx, -2);
                const or = removeDoorFromRoom(otherRoom, coinc.edgeIdx);
                if (or) updateRoom(otherRoom.id, or.points, or.edges);
              }
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
      pushHistory();
      // Shift constraints to account for 2 inserted vertices
      shiftConstraintIndices(tgtRoom.id, i, 2);
      updateRoom(tgtRoom.id, [...pts.slice(0, i + 1), dA, dB, ...pts.slice(i + 1)],
        [...edges.slice(0, i), 'WALL', 'DOOR', 'WALL', ...edges.slice(i + 1)] as EdgeType[]);
      const coinc = findCoincidentWallEdge(rooms, tgtRoom.id, p1, p2);
      if (coinc) {
        const otherRoom = rooms.find((r) => r.id === coinc.roomId);
        if (otherRoom) {
          const j = coinc.edgeIdx;
          const [first, second] = coinc.reversed ? [dB, dA] : [dA, dB];
          shiftConstraintIndices(otherRoom.id, j, 2);
          updateRoom(otherRoom.id, [...otherRoom.points.slice(0, j + 1), first, second, ...otherRoom.points.slice(j + 1)],
            [...otherRoom.edges.slice(0, j), 'WALL', 'DOOR', 'WALL', ...otherRoom.edges.slice(j + 1)] as EdgeType[]);
        }
      }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (draggedVertex !== null) {
      const { roomId, idx } = draggedVertex;
      const room = roomsRef.current.find((r) => r.id === roomId);
      if (!room) return;
      const { point: snapped, preview } = snapPos(raw);
      setSnapPreview(preview);
      const modifiedRooms = roomsRef.current.map((r) => {
        if (r.id !== roomId) return r;
        const pts = [...r.points];
        pts[idx] = snapped;
        return { ...r, points: pts };
      });
      const valid = validateAndSolve(constraintsRef.current, ptKey(roomId, idx), modifiedRooms);
      if (!valid) {
        if (!wasViolatingDragRef.current) { flashViolation(); wasViolatingDragRef.current = true; }
      } else {
        wasViolatingDragRef.current = false;
      }
      return;
    }

    if (isPanning) { setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY }); return; }

    const refPt = tool === 'WALL' && activeRoom ? activeRoom.points[activeRoom.points.length - 1] : undefined;
    const { point: snapped, preview } = snapPos(raw, refPt);
    setMousePos(snapped);
    setSnapPreview(preview);

    if (tool === 'DOOR') setHoveredEdge(findNearestEdgeOfType(raw, 'DOOR') ?? findNearestWallEdge(raw));
    else if (tool === 'APPLY_H' || tool === 'APPLY_V') setHoveredEdge(findNearestWallEdge(raw));
    else setHoveredEdge(null);
  };

  const handlePointerUp = () => {
    if (draggedVertex !== null) {
      wasViolatingDragRef.current = false;
      runSolver(null);
    }
    setDraggedVertex(null);
    setIsPanning(false);
  };

  const handleEdgePointerDown = (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (tool !== 'SELECT') return;
    setEditingEdge({ roomId, edgeIndex });
    setEditValue((dist / 10).toFixed(1));
  };

  const handleVertexPointerDown = (roomId: string, index: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();

    // ── ANCHOR tool: toggle FIX constraint ──
    if (tool === 'ANCHOR') {
      const room = rooms.find((r) => r.id === roomId);
      if (!room) return;
      const p = room.points[index]!;
      const existing = findConstraint('FIX', ref(roomId, index));
      pushHistory();
      if (existing) {
        removeConstraint(existing.id);
        runSolver();
      } else {
        addConstraint({ id: generateId(), type: 'FIX', pts: [ref(roomId, index)], value: { x: p.x, y: p.y } });
      }
      return;
    }

    // ── COINCIDE tool ──
    if (tool === 'COINCIDE') {
      if (!coincideSource) {
        // First click: select source (or remove existing coincidences)
        const existing = constraints.filter(
          (c) => (c.type === 'COINCIDENT' || c.type === 'POINT_ON_LINE') &&
            c.pts[0]?.roomId === roomId && c.pts[0]?.vertexIdx === index,
        );
        if (existing.length > 0) {
          pushHistory();
          existing.forEach((c) => removeConstraint(c.id));
          runSolver();
        } else {
          setCoincideSource({ roomId, idx: index });
        }
        return;
      }
      // Cancel if same vertex
      if (coincideSource.roomId === roomId && coincideSource.idx === index) { setCoincideSource(null); return; }
      // Second click: add COINCIDENT constraint
      const srcRoom = rooms.find((r) => r.id === coincideSource.roomId);
      const tgtRoom = rooms.find((r) => r.id === roomId);
      if (!srcRoom || !tgtRoom) { setCoincideSource(null); return; }
      const tgtPt = tgtRoom.points[index];
      if (!tgtPt) { setCoincideSource(null); return; }
      const newC: Constraint = { id: generateId(), type: 'COINCIDENT', pts: [ref(coincideSource.roomId, coincideSource.idx), ref(roomId, index)] };
      const snappedRooms = rooms.map((r) => {
        if (r.id !== srcRoom.id) return r;
        const pts = [...srcRoom.points];
        pts[coincideSource.idx] = { ...tgtPt };
        return { ...r, points: pts };
      });
      if (!validateAndSolve([...constraints, newC], null, snappedRooms)) {
        flashViolation(); setCoincideSource(null); return;
      }
      pushHistory();
      addConstraint(newC);
      setCoincideSource(null);
      return;
    }

    // ── Alt-click: toggle origin marker ──
    if (e.altKey) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        const pt = room.points[index]!;
        setOriginPoint((prev) => prev && Math.abs(prev.x - pt.x) < 1 && Math.abs(prev.y - pt.y) < 1 ? null : pt);
      }
      return;
    }

    // ── WALL: close polygon ──
    if (tool === 'WALL') {
      const room = rooms.find((r) => r.id === roomId);
      if (room && index === 0 && canCloseRoom(room, rooms)) { setTool('SELECT'); return; }
    }

    // ── SELECT: start drag (blocked if fully constrained) ──
    if (tool === 'SELECT') {
      const dof = dofMap.get(ptKey(roomId, index));
      if (dof?.isFullyConstrained) return; // spec §4: drag blocked
      pushHistory();
      setDraggedVertex({ roomId, idx: index });
    }
  };

  // ── Dimension editor: adds / updates LENGTH constraint ────────────────────

  const submitDimension = () => {
    if (!editingEdge) return;
    const valCm = parseFloat(editValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingEdge(null); return; }
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (!room) { setEditingEdge(null); return; }
    const n = room.points.length;
    const eIdx = editingEdge.edgeIndex;
    const p1Ref = ref(room.id, eIdx);
    const p2Ref = ref(room.id, (eIdx + 1) % n);
    const lengthMm = valCm * 10;
    const existing = findConstraint('LENGTH', p1Ref, p2Ref);
    const newId = existing?.id ?? generateId();
    const newCs = existing
      ? constraints.map((c) => c.id === existing.id ? { ...c, value: lengthMm } : c)
      : [...constraints, { id: newId, type: 'LENGTH' as const, pts: [p1Ref, p2Ref], value: lengthMm }];
    if (!validateAndSolve(newCs)) { flashViolation(); setEditingEdge(null); return; }
    pushHistory();
    if (existing) {
      updateConstraintValue(existing.id, lengthMm);
    } else {
      addConstraint({ id: newId, type: 'LENGTH', pts: [p1Ref, p2Ref], value: lengthMm });
    }
    setEditingEdge(null);
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
    // Remove all constraints that reference this room
    constraints.filter((c) => c.pts.some((r) => r.roomId === activeRoom.id)).forEach((c) => removeConstraint(c.id));
    updateRoom(activeRoom.id, [], []);
    setTool('WALL');
    setEditingEdge(null);
  };

  const handleAddRoom = () => { const id = addRoom(); setActiveRoomId(id); setTool('WALL'); };

  const handleRemoveRoom = (roomId: string) => {
    // Store.removeRoom already cleans up constraints referencing this room
    removeRoom(roomId);
    if (activeRoomId === roomId) setActiveRoomId(rooms.find((r) => r.id !== roomId)?.id ?? null);
  };

  // ── DimensionEditor screen position ──────────────────────────────────────

  let editorScreen: { x: number; y: number } | undefined;
  if (editingEdge) {
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (room) {
      const p1 = room.points[editingEdge.edgeIndex];
      const p2 = room.points[(editingEdge.edgeIndex + 1) % room.points.length];
      if (p1 && p2) editorScreen = { x: ((p1.x + p2.x) / 2) * scale + pan.x, y: ((p1.y + p2.y) / 2) * scale + pan.y };
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-zinc-950">
      {violationFlash && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-red-500/50 bg-red-950/90 px-4 py-2 text-sm font-medium text-red-300 shadow-xl backdrop-blur-sm">
          Contrainte impossible à satisfaire
        </div>
      )}

      <PlanToolbar
        tool={tool} canUndo={history.length > 0} wallThickness={wallThickness}
        onChangeTool={(t) => { setTool(t); setCoincideSource(null); }}
        onUndo={handleUndo} onClearRoom={handleClearRoom}
        onWallThicknessChange={setWallThickness}
      />

      <RoomTabs
        rooms={rooms} activeRoomId={activeRoomId}
        onSelectRoom={(id) => setActiveRoomId(id)}
        onAddRoom={handleAddRoom} onRemoveRoom={handleRemoveRoom}
        onRenameRoom={renameRoom}
      />

      {/* Shortcuts hint */}
      <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-xl border border-zinc-800/60 bg-zinc-900/70 px-4 py-3 text-[11px] shadow-xl backdrop-blur-md">
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Raccourcis</p>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5 text-zinc-500">
          <span>Fermer la forme</span><span className="text-right font-semibold text-orange-500/80">↵ Entrée</span>
          <span>Orthogonalité</span><kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">⇧ Maj</kbd>
          <span>Sans aimantation</span><kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">Ctrl</kbd>
          <span>Annuler</span><kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">Ctrl+Z</kbd>
          <span>Cote / H / V</span><span className="text-right font-semibold text-orange-500/80">Clic mur</span>
          <span>Ancrer nœud</span><span className="text-right font-semibold text-violet-500/80">Outil 📌</span>
        </div>
      </div>

      {editingEdge !== null && (
        <DimensionEditor
          screenX={editorScreen?.x} screenY={editorScreen?.y}
          value={editValue} onChange={setEditValue}
          onSubmit={submitDimension} onCancel={() => setEditingEdge(null)}
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
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onEdgePointerDown={handleEdgePointerDown}
        onVertexPointerDown={handleVertexPointerDown}
        onConstraintRemove={(id) => { pushHistory(); removeConstraint(id); runSolver(); }}
      />
    </div>
  );
};
