'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { TilingStats } from '@/types/tiling';
import { formatM2 } from '@/utils/formatters';
import { WASTE_WARNING_THRESHOLD } from '@/constants/businessRules';

interface ResultsPanelProps {
  stats: TilingStats | null;
}

export const ResultsPanel = ({ stats }: ResultsPanelProps) => (
  <div className="border-t border-slate-200 pt-6">
    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
      <CheckCircle2 size={20} className="text-emerald-600" /> Synthèse en direct
    </h3>

    {stats ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
          <span className="text-sm text-slate-600">Surface pièce</span>
          <span className="font-bold text-slate-800">{formatM2(stats.roomArea)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center rounded-lg border border-blue-100 bg-blue-50 p-3">
            <span className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600">
              Entiers
            </span>
            <span className="text-2xl font-bold text-blue-800">{stats.whole}</span>
          </div>
          <div className="flex flex-col items-center rounded-lg border border-amber-100 bg-amber-50 p-3">
            <span className="mb-1 text-xs font-medium uppercase tracking-wider text-amber-600">
              Coupes
            </span>
            <span className="text-2xl font-bold text-amber-800">{stats.cuts}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <span className="text-sm font-medium text-emerald-800">À commander (+10%)</span>
          <span className="text-xl font-bold text-emerald-700">{stats.toOrder}</span>
        </div>

        {stats.wastePercent > WASTE_WARNING_THRESHOLD && (
          <div className="mt-2 flex items-start gap-2 rounded bg-amber-50 p-2 text-xs text-amber-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Taux de perte élevé ({stats.wastePercent.toFixed(1)}%). Ajustez le point de départ.
          </div>
        )}
      </div>
    ) : (
      <p className="py-4 text-center text-sm text-slate-500">
        Tracez une pièce pour voir les résultats
      </p>
    )}
  </div>
);
