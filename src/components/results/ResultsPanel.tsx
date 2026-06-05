'use client';

import { BarChart3 } from 'lucide-react';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { formatM2 } from '@/utils/formatters';

interface ResultsPanelProps {
  result: QuantityResult;
}

export const ResultsPanel = ({ result }: ResultsPanelProps) => {
  const totalCutArea = result.cuts.reduce((sum, c) => sum + c.usedW * c.usedH, 0);
  const reuseArea = result.cuts.filter((c) => c.coveredById !== null).reduce((sum, c) => sum + c.usedW * c.usedH, 0);

  return (
  <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-zinc-100">
      <BarChart3 size={16} className="text-emerald-500" /> Quantitatif
    </h3>

    {result.roomArea > 0 ? (
      <div className="space-y-3">
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Surface</span>
          <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">{formatM2(result.roomArea)}</span>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Carreaux entiers</span>
          <div className="text-right">
            <div className="font-mono text-gray-900 dark:text-zinc-100">{result.wholeCount}</div>
            <div className="text-[10px] opacity-60">{formatM2(result.wholeCount * result.tileW * result.tileH)}</div>
          </div>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Coupes</span>
          <div className="text-right">
            <div className="font-mono text-gray-900 dark:text-zinc-100">{result.cuts.length}</div>
            {totalCutArea > 0 && <div className="text-[10px] opacity-60">{formatM2(totalCutArea)}</div>}
          </div>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Chutes récupérées</span>
          <div className="text-right">
            <div className="font-mono text-gray-900 dark:text-zinc-100">{result.totalReuseCount}</div>
            {reuseArea > 0 && <div className="text-[10px] opacity-60">{formatM2(reuseArea)}</div>}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase text-emerald-500">
            Total à commander (+10%)
          </div>
          <div className="text-2xl font-black tracking-tight text-emerald-400">
            {result.toOrder}{' '}
            <span className="text-sm font-medium opacity-60">carreaux</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-400 opacity-70">
            {formatM2(result.toOrder * result.tileW * result.tileH)}
          </div>
        </div>
      </div>
    ) : (
      <p className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">
        Tracez une pièce pour voir les résultats
      </p>
    )}
  </div>
  );
};
