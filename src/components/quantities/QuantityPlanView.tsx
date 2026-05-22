'use client';
import { useId } from 'react';
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
  if (validRooms.length === 0 || result.tiles.length === 0) return null;

  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const pad = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.1;
  const vbX = bbox.minX - pad;
  const vbY = bbox.minY - pad;
  const vbW = bbox.maxX - bbox.minX + pad * 2;
  const vbH = bbox.maxY - bbox.minY + pad * 2;
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
      <div className="flex flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-zinc-800 dark:bg-zinc-950">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
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

                const groupInfo = cut ? groupMap.get(`${cut.usedW}×${cut.usedH}|${cut.pieceEdges.left}|${cut.pieceEdges.right}|${cut.pieceEdges.top}|${cut.pieceEdges.bottom}`) : undefined;
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
                        <circle
                          cx={cut.clipCx}
                          cy={cut.clipCy}
                          r={labelSize * 0.62}
                          fill="rgba(0,0,0,0.50)"
                        />
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
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 print:mt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
          <span className="inline-block h-3 w-5 rounded-sm" style={{ background: config.color, opacity: 0.7 }} />
          Carreau entier
        </div>
        {result.cutGroups.map((g, i) => (
          <div key={`${g.usedW}×${g.usedH}|${g.pieceEdges.left}|${g.pieceEdges.right}|${g.pieceEdges.top}|${g.pieceEdges.bottom}`} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-black"
              style={{
                background: `${GROUP_COLORS[i % GROUP_COLORS.length]}33`,
                color: GROUP_COLORS[i % GROUP_COLORS.length],
                border: `1.5px solid ${GROUP_COLORS[i % GROUP_COLORS.length]}55`,
              }}
            >
              {i + 1}
            </span>
            Coupe {i + 1}
          </div>
        ))}
        {result.totalReuseCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-zinc-400">
            <span className="font-bold text-emerald-400">↩</span>
            Taillée dans une chute
          </div>
        )}
      </div>
    </div>
  );
};
