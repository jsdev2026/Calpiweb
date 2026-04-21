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
  <div className="flex items-center rounded-lg bg-slate-100 p-1">
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
        active === 'PLAN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800',
      )}
      onClick={() => onChange('PLAN')}
    >
      <Ruler size={16} /> 1. Plan 2D
    </button>
    <button
      type="button"
      disabled={!canGoTiling}
      className={cn(
        'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
        active === 'TILING' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-800',
        !canGoTiling && 'cursor-not-allowed opacity-50',
      )}
      onClick={() => canGoTiling && onChange('TILING')}
    >
      <Grid size={16} /> 2. Calepinage
    </button>
  </div>
);
