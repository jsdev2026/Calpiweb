'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '@/types/plan';
import type { EdgeType } from '@/types/project';
import { distance, getPointOnSegment } from '@/engine/geometry/polygon';
import { SNAP_GRID_MM, CLOSING_TOLERANCE_MM, DOOR_DEFAULT_WIDTH_MM } from '@/constants/businessRules';
import { screenToWorld } from '@/utils/units';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { PlanToolbar, type PlanTool } from './PlanToolbar';
import { DimensionEditor } from './DimensionEditor';
import { DrawingCanvas, type EditingEdgeState, type HoveredEdge, type SnapPreview } from './DrawingCanvas';

export const PlanEditor = () => {
  const rooms = useProjectStore((s) => selectActiveProject(s)?.rooms ?? []);
  const wallThickness = useProjectStore((s) => selectActiveProject(s)?.wallThickness ?? 100);
  const updateRoom = useProjectStore((s) => s.updateRoom);
  const addRoom = useProjectStore((s) => s.addRoom);
  const removeRoom = useProjectStore((s) => s.removeRoom);
  const renameRoom = useProjectStore((s) => s.renameRoom);
  const setWallThickness = useProjectStore((s) => s.setWallThickness);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => rooms[0]?.id ?? null);
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [tool, setTool] = useState<PlanTool>(() =>
    (rooms[0]?.points.length ?? 0) >= 3 ? 'SELECT' : 'WALL',
  );
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [draggedVertex, setDraggedVertex] = useState<{ roomId: string; idx: number } | null>(null);
  const [editingEdge, setEditingEdge] = useState<EditingEdgeState | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredEdge, setHoveredEdge] = useState<HoveredEdge | null>(null);
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);
  const [originPoint, setOriginPoint] = useState<Point | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!activeRoomId || !rooms.find((r) => r.id === activeRoomId)) {
      setActiveRoomId(rooms[0]?.id ?? null);
    }
  }, [rooms, activeRoomId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
      if (e.key === 'Control') setIsCtrlPressed(true);
      if (e.key === 'Enter' && tool === 'WALL') setTool('SELECT');
      if (e.key === 'Escape') { setEditingEdge(null); setDraggedVertex(null); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
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
  }, [tool, rooms, activeRoomId]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.15;
      const dir = e.deltaY > 0 ? -1 : 1;
      let newScale = scale * (dir > 0 ? zoomFactor : 1 / zoomFactor);
      newScale = Math.max(0.005, Math.min(newScale, 4));
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setScale(newScale);
      setPan({ x: mx - (mx - pan.x) * (newScale / scale), y: my - (my - pan.y) * (newScale / scale) });
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [scale, pan]);

  const toWorld = (sx: number, sy: number): Point => ({
    x: screenToWorld(sx, scale, pan.x),
    y: screenToWorld(sy, scale, pan.y),
  });

  const applyOrthogonality = (point: Point, ref: Point): Point => {
    const dx = Math.abs(point.x - ref.x);
    const dy = Math.abs(point.y - ref.y);
    if (isShiftPressed || dx < 60 || dy < 60) {
      return dx > dy ? { x: point.x, y: ref.y } : { x: ref.x, y: point.y };
    }
    return point;
  };

  // Returns snapped position and snap type, respecting Ctrl de-magnetization
  const snapPos = useCallback(
    (raw: Point, ref?: Point): { point: Point; preview: SnapPreview | null } => {
      if (!isCtrlPressed) {
        // 1. Snap to existing vertices
        for (const room of rooms) {
          for (const p of room.points) {
            if (distance(raw, p) < 30 / scale) {
              return { point: { x: p.x, y: p.y }, preview: { point: { x: p.x, y: p.y }, type: 'vertex' } };
            }
          }
        }
        // 2. Snap to closed room edges
        for (const room of rooms) {
          if (room.points.length < 3) continue;
          for (let i = 0; i < room.points.length; i++) {
            const a = room.points[i]!;
            const b = room.points[(i + 1) % room.points.length]!;
            const proj = getPointOnSegment(raw, a, b);
            if (distance(raw, proj) < 18 / scale) {
              const snapped = { x: proj.x, y: proj.y };
              return { point: snapped, preview: { point: snapped, type: 'edge' } };
            }
          }
        }
      }

      // 3. Grid snap
      const gridSnapped: Point = {
        x: Math.round(raw.x / SNAP_GRID_MM) * SNAP_GRID_MM,
        y: Math.round(raw.y / SNAP_GRID_MM) * SNAP_GRID_MM,
      };

      // 4. Orthogonality relative to previous point
      const snapped = ref ? applyOrthogonality(gridSnapped, ref) : gridSnapped;
      return { point: snapped, preview: null };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooms, scale, isCtrlPressed, isShiftPressed],
  );

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  const findNearestWallEdge = (worldPos: Point): HoveredEdge | null => {
    let best: HoveredEdge | null = null;
    let bestDist = 80 / scale;
    for (const room of rooms) {
      if (room.points.length < 2) continue;
      const isClosed = room.points.length >= 3;
      const limit = isClosed ? room.points.length : room.points.length - 1;
      for (let i = 0; i < limit; i++) {
        if ((room.edges[i] ?? 'WALL') !== 'WALL') continue;
        const a = room.points[i]!;
        const b = room.points[(i + 1) % room.points.length]!;
        const proj = getPointOnSegment(worldPos, a, b);
        const d = distance(worldPos, proj);
        if (d < bestDist) {
          bestDist = d;
          best = { roomId: room.id, edgeIndex: i, t: proj.t };
        }
      }
    }
    return best;
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (editingEdge !== null) { setEditingEdge(null); return; }
    if (draggedVertex !== null) return;

    if (e.button === 1 || tool === 'SELECT' || e.button === 2) {
      setIsPanning(true);
      return;
    }

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (tool === 'WALL') {
      if (!activeRoom) return;
      const ref = activeRoom.points[activeRoom.points.length - 1];
      const { point: snapped } = snapPos(raw, ref);
      const pts = activeRoom.points;

      if (pts.length >= 3 && distance(snapped, pts[0]!) < CLOSING_TOLERANCE_MM) {
        setTool('SELECT');
        return;
      }

      updateRoom(activeRoom.id, [...pts, snapped], [...activeRoom.edges, 'WALL']);
    }

    if (tool === 'DOOR') {
      const edge = hoveredEdge ?? findNearestWallEdge(raw);
      if (!edge) return;
      const targetRoom = rooms.find((r) => r.id === edge.roomId);
      if (!targetRoom || targetRoom.points.length < 2) return;

      const pts = targetRoom.points;
      const edges = targetRoom.edges;
      const i = edge.edgeIndex;
      const p1 = pts[i]!;
      const p2 = pts[(i + 1) % pts.length]!;
      const edgeLen = distance(p1, p2);
      const doorW = Math.min(DOOR_DEFAULT_WIDTH_MM, edgeLen * 0.9);
      const halfW = doorW / 2;
      const tCenter = Math.min(1 - halfW / edgeLen, Math.max(halfW / edgeLen, edge.t));
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const cd = tCenter * edgeLen;
      const dA: Point = { x: p1.x + cos * (cd - halfW), y: p1.y + sin * (cd - halfW) };
      const dB: Point = { x: p1.x + cos * (cd + halfW), y: p1.y + sin * (cd + halfW) };

      updateRoom(targetRoom.id, [...pts.slice(0, i + 1), dA, dB, ...pts.slice(i + 1)], [
        ...edges.slice(0, i), 'WALL', 'DOOR', 'WALL', ...edges.slice(i + 1),
      ] as EdgeType[]);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const raw = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (draggedVertex !== null) {
      const room = rooms.find((r) => r.id === draggedVertex.roomId);
      if (!room) return;
      const { point: snapped, preview } = snapPos(raw);
      setSnapPreview(preview);
      const newPoints = [...room.points];
      newPoints[draggedVertex.idx] = snapped;
      updateRoom(room.id, newPoints, room.edges);
      return;
    }

    if (isPanning) {
      setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
      return;
    }

    const ref = tool === 'WALL' && activeRoom ? activeRoom.points[activeRoom.points.length - 1] : undefined;
    const { point: snapped, preview } = snapPos(raw, ref);
    setMousePos(snapped);
    setSnapPreview(preview);

    if (tool === 'DOOR') setHoveredEdge(findNearestWallEdge(raw));
    else setHoveredEdge(null);
  };

  const handlePointerUp = () => { setIsPanning(false); setDraggedVertex(null); };

  const handleEdgePointerDown =
    (roomId: string, edgeIndex: number, dist: number) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      setEditingEdge({ roomId, edgeIndex });
      setEditValue((dist / 10).toFixed(1));
    };

  const handleVertexPointerDown = (roomId: string, index: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();

    // Alt+click → set as origin
    if (e.altKey) {
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        const pt = room.points[index]!;
        setOriginPoint((prev) =>
          prev && Math.abs(prev.x - pt.x) < 1 && Math.abs(prev.y - pt.y) < 1 ? null : pt,
        );
      }
      return;
    }

    if (tool === 'WALL') {
      const room = rooms.find((r) => r.id === roomId);
      if (room && index === 0 && room.points.length >= 3) { setTool('SELECT'); return; }
    }
    setDraggedVertex({ roomId, idx: index });
  };

  const submitDimension = () => {
    if (!editingEdge) return;
    const valCm = parseFloat(editValue);
    if (isNaN(valCm) || valCm <= 0) { setEditingEdge(null); return; }
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (!room) { setEditingEdge(null); return; }
    const pts = room.points;
    const p1 = pts[editingEdge.edgeIndex]!;
    const p2idx = (editingEdge.edgeIndex + 1) % pts.length;
    const p2 = pts[p2idx]!;
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const newPoints = [...pts];
    newPoints[p2idx] = { x: p1.x + Math.cos(ang) * valCm * 10, y: p1.y + Math.sin(ang) * valCm * 10 };
    updateRoom(room.id, newPoints, room.edges);
    setEditingEdge(null);
  };

  const handleAlignH = () => {
    if (!editingEdge) return;
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (!room) { setEditingEdge(null); return; }
    const pts = room.points;
    const p1 = pts[editingEdge.edgeIndex]!;
    const p2idx = (editingEdge.edgeIndex + 1) % pts.length;
    const newPoints = [...pts];
    newPoints[p2idx] = { x: newPoints[p2idx]!.x, y: p1.y };
    updateRoom(room.id, newPoints, room.edges);
    setEditingEdge(null);
  };

  const handleAlignV = () => {
    if (!editingEdge) return;
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (!room) { setEditingEdge(null); return; }
    const pts = room.points;
    const p1 = pts[editingEdge.edgeIndex]!;
    const p2idx = (editingEdge.edgeIndex + 1) % pts.length;
    const newPoints = [...pts];
    newPoints[p2idx] = { x: p1.x, y: newPoints[p2idx]!.y };
    updateRoom(room.id, newPoints, room.edges);
    setEditingEdge(null);
  };

  const handleUndo = () => {
    const room = rooms.find((r) => r.id === activeRoomId);
    if (!room || room.points.length === 0) return;
    updateRoom(room.id, room.points.slice(0, -1), room.edges.slice(0, -1));
  };

  const handleClearRoom = () => {
    if (!activeRoom) return;
    updateRoom(activeRoom.id, [], []);
    setTool('WALL');
    setEditingEdge(null);
  };

  const handleAddRoom = () => {
    const id = addRoom();
    setActiveRoomId(id);
    setTool('WALL');
  };

  const handleRemoveRoom = (roomId: string) => {
    removeRoom(roomId);
    if (activeRoomId === roomId) setActiveRoomId(rooms.find((r) => r.id !== roomId)?.id ?? null);
  };

  // Screen position of dimension editor (near the selected edge midpoint)
  let editorScreen: { x: number; y: number } | undefined;
  if (editingEdge !== null) {
    const room = rooms.find((r) => r.id === editingEdge.roomId);
    if (room) {
      const p1 = room.points[editingEdge.edgeIndex];
      const p2 = room.points[(editingEdge.edgeIndex + 1) % room.points.length];
      if (p1 && p2) {
        editorScreen = {
          x: ((p1.x + p2.x) / 2) * scale + pan.x,
          y: ((p1.y + p2.y) / 2) * scale + pan.y,
        };
      }
    }
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-zinc-950">
      <PlanToolbar
        tool={tool}
        canUndo={(activeRoom?.points.length ?? 0) > 0}
        rooms={rooms}
        activeRoomId={activeRoomId}
        wallThickness={wallThickness}
        onChangeTool={setTool}
        onUndo={handleUndo}
        onClearRoom={handleClearRoom}
        onAddRoom={handleAddRoom}
        onRemoveRoom={handleRemoveRoom}
        onSelectRoom={(id) => setActiveRoomId(id)}
        onRenameRoom={renameRoom}
        onWallThicknessChange={setWallThickness}
      />

      <div className="pointer-events-none absolute bottom-5 right-5 z-10 rounded-xl border border-zinc-800/60 bg-zinc-900/70 px-4 py-3 text-[11px] shadow-xl backdrop-blur-md">
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Raccourcis</p>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5 text-zinc-500">
          <span>Fermer la forme</span>
          <span className="text-right font-semibold text-orange-500/80">↵ Entrée</span>
          <span>Orthogonalité</span>
          <kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">⇧ Maj</kbd>
          <span>Sans aimantation</span>
          <kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">Ctrl</kbd>
          <span>Marquer origine</span>
          <kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">Alt+clic</kbd>
          <span>Annuler</span>
          <kbd className="justify-self-end rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">Ctrl+Z</kbd>
        </div>
      </div>

      {editingEdge !== null && (
        <DimensionEditor
          screenX={editorScreen?.x}
          screenY={editorScreen?.y}
          value={editValue}
          onChange={setEditValue}
          onSubmit={submitDimension}
          onCancel={() => setEditingEdge(null)}
          onAlignH={handleAlignH}
          onAlignV={handleAlignV}
        />
      )}

      <DrawingCanvas
        svgRef={svgRef}
        rooms={rooms}
        activeRoomId={activeRoomId}
        scale={scale}
        pan={pan}
        snapGrid={SNAP_GRID_MM}
        tool={tool}
        isPanning={isPanning}
        mousePos={mousePos}
        editingEdge={editingEdge}
        hoveredEdge={hoveredEdge}
        snapPreview={snapPreview}
        originPoint={originPoint}
        wallThickness={wallThickness}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onEdgePointerDown={handleEdgePointerDown}
        onVertexPointerDown={handleVertexPointerDown}
      />
    </div>
  );
};
