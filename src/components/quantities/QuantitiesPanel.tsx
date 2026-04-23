'use client';

import { useMemo } from 'react';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { analyzeQuantities, type QuantityResult, type CutDetail } from '@/engine/quantities/quantityEngine';
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
  color: string;
  reused?: boolean;
}

const TileThumbnail = ({ tileW, tileH, usedW, usedH, color, reused }: ThumbnailProps) => {
  const maxDim = 48;
  const scale = Math.min(maxDim / tileW, maxDim / tileH);
  const tw = tileW * scale;
  const th = tileH * scale;
  const uw = Math.min(usedW * scale, tw);
  const uh = Math.min(usedH * scale, th);

  return (
    <svg width={tw} height={th} className="shrink-0 overflow-visible">
      <rect x={0} y={0} width={tw} height={th} fill="#27272a" rx="2" />
      <rect x={0} y={th - uh} width={uw} height={uh} fill={reused ? '#86efac' : color} rx="1" />
      <rect x={0} y={0} width={tw} height={th} fill="none" stroke="#52525b" strokeWidth="1" rx="2" />
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
    zinc: 'text-zinc-200 border-zinc-700 bg-zinc-800/50',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[accent]}`}>
      <div className="text-3xl font-black tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wider opacity-70">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] opacity-50">{sub}</div>}
    </div>
  );
};

// ─── Annotated plan view ──────────────────────────────────────────────────────

const fmtDim = (mm: number) => (mm / 10).toFixed(1).replace(/\.0$/, '');

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

  const cutMap = new Map<string, CutDetail>(result.cuts.map((c) => [c.id, c]));
  const fontSize = Math.min(config.width, config.height) * 0.2;
  const fontSizeSm = fontSize * 0.72;

  return (
    <div>
      <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
        Plan de calepinage annoté
      </h3>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
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
              fill="#09090b"
            />
          ))}

          {/* Tiles */}
          <g clipPath="url(#qty-plan-clip)">
            <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
              {result.tiles.map((tile) => {
                const cut = cutMap.get(tile.id);
                const isWhole = tile.type === 'WHOLE';
                const isReused = cut ? cut.coveredById !== null : false;
                const isProvider = cut ? cut.reusedForId !== null : false;

                let fill: string;
                if (isWhole) fill = config.color;
                else if (isReused) fill = '#052e16';
                else fill = '#27272a';

                const tcx = tile.rect.x + tile.rect.w / 2;
                const tcy = tile.rect.y + tile.rect.h / 2;

                return (
                  <g key={tile.id}>
                    <rect
                      x={tile.rect.x}
                      y={tile.rect.y}
                      width={tile.rect.w}
                      height={tile.rect.h}
                      fill={fill}
                      fillOpacity={isWhole ? 0.75 : 1}
                      stroke="#09090b"
                      strokeWidth={config.joint}
                    />
                    {cut && (
                      <>
                        <text
                          x={tcx}
                          y={tcy - fontSize * 0.15}
                          textAnchor="middle"
                          dominantBaseline="auto"
                          fontSize={fontSize}
                          fontWeight="700"
                          fontFamily="ui-monospace, monospace"
                          fill={isReused ? '#6ee7b7' : '#d4d4d8'}
                        >
                          {fmtDim(cut.usedW)}×{fmtDim(cut.usedH)}
                        </text>
                        {(isReused || isProvider) && (
                          <text
                            x={tcx}
                            y={tcy + fontSize * 0.75}
                            textAnchor="middle"
                            dominantBaseline="auto"
                            fontSize={fontSizeSm}
                            fontFamily="ui-monospace, monospace"
                            fill={isReused ? '#34d399' : '#f97316'}
                          >
                            {isReused ? '↩ chute' : '→ chute'}
                          </text>
                        )}
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
        <div className="flex items-center gap-6 border-t border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: config.color, opacity: 0.75 }} />
            Entier
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="inline-block h-3 w-5 rounded-sm bg-zinc-700" />
            Coupe
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="inline-block h-3 w-5 rounded-sm bg-emerald-950" />
            <span className="text-emerald-400">↩ chute réutilisée</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="text-orange-400">→ chute</span>
            <span>fournie pour une autre coupe</span>
          </div>
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
    return analyzeQuantities(project.rooms, project.config);
  }, [project]);

  if (!result) return null;

  if (result.totalTiles === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-950 text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project?.config.color ?? '#93c5fd';

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <h2 className="text-lg font-black text-zinc-100">Tableau des quantités</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Format&nbsp;: <span className="font-bold text-zinc-300">{tileLabel}</span> —
          Joint&nbsp;: <span className="font-bold text-zinc-300">{result.joint}&nbsp;mm</span> —
          Surface&nbsp;: <span className="font-bold text-zinc-300">{formatM2(result.roomArea)}</span>
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
        <div>
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Détail des coupes
          </h3>
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 text-left">Visuel</th>
                  <th className="px-4 py-3 text-left">Dimensions coupées</th>
                  <th className="px-4 py-3 text-left">Chute disponible</th>
                  <th className="px-4 py-3 text-right">Qté totale</th>
                  <th className="px-4 py-3 text-right">Réutil.</th>
                  <th className="px-4 py-3 text-right font-black text-zinc-300">Carreaux nets</th>
                </tr>
              </thead>
              <tbody>
                {result.cutGroups.map((g, i) => {
                  const hasBigChute = g.chuteW > 20 && g.chuteH > 20;
                  return (
                    <tr
                      key={`${g.usedW}×${g.usedH}`}
                      className={`border-b border-zinc-800/60 transition-colors hover:bg-zinc-900/60 ${i % 2 === 0 ? '' : 'bg-zinc-900/20'}`}
                    >
                      <td className="px-4 py-3">
                        <TileThumbnail
                          tileW={result.tileW}
                          tileH={result.tileH}
                          usedW={g.usedW}
                          usedH={g.usedH}
                          color={color}
                          reused={g.reuseCount > 0}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-zinc-100">
                          {formatCm(g.usedW)} × {formatCm(g.usedH)}
                        </span>
                        <div className="mt-0.5 text-[10px] text-zinc-500">
                          {((g.usedW * g.usedH) / (result.tileW * result.tileH) * 100).toFixed(0)}% du carreau
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {hasBigChute ? (
                          <>
                            <span className="font-mono font-bold text-emerald-400">
                              {formatCm(g.chuteW)} × {formatCm(g.chuteH)}
                            </span>
                            <div className="mt-0.5 text-[10px] text-zinc-500">
                              {((g.chuteW * g.chuteH) / (result.tileW * result.tileH) * 100).toFixed(0)}% récupérable
                            </div>
                          </>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">
                        {g.totalCount}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {g.reuseCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
                            ↩ {g.reuseCount}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-base font-black text-zinc-100">
                          {g.netTiles}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-700 bg-zinc-900">
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-zinc-400">
                    Total coupes
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-zinc-300">
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
              <div className="mt-3 space-y-1.5 text-sm text-zinc-400">
                <div className="flex justify-between gap-12">
                  <span>Carreaux entiers</span>
                  <span className="font-mono font-bold text-zinc-200">{result.wholeCount}</span>
                </div>
                <div className="flex justify-between gap-12">
                  <span>Carreaux pour coupes</span>
                  <span className="font-mono font-bold text-zinc-200">{result.tilesForCuts}</span>
                </div>
                {result.totalReuseCount > 0 && (
                  <div className="flex justify-between gap-12 text-emerald-400">
                    <span>Économies (réutilisation chutes)</span>
                    <span className="font-mono font-bold">−{result.totalReuseCount}</span>
                  </div>
                )}
                <div className="my-2 border-t border-zinc-700" />
                <div className="flex justify-between gap-12 text-zinc-300">
                  <span>Sous-total</span>
                  <span className="font-mono font-bold">{result.totalTiles}</span>
                </div>
                <div className="flex justify-between gap-12 text-zinc-500">
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

        {result.totalReuseCount > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-400">
            <span className="font-bold">↩ {result.totalReuseCount} chute{result.totalReuseCount > 1 ? 's' : ''} réutilisable{result.totalReuseCount > 1 ? 's' : ''}</span>
            {' '}— les coupes marquées en vert dans le tableau peuvent être taillées dans les chutes d&apos;autres carreaux, évitant d&apos;ouvrir un nouveau carreau.
          </div>
        )}

      </div>
    </div>
  );
};
