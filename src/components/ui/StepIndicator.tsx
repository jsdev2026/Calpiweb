'use client';

import { Grid, Ruler } from 'lucide-react';
import { cn } from '@/lib/cn';

export type WorkspaceTab = 'PLAN' | 'TILING';

interface StepIndicatorProps {
  active: WorkspaceTab;
  canGoTiling: boolean;
  onChange: (tab: WorkspaceTab) => void;
}

export const StepIndicator = ({ active, canGoTiling, onChange }: StepIndicatorProps) => (
  <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-950 p-1">
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest transition-all',
        active === 'PLAN'
          ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20'
          : 'text-zinc-500 hover:text-zinc-300',
      )}
      onClick={() => onChange('PLAN')}
    >
      <Ruler size={14} /> 1. Plan 2D
    </button>
    <button
      type="button"
      disabled={!canGoTiling}
      className={cn(
        'flex items-center gap-2 rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest transition-all',
        active === 'TILING'
          ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20'
          : 'text-zinc-500 hover:text-zinc-300',
        !canGoTiling && 'cursor-not-allowed opacity-50',
      )}
      onClick={() => canGoTiling && onChange('TILING')}
    >
      <Grid size={14} /> 2. Calepinage
    </button>
  </div>
);
