'use client';
import { useId, useRef, useState, useEffect } from 'react';
import type { QuantityResult, CutRecord } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { GROUP_COLORS } from './CutGroupCard';

export interface QuantityPlanViewProps {
  result: QuantityResult;
  config: TilingConfig;
  rooms: Room[];
  highlightGroup: number | null;
}

export const QuantityPlanView = ({ result, config, rooms, highlightGroup }: QuantityPlanViewProps) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `qty-plan-clip-${uid}`;

  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const allPoints = validRooms.flatMap((r) => r.points);

  // Bounding box (fallback si pas de pièces valides)
  const bbox = allPoints.length > 0
    ? getBoundingBox(allPoints)
    : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const pad = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.1;
  const initX = bbox.minX - pad;
  const initY = bbox.minY - pad;
  const initW = bbox.maxX - bbox.minX + pad * 2;
  const initH = bbox.maxY - bbox.minY + pad * 2;

  // ── Tous les hooks avant le return conditionnel ──
  const [vb, setVb] = useState({ x: initX, y: initY, w: initW, h: initH });
  const [dragging, setDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Ref miroir de vb pour les handlers natifs (évite les stale closures)
  const vbRef = useRef(vb);
  vbRef.current = vb;
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const touchRef = useRef<{ dist: number; midX: number; midY: number; vb: typeof vb } | null>(null);

  const isDirty =
    vb.x !== initX || vb.y !== initY || vb.w !== initW || vb.h !== initH;

  // ── Wheel (passive: false) + touchmove (passive: false) via useEffect ──
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const minW = initW * 0.1;
    const maxW = initW * 5;

    const clampAndApply = (
      uncW: number,
      uncH: number,
      svgMx: number,
      svgMy: number,
      mx: number,
      my: number,
      rectW: number,
      rectH: number,
    ) => {
      if (!uncW || !uncH) return { x: svgMx, y: svgMy, w: minW, h: minW }; // degenerate case
      const nw = Math.max(minW, Math.min(maxW, uncW));
      const nh = uncH * (nw / uncW);
      return { x: svgMx - mx * (nw / rectW), y: svgMy - my * (nh / rectH), w: nw, h: nh };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setVb((prev) => {
        const svgMx = prev.x + mx * (prev.w / rect.width);
        const svgMy = prev.y + my * (prev.h / rect.height);
        return clampAndApply(prev.w * factor, prev.h * factor, svgMx, svgMy, mx, my, rect.width, rect.height);
      });
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      if (e.touches.length === 1 && dragRef.current) {
        const touch = e.touches[0]!;
        const dx = touch.clientX - dragRef.current.x;
        const dy = touch.clientY - dragRef.current.y;
        dragRef.current = { x: touch.clientX, y: touch.clientY };
        setVb((prev) => ({
          ...prev,
          x: prev.x - dx * (prev.w / rect.width),
          y: prev.y - dy * (prev.h / rect.height),
        }));
      } else if (e.touches.length === 2 && touchRef.current) {
        const t0 = e.touches[0]!;
        const t1 = e.touches[1]!;
        const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        if (!newDist) return;
        const factor = touchRef.current.dist / newDist;
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const mx = midX - rect.left;
        const my = midY - rect.top;
        setVb((prev) => {
          const svgMx = prev.x + mx * (prev.w / rect.width);
          const svgMy = prev.y + my * (prev.h / rect.height);
          return clampAndApply(prev.w * factor, prev.h * factor, svgMx, svgMy, mx, my, rect.width, rect.height);
        });
        // Update ref so next frame uses current distance as baseline
        touchRef.current = { ...touchRef.current, dist: newDist, midX, midY };
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [initW, initH]);

  // Sync vb to new init values when room geometry changes
  useEffect(() => {
    setVb({ x: initX, y: initY, w: initW, h: initH });
  }, [initX, initY, initW, initH]);

  // ── Handlers souris (React synthetic events) ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const movX = e.movementX;
    const movY = e.movementY;
    setVb((prev) => ({
      ...prev,
      x: prev.x - movX * (prev.w / rect.width),
      y: prev.y - movY * (prev.h / rect.height),
    }));
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // ── Handlers touch start/end (React — pas besoin de preventDefault ici) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
      touchRef.current = null;
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      touchRef.current = {
        dist,
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
        vb: vbRef.current,
      };
      dragRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    dragRef.current = null;
    touchRef.current = null;
  };

  const resetVb = () => setVb({ x: initX, y: initY, w: initW, h: initH });

  // ── Return conditionnel APRÈS tous les hooks ──
  if (validRooms.length === 0 || result.tiles.length === 0) return null;

  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const cutMap = new Map<string, CutRecord>(result.cuts.map((c) => [c.id, c]));
  const groupMap = new Map(
    result.cutGroups.map((g, i) => [
      `${g.usedW}×${g.usedH}|${g.pieceEdges.left}|${g.pieceEdges.right}|${g.pieceEdges.top}|${g.pieceEdges.bottom}`,
      { index: i, color: GROUP_COLORS[i % GROUP_COLORS.length]! },
    ]),
  );
  const labelSize = Math.min(config.width, config.height) * 0.15;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={wrapperRef}
        data-testid="plan-wrapper"
        className={`relative flex flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-950 select-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="h-full w-full"
          style={{ display: 'block' }}
        >
          <defs>
            <clipPath id={clipId}>
              {validRooms.map((room) => (
                <polygon
                  key={room.id}
                  points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </clipPath>
          </defs>

          {validRooms.map((room) => (
            <polygon
              key={`bg-${room.id}`}
              points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="var(--tile-joint)"
            />
          ))}

          <g clipPath={`url(#${clipId})`}>
            <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
              {result.tiles.map((tile) => {
                const cut = cutMap.get(tile.id);
                const isWhole = tile.type === 'WHOLE';
                const isReused = cut ? cut.coveredById !== null : false;

                const groupInfo = cut
                  ? groupMap.get(`${cut.usedW}×${cut.usedH}|${cut.pieceEdges.left}|${cut.pieceEdges.right}|${cut.pieceEdges.top}|${cut.pieceEdges.bottom}`)
                  : undefined;
                const groupColor = groupInfo?.color;
                const groupNumber = groupInfo ? groupInfo.index + 1 : null;

                let dimOpacity = 1;
                if (highlightGroup !== null) {
                  dimOpacity = !isWhole && groupNumber === highlightGroup ? 1 : 0.12;
                }
                const isHighlighted = highlightGroup !== null && !isWhole && groupNumber === highlightGroup;

                const fill = isWhole
                  ? config.color
                  : isReused && groupColor
                    ? groupColor
                    : 'var(--tile-cut-bg)';
                const fillOpacity = isWhole ? 0.7 : isReused ? 0.28 : 1;

                return (
                  <g
                    key={tile.id}
                    style={{
                      opacity: dimOpacity,
                      transition: 'opacity 0.15s ease, filter 0.15s ease',
                      filter: isHighlighted && groupColor ? `drop-shadow(0 0 8px ${groupColor}88)` : undefined,
                    }}
                  >
                    <rect
                      x={tile.rect.x}
                      y={tile.rect.y}
                      width={tile.rect.w}
                      height={tile.rect.h}
                      fill={fill}
                      fillOpacity={fillOpacity}
                    />
                    {cut && groupInfo && (
                      <>
                        <circle cx={cut.clipCx} cy={cut.clipCy} r={labelSize * 0.62} fill="rgba(0,0,0,0.50)" />
                        <text
                          x={cut.clipCx}
                          y={cut.clipCy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={labelSize}
                          fontWeight="600"
                          fontFamily="system-ui, -apple-system, sans-serif"
                          fill={groupColor ?? '#a1a1aa'}
                        >
                          {isReused ? '↩' : groupInfo.index + 1}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </g>

          {validRooms.map((room) =>
            room.points.map((p, i) => {
              const nextP = room.points[(i + 1) % room.points.length]!;
              const isDoor = (room.edges[i] ?? 'WALL') === 'DOOR';
              return (
                <line
                  key={`edge-${room.id}-${i}`}
                  x1={p.x} y1={p.y}
                  x2={nextP.x} y2={nextP.y}
                  stroke={isDoor ? '#f97316' : '#ea580c'}
                  strokeWidth={isDoor ? 50 : 80}
                  strokeLinecap="round"
                  strokeDasharray={isDoor ? '120,80' : undefined}
                />
              );
            }),
          )}
        </svg>

        {/* ── Bouton reset zoom (visible seulement si zoom/pan actif) ── */}
        {isDirty && (
          <button
            type="button"
            aria-label="Ajuster la vue"
            onClick={resetVb}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:bg-white hover:text-gray-900 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span aria-hidden>⊙</span> Ajuster
          </button>
        )}
      </div>
    </div>
  );
};
