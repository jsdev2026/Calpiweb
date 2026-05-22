'use client';

import { useMemo } from 'react';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { analyzeQuantities, type QuantityResult, type CutRecord, type PieceEdges } from '@/engine/quantities/quantityEngine';
import { formatCm, formatM2 } from '@/utils/formatters';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';

// ─── Tile cut thumbnail ───────────────────────────────────────────────────────

interface ThumbnailProps {
  tileW: number;
  tileH: number;
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  color: string;
  reused?: boolean;
}

const TileThumbnail = ({ tileW, tileH, usedW, usedH, pieceEdges, color, reused }: ThumbnailProps) => {
  const maxDim = 48;
  const scale = Math.min(maxDim / tileW, maxDim / tileH);
  const tw = tileW * scale;
  const th = tileH * scale;
  const uw = Math.min(usedW * scale, tw);
  const uh = Math.min(usedH * scale, th);
  // Piece is anchored bottom-left
  const px = 0;
  const py = th - uh;
  const cutColor = '#f97316';
  const factoryColor = '#52525b';
  const sw = 1.5;
  const dash = '3,2';

  return (
    <svg width={tw} height={th} className="shrink-0 overflow-visible">
      <rect x={0} y={0} width={tw} height={th} fill="var(--tile-thumb-bg)" rx="2" />
      <rect x={px} y={py} width={uw} height={uh} fill={reused ? '#86efac' : color} rx="1" />
      {/* Edge indicators */}
      <line x1={px} y1={py} x2={px} y2={py + uh} stroke={pieceEdges.left === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.left === 'cut' ? dash : undefined} />
      <line x1={px + uw} y1={py} x2={px + uw} y2={py + uh} stroke={pieceEdges.right === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.right === 'cut' ? dash : undefined} />
      <line x1={px} y1={py} x2={px + uw} y2={py} stroke={pieceEdges.top === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.top === 'cut' ? dash : undefined} />
      <line x1={px} y1={py + uh} x2={px + uw} y2={py + uh} stroke={pieceEdges.bottom === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.bottom === 'cut' ? dash : undefined} />
      <rect x={0} y={0} width={tw} height={th} fill="none" stroke="var(--tile-thumb-bdr)" strokeWidth="0.5" rx="2" />
    </svg>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: 'orange' | 'green' | 'blue' | 'zinc';
}

const StatCard = ({ label, value, sub, accent = 'zinc' }: StatCardProps) => {
  const colors: Record<string, string> = {
    orange: 'text-orange-400 border-orange-500/20 bg-orange-500/5',
    green: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
    zinc: 'text-gray-800 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[accent]}`}>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wider opacity-70">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] opacity-50">{sub}</div>}
    </div>
  );
};

// ─── Group colour palette ─────────────────────────────────────────────────────

const GROUP_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee',
  '#818cf8', '#e879f9', '#f472b6', '#a78bfa', '#34d399',
];

// ─── Annotated plan view ──────────────────────────────────────────────────────

interface PlanViewProps {
  result: QuantityResult;
  config: TilingConfig;
  rooms: Room[];
}

