'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Plan, Point } from '@/types/plan';
import { angle, distance } from '@/engine/geometry/polygon';
import { SNAP_GRID_MM, CLOSING_TOLERANCE_MM } from '@/constants/businessRules';
import { screenToWorld } from '@/utils/units';
import { PlanToolbar, type PlanTool } from './PlanToolbar';
import { DimensionEditor } from './DimensionEditor';
import { DrawingCanvas } from './DrawingCanvas';

interface PlanEditorProps {
  plan: Plan;
  setPlan: (plan: Plan) => void;
}

export const PlanEditor = ({ plan, setPlan }: PlanEditorProps) => {
  const [scale, setScale] = useState(0.1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [tool, setTool] = useState<PlanTool>('draw');

  const [draggedPoint, setDraggedPoint] = useState<number | null>(null);
  const [editingEdge, setEditingEdge] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      let newScale = scale * (direction > 0 ? zoomFactor : 1 / zoomFactor);
      newScale = Math.max(0.01, Math.min(newScale, 2));

      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
      const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [scale, pan]);

  const toWorld = (sx: number, sy: number): Point => ({
    x: screenToWorld(sx, scale, pan.x),
    y: screenToWorld(sy, scale, pan.y),
  });

  const snap = (p: Point): Point => ({
    x: Math.round(p.x / SNAP_GRID_MM) * SNAP_GRID_MM,
    y: Math.round(p.y / SNAP_GRID_MM) * SNAP_GRID_MM,
  });

  const isClosed = plan.length >= 3 && tool !== 'draw';

  const submitDimension = () => {
    if (editingEdge === null) return;

    const valCm = parseFloat(editValue);
    if (isNaN(valCm) || valCm <= 0) {
      setEditingEdge(null);
      return;
    }

    const newLengthMm = valCm * 10;
    const p1 = plan[editingEdge]!;
    const nextIndex = (editingEdge + 1) % plan.length;
    const p2 = plan[nextIndex]!;

    const currentDist = distance(p1, p2);
    if (currentDist === 0) {
      setEditingEdge(null);
      return;
    }

    const ang = angle(p1, p2);
    const dx = Math.cos(ang) * newLengthMm - (p2.x - p1.x);
    const dy = Math.sin(ang) * newLengthMm - (p2.y - p1.y);

    const newPlan = [...plan];

    if (isClosed) {
      let curr = nextIndex;
      while (curr !== 0) {
        newPlan[curr] = { x: newPlan[curr]!.x + dx, y: newPlan[curr]!.y + dy };
        curr = (curr + 1) % plan.length;
      }
    } else {
      for (let j = editingEdge + 1; j < plan.length; j++) {
        newPlan[j] = { x: newPlan[j]!.x + dx, y: newPlan[j]!.y + dy };
      }
    }

    setPlan(newPlan);
    setEditingEdge(null);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (editingEdge !== null) setEditingEdge(null);
    if (draggedPoint !== null) return;

    if (e.button === 1 || tool === 'pan' || e.button === 2) {
      setIsPanning(true);
      return;
    }

    if (tool === 'draw' && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const rawW = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const snappedW = snap(rawW);

      if (plan.length >= 3) {
        const distToStart = distance(snappedW, plan[0]!);
        if (distToStart < CLOSING_TOLERANCE_MM) {
          setTool('pan');
          return;
        }
      }

      setPlan([...plan, snappedW]);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();

    if (draggedPoint !== null) {
      const rawW = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      const snappedW = snap(rawW);
      const newPlan = [...plan];
      newPlan[draggedPoint] = snappedW;
      setPlan(newPlan);
      return;
    }

    if (isPanning) {
      setPan({ x: pan.x + e.movementX, y: pan.y + e.movementY });
    } else {
      const rawW = toWorld(e.clientX - rect.left, e.clientY - rect.top);
      setMousePos(snap(rawW));
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setDraggedPoint(null);
  };

  const handleEdgePointerDown =
    (edgeIndex: number, currentDistanceMm: number) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      setEditingEdge(edgeIndex);
      setEditValue((currentDistanceMm / 10).toFixed(1));
    };

  const handleVertexPointerDown = (index: number) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    setDraggedPoint(index);
  };

  const hintMessage =
    tool === 'draw' && !isClosed
      ? 'Tracez les murs. Rejoignez le premier point pour fermer.'
      : 'Modifiez les cotes, glissez les sommets, ou molette pour zoomer.';

  let editorScreen: { x: number; y: number } | null = null;
  if (editingEdge !== null) {
    const p1 = plan[editingEdge]!;
    const p2 = plan[(editingEdge + 1) % plan.length]!;
    editorScreen = {
      x: ((p1.x + p2.x) / 2) * scale + pan.x,
      y: ((p1.y + p2.y) / 2) * scale + pan.y,
    };
  }

  return (
    <div className="relative flex flex-1 overflow-hidden bg-slate-50">
      <PlanToolbar
        tool={tool}
        canUndo={plan.length > 0}
        onChangeTool={setTool}
        onUndo={() => setPlan(plan.slice(0, -1))}
        onClearAll={() => {
          setPlan([]);
          setTool('draw');
          setEditingEdge(null);
        }}
      />

      <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow backdrop-blur">
        {hintMessage}
      </div>

      {editingEdge !== null && editorScreen && (
        <DimensionEditor
          screenX={editorScreen.x}
          screenY={editorScreen.y}
          value={editValue}
          onChange={setEditValue}
          onSubmit={submitDimension}
          onCancel={() => setEditingEdge(null)}
        />
      )}

      <DrawingCanvas
        svgRef={svgRef}
        plan={plan}
        scale={scale}
        pan={pan}
        snapGrid={SNAP_GRID_MM}
        tool={tool}
        isPanning={isPanning}
        isClosed={isClosed}
        mousePos={mousePos}
        editingEdge={editingEdge}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onEdgePointerDown={handleEdgePointerDown}
        onVertexPointerDown={handleVertexPointerDown}
      />
    </div>
  );
};
