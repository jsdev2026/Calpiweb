'use client';

import { useMemo, useState } from 'react';
import {
  FileDown,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  PaintBucket,
  Scissors,
  ShoppingCart,
} from 'lucide-react';
import type { ConsumableParams, TilingConfig } from '@/types/tiling';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { mergeSimilarCutGroups } from '@/engine/quantities/mergeSimilarCutGroups';
import { formatM2 } from '@/utils/formatters';
import { PanelSection, SidePanel } from '@/components/panel/SidePanel';
import { QuantitiesRecapColumn } from './QuantitiesRecapColumn';
import { CutGroupsTable } from './CutGroupsTable';

export interface QuantitiesSheetProps {
  result: QuantityResult;
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
  onHighlight: (group: number | null) => void;
  readOnly?: boolean;
  /** Retour au Calepinage */
  onShowTiling?: () => void;
}

const ICON = 16;

/** Panneau du mode Quantitatif (panneau latéral commun aux trois modes). */
export const QuantitiesSheet = ({
  result,
  config,
  onChange,
  onHighlight,
  readOnly = false,
  onShowTiling,
}: QuantitiesSheetProps) => {
  const [cutsOpen, setCutsOpen] = useState(false);
  const merged = useMemo(() => mergeSimilarCutGroups(result.cutGroups), [result]);
  const set = (patch: Partial<TilingConfig>) => {
    if (!readOnly) onChange({ ...config, ...patch });
  };
  const updateConsumable = (patch: Partial<ConsumableParams>) =>
    set({ consumableParams: { ...(config.consumableParams ?? {}), ...patch } });

  const empty = result.totalTiles === 0;

  return (
    <SidePanel
      testId="quantities-sheet"
      icon={<ClipboardList size={18} />}
      title="Quantitatif"
      summary={
        empty ? (
          'Aucune pièce fermée'
        ) : (
          <>
            À commander :{' '}
            <strong style={{ color: 'var(--accent)' }}>
              {result.boxes
                ? `${result.boxes.count} carton${result.boxes.count > 1 ? 's' : ''}`
                : `${result.toOrder} carreaux`}
            </strong>{' '}
            · {formatM2(result.roomArea)}
          </>
        )
      }
      prev={onShowTiling ? { label: 'Calepinage', onClick: onShowTiling } : undefined}
      next={
        empty
          ? undefined
          : {
              label: 'Export PDF',
              pulse: false,
              icon: <FileDown size={14} aria-hidden />,
              onClick: () => window.print(),
            }
      }
      railItems={
        empty
          ? []
          : [
              { id: 'commande', label: 'À commander', icon: <ShoppingCart size={ICON} /> },
              { id: 'consommables', label: 'Consommables', icon: <PaintBucket size={ICON} /> },
              { id: 'coupes', label: 'Coupes', icon: <Scissors size={ICON} /> },
            ]
      }
    >
      {!empty && (
        <>
          <PanelSection id="commande" title="À commander">
            <QuantitiesRecapColumn
              className="flex w-full flex-col gap-3"
              result={result}
              marginOverride={config.marginOverride}
              onMarginCommit={(pct) => set({ marginOverride: pct / 100 })}
              onMarginReset={() => set({ marginOverride: undefined })}
              consumableParams={config.consumableParams}
              onConsumableParamChange={updateConsumable}
            />
          </PanelSection>
          <PanelSection
            id="coupes"
            title={`Coupes · ${merged.length} groupes · ${result.cuts.length} carreaux`}
          >
            <button
              type="button"
              onClick={() => setCutsOpen((o) => !o)}
              aria-expanded={cutsOpen}
              className="flex h-9 w-full items-center justify-between rounded-lg border px-2.5 text-[12.5px] font-semibold"
              style={{
                borderColor: 'var(--bdr)',
                background: 'var(--surf2)',
                color: 'var(--text2)',
              }}
            >
              {cutsOpen ? 'Masquer le détail des coupes' : 'Afficher le détail des coupes'}
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
          </PanelSection>
        </>
      )}
    </SidePanel>
  );
};
