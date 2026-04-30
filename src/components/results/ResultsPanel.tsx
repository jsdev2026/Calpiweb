'use client';

import { Calculator } from 'lucide-react';
import type { TilingStats } from '@/types/tiling';
import { formatM2 } from '@/utils/formatters';

interface ResultsPanelProps {
  stats: TilingStats | null;
}

export const ResultsPanel = ({ stats }: ResultsPanelProps) => (
  <div className="border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-zinc-100">
      <Calculator size={16} className="text-emerald-500" /> Devis Matériaux
    </h3>

    {stats ? (
      <div className="space-y-3">
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Surface</span>
          <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">{formatM2(stats.roomArea)}</span>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Carreaux pleins</span>
          <span className="font-mono text-gray-900 dark:text-zinc-100">{stats.whole}</span>
        </div>
        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-zinc-400">
          <span>Coupes</span>
          <span className="font-mono text-gray-900 dark:text-zinc-100">{stats.cuts}</span>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase text-emerald-500">
            Total à commander (+10%)
          </div>
          <div className="text-2xl font-black tracking-tight text-emerald-400">
            {stats.toOrder}{' '}
            <span className="text-sm font-medium opacity-60">carreaux</span>
          </div>
        </div>

        {stats.wastePercent > 15 && (
          <p className="rounded bg-amber-500/10 p-2 text-[10px] text-amber-400">
            Taux de perte élevé ({stats.wastePercent.toFixed(1)}%). Ajustez le point de départ.
          </p>
        )}
      </div>
    ) : (
      <p className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">
        Tracez une pièce pour voir les résultats
      </p>
    )}
  </div>
);
