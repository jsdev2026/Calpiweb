'use client';

import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Wall, DrawingChain, SnapResult } from '@/types/wall';
import type { Point } from '@/types/plan';
import { snapToWalls } from '@/engine/geometry/wallSnap';
import { computeCornerGeometry, computeJointLines } from '@/engine/geometry/wallGeometry';
import { generateId } from '@/utils/id';
import { WallEdgeEditor } from './WallEdgeEditor';

type PlanTool = 'WALL' | 'SELECT' | 'DELETE';

const DEFAULT_THICKNESS = 20;   // cm
const ENDPOINT_RADIUS_PX = 12;
const FACE_RADIUS_PX = 8;
const WALL_COLOR = '#6b6056';
const WALL_SELECTED_COLOR = '#e67e22';
const SNAP_INDICATOR_R = 8;

interface WallDrawingCanvasProps {
  walls: Wall[];
  tool: PlanTool;
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
  onPushHistory: () => void;
}

/** Convert SVG/screen coordinate to world coordinate given pan + scale. */
function screenToWorld(pt: Point, pan: Point, scale: number): Point {
  return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
}

export const WallDrawingCanvas = ({
  walls,
  tool,
  onAddWall,
  onRemoveWall,
  onUpdateWall,
  onPushHistory,
}: WallDrawingCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scale, setScale] = useState(0.5);    // px per cm
  const [pan, setPan] = useState<Point>({ x: 200, y: 200 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ panX: number; panY: number; clientX: number; clientY: number } | null>(null);

  const [chain, setChain] = useState<DrawingChain>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editingWallId, setEditingWallId] = useState<string | null>(null);
  const [editThickness, setEditThickness] = useState('');

  // ── Clear selection / chain when tool changes ────────────────────────────

  useEffect(() => {
    setSelectedWallId(null);
    setEditingWallId(null);
    setChain(null);
  }, [tool]);

  // ── World coordinate from SVG pointer event ──────────────────────────────

  const getWorldPos = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const screen: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    return screenToWorld(screen, pan, scale);
  }, [pan, scale]);

  const getWorldScreen = useCallback((e: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── Pan / Zoom ────────────────────────────────────────────────────────────

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      setScale((s) => {
        const ns = Math.max(0.05, Math.min(5, s * factor));
        setPan((p) => ({ x: ox - (ox - p.x) * (ns / s), y: oy - (oy - p.y) * (ns / s) }));
        return ns;
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle button or Alt+left = pan
      setIsPanning(true);
      const screen = getWorldScreen(e);
      panStart.current = { panX: pan.x, panY: pan.y, clientX: screen.x, clientY: screen.y };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const world = getWorldPos(e);
    const snap = snapToWalls(world, walls, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX);
    const pt = snap?.point ?? world;

    if (tool === 'WALL') {
      if (!chain) {
        setChain({ points: [pt], thickness: DEFAULT_THICKNESS });
      } else {
        const prev = chain.points[chain.points.length - 1]!;
        // Avoid zero-length walls
        const dx = pt.x - prev.x, dy = pt.y - prev.y;
        if (Math.sqrt(dx * dx + dy * dy) < 1) return;

        onPushHistory();
        onAddWall({ id: generateId(), p1: prev, p2: pt, thickness: chain.thickness });

        // Check if we closed the chain (snapped back to start)
        const start = chain.points[0]!;
        const ddx = pt.x - start.x, ddy = pt.y - start.y;
        const closed = Math.sqrt(ddx * ddx + ddy * ddy) < ENDPOINT_RADIUS_PX / scale;

        if (closed) {
          setChain(null);
        } else {
          setChain({ ...chain, points: [...chain.points, pt] });
        }
      }
    } else if (tool === 'SELECT') {
      const hit = hitTestWall(world, walls, scale);
      setSelectedWallId(hit?.id ?? null);
      if (hit) {
        setEditingWallId(hit.id);
        setEditThickness((hit.thickness).toFixed(1));
      } else {
        setEditingWallId(null);
      }
    } else if (tool === 'DELETE') {
      const hit = hitTestWall(world, walls, scale);
      if (hit) { onPushHistory(); onRemoveWall(hit.id); }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning && panStart.current) {
      const screen = getWorldScreen(e);
      setPan({
        x: panStart.current.panX + (screen.x - panStart.current.clientX),
        y: panStart.current.panY + (screen.y - panStart.current.clientY),
      });
      return;
    }
    const world = getWorldPos(e);
    const snap = snapToWalls(world, walls, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX);
    setCursor(snap?.point ?? world);
    setSnapResult(snap);
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') setChain(null);
  };

  // ── WallEdgeEditor submit ─────────────────────────────────────────────────

  const submitThickness = () => {
    if (!editingWallId) return;
    const v = parseFloat(editThickness);
    if (!isNaN(v) && v > 0) { onPushHistory(); onUpdateWall(editingWallId, { thickness: v }); }
    setEditingWallId(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const worldToScreen = (pt: Point): Point => ({
    x: pt.x * scale + pan.x,
    y: pt.y * scale + pan.y,
  });

  const wallPolygons = useMemo(() => computeCornerGeometry(walls), [walls]);
  const jointLines   = useMemo(() => computeJointLines(walls), [walls]);

  const editingWall = editingWallId ? walls.find((w) => w.id === editingWallId) : null;
  const editingScreen = editingWall ? worldToScreen({
    x: (editingWall.p1.x + editingWall.p2.x) / 2,
    y: (editingWall.p1.y + editingWall.p2.y) / 2,
  }) : null;

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
        {/* Grid dots */}
        <defs>
          <pattern id="wdc-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse"
            x={pan.x % (20 * scale)} y={pan.y % (20 * scale)}>
            <circle cx={10 * scale} cy={10 * scale} r="0.8" fill="#272b38" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wdc-grid)" />

        {/* Rendered walls */}
        {wallPolygons.map((poly) => {
          if (!poly.points.length) return null;
          const isSelected = poly.wallId === selectedWallId;
          const color = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
          const screenPts = poly.points
            .map((p) => worldToScreen(p))
            .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
            .join(' ');
          return (
            <polygon
              key={poly.wallId}
              points={screenPts}
              fill={color}
            />
          );
        })}

        {/* Joint lines — drawn on top of wall polygons */}
        {jointLines.map((line, i) => {
          const sp1 = worldToScreen(line.p1);
          const sp2 = worldToScreen(line.p2);
          return (
            <line
              key={`joint-${i}`}
              x1={sp1.x} y1={sp1.y}
              x2={sp2.x} y2={sp2.y}
              stroke="#3d3830"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Drawing chain preview */}
        {chain && chain.points.length > 0 && cursor && (() => {
          const last = chain.points[chain.points.length - 1]!;
          const sl = worldToScreen(last);
          const sc = worldToScreen(cursor);
          const dx = sc.x - sl.x, dy = sc.y - sl.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.5) return null;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const halfT = (DEFAULT_THICKNESS / 2) * scale;
          return (
            <g transform={`translate(${sl.x},${sl.y}) rotate(${angle})`} opacity={0.5}>
              <rect x={0} y={-halfT} width={len} height={halfT * 2}
                fill={WALL_COLOR} stroke="#e67e22" strokeWidth={1} strokeDasharray="6,3" rx={1} />
            </g>
          );
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
          return null;
        })()}

        {/* Chain start snap ring (close indicator) */}
        {tool === 'WALL' && chain && chain.points.length > 0 && (() => {
          const start = chain.points[0]!;
          const ss = worldToScreen(start);
          return <circle cx={ss.x} cy={ss.y} r={ENDPOINT_RADIUS_PX + 4}
            fill="none" stroke="#27ae60" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7} />;
        })()}
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

// ── Hit test helper ─────────────────────────────────────────────────────────

/**
 * Return the first wall whose rendered body contains `world`.
 * Uses a point-to-segment distance check with half-thickness tolerance.
 */
function hitTestWall(world: Point, walls: Wall[], scale: number): Wall | null {
  for (const wall of walls) {
    const dx = wall.p2.x - wall.p1.x;
    const dy = wall.p2.y - wall.p1.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1,
      ((world.x - wall.p1.x) * dx + (world.y - wall.p1.y) * dy) / lenSq
    ));
    const proj = { x: wall.p1.x + t * dx, y: wall.p1.y + t * dy };
    const dist = Math.sqrt((world.x - proj.x) ** 2 + (world.y - proj.y) ** 2);
    // Tolerance = half-thickness + 4px screen slack
    const tolerance = wall.thickness / 2 + 4 / scale;
    if (dist <= tolerance) return wall;
  }
  return null;
}
