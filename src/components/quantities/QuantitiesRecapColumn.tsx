'use client';

import { useState } from 'react';
import type { QuantityResult } from '@/engine/quantities/types';
import type { ConsumableParams } from '@/types/tiling';
import { formatM2 } from '@/utils/formatters';

interface ConsumableCardProps {
  label: string;
  unit: string;
  bags: number;
  bagSize: number;
  bagUnit: string;
  rendement: number;
  rendementUnit: string;
  totalKg: number;
  onRendementChange: ((v: number) => void) | null;
  onBagSizeChange: (v: number) => void;
  color: 'blue' | 'violet';
}

const ConsumableCard = ({
  label, unit, bags, bagSize, bagUnit, rendement, rendementUnit,
  totalKg, onRendementChange, onBagSizeChange, color,
}: ConsumableCardProps) => {
  const accent = color === 'blue' ? 'text-blue-500' : 'text-violet-500';
  const border = color === 'blue' ? 'border-blue-500/30' : 'border-violet-500/30';
  const bg = color === 'blue' ? 'bg-blue-500/5' : 'bg-violet-500/5';

  return (
    <div className={`rounded-xl border ${border} ${bg} px-4 py-3`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${accent} mb-2`}>{label}</div>
      <div className="flex items-end gap-1 mb-2">
        <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-zinc-100">{bags}</span>
        <span className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">{unit}</span>
      </div>
      <div className="space-y-1 text-[11px] text-gray-400 dark:text-zinc-500">
        <div className="flex items-center gap-1">
          <span>Cdt :</span>
          <input
            key={bagSize}
            type="number"
            min="1"
            step="1"
            defaultValue={bagSize}
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) onBagSizeChange(v);
            }}
            className="w-14 rounded border border-gray-300 dark:border-zinc-600 bg-transparent px-1 text-center text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-400"
          />
          <span>{bagUnit}/{unit.slice(0, -1)}</span>
        </div>
        {onRendementChange !== null && (
          <div className="flex items-center gap-1">
            <span>Rdmt :</span>
            <input
              key={rendement.toFixed(3)}
              type="number"
              min="0.1"
              step="0.1"
              defaultValue={parseFloat(rendement.toFixed(3))}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) onRendementChange(v);
              }}
              className="w-14 rounded border border-gray-300 dark:border-zinc-600 bg-transparent px-1 text-center text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-400"
            />
            <span>{rendementUnit}</span>
          </div>
        )}
        <div className="text-[10px]">{totalKg.toFixed(1)} {bagUnit} total</div>
      </div>
    </div>
  );
};

export interface QuantitiesRecapColumnProps {
  result: QuantityResult;
  marginOverride: number | undefined;
  onMarginCommit: (pct: number) => void;
  onMarginReset: () => void;
  consumableParams: ConsumableParams | undefined;
  onConsumableParamChange: (patch: Partial<ConsumableParams>) => void;
}

export const QuantitiesRecapColumn = ({
  result,
  marginOverride,
  onMarginCommit,
  onMarginReset,
  consumableParams,
  onConsumableParamChange,
}: QuantitiesRecapColumnProps) => {
  const [editingMargin, setEditingMargin] = useState(false);
  const [marginInput, setMarginInput] = useState('');
  const [consumablesOpen, setConsumablesOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(true);

  const marginPct = Math.round(result.margin * 100);

  const handleMarginEdit = () => {
    setMarginInput(String(marginPct));
    setEditingMargin(true);
  };

  const handleMarginCommit = () => {
    const val = parseFloat(marginInput);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      onMarginCommit(val);
    }
    setEditingMargin(false);
  };

  const handleMarginReset = () => {
    onMarginReset();
    setEditingMargin(false);
  };

  return (
    <div
      data-testid="recap-column"
      className="order-1 flex w-full shrink-0 flex-col gap-3 border-b border-gray-200 p-4 dark:border-zinc-800 md:order-2 md:w-[230px] md:border-b-0 md:border-l"
    >
      {/* Hero — Total à commander */}
      <div className="rounded-xl bg-orange-500 px-4 py-3 text-center text-white">
        <div className="text-[10px] font-bold uppercase tracking-wider opacity-85">Total à commander</div>
        <div className="text-3xl font-black leading-tight tabular-nums">{result.toOrder}</div>
        <div className="text-[11px] opacity-90">
          carreaux · {formatM2(result.toOrder * result.tileW * result.tileH)}
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 text-[10px] opacity-75">
          <span>{result.wholeCount} + ({result.cuts.length}−{result.totalReuseCount})</span>
          {editingMargin ? (
            <span className="flex items-center gap-1">
              ×
              <input
                autoFocus
                type="number"
                min="0"
                max="100"
                step="1"
                value={marginInput}
                onChange={(e) => setMarginInput(e.target.value)}
                onBlur={handleMarginCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMarginCommit();
                  if (e.key === 'Escape') setEditingMargin(false);
                }}
                className="w-10 rounded border border-white/40 bg-transparent px-1 text-center text-white outline-none"
              />
              %
              {marginOverride !== undefined && (
                <button type="button" onClick={handleMarginReset} className="underline">
                  auto
                </button>
              )}
            </span>
          ) : (
            <button type="button" onClick={handleMarginEdit} className="underline">
              × {marginPct}%{marginOverride !== undefined ? ' ✎' : ''}
            </button>
          )}
        </div>
        <div className="mt-1 text-[10px] opacity-75">
          Carreaux nets pour coupes&nbsp;: {result.tilesForCuts}
        </div>
      </div>

      {/* Mobile collapse toggle */}
      <button
        type="button"
        onClick={() => setMobileExpanded((o) => !o)}
        className="flex items-center justify-between text-xs font-bold text-gray-400 dark:text-zinc-500 md:hidden"
      >
        Détails
        <span>{mobileExpanded ? '▲' : '▼'}</span>
      </button>

      <div className={`${mobileExpanded ? 'flex' : 'hidden'} flex-col gap-3 md:flex`}>
        {/* Stat list */}
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between border-l-[3px] border-blue-500 bg-gray-50 px-3 py-1.5 dark:bg-zinc-800/60">
            <span className="text-gray-500 dark:text-zinc-400">Carreaux entiers</span>
            <span className="font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.wholeCount}</span>
          </div>
          <div className="flex items-center justify-between border-l-[3px] border-orange-500 bg-gray-50 px-3 py-1.5 dark:bg-zinc-800/60">
            <span className="text-gray-500 dark:text-zinc-400">Carreaux à couper</span>
            <span className="font-black tabular-nums text-gray-900 dark:text-zinc-100">{result.cuts.length}</span>
          </div>
          <div className="flex items-center justify-between border-l-[3px] border-emerald-500 bg-gray-50 px-3 py-1.5 dark:bg-zinc-800/60">
            <span className="text-gray-500 dark:text-zinc-400">Récupérées</span>
            <span
              className={`font-black tabular-nums ${
                result.totalReuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400 dark:text-zinc-600'
              }`}
            >
              {result.totalReuseCount}
            </span>
          </div>
        </div>

        {/* Consumables accordion */}
        <div className="border-t border-gray-200 pt-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setConsumablesOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-blue-500"
          >
            <span>Consommables</span>
            <span className="text-gray-400">{consumablesOpen ? '▲' : '▼'}</span>
          </button>

          {consumablesOpen && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
                <span>Épaisseur carreau :</span>
                <input
                  key={consumableParams?.tileThickness ?? 10}
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  defaultValue={consumableParams?.tileThickness ?? 10}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) onConsumableParamChange({ tileThickness: v });
                  }}
                  className="w-14 rounded border border-gray-300 dark:border-zinc-600 bg-transparent px-1 text-center text-gray-700 dark:text-zinc-300 outline-none focus:border-blue-400"
                />
                <span>mm</span>
              </div>

              <ConsumableCard
                label="Colle"
                unit="sacs"
                bags={result.consumables.colle.bags}
                bagSize={result.consumables.colle.bagSize}
                bagUnit="kg"
                rendement={result.consumables.colle.rendement}
                rendementUnit="kg/m²"
                totalKg={result.consumables.colle.total}
                onRendementChange={(v) => onConsumableParamChange({ colleRendement: v })}
                onBagSizeChange={(v) => onConsumableParamChange({ colleBagSize: v })}
                color="blue"
              />

              <ConsumableCard
                label="Joint"
                unit="sacs"
                bags={result.consumables.joint.bags}
                bagSize={result.consumables.joint.bagSize}
                bagUnit="kg"
                rendement={result.consumables.joint.rendement}
                rendementUnit="kg/m²"
                totalKg={result.consumables.joint.total}
                onRendementChange={(v) => onConsumableParamChange({ jointRendement: v })}
                onBagSizeChange={(v) => onConsumableParamChange({ jointBagSize: v })}
                color="blue"
              />

              <ConsumableCard
                label="Croisillons"
                unit="sachets"
                bags={result.consumables.croisillons.bags}
                bagSize={result.consumables.croisillons.bagSize}
                bagUnit="unités"
                rendement={result.consumables.croisillons.rendement}
                rendementUnit="×/carreau"
                totalKg={result.consumables.croisillons.total}
                onRendementChange={null}
                onBagSizeChange={(v) => onConsumableParamChange({ croisillonsBagSize: v })}
                color="violet"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
