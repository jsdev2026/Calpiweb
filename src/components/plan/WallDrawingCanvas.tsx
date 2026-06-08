'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Wall, WallNode, DrawingChain, SnapResult, WallExcludedZone, AutoCotation, ExcludeNode } from '@/types/wall';
import type { Point } from '@/types/plan';
import { snapToWalls, perpendicularSnapForNode, adjacentAxisSnapForNode, collinearSnap, collinearSnapForNode } from '@/engine/geometry/wallSnap';
import { computeCornerGeometry, computeJointLines } from '@/engine/geometry/wallGeometry';
import { computeAutoCotations } from '@/engine/geometry/wallCotation';
import { wallsToRooms } from '@/engine/geometry/wallFaces';
import { computeWallNormal, computeWallPerpMove } from '@/engine/geometry/wallDrag';
import { generateId } from '@/utils/id';
import { WallEdgeEditor } from './WallEdgeEditor';
import { AutoCotationPanel } from './AutoCotationPanel';

type PlanTool = 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE';

const ENDPOINT_RADIUS_PX  = 12;
const FACE_RADIUS_PX      = 8;
const HV_SNAP_PX          = 15;  // était 20
const HV_SNAP_DRAG_PX     = 28;  // était 40
const PERP_SNAP_PX        = 22;  // était 30
const COLLINEAR_SNAP_PX   = 12;  // snap colinéaire — dessin + drag
const NODE_HANDLE_RADIUS_PX = 10;
const WALL_COLOR          = 'var(--canvas-wall)';
const WALL_SELECTED_COLOR = '#e67e22';
const SNAP_INDICATOR_R    = 8;
const DOOR_DEFAULT_WIDTH_MM = 900;
const DOOR_MIN_WALL_MM      = 600;

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
  scale: number;
  pan: Point;
  onScaleChange: (s: number) => void;
  onPanChange: (p: Point) => void;
  wallThickness: number;
  excludedZones: WallExcludedZone[];
  onAddExcludedZone: (nodes: ExcludeNode[]) => void;
  onRemoveExcludedZone: (id: string) => void;
  onUpdateExcludeZoneNode: (zoneId: string, nodeId: string, pos: Point) => void;
  onSplitWall: (wallId: string, newNode: WallNode) => void;
  onConnectNodeToWall: (wallId: string, nodeId: string, newPos: Point) => void;
  wallRoomNames?: Record<string, string>;
  onRenameRoom?: (id: string, name: string) => void;
}

