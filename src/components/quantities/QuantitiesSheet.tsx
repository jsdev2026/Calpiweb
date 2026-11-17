'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ConsumableParams, TilingConfig } from '@/types/tiling';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { mergeSimilarCutGroups } from '@/engine/quantities/mergeSimilarCutGroups';
import { formatM2 } from '@/utils/formatters';
import { tileSummary } from '@/components/tiling/TileSettingsSheet';
import { QuantitiesRecapColumn } from './QuantitiesRecapColumn';
import { CutGroupsTable } from './CutGroupsTable';

export interface QuantitiesSheetProps {
  result: QuantityResult;
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHighlight: (group: number | null) => void;
  readOnly?: boolean;
}

/** Panneau du mode Quantitatif : même emplacement que le panneau Carreau. */
export const QuantitiesSheet = ({
  result,
  config,
  onChange,
  open,
  onOpenChange,
  onHighlight,
  readOnly = false,
}: QuantitiesSheetProps) => {
  const [cutsOpen, setCutsOpen] = useState(false);
  const merged = useMemo(() => mergeSimilarCutGroups(result.cutGroups), [result]);
  const set = (patch: Partial<TilingConfig>) => {
    if (!readOnly) onChange({ ...config, ...patch });
  };
  const updateConsumable = (patch: Partial<ConsumableParams>) =>
    set({ consumableParams: { ...(config.consumableParams ?? {}), ...patch } });

  return (
    <div
      data-testid="quantities-sheet"
      data-canvas-overlay
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t mouse:inset-x-auto mouse:bottom-3 mouse:right-3 mouse:top-3 mouse:w-[340px] mouse:rounded-2xl mouse:border md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:w-[340px] md:rounded-2xl md:border"
      style={{
        background: 'var(--surf)',
        borderColor: 'var(--bdr)',
        boxShadow: 'var(--sh-lg)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full shrink-0 flex-col items-stretch px-4 pb-2.5 pt-1.5 text-left"
      >
        <span
          className="mx-auto mb-1.5 h-1 w-10 rounded-full mouse:hidden md:hidden"
          style={{ background: 'var(--bdr)' }}
        />
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-[14px] font-bold" style={{ color: 'var(--text)' }}>
            {result.totalTiles === 0 ? (
              'Aucune pièce fermée'
            ) : (
              <>
                À commander :{' '}
                <span style={{ color: 'var(--accent)' }}>{result.toOrder} carreaux</span>
              </>
            )}
          </span>
          <span className="mouse:hidden md:hidden">
            {open ? (
              <ChevronDown size={18} style={{ color: 'var(--muted)' }} />
            ) : (
              <ChevronUp size={18} style={{ color: 'var(--muted)' }} />
            )}
          </span>
        </span>
        <span className="mt-0.5 truncate text-[12px]" style={{ color: 'var(--muted)' }}>
          {formatM2(result.roomArea)} · {tileSummary(config)}
        </span>
      </button>

      {result.totalTiles > 0 && (
        <div
          className={`${open ? 'flex' : 'hidden'} max-h-[46svh] flex-col gap-3 overflow-y-auto border-t mouse:flex mouse:max-h-none mouse:flex-1 md:flex md:max-h-none md:flex-1`}
          style={{ borderColor: 'var(--bdr)' }}
        >
          <QuantitiesRecapColumn
            className="flex w-full flex-col gap-3 p-4"
            result={result}
            marginOverride={config.marginOverride}
            onMarginCommit={(pct) => set({ marginOverride: pct / 100 })}
            onMarginReset={() => set({ marginOverride: undefined })}
            consumableParams={config.consumableParams}
            onConsumableParamChange={updateConsumable}
          />
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => setCutsOpen((o) => !o)}
              aria-expanded={cutsOpen}
              className="flex min-h-[44px] w-full items-center justify-between text-[13px] font-bold"
              style={{ color: 'var(--text)' }}
            >
              Coupes ({merged.length} groupes · {result.cuts.length} carreaux)
              {cutsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {cutsOpen && (
              <CutGroupsTable
                groups={merged}
                tileW={result.tileW}
                tileH={result.tileH}
                tileColor={config.color}
                onHighlight={onHighlight}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
