'use client';

import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Wall, WallNode, DrawingChain, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';
import { snapToWalls } from '@/engine/geometry/wallSnap';
import { computeCornerGeometry, computeJointLines } from '@/engine/geometry/wallGeometry';
import { generateId } from '@/utils/id';
import { WallEdgeEditor } from './WallEdgeEditor';

type PlanTool = 'WALL' | 'SELECT' | 'DELETE';

const DEFAULT_THICKNESS   = 20;
const ENDPOINT_RADIUS_PX  = 12;
const FACE_RADIUS_PX      = 8;
const HV_SNAP_PX          = 8;
const NODE_HANDLE_RADIUS_PX = 10;
const WALL_COLOR          = '#6b6056';
const WALL_SELECTED_COLOR = '#e67e22';
const SNAP_INDICATOR_R    = 8;

interface WallDrawingCanvasProps {
  walls: Wall[];
  nodes: WallNode[];
  tool: PlanTool;
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
  onAddNode: (node: WallNode) => void;
  onUpdateNode: (id: string, patch: { x?: number; y?: number }) => void;
  onMergeNodes: (keepId: string, dropId: string) => void;
  onPushHistory: () => void;
}

function screenToWorld(pt: Point, pan: Point, scale: number): Point {
  return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
}: WallDrawingCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [pan,   setPan]   = useState<Point>({ x: 200, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ panX:number; panY:number; clientX:number; clientY:number } | null>(null);

  const [chain,        setChain]        = useState<DrawingChain>(null);
  const [cursor,       setCursor]       = useState<Point | null>(null);
  const [snapResult,   setSnapResult]   = useState<SnapResult | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editingWallId,  setEditingWallId]  = useState<string | null>(null);
  const [editThickness,  setEditThickness]  = useState('');

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragSnapRef = useRef<SnapResult | null>(null);

  useEffect(() => {
    setSelectedWallId(null);
    setEditingWallId(null);
    setChain(null);
  }, [tool]);

  const getSvgPos = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const getWorldPos = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    return screenToWorld(getSvgPos(e), pan, scale);
  }, [pan, scale, getSvgPos]);

  const worldToScreen = useCallback((pt: Point): Point => ({
    x: pt.x * scale + pan.x,
    y: pt.y * scale + pan.y,
  }), [pan, scale]);

  // Wheel zoom — non-passive
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      setScale((s) => {
        const ns = Math.max(0.05, Math.min(5, s * factor));
        setPan((p) => ({ x: ox - (ox - p.x) * (ns / s), y: oy - (oy - p.y) * (ns / s) }));
        return ns;
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // ── Hit test helpers ───────────────────────────────────────────────────────

  const hitTestNode = useCallback((world: Point): WallNode | null => {
    const r = NODE_HANDLE_RADIUS_PX / scale;
    for (const n of nodes) {
      if (dist(world, { x: n.x, y: n.y }) < r) return n;
    }
    return null;
  }, [nodes, scale]);

  const hitTestWall = useCallback((world: Point): Wall | null => {
    for (const wall of walls) {
      const n1 = nodes.find((n) => n.id === wall.node1Id);
      const n2 = nodes.find((n) => n.id === wall.node2Id);
      if (!n1 || !n2) continue;
      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1,
        ((world.x - n1.x) * dx + (world.y - n1.y) * dy) / lenSq,
      ));
      const proj = { x: n1.x + t * dx, y: n1.y + t * dy };
      if (dist(world, proj) <= wall.thickness / 2 + 4 / scale) return wall;
    }
    return null;
  }, [walls, nodes, scale]);

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      const sp = getSvgPos(e);
      panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const world = getWorldPos(e);
    const snap  = snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    const pt    = snap?.point ?? world;

    if (tool === 'WALL') {
      if (!chain) {
        let nodeId: string;
        if (snap?.type === 'endpoint' && snap.nodeId) {
          nodeId = snap.nodeId;
        } else {
          nodeId = generateId();
          onAddNode({ id: nodeId, x: pt.x, y: pt.y });
        }
        setChain({ nodeIds: [nodeId], thickness: DEFAULT_THICKNESS });
      } else {
        const prevNodeId = chain.nodeIds[chain.nodeIds.length - 1]!;
        const prevNode = nodes.find((n) => n.id === prevNodeId);
        if (!prevNode) return;
        if (dist({ x: prevNode.x, y: prevNode.y }, pt) < 1) return;

        let targetNodeId: string;
        if (snap?.type === 'endpoint' && snap.nodeId) {
          targetNodeId = snap.nodeId;
        } else {
          targetNodeId = generateId();
          onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
        }

        onPushHistory();
        onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });

        const startId = chain.nodeIds[0]!;
        if (targetNodeId === startId) {
          setChain(null);
        } else {
          setChain({ ...chain, nodeIds: [...chain.nodeIds, targetNodeId] });
        }
      }
      return;
    }

    if (tool === 'SELECT') {
      const hitNode = hitTestNode(world);
      if (hitNode) {
        setDraggingNodeId(hitNode.id);
        dragSnapRef.current = null;
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        return;
      }
      const hit = hitTestWall(world);
      setSelectedWallId(hit?.id ?? null);
      if (hit) {
        setEditingWallId(hit.id);
        setEditThickness(hit.thickness.toFixed(1));
      } else {
        setEditingWallId(null);
      }
      return;
    }

    if (tool === 'DELETE') {
      const hit = hitTestWall(world);
      if (hit) { onPushHistory(); onRemoveWall(hit.id); }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning && panStart.current) {
      const sp = getSvgPos(e);
      setPan({
        x: panStart.current.panX + (sp.x - panStart.current.clientX),
        y: panStart.current.panY + (sp.y - panStart.current.clientY),
      });
      return;
    }

    const world = getWorldPos(e);

    if (draggingNodeId) {
      const otherNodes = nodes.filter((n) => n.id !== draggingNodeId);
      const snapWalls  = walls.filter((w) => w.node1Id !== draggingNodeId && w.node2Id !== draggingNodeId);
      const snap = snapToWalls(world, snapWalls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
      const pt = snap?.point ?? world;
      dragSnapRef.current = snap;
      onUpdateNode(draggingNodeId, { x: pt.x, y: pt.y });
      setCursor(pt);
      return;
    }

    const snap = snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    setCursor(snap?.point ?? world);
    setSnapResult(snap);
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      return;
    }

    if (draggingNodeId) {
      const snap = dragSnapRef.current;
      if (snap?.type === 'endpoint' && snap.nodeId && snap.nodeId !== draggingNodeId) {
        onPushHistory();
        onMergeNodes(snap.nodeId, draggingNodeId);
      } else {
        onPushHistory();
      }
      setDraggingNodeId(null);
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') setChain(null);
  };

  // ── WallEdgeEditor ─────────────────────────────────────────────────────────

  const submitThickness = () => {
    if (!editingWallId) return;
    const v = parseFloat(editThickness);
    if (!isNaN(v) && v > 0) { onPushHistory(); onUpdateWall(editingWallId, { thickness: v }); }
    setEditingWallId(null);
  };

  // ── Geometry ───────────────────────────────────────────────────────────────

  const wallPolygons = useMemo(() => computeCornerGeometry(walls, nodes), [walls, nodes]);
  const jointLines   = useMemo(() => computeJointLines(walls, nodes),     [walls, nodes]);

  const editingWall = editingWallId ? walls.find((w) => w.id === editingWallId) : null;
  const editingWallN1 = editingWall ? nodes.find((n) => n.id === editingWall.node1Id) : null;
  const editingWallN2 = editingWall ? nodes.find((n) => n.id === editingWall.node2Id) : null;
  const editingScreen = (editingWallN1 && editingWallN2) ? worldToScreen({
    x: (editingWallN1.x + editingWallN2.x) / 2,
    y: (editingWallN1.y + editingWallN2.y) / 2,
  }) : null;

  // ── Chain preview ──────────────────────────────────────────────────────────

  const chainPreview = (() => {
    if (!chain || !cursor) return null;
    const lastId = chain.nodeIds[chain.nodeIds.length - 1]!;
    const lastNode = nodes.find((n) => n.id === lastId);
    if (!lastNode) return null;
    const sl = worldToScreen({ x: lastNode.x, y: lastNode.y });
    const sc = worldToScreen(cursor);
    const dx = sc.x - sl.x, dy = sc.y - sl.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return null;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const halfT = (DEFAULT_THICKNESS / 2) * scale;
    return { sl, angle, len, halfT };
  })();

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1c24]" tabIndex={0}>
      <svg
        ref={svgRef}
        className="h-full w-full cursor-crosshair select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Grid */}
        <defs>
          <pattern id="wdc-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse"
            x={pan.x % (20 * scale)} y={pan.y % (20 * scale)}>
            <circle cx={10 * scale} cy={10 * scale} r="0.8" fill="#272b38" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wdc-grid)" />

        {/* Wall polygons */}
        {wallPolygons.map((poly) => {
          if (!poly.points.length) return null;
          const isSelected = poly.wallId === selectedWallId;
          const color = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
          const screenPts = poly.points
            .map((p) => worldToScreen(p))
            .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(' ');
          return <polygon key={poly.wallId} points={screenPts} fill={color} />;
        })}

        {/* Joint lines */}
        {jointLines.map((line, i) => {
          const sp1 = worldToScreen(line.p1);
          const sp2 = worldToScreen(line.p2);
          return (
            <line key={`joint-${i}`}
              x1={sp1.x} y1={sp1.y} x2={sp2.x} y2={sp2.y}
              stroke="#3d3830" strokeWidth={1.5} />
          );
        })}

        {/* Chain preview */}
        {chainPreview && (
          <g transform={`translate(${chainPreview.sl.x},${chainPreview.sl.y}) rotate(${chainPreview.angle})`} opacity={0.5}>
            <rect x={0} y={-chainPreview.halfT} width={chainPreview.len} height={chainPreview.halfT * 2}
              fill={WALL_COLOR} stroke="#e67e22" strokeWidth={1} strokeDasharray="6,3" rx={1} />
          </g>
        )}

        {/* H/V snap guide lines */}
        {tool === 'WALL' && snapResult?.type === 'hv' && cursor && (() => {
          const sc = worldToScreen(cursor);
          if (snapResult.axis === 'h') {
            return <line x1={0} y1={sc.y} x2="100%" y2={sc.y}
              stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />;
          }
          return <line x1={sc.x} y1={0} x2={sc.x} y2="100%"
            stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />;
        })()}

        {/* Snap indicator */}
        {tool === 'WALL' && cursor && (() => {
          const sc = worldToScreen(cursor);
          if (snapResult?.type === 'endpoint') {
            return <circle cx={sc.x} cy={sc.y} r={SNAP_INDICATOR_R}
              fill="none" stroke="#e67e22" strokeWidth={2} />;
          }
          if (snapResult?.type === 'face') {
            return <rect x={sc.x - SNAP_INDICATOR_R / 2} y={sc.y - SNAP_INDICATOR_R / 2}
              width={SNAP_INDICATOR_R} height={SNAP_INDICATOR_R}
              fill="none" stroke="#e67e22" strokeWidth={1.5} />;
          }
          if (snapResult?.type === 'hv') {
            return <circle cx={sc.x} cy={sc.y} r={SNAP_INDICATOR_R}
              fill="none" stroke="#27ae60" strokeWidth={1.5} strokeDasharray="3,2" />;
          }
          return null;
        })()}

        {/* Chain start ring (close indicator) */}
        {tool === 'WALL' && chain && chain.nodeIds.length > 0 && (() => {
          const startId = chain.nodeIds[0]!;
          const startNode = nodes.find((n) => n.id === startId);
          if (!startNode) return null;
          const ss = worldToScreen({ x: startNode.x, y: startNode.y });
          return <circle cx={ss.x} cy={ss.y} r={ENDPOINT_RADIUS_PX + 4}
            fill="none" stroke="#27ae60" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7} />;
        })()}

        {/* Node handles (SELECT mode) */}
        {tool === 'SELECT' && nodes.map((n) => {
          const sp = worldToScreen({ x: n.x, y: n.y });
          const isDragging = n.id === draggingNodeId;
          return (
            <circle key={n.id}
              cx={sp.x} cy={sp.y} r={5}
              fill={isDragging ? '#e67e22' : 'none'}
              stroke="#e67e22"
              strokeWidth={isDragging ? 2 : 1.5}
              style={{ cursor: 'grab' }}
            />
          );
        })}
      </svg>

      {/* WallEdgeEditor popup */}
      {editingWall && editingScreen && (
        <WallEdgeEditor
          screenX={editingScreen.x}
          screenY={editingScreen.y}
          above
          thicknessValue={editThickness}
          onThicknessChange={setEditThickness}
          hasExistingConstraint={false}
          onRelease={() => setEditingWallId(null)}
          onSubmit={submitThickness}
          onCancel={() => setEditingWallId(null)}
        />
      )}
    </div>
  );
};