function screenToWorld(pt: Point, pan: Point, scale: number): Point {
  return { x: (pt.x - pan.x) / scale, y: (pt.y - pan.y) / scale };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function polygonCentroid(points: Point[]): Point {
  const n = points.length;
  if (n < 3) return { x: points.reduce((s, p) => s + p.x, 0) / Math.max(n, 1), y: points.reduce((s, p) => s + p.y, 0) / Math.max(n, 1) };
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const c = p1.x * p2.y - p2.x * p1.y;
    area += c;
    cx += (p1.x + p2.x) * c;
    cy += (p1.y + p2.y) * c;
  }
  area /= 2;
  if (Math.abs(area) < 1e-10) return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export const WallDrawingCanvas = ({
  walls, nodes, tool,
  onAddWall, onRemoveWall, onUpdateWall,
  onAddNode, onUpdateNode, onMergeNodes, onPushHistory,
  scale, pan, onScaleChange, onPanChange,
  wallThickness,
  excludedZones, onAddExcludedZone, onRemoveExcludedZone: _onRemoveExcludedZone, onUpdateExcludeZoneNode,
  onSplitWall,
  onConnectNodeToWall,
  wallRoomNames, onRenameRoom,
}: WallDrawingCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Refs mutable pour wheel/touch — évitent les stale closures
  const scaleRef = useRef(scale);
  const panRef   = useRef(pan);
  scaleRef.current = scale; // toujours à jour pendant le rendu
  panRef.current   = pan;
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ panX:number; panY:number; clientX:number; clientY:number } | null>(null);
  const touchRef = useRef<{
    type: '1finger' | '2finger';
    prevDist: number;
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [chain,        setChain]        = useState<DrawingChain>(null);
  const [cursor,       setCursor]       = useState<Point | null>(null);
  const [snapResult,   setSnapResult]   = useState<SnapResult | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [editingWallId,  setEditingWallId]  = useState<string | null>(null);
  const [editThickness,  setEditThickness]  = useState('');
  const [selectedCot, setSelectedCot] = useState<{ wallId: string; side: AutoCotation['side']; screenX: number; screenY: number } | null>(null);
  const [renamingRoom, setRenamingRoom] = useState<{ id: string; screenX: number; screenY: number } | null>(null);
  const [renameValue,  setRenameValue]  = useState('');

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingZoneNode, setDraggingZoneNode] = useState<{ zoneId: string; nodeId: string } | null>(null);
  const dragSnapRef = useRef<SnapResult | null>(null);

  // Wall segment drag state
  const [draggingWallId, setDraggingWallId] = useState<string | null>(null);
  const wallDragRef = useRef<{
    node1Start: Point;
    node2Start: Point;
    pointerStart: Point;
    normal: Point;
    hasMoved: boolean;
  } | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const lastWallClickRef = useRef<{ time: number; wallId: string } | null>(null);

  const [excludeChain, setExcludeChain] = useState<ExcludeNode[]>([]);
  const excludeChainRef = useRef<ExcludeNode[]>([]);
  excludeChainRef.current = excludeChain;
  const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isCtrlPressed,  setIsCtrlPressed]  = useState(false);

  useEffect(() => {
    setSelectedWallId(null);
    setEditingWallId(null);
    setChain(null);
    setExcludeChain([]);
    setSelectedCot(null);
    setRenamingRoom(null);
    setDraggingWallId(null);
    wallDragRef.current = null;
    setHoveredWallId(null);
    setDraggingZoneNode(null);
  }, [tool]);

  const tryCloseChain = useCallback(() => {
    if (!chain || chain.nodeIds.length < 2) return;
    const firstId = chain.nodeIds[0]!;
    const lastId  = chain.nodeIds[chain.nodeIds.length - 1]!;
    if (firstId === lastId) return;
    const alreadyConnected = walls.some(w =>
      (w.node1Id === lastId && w.node2Id === firstId) ||
      (w.node1Id === firstId && w.node2Id === lastId)
    );
    onPushHistory();
    if (!alreadyConnected) {
      onAddWall({ id: generateId(), node1Id: lastId, node2Id: firstId, thickness: chain.thickness });
    }
    setChain(null);
  }, [chain, walls, onAddWall, onPushHistory]);

  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Shift')   setIsShiftPressed(true);
      if (e.key === 'Control') setIsCtrlPressed(true);
      if (e.key === 'Escape') {
        setChain(null);
        setSelectedWallId(null);
        setEditingWallId(null);
        setExcludeChain([]);
        setSelectedCot(null);
        setRenamingRoom(null);
      }
      if (e.key === 'Enter') {
        tryCloseChain();
        if (excludeChainRef.current.length >= 3) {
          onPushHistory();
          onAddExcludedZone([...excludeChainRef.current]);
          setExcludeChain([]);
        }
      }
      if (e.key === 'Backspace' && tool === 'EXCLUDE') {
        setExcludeChain((prev) => prev.slice(0, -1));
        return;
      }
    };
    const up = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Shift')   setIsShiftPressed(false);
      if (e.key === 'Control') setIsCtrlPressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
    };
  }, [tryCloseChain, tool, onPushHistory, onAddExcludedZone]);

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

  // Wheel zoom — centré sur curseur, non-passive
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = svg.getBoundingClientRect();
      const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      const s = scaleRef.current;
      const p = panRef.current;
      const ns = Math.max(0.005, Math.min(4, s * factor));
      const np = { x: ox - (ox - p.x) * (ns / s), y: oy - (oy - p.y) * (ns / s) };
      scaleRef.current = ns;
      panRef.current   = np;
      onScaleChange(ns);
      onPanChange(np);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onScaleChange, onPanChange]);

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

  // ── Ortho helper ───────────────────────────────────────────────────────────

  function applyOrtho(cursor: Point, ref: Point): Point {
    const dx = Math.abs(cursor.x - ref.x);
    const dy = Math.abs(cursor.y - ref.y);
    return dx > dy ? { x: cursor.x, y: ref.y } : { x: ref.x, y: cursor.y };
  }

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      const sp = getSvgPos(e);
      panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    let world = getWorldPos(e);

    if (isShiftPressed && chain && chain.nodeIds.length > 0) {
      const lastId   = chain.nodeIds[chain.nodeIds.length - 1]!;
      const lastNode = nodes.find((n) => n.id === lastId);
      if (lastNode) world = applyOrtho(world, { x: lastNode.x, y: lastNode.y });
    }

    const baseSnap = isCtrlPressed
      ? null
      : snapToWalls(world, walls, nodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    // face snap (cursor on wall segment) takes priority over collinear snap (infinite line extension)
    const snap = (isCtrlPressed || baseSnap?.type === 'endpoint' || baseSnap?.type === 'face')
      ? baseSnap
      : (collinearSnap(world, walls, nodes, scale, COLLINEAR_SNAP_PX) ?? baseSnap);
    const pt = snap?.point ?? world;

    if (tool === 'WALL') {
      if (!chain) {
        let nodeId: string;
        if (snap?.type === 'endpoint' && snap.nodeId) {
          nodeId = snap.nodeId;
        } else if (snap?.type === 'face' && snap.wallId) {
          nodeId = generateId();
          onSplitWall(snap.wallId, { id: nodeId, x: pt.x, y: pt.y });
        } else {
          nodeId = generateId();
          onAddNode({ id: nodeId, x: pt.x, y: pt.y });
        }
        setChain({ nodeIds: [nodeId], thickness: wallThickness });
      } else {
        const prevNodeId = chain.nodeIds[chain.nodeIds.length - 1]!;
        const prevNode = nodes.find((n) => n.id === prevNodeId);
        if (!prevNode) return;
        if (dist({ x: prevNode.x, y: prevNode.y }, pt) < 1) return;

        let targetNodeId: string;
        let splitWallId: string | null = null;

        if (snap?.type === 'endpoint' && snap.nodeId) {
          targetNodeId = snap.nodeId;
        } else if (snap?.type === 'face' && snap.wallId) {
          targetNodeId = generateId();
          splitWallId = snap.wallId;
        } else {
          targetNodeId = generateId();
        }

        const alreadyConnected = walls.some(w =>
          (w.node1Id === prevNodeId && w.node2Id === targetNodeId) ||
          (w.node1Id === targetNodeId && w.node2Id === prevNodeId)
        );

        // Quand le split crée lui-même le lien prevNodeId→targetNodeId, ne pas doubler le mur.
        // splitWallInEngine crée wall.node1Id→newNode et newNode→wall.node2Id.
        // Si prevNodeId est l'une de ces extrémités, le lien est déjà créé par le split.
        const snapWallObj = splitWallId !== null ? walls.find(w => w.id === splitWallId) : null;
        const splitWillCreateLink =
          snapWallObj &&
          (snapWallObj.node1Id === prevNodeId || snapWallObj.node2Id === prevNodeId);

        onPushHistory();

        if (splitWallId !== null) {
          onSplitWall(splitWallId, { id: targetNodeId, x: pt.x, y: pt.y });
        } else if (!(snap?.type === 'endpoint' && snap.nodeId)) {
          onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
        }

        if (!alreadyConnected && !splitWillCreateLink) {
          onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });
        }

        const startId = chain.nodeIds[0]!;
        // Also auto-close when the split of a wall creates an edge to the chain's start node.
        // e.g. chain starts at B, user snaps to wall B→C at P → split creates B→P;
        // the room B-…-P is now closed via the B→P edge.
        const splitConnectsToStart =
          !!snapWallObj &&
          (snapWallObj.node1Id === startId || snapWallObj.node2Id === startId);
        if (targetNodeId === startId || splitConnectsToStart) {
          setChain(null);
        } else {
          setChain({ ...chain, nodeIds: [...chain.nodeIds, targetNodeId] });
        }
      }
      return;
    }

    if (tool === 'EXCLUDE') {
      // Recalculate snap with EXCLUDE node pool (excludedZone nodes included)
      const excludeSnapPool: WallNode[] = [
        ...nodes,
        ...excludedZones.flatMap(z => z.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))),
      ];
      const excludeSnap = isCtrlPressed
        ? null
        : snapToWalls(world, walls, excludeSnapPool, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
      const excludePt = excludeSnap?.point ?? world;

      // Clic sur le 1er nœud → fermer la zone
      if (excludeChain.length >= 3) {
        const first = excludeChain[0]!;
        const firstS = worldToScreen({ x: first.x, y: first.y });
        const excludePtS = worldToScreen(excludePt);
        if (Math.hypot(excludePtS.x - firstS.x, excludePtS.y - firstS.y) < ENDPOINT_RADIUS_PX) {
          onPushHistory();
          onAddExcludedZone([...excludeChain]);
          setExcludeChain([]);
          return;
        }
      }

      // Double-clic → fermer si ≥ 3 nœuds
      const now = Date.now();
      const last = lastClickRef.current;
      const isDouble = now - last.time < 350 && dist(world, { x: last.x, y: last.y }) < 30 / scale;
      lastClickRef.current = { time: now, x: world.x, y: world.y };
      if (isDouble) {
        if (excludeChain.length >= 3) {
          onPushHistory();
          onAddExcludedZone([...excludeChain]);
          setExcludeChain([]);
        }
        return;
      }

      setExcludeChain((prev) => [...prev, { id: generateId(), x: excludePt.x, y: excludePt.y }]);
      return;
    }

    if (tool === 'DOOR') {
      const hit = hitTestWall(world);
      if (!hit) return;
      const n1 = nodes.find((n) => n.id === hit.node1Id);
      const n2 = nodes.find((n) => n.id === hit.node2Id);
      if (!n1 || !n2) return;

      if (hit.isDoor) {
        onPushHistory();
        onRemoveWall(hit.id);
        return;
      }

      const dx = n2.x - n1.x, dy = n2.y - n1.y;
      const len = Math.hypot(dx, dy);
      if (len < DOOR_MIN_WALL_MM) return;

      const halfW = Math.min(DOOR_DEFAULT_WIDTH_MM / 2, len * 0.4);
      const t = Math.max(0, Math.min(1,
        ((world.x - n1.x) * dx + (world.y - n1.y) * dy) / (len * len),
      ));
      const tCenter = Math.max(halfW / len, Math.min(1 - halfW / len, t));

      const d1: Point = {
        x: n1.x + (dx / len) * (tCenter * len - halfW),
        y: n1.y + (dy / len) * (tCenter * len - halfW),
      };
      const d2: Point = {
        x: n1.x + (dx / len) * (tCenter * len + halfW),
        y: n1.y + (dy / len) * (tCenter * len + halfW),
      };

      const id1 = generateId(), id2 = generateId();
      // Add new nodes + walls BEFORE removing the original (prevents node pruning)
      onPushHistory();
      onAddNode({ id: id1, x: d1.x, y: d1.y });
      onAddNode({ id: id2, x: d2.x, y: d2.y });
      onAddWall({ id: generateId(), node1Id: hit.node1Id, node2Id: id1,         thickness: hit.thickness });
      onAddWall({ id: generateId(), node1Id: id1,          node2Id: id2,         thickness: hit.thickness, isDoor: true });
      onAddWall({ id: generateId(), node1Id: id2,          node2Id: hit.node2Id, thickness: hit.thickness });
      onRemoveWall(hit.id);
      return;
    }

    if (tool === 'SELECT') {
      // Hit test nœuds de zone (même priorité que nœuds de murs)
      const r = NODE_HANDLE_RADIUS_PX / scale;
      for (const zone of excludedZones) {
        for (const zn of zone.nodes) {
          if (dist(world, { x: zn.x, y: zn.y }) < r) {
            setDraggingZoneNode({ zoneId: zone.id, nodeId: zn.id });
            dragSnapRef.current = null;
            (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
            return;
          }
        }
      }
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
        const n1 = nodes.find((n) => n.id === hit.node1Id);
        const n2 = nodes.find((n) => n.id === hit.node2Id);
        const normal = computeWallNormal(hit, nodes);
        if (n1 && n2 && normal) {
          wallDragRef.current = {
            node1Start:   { x: n1.x, y: n1.y },
            node2Start:   { x: n2.x, y: n2.y },
            pointerStart: world,
            normal,
            hasMoved: false,
          };
          setDraggingWallId(hit.id);
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }
      } else {
        setEditingWallId(null);
        // Clic gauche sur zone vide → pan
        setIsPanning(true);
        const sp = getSvgPos(e);
        panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
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
      onPanChange({
        x: panStart.current.panX + (sp.x - panStart.current.clientX),
        y: panStart.current.panY + (sp.y - panStart.current.clientY),
      });
      return;
    }

    let world = getWorldPos(e);

    if (draggingWallId && wallDragRef.current) {
      const ref = wallDragRef.current;
      const wall = walls.find((w) => w.id === draggingWallId);
      if (wall) {
        const otherNodes = nodes.filter((n) => n.id !== wall.node1Id && n.id !== wall.node2Id);
        const result = computeWallPerpMove(
          ref.node1Start, ref.node2Start, ref.pointerStart, world,
          ref.normal, otherNodes, scale, HV_SNAP_DRAG_PX,
        );
        const dx = (world.x - ref.pointerStart.x) * scale;
        const dy = (world.y - ref.pointerStart.y) * scale;
        if (Math.sqrt(dx * dx + dy * dy) > 4) ref.hasMoved = true;
        onUpdateNode(wall.node1Id, result.node1Target);
        onUpdateNode(wall.node2Id, result.node2Target);
      }
      return;
    }

    if (draggingZoneNode) {
      const allZoneNodes = excludedZones.flatMap(z => z.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));
      const otherNodes: WallNode[] = [
        ...nodes,
        ...allZoneNodes.filter(n => n.id !== draggingZoneNode.nodeId),
      ];
      const snap = isCtrlPressed
        ? null
        : snapToWalls(world, walls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_DRAG_PX);
      const pt = snap?.point ?? world;
      dragSnapRef.current = snap;
      setSnapResult(snap);
      onUpdateExcludeZoneNode(draggingZoneNode.zoneId, draggingZoneNode.nodeId, pt);
      return;
    }

    if (draggingNodeId) {
      const otherNodes = nodes.filter((n) => n.id !== draggingNodeId);
      const snapWalls  = walls.filter((w) => w.node1Id !== draggingNodeId && w.node2Id !== draggingNodeId);

      // Nœuds adjacents (autres extrémités des murs connectés au nœud dragué)
      const adjacentNodes = walls
        .filter((w) => w.node1Id === draggingNodeId || w.node2Id === draggingNodeId)
        .map((w) => {
          const otherId = w.node1Id === draggingNodeId ? w.node2Id : w.node1Id;
          return nodes.find((n) => n.id === otherId);
        })
        .filter((n): n is WallNode => n !== undefined);

      let snap = null;
      if (!isCtrlPressed) {
        const wallSnap = snapToWalls(world, snapWalls, otherNodes, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_DRAG_PX);
        if (wallSnap?.type === 'endpoint' || wallSnap?.type === 'face') {
          // endpoint et face prennent la priorité sur les snaps H/V géométriques
          snap = wallSnap;
        } else {
          const adjSnap = adjacentNodes.length > 0
            ? adjacentAxisSnapForNode(world, adjacentNodes, scale, HV_SNAP_DRAG_PX)
            : null;
          if (adjSnap && !adjSnap.axis) {
            // Intersection H+V : priorité max après endpoint/face
            snap = adjSnap;
          } else {
            const colSnap = adjacentNodes.length >= 2
              ? collinearSnapForNode(world, adjacentNodes, scale, COLLINEAR_SNAP_PX)
              : null;
            const perpSnap = adjacentNodes.length >= 2
              ? perpendicularSnapForNode(world, adjacentNodes, scale, PERP_SNAP_PX)
              : null;
            snap = colSnap ?? perpSnap ?? adjSnap ?? wallSnap;
          }
        }
      }

      const pt = snap?.point ?? world;
      dragSnapRef.current = snap;
      setSnapResult(snap); // afficher indicateur pendant le drag
      onUpdateNode(draggingNodeId, { x: pt.x, y: pt.y });
      setCursor(pt);
      return;
    }

    if (isShiftPressed && chain && chain.nodeIds.length > 0) {
      const lastId   = chain.nodeIds[chain.nodeIds.length - 1]!;
      const lastNode = nodes.find((n) => n.id === lastId);
      if (lastNode) world = applyOrtho(world, { x: lastNode.x, y: lastNode.y });
    }

    if (isShiftPressed && tool === 'EXCLUDE' && excludeChainRef.current.length > 0) {
      const last = excludeChainRef.current[excludeChainRef.current.length - 1]!;
      world = applyOrtho(world, { x: last.x, y: last.y });
    }

    const snapNodePool: WallNode[] = tool === 'EXCLUDE'
      ? [
          ...nodes,
          ...excludedZones.flatMap(z => z.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }))),
        ]
      : nodes;
    const baseSnap = isCtrlPressed
      ? null
      : snapToWalls(world, walls, snapNodePool, scale, ENDPOINT_RADIUS_PX, FACE_RADIUS_PX, HV_SNAP_PX);
    // face snap (cursor on wall segment) takes priority over collinear snap (infinite line extension)
    const snap = (isCtrlPressed || baseSnap?.type === 'endpoint' || baseSnap?.type === 'face')
      ? baseSnap
      : (collinearSnap(world, walls, nodes, scale, COLLINEAR_SNAP_PX) ?? baseSnap);
    setCursor(snap?.point ?? world);
    setSnapResult(snap);

    if (tool === 'SELECT' && !draggingNodeId && !draggingWallId) {
      const hitNode = hitTestNode(world);
      setHoveredWallId(hitNode ? null : (hitTestWall(world)?.id ?? null));
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      return;
    }

    if (draggingWallId) {
      const ref = wallDragRef.current;
      if (ref?.hasMoved) {
        onPushHistory();
      } else {
        // No movement — check for double-click to open thickness editor
        const now = Date.now();
        const last = lastWallClickRef.current;
        if (last && last.wallId === draggingWallId && now - last.time < 300) {
          const wall = walls.find((w) => w.id === draggingWallId);
          if (wall) {
            setEditingWallId(wall.id);
            setEditThickness((wall.thickness / 10).toFixed(0));
          }
          lastWallClickRef.current = null;
        } else {
          lastWallClickRef.current = { time: now, wallId: draggingWallId };
        }
      }
      setDraggingWallId(null);
      wallDragRef.current = null;
      setHoveredWallId(null);
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      return;
    }

    if (draggingZoneNode) {
      onPushHistory();
      setDraggingZoneNode(null);
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      return;
    }

    if (draggingNodeId) {
      const snap = dragSnapRef.current;
      if (snap?.type === 'endpoint' && snap.nodeId && snap.nodeId !== draggingNodeId) {
        onPushHistory();
        onMergeNodes(snap.nodeId, draggingNodeId);
      } else if (snap?.type === 'face' && snap.wallId) {
        const degree = walls.filter(w => w.node1Id === draggingNodeId || w.node2Id === draggingNodeId).length;
        if (degree === 1) {
          onPushHistory();
          onConnectNodeToWall(snap.wallId, draggingNodeId, snap.point);
        } else {
          onPushHistory();
        }
      } else {
        onPushHistory();
      }
      setDraggingNodeId(null);
      dragSnapRef.current = null;
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const t = e.touches;
      const dx = t[1]!.clientX - t[0]!.clientX;
      const dy = t[1]!.clientY - t[0]!.clientY;
      touchRef.current = {
        type: '2finger',
        prevDist: Math.hypot(dx, dy),
        clientX: (t[0]!.clientX + t[1]!.clientX) / 2,
        clientY: (t[0]!.clientY + t[1]!.clientY) / 2,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    } else if (e.touches.length === 1 && tool === 'SELECT') {
      touchRef.current = {
        type: '1finger',
        prevDist: 0,
        clientX: e.touches[0]!.clientX,
        clientY: e.touches[0]!.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ref = touchRef.current;
    if (!ref) return;

    if (ref.type === '2finger' && e.touches.length === 2) {
      const t = e.touches;
      const dist2 = Math.hypot(t[1]!.clientX - t[0]!.clientX, t[1]!.clientY - t[0]!.clientY);
      const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
      const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
      const svg = svgRef.current;
      if (svg && ref.prevDist > 0) {
        const ratio = dist2 / ref.prevDist;
        const rect  = svg.getBoundingClientRect();
        const mx = midX - rect.left, my = midY - rect.top;
        const s  = scaleRef.current;
        const p  = panRef.current;
        const ns = Math.max(0.005, Math.min(4, s * ratio));
        const np = { x: mx - (mx - p.x) * (ns / s), y: my - (my - p.y) * (ns / s) };
        scaleRef.current = ns;
        panRef.current   = np;
        onScaleChange(ns);
        onPanChange(np);
      }
      touchRef.current = { ...ref, prevDist: dist2, clientX: midX, clientY: midY };
    } else if (ref.type === '1finger' && e.touches.length === 1) {
      const t = e.touches[0]!;
      onPanChange({
        x: ref.panX + (t.clientX - ref.clientX),
        y: ref.panY + (t.clientY - ref.clientY),
      });
    }
  };

  const handleTouchEnd = () => { touchRef.current = null; };

  const submitRename = () => {
    if (renamingRoom && onRenameRoom) {
      const trimmed = renameValue.trim();
      if (trimmed) onRenameRoom(renamingRoom.id, trimmed);
    }
    setRenamingRoom(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'Escape') {
      setChain(null);
      setSelectedCot(null);
      setRenamingRoom(null);
    }
  };

  // ── WallEdgeEditor ─────────────────────────────────────────────────────────

  const submitThickness = () => {
    if (!editingWallId) return;
    const cm = parseFloat(editThickness);
    if (!isNaN(cm) && cm > 0) {
      onPushHistory();
      onUpdateWall(editingWallId, { thickness: Math.round(cm * 10) }); // cm → mm
    }
    setEditingWallId(null);
  };

  // ── Geometry ───────────────────────────────────────────────────────────────

  const nonDoorWalls  = useMemo(() => walls.filter(w => !w.isDoor), [walls]);
  const wallPolygons  = useMemo(() => computeCornerGeometry(nonDoorWalls, nodes), [nonDoorWalls, nodes]);
  const jointLines    = useMemo(() => computeJointLines(nonDoorWalls, nodes),     [nonDoorWalls, nodes]);
  const autoCotations = useMemo(() => computeAutoCotations(walls, nodes), [walls, nodes]);
  const detectedRooms = useMemo(() => wallsToRooms(walls, nodes), [walls, nodes]);

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
    const halfT = (chain.thickness / 2) * scale;
    return { sl, angle, len, halfT };
  })();

  // Filter cotations: skip lines too short on screen, then skip labels that would overlap
  const visibleCotations = (() => {
    const placed: { x: number; y: number }[] = [];
    return autoCotations.filter((c) => {
      const sa1 = worldToScreen(c.anchor1);
      const sa2 = worldToScreen(c.anchor2);
      const ox = c.normal.x * c.offset * scale;
      const oy = c.normal.y * c.offset * scale;
      const sl1 = { x: sa1.x + ox, y: sa1.y + oy };
      const sl2 = { x: sa2.x + ox, y: sa2.y + oy };
      if (Math.hypot(sl2.x - sl1.x, sl2.y - sl1.y) < 40) return false;
      const smid = { x: (sl1.x + sl2.x) / 2, y: (sl1.y + sl2.y) / 2 };
      const lx = smid.x + c.normal.x * 12;
      const ly = smid.y + c.normal.y * 12;
      if (placed.some((p) => Math.hypot(p.x - lx, p.y - ly) < 32)) return false;
      placed.push({ x: lx, y: ly });
      return true;
    });
  })();

  const svgCursor = (() => {
    if (tool !== 'SELECT') return 'crosshair';
    if (draggingWallId) return 'grabbing';
    if (hoveredWallId) {
      const w = walls.find((wl) => wl.id === hoveredWallId);
      if (w) {
        const n1 = nodes.find((n) => n.id === w.node1Id);
        const n2 = nodes.find((n) => n.id === w.node2Id);
        if (n1 && n2) {
          const adx = Math.abs(n2.x - n1.x);
          const ady = Math.abs(n2.y - n1.y);
          if (ady < adx * 0.1) return 'ns-resize';
          if (adx < ady * 0.1) return 'ew-resize';
          return 'move';
        }
      }
    }
    return 'crosshair';
  })();

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      tabIndex={0}
      style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg
        ref={svgRef}
        className="h-full w-full select-none"
        style={{ cursor: svgCursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        tabIndex={0}
      >
        {/* Grid */}
        <defs>
          <pattern id="wdc-grid" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse"
            x={pan.x % (20 * scale)} y={pan.y % (20 * scale)}>
            <circle cx={10 * scale} cy={10 * scale} r="0.8" fill="var(--canvas-dot)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wdc-grid)" />

        {/* Fill des pièces détectées + label */}
        {detectedRooms.map((room) => {
          if (room.points.length < 3) return null;
          const screenPts = room.points
            .map((p) => worldToScreen(p))
            .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ');
          const centroid = polygonCentroid(room.points);
          const sc = worldToScreen(centroid);
          const displayName = wallRoomNames?.[room.id] ?? room.name ?? '';
          return (
            <g key={`room-fill-${room.id}`}>
              <polygon points={screenPts} fill="var(--canvas-poly-active)" className="pointer-events-none" />
              <text
                x={sc.x} y={sc.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill="var(--canvas-name-active)"
                style={{ fontFamily: 'system-ui', userSelect: 'none', cursor: 'text', pointerEvents: 'auto' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingRoom({ id: room.id, screenX: sc.x, screenY: sc.y });
                  setRenameValue(displayName);
                }}
              >
                {displayName}
              </text>
            </g>
          );
        })}

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

        {/* Ouvertures (murs isDoor) — ligne dashed orange */}
        {walls.filter(w => w.isDoor).map(w => {
          const n1 = nodes.find((n) => n.id === w.node1Id);
          const n2 = nodes.find((n) => n.id === w.node2Id);
          if (!n1 || !n2) return null;
          const s1 = worldToScreen({ x: n1.x, y: n1.y });
          const s2 = worldToScreen({ x: n2.x, y: n2.y });
          return (
            <line key={`door-${w.id}`}
              x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}
              stroke="#e67e22" strokeWidth={2} strokeDasharray="8,4"
            />
          );
        })}

        {/* Zones exclues existantes */}
        {excludedZones.map(zone => {
          if (zone.nodes.length < 3) return null;
          const pts = zone.nodes.map(n => worldToScreen({ x: n.x, y: n.y }));
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
          return (
            <path key={zone.id} d={d}
              fill="#f59e0b" fillOpacity={0.25}
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3"
            />
          );
        })}

        {/* Zone en cours de tracé */}
        {tool === 'EXCLUDE' && excludeChain.length >= 1 && cursor && (() => {
          const pts = [...excludeChain.map(n => ({ x: n.x, y: n.y })), cursor].map(p => worldToScreen(p));
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
          return (
            <path d={d}
              fill="none"
              stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3"
            />
          );
        })()}

        {/* Ring indicateur fermeture zone */}
        {tool === 'EXCLUDE' && excludeChain.length >= 3 && cursor && (() => {
          const first = excludeChain[0]!;
          const firstS = worldToScreen({ x: first.x, y: first.y });
          const curS = worldToScreen(cursor);
          if (Math.hypot(curS.x - firstS.x, curS.y - firstS.y) >= ENDPOINT_RADIUS_PX) return null;
          return (
            <circle cx={firstS.x} cy={firstS.y} r={ENDPOINT_RADIUS_PX + 4}
              fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2" opacity={0.7} />
          );
        })()}

        {/* Joint lines */}
        {jointLines.map((line, i) => {
          const sp1 = worldToScreen(line.p1);
          const sp2 = worldToScreen(line.p2);
          return (
            <line key={`joint-${i}`}
              x1={sp1.x} y1={sp1.y} x2={sp2.x} y2={sp2.y}
              stroke="var(--canvas-wall-joint)" strokeWidth={1.5} />
          );
        })}

        {/* Auto-cotations */}
        {visibleCotations.map((c, i) => {
          const sa1 = worldToScreen(c.anchor1);
          const sa2 = worldToScreen(c.anchor2);
          const ox = c.normal.x * c.offset * scale;
          const oy = c.normal.y * c.offset * scale;
          const sl1 = { x: sa1.x + ox, y: sa1.y + oy };
          const sl2 = { x: sa2.x + ox, y: sa2.y + oy };
          const smid = { x: (sl1.x + sl2.x) / 2, y: (sl1.y + sl2.y) / 2 };
          const isSelected = selectedCot?.wallId === c.wallId && selectedCot?.side === c.side;
          const color =
            isSelected ? '#f97316' :
            c.side === 'exterior' ? '#22c55e' :
            c.side === 'interior' ? '#3b82f6' : '#f97316';
          const tick = 5;
          return (
            <g key={`cot-${i}`} className="pointer-events-none">
              {/* Lignes témoins pointillées */}
              <line x1={sa1.x} y1={sa1.y} x2={sl1.x} y2={sl1.y}
                stroke={color} strokeWidth={0.7} strokeDasharray="3,3" />
              <line x1={sa2.x} y1={sa2.y} x2={sl2.x} y2={sl2.y}
                stroke={color} strokeWidth={0.7} strokeDasharray="3,3" />
              {/* Ligne de cote */}
              <line x1={sl1.x} y1={sl1.y} x2={sl2.x} y2={sl2.y}
                stroke={color} strokeWidth={1} />
              {/* Ticks perpendiculaires */}
              <line
                x1={sl1.x - c.normal.x * tick} y1={sl1.y - c.normal.y * tick}
                x2={sl1.x + c.normal.x * tick} y2={sl1.y + c.normal.y * tick}
                stroke={color} strokeWidth={1.5} />
              <line
                x1={sl2.x - c.normal.x * tick} y1={sl2.y - c.normal.y * tick}
                x2={sl2.x + c.normal.x * tick} y2={sl2.y + c.normal.y * tick}
                stroke={color} strokeWidth={1.5} />
              {/* Label cliquable — pointer-events réactivés sur ce groupe uniquement */}
              <g
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setSelectedCot({ wallId: c.wallId, side: c.side, screenX: smid.x + c.normal.x * 12, screenY: smid.y + c.normal.y * 12 }); }}
              >
                <text
                  x={smid.x + c.normal.x * 12} y={smid.y + c.normal.y * 12}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fill={color} fontWeight={isSelected ? 'bold' : 'normal'}
                  style={{ fontFamily: 'monospace', userSelect: 'none' }}
                >
                  {c.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* Chain preview */}
        {chainPreview && (
          <g transform={`translate(${chainPreview.sl.x},${chainPreview.sl.y}) rotate(${chainPreview.angle})`} opacity={0.5}>
            <rect x={0} y={-chainPreview.halfT} width={chainPreview.len} height={chainPreview.halfT * 2}
              fill={WALL_COLOR} stroke="#e67e22" strokeWidth={1} strokeDasharray="6,3" rx={1} />
          </g>
        )}

        {/* Snap colinéaire — ligne pointillée violette dans la direction du mur */}
        {snapResult?.type === 'collinear' && snapResult.dir && cursor && (() => {
          const sc = worldToScreen(cursor);
          const d = snapResult.dir!;
          const BIG = 2000;
          return (
            <line
              x1={sc.x - d.x * BIG} y1={sc.y - d.y * BIG}
              x2={sc.x + d.x * BIG} y2={sc.y + d.y * BIG}
              stroke="#8b5cf6" strokeWidth={1} strokeDasharray="6,3" opacity={0.6}
            />
          );
        })()}

        {/* H/V snap guide lines */}
        {snapResult?.type === 'hv' && cursor && (() => {
          const sc = worldToScreen(cursor);
          if (!snapResult.axis) {
            // Intersection : afficher les deux lignes (croix)
            return (
              <>
                <line x1={0} y1={sc.y} x2="100%" y2={sc.y}
                  stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.7} />
                <line x1={sc.x} y1={0} x2={sc.x} y2="100%"
                  stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.7} />
              </>
            );
          }
          if (snapResult.axis === 'h') {
            return <line x1={0} y1={sc.y} x2="100%" y2={sc.y}
              stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />;
          }
          return <line x1={sc.x} y1={0} x2={sc.x} y2="100%"
            stroke="#27ae60" strokeWidth={1} strokeDasharray="6,3" opacity={0.5} />;
        })()}

        {/* Snap indicator */}
        {cursor && (() => {
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
          if (snapResult?.type === 'perpendicular') {
            // Petit carré vert = symbole d'angle droit
            const s = SNAP_INDICATOR_R;
            return <rect x={sc.x - s / 2} y={sc.y - s / 2} width={s} height={s}
              fill="rgba(39,174,96,0.2)" stroke="#27ae60" strokeWidth={2} />;
          }
          if (snapResult?.type === 'collinear') {
            return <circle cx={sc.x} cy={sc.y} r={SNAP_INDICATOR_R}
              fill="none" stroke="#8b5cf6" strokeWidth={1.5} />;
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

        {/* Zone node handles (SELECT mode) */}
        {tool === 'SELECT' && excludedZones.flatMap((zone) =>
          zone.nodes.map((zn) => {
            const sp = worldToScreen({ x: zn.x, y: zn.y });
            const isDragging =
              draggingZoneNode?.nodeId === zn.id && draggingZoneNode?.zoneId === zone.id;
            return (
              <circle
                key={`zn-${zone.id}-${zn.id}`}
                cx={sp.x} cy={sp.y} r={5}
                fill={isDragging ? '#f59e0b' : 'none'}
                stroke="#f59e0b"
                strokeWidth={isDragging ? 2 : 1.5}
                style={{ cursor: 'grab' }}
              />
            );
          }),
        )}
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

      {/* AutoCotationPanel */}
      {selectedCot && (() => {
        const cot = autoCotations.find(
          (ac) => ac.wallId === selectedCot.wallId && ac.side === selectedCot.side,
        );
        const wall = walls.find((w) => w.id === selectedCot.wallId);
        return cot && wall ? (
          <AutoCotationPanel
            key={`${selectedCot.wallId}-${selectedCot.side}`}
            cot={cot}
            wall={wall}
            nodes={nodes}
            screenX={selectedCot.screenX}
            screenY={selectedCot.screenY}
            onApply={(nodeId, newPos) => {
              onPushHistory();
              onUpdateNode(nodeId, newPos);
            }}
            onClose={() => setSelectedCot(null)}
          />
        ) : null;
      })()}

      {/* Rename room input */}
      {renamingRoom && (
        <div
          className="absolute z-30"
          style={{ left: renamingRoom.screenX, top: renamingRoom.screenY, transform: 'translate(-50%, -50%)' }}
        >
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') setRenamingRoom(null);
            }}
            onBlur={submitRename}
            className="rounded border border-orange-500 bg-white/95 dark:bg-zinc-900/95 px-2 py-1 text-center text-xs font-bold text-gray-900 dark:text-white shadow-xl outline-none"
            style={{ minWidth: '6rem' }}
          />
        </div>
      )}

      {/* Panel raccourcis — desktop uniquement */}
      <div
        className="pointer-events-none absolute bottom-5 right-5 z-10 hidden md:block mouse:block rounded-xl px-4 py-3 text-[11px] shadow-xl backdrop-blur-md"
        style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', opacity: 0.9 }}
      >
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>Raccourcis</p>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-1.5" style={{ color: 'var(--text2)' }}>
          <span>Annuler la chaîne</span>
          <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Échap</kbd>
          <span>Orthogonalité</span>
          <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>⇧ Maj</kbd>
          <span>Sans aimantation</span>
          <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl</kbd>
          <span>Annuler</span>
          <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Z</kbd>
          <span>Rétablir</span>
          <kbd className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>Ctrl+Y</kbd>
          <span>Épaisseur mur</span>
          <span className="justify-self-end rounded px-1.5 py-0.5 font-mono text-[9px]" style={{ border: '1px solid var(--bdr2)', background: 'var(--surf2)', color: 'var(--text2)' }}>2×clic</span>
        </div>
      </div>
    </div>
  );
};
