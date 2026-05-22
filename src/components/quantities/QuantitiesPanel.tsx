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
      <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-400 dark:text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project.config.color;
  const totalCutArea = result.cuts.reduce((sum, c) => sum + c.usedW * c.usedH, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">Tableau des quantités</h2>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-zinc-500">
          Format&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{tileLabel}</span>
          {' '}—{' '}
          Joint&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{result.joint}&nbsp;mm</span>
          {' '}—{' '}
          Surface&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{formatM2(result.roomArea)}</span>
        </p>
      </div>

      {/* Stat strip */}
      <div className="shrink-0 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-3">
        <div className="grid grid-cols-4 gap-4">
          {/* Carreaux entiers */}
          <div className="rounded-xl border-l-[3px] border-blue-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
            <div className="text-xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.wholeCount}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Carreaux entiers</div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{formatM2(result.wholeCount * result.tileW * result.tileH)}</div>
          </div>
          {/* Carreaux à couper */}
          <div className="rounded-xl border-l-[3px] border-orange-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
            <div className="text-xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.cuts.length}</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Carreaux à couper</div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">{formatM2(totalCutArea)} posés</div>
          </div>
          {/* Récupérées */}
          <div className="rounded-xl border-l-[3px] border-emerald-500 bg-gray-50 dark:bg-zinc-800/60 px-4 py-2">
            <div className={`text-xl font-black tabular-nums ${result.totalReuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-600'}`}>
              {result.totalReuseCount}
            </div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">Récupérées</div>
            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
              {result.totalReuseCount > 0 ? 'dans une chute' : '—'}
            </div>
          </div>
          {/* Total à commander */}
          <div className="flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-500/80">Total à commander</div>
              <div className="mt-0.5 text-[11px] text-gray-400 dark:text-zinc-500">
                {result.wholeCount} + ({result.cuts.length}−{result.totalReuseCount}) = {result.totalTiles} × 1.10
              </div>
              <div className="text-[11px] text-orange-400/70">{formatM2(result.toOrder * result.tileW * result.tileH)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-2xl font-black tabular-nums text-orange-400">{result.toOrder}</div>
              <div className="text-[10px] font-bold text-orange-500/60">carreaux</div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — annotated plan */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden border-r border-gray-200 dark:border-zinc-800 p-5">
          <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
            Plan de calepinage annoté
          </h3>
          <QuantityPlanView
            result={result}
            config={project.config}
            rooms={project.rooms}
            highlightGroup={highlightGroup}
          />
        </div>

        {/* Right — cut groups */}
        <div className="flex w-[360px] shrink-0 flex-col gap-4 overflow-y-auto p-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
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
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-zinc-800 pt-3 text-xs">
            <span className="text-gray-400 dark:text-zinc-500">Carreaux nets pour coupes</span>
            <span className="font-mono font-black text-gray-900 dark:text-zinc-100">{result.tilesForCuts} carreaux</span>
          </div>
        </div>
      </div>
    </div>
  );
};
