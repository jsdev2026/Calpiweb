'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { QuantityResult } from '@/engine/quantities/types';
import type { ConsumableParams } from '@/types/tiling';
import { formatM2 } from '@/utils/formatters';
import { sectionDomId } from '@/components/panel/SidePanel';

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
}

const ConsumableCard = ({
  label,
  unit,
  bags,
  bagSize,
  bagUnit,
  rendement,
  rendementUnit,
  totalKg,
  onRendementChange,
  onBagSizeChange,
}: ConsumableCardProps) => {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ borderColor: 'var(--bdr)', background: 'var(--surf2)' }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
          {label}
        </span>
        <span className="flex items-baseline gap-1">
          <span className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {bags}
          </span>
          <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {unit}
          </span>
        </span>
      </div>
      <div className="space-y-1 text-[11.5px]" style={{ color: 'var(--text2)' }}>
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
            className="h-7 w-14 rounded-md border px-1 text-center outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--bdr)', background: 'var(--surf)', color: 'var(--text)' }}
          />
          <span>
            {bagUnit}/{unit.slice(0, -1)}
          </span>
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
              className="h-7 w-14 rounded-md border px-1 text-center outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--bdr)', background: 'var(--surf)', color: 'var(--text)' }}
            />
            <span>{rendementUnit}</span>
          </div>
        )}
        <div className="text-[10px]">
          {totalKg.toFixed(1)} {bagUnit} total
        </div>
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
  /** Remplace les classes de mise en page du conteneur (ex. intégration dans un panneau). */
  className?: string;
}

export const QuantitiesRecapColumn = ({
  className,
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
      className={
        className ??
        'order-1 flex max-h-[45vh] w-full shrink-0 flex-col gap-3 overflow-y-auto border-b border-gray-200 p-4 md:order-2 md:max-h-full md:w-[230px] md:border-b-0 md:border-l dark:border-zinc-800'
      }
    >
      {/* Hero — Total à commander */}
      <div
        className="rounded-xl border px-4 py-3 text-center"
        style={{
          borderColor: 'var(--accent)',
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          color: 'var(--text2)',
        }}
      >
        <div
          className="text-[10.5px] font-bold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          Total à commander
        </div>
        <div
          className="text-3xl font-black tabular-nums leading-tight"
          style={{ color: 'var(--accent)' }}
        >
          {result.toOrder}
        </div>
        <div className="text-[12px]">
          carreaux · {formatM2(result.toOrder * result.tileW * result.tileH)}
        </div>
        <div className="mt-1 flex items-center justify-center gap-1 text-[11px]">
          <span>
            {result.wholeCount} + ({result.cuts.length}−{result.totalReuseCount})
          </span>
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
                className="w-10 rounded border px-1 text-center outline-none"
                style={{
                  borderColor: 'var(--accent)',
                  background: 'var(--surf)',
                  color: 'var(--text)',
                }}
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
        <div className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          Carreaux nets pour coupes&nbsp;: {result.tilesForCuts}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Stat list */}
        <div className="flex flex-col text-[13px]">
          <div
            className="flex items-center justify-between border-b py-1.5 last:border-b-0"
            style={{ borderColor: 'var(--bdr)' }}
          >
            <span style={{ color: 'var(--text2)' }}>Carreaux entiers</span>
            <span className="font-bold tabular-nums" style={{ color: 'var(--text)' }}>
              {result.wholeCount}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b py-1.5 last:border-b-0"
            style={{ borderColor: 'var(--bdr)' }}
          >
            <span style={{ color: 'var(--text2)' }}>Carreaux à couper</span>
            <span className="font-bold tabular-nums" style={{ color: 'var(--text)' }}>
              {result.cuts.length}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b py-1.5 last:border-b-0"
            style={{ borderColor: 'var(--bdr)' }}
          >
            <span style={{ color: 'var(--text2)' }}>Récupérées</span>
            <span
              className={`font-black tabular-nums ${
                result.totalReuseCount > 0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-zinc-600'
              }`}
            >
              {result.totalReuseCount}
            </span>
          </div>
        </div>

        {/* Consumables accordion */}
        <div
          id={sectionDomId('consommables')}
          className="scroll-mt-2 border-t pt-2"
          style={{ borderColor: 'var(--bdr)' }}
        >
          <button
            type="button"
            onClick={() => setConsumablesOpen((o) => !o)}
            aria-expanded={consumablesOpen}
            className="flex min-h-[32px] w-full items-center justify-between text-left text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--muted)' }}
          >
            <span>Consommables</span>
            {consumablesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {consumablesOpen && (
            <div className="mt-2 flex flex-col gap-3">
              <div
                className="flex items-center gap-2 text-[12px]"
                style={{ color: 'var(--text2)' }}
              >
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
                  className="h-7 w-14 rounded-md border px-1 text-center outline-none focus:border-[var(--accent)]"
                  style={{
                    borderColor: 'var(--bdr)',
                    background: 'var(--surf)',
                    color: 'var(--text)',
                  }}
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