const QuantityPlanView = ({ result, config, rooms }: PlanViewProps) => {
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

  // Map: "usedW×usedH" → { index, color }
  const groupMap = new Map(
    result.cutGroups.map((g, i) => [
      `${g.usedW}×${g.usedH}`,
      { index: i, color: GROUP_COLORS[i % GROUP_COLORS.length]! },
    ])
  );

  const labelSize = Math.min(config.width, config.height) * 0.15;

  return (
    <div>
      <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500">
        Plan de calepinage annoté
      </h3>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="w-full"
          style={{ maxHeight: 420, display: 'block' }}
        >
          <defs>
            <clipPath id="qty-plan-clip">
              {validRooms.map((room) => (
                <polygon
                  key={room.id}
                  points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </clipPath>
          </defs>

          {/* Room background */}
          {validRooms.map((room) => (
            <polygon
              key={`bg-${room.id}`}
              points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="var(--tile-joint)"
            />
          ))}

          {/* Tiles */}
          <g clipPath="url(#qty-plan-clip)">
            <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
              {result.tiles.map((tile) => {
                const cut = cutMap.get(tile.id);
                const isWhole = tile.type === 'WHOLE';
                const isReused = cut ? cut.coveredById !== null : false;

                const groupInfo = cut ? groupMap.get(`${cut.usedW}×${cut.usedH}`) : undefined;
                const groupColor = groupInfo?.color;

                let fill: string;
                let fillOpacity: number;
                if (isWhole) {
                  fill = config.color;
                  fillOpacity = 0.75;
                } else if (isReused && groupColor) {
                  fill = groupColor;
                  fillOpacity = 0.28;
                } else {
                  fill = 'var(--tile-cut-bg)';
                  fillOpacity = 1;
                }

                return (
                  <g key={tile.id}>
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
                          fill={isReused && groupColor ? groupColor : '#a1a1aa'}
                        >
                          {groupInfo.index + 1}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </g>

          {/* Room walls */}
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

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 dark:border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: config.color, opacity: 0.75 }} />
            Entier
          </div>
          {result.cutGroups.slice(0, 6).map((g, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
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
              {formatCm(g.usedW)} × {formatCm(g.usedH)}
            </div>
          ))}
          {result.cutGroups.length > 6 && (
            <span className="text-[11px] text-gray-400 dark:text-zinc-600">+{result.cutGroups.length - 6} autres</span>
          )}
          {result.totalReuseCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-zinc-400">
              <span className="text-emerald-400 font-bold">↩</span>
              chute réutilisée
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const QuantitiesPanel = () => {
  const project = useProjectStore(selectActiveProject);

  const result = useMemo(() => {
    if (!project) return null;
    return analyzeQuantities(project.rooms, project.config, project.wallThickness);
  }, [project]);

  if (!result) return null;

  if (result.totalTiles === 0) {
    return (
      <div className="flex flex-1 items-center justify-center dark:bg-zinc-950 bg-gray-50 text-gray-500 dark:text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project?.config.color ?? '#93c5fd';

  return (
    <div className="flex flex-1 flex-col overflow-hidden dark:bg-zinc-950 bg-gray-50">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">Tableau des quantités</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-500">
          Format&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{tileLabel}</span> —
          Joint&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{result.joint}&nbsp;mm</span> —
          Surface&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{formatM2(result.roomArea)}</span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Carreaux entiers"
            value={result.wholeCount}
            accent="zinc"
          />
          <StatCard
            label="Coupes nécessaires"
            value={result.cuts.length}
            sub={`${result.cutGroups.length} format${result.cutGroups.length > 1 ? 's' : ''} distinct${result.cutGroups.length > 1 ? 's' : ''}`}
            accent="zinc"
          />
          <StatCard
            label="Chutes réutilisées"
            value={result.totalReuseCount}
            sub={result.totalReuseCount > 0 ? `${result.totalReuseCount} carreau${result.totalReuseCount > 1 ? 'x' : ''} économisé${result.totalReuseCount > 1 ? 's' : ''}` : 'Aucune économie'}
            accent={result.totalReuseCount > 0 ? 'green' : 'zinc'}
          />
          <StatCard
            label="Total à commander"
            value={result.toOrder}
            sub={`+10% marge · ${result.totalTiles} nets`}
            accent="orange"
          />
        </div>

        {/* Annotated plan */}
        {project && <QuantityPlanView result={result} config={project.config} rooms={project.rooms} />}

        {/* Cut groups table */}
        {result.totalReuseCount > 0 && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-400">
            <span className="font-bold">↩ {result.totalReuseCount} chute{result.totalReuseCount > 1 ? 's' : ''} réutilisable{result.totalReuseCount > 1 ? 's' : ''}</span>
            {' '}— les coupes marquées en vert dans le tableau peuvent être taillées dans les chutes d&apos;autres carreaux, évitant d&apos;ouvrir un nouveau carreau.
          </div>
        )}
        <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-zinc-500">
          Détail des coupes
        </h3>
        <div className="overflow-x-auto">
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-zinc-800 min-w-[640px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Visuel</th>
                  <th className="px-4 py-3 text-left">Dimensions coupées</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Chute disponible</th>
                  <th className="px-4 py-3 text-right">Qté totale</th>
                  <th className="px-4 py-3 text-right">Récupérées</th>
                  <th className="px-4 py-3 text-right font-black text-gray-700 dark:text-zinc-300">Carreaux nets</th>
                </tr>
              </thead>
              <tbody>
                {result.cutGroups.map((g, i) => {
                  const hasBigChute = g.chuteW > 20 && g.chuteH > 20;
                  const groupColor = GROUP_COLORS[i % GROUP_COLORS.length]!;
                  const cutEdgeCount = (['left', 'right', 'top', 'bottom'] as const).filter(
                    (s) => g.pieceEdges[s] === 'cut',
                  ).length;
                  return (
                    <tr
                      key={`${g.usedW}×${g.usedH}|${g.pieceEdges.left[0]}${g.pieceEdges.right[0]}${g.pieceEdges.top[0]}${g.pieceEdges.bottom[0]}`}
                      className={`border-b border-gray-100 dark:border-zinc-800/60 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900/60 ${i % 2 === 0 ? '' : 'bg-gray-50/60 dark:bg-zinc-900/20'}`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
                          style={{
                            background: `${groupColor}20`,
                            color: groupColor,
                            border: `1.5px solid ${groupColor}40`,
                          }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <TileThumbnail
                          tileW={result.tileW}
                          tileH={result.tileH}
                          usedW={g.usedW}
                          usedH={g.usedH}
                          pieceEdges={g.pieceEdges}
                          color={color}
                          reused={g.reuseCount > 0}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">
                          {formatCm(g.usedW)} × {formatCm(g.usedH)}
                        </span>
                        <div className="mt-0.5 text-[10px] text-gray-500 dark:text-zinc-500">
                          {((g.usedW * g.usedH) / (result.tileW * result.tileH) * 100).toFixed(0)}% du carreau
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          cutEdgeCount <= 1
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {cutEdgeCount <= 1 ? 'Simple' : 'Angle'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {hasBigChute ? (
                          <>
                            <span className="font-mono font-bold text-emerald-400">
                              {formatCm(g.chuteW)} × {formatCm(g.chuteH)}
                            </span>
                            <div className="mt-0.5 text-[10px] text-gray-500 dark:text-zinc-500">
                              {((g.chuteW * g.chuteH) / (result.tileW * result.tileH) * 100).toFixed(0)}% récupérable
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-zinc-400">
                        {g.totalCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {g.reuseCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
                            ↩ {g.reuseCount}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-base font-black text-gray-900 dark:text-zinc-100">
                          {g.netTiles}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900">
                  <td colSpan={5} className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-zinc-400">
                    Total coupes
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-700 dark:text-zinc-300">
                    {result.cuts.length}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                    {result.totalReuseCount > 0 ? `↩ ${result.totalReuseCount}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-base font-black text-orange-400">
                    {result.tilesForCuts}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Order summary */}
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-orange-500/80">
                Récapitulatif de commande
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-gray-500 dark:text-zinc-400">
                <div className="flex justify-between gap-12">
                  <span>Carreaux entiers</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{result.wholeCount}</span>
                </div>
                <div className="flex justify-between gap-12">
                  <span>Carreaux pour coupes</span>
                  <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{result.tilesForCuts}</span>
                </div>
                {result.totalReuseCount > 0 && (
                  <div className="flex justify-between gap-12 text-emerald-400">
                    <span>Économies (réutilisation chutes)</span>
                    <span className="font-mono font-bold">−{result.totalReuseCount}</span>
                  </div>
                )}
                <div className="my-2 border-t border-gray-200 dark:border-zinc-700" />
                <div className="flex justify-between gap-12 text-gray-700 dark:text-zinc-300">
                  <span>Sous-total</span>
                  <span className="font-mono font-bold">{result.totalTiles}</span>
                </div>
                <div className="flex justify-between gap-12 text-gray-400 dark:text-zinc-500">
                  <span>Marge casse / perte (+10%)</span>
                  <span className="font-mono">+{result.toOrder - result.totalTiles}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-5xl font-black tabular-nums text-orange-400">
                {result.toOrder}
              </div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-orange-500/70">
                carreaux à commander
              </div>
              <div className="mt-2 text-[10px] text-zinc-500">
                {tileLabel}
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
