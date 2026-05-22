'use client';

import { useMemo, useState } from 'react';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { formatCm, formatM2 } from '@/utils/formatters';
import { QuantityPlanView } from './QuantityPlanView';
import { CutGroupCard, GROUP_COLORS } from './CutGroupCard';

export const QuantitiesPanel = () => {
  const project = useProjectStore(selectActiveProject);
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!project) return null;
    return analyzeQuantities(project.rooms, project.config, project.wallThickness);
  }, [project]);

  if (!project || !result) return null;

  if (result.totalTiles === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-950 text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project.config.color;
  const totalCutArea = result.cuts.reduce((sum, c) => sum + c.usedW * c.usedH, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <h2 className="text-lg font-black text-zinc-100">Tableau des quantités</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Format&nbsp;: <span className="font-bold text-zinc-300">{tileLabel}</span>
          {' '}—{' '}
          Joint&nbsp;: <span className="font-bold text-zinc-300">{result.joint}&nbsp;mm</span>
          {' '}—{' '}
          Surface&nbsp;: <span className="font-bold text-zinc-300">{formatM2(result.roomArea)}</span>
        </p>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — annotated plan */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden border-r border-zinc-800 p-5">
          <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Plan de calepinage annoté
          </h3>
          <QuantityPlanView
            result={result}
            config={project.config}
            rooms={project.rooms}
            highlightGroup={highlightGroup}
          />
        </div>

        {/* Right — side panel */}
        <div className="flex w-[360px] shrink-0 flex-col gap-6 overflow-y-auto p-5">

          {/* Stat boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-t-2 border-blue-500 bg-zinc-900 p-4">
              <div className="text-2xl font-black tabular-nums text-zinc-100">{result.wholeCount}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Carreaux entiers
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {formatM2(result.wholeCount * result.tileW * result.tileH)}
              </div>
            </div>
            <div className="rounded-xl border-t-2 border-orange-500 bg-zinc-900 p-4">
              <div className="text-2xl font-black tabular-nums text-zinc-100">{result.cuts.length}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Carreaux à couper
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {formatM2(totalCutArea)} posés
              </div>
            </div>
          </div>

          {/* Cut group cards */}
          <div>
            <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Groupes de coupes
            </h3>
            <div className="flex flex-col gap-2">
              {result.cutGroups.map((group, i) => (
                <CutGroupCard
                  key={`${group.usedW}×${group.usedH}|${group.pieceEdges.left}|${group.pieceEdges.right}|${group.pieceEdges.top}|${group.pieceEdges.bottom}`}
                  group={group}
                  groupIndex={i}
                  groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
                  tileW={result.tileW}
                  tileH={result.tileH}
                  tileColor={color}
                  onHighlight={setHighlightGroup}
                />
              ))}
            </div>

            {/* Net summary row */}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
              <span className="text-zinc-500">Carreaux nets pour coupes</span>
              <span className="font-mono font-black text-zinc-100">{result.tilesForCuts} carreaux</span>
            </div>
          </div>

          {/* Total à commander */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-500/80">
              TOTAL À COMMANDER
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="space-y-1 text-xs text-zinc-400">
                <div>{result.wholeCount} entiers</div>
                <div>+ {result.tilesForCuts} pour coupes</div>
                <div className="font-bold text-zinc-300">= {result.totalTiles} nets</div>
                <div className="text-zinc-500">× 1.10 (+10%)</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-5xl font-black tabular-nums text-orange-400">
                  {result.toOrder}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-orange-500/70">
                  carreaux
                </div>
                <div className="mt-0.5 text-sm font-semibold text-orange-400 opacity-70">
                  {formatM2(result.toOrder * result.tileW * result.tileH)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
