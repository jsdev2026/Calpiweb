'use client';

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/** Lit un nombre saisi à la française ou à l'anglaise (« 2,5 » ou « 2.5 »). */
export function parseDecimal(raw: string): number {
  return parseFloat(raw.trim().replace(',', '.'));
}

const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

interface NumberStepperProps {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  onChange: (v: number) => void;
  'aria-label'?: string;
}

/**
 * Champ numérique tactile : pavé décimal, virgule acceptée, boutons −/+ de 44 px,
 * valeur appliquée en direct dès qu'elle est valide.
 */
export const NumberStepper = ({
  label,
  unit,
  value,
  step,
  min,
  max,
  onChange,
  ...rest
}: NumberStepperProps) => {
  const [raw, setRaw] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setRaw(fmt(value));
  }, [value, focused]);

  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min, v));
  const commitRaw = (s: string) => {
    setRaw(s);
    const v = parseDecimal(s);
    if (!isNaN(v) && v >= min && (max === undefined || v <= max)) onChange(v);
  };
  const bump = (dir: 1 | -1) => {
    const v = clamp(Math.round((value + dir * step) * 10) / 10);
    onChange(v);
    setRaw(fmt(v));
  };

  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-95 disabled:opacity-40';
  const btnStyle = { borderColor: 'var(--bdr)', background: 'var(--surf2)', color: 'var(--text2)' };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={btn}
          style={btnStyle}
          aria-label={`Diminuer ${label}`}
          onClick={() => bump(-1)}
          disabled={value - step < min}
        >
          <Minus size={16} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            aria-label={rest['aria-label'] ?? label}
            value={raw}
            onChange={(e) => commitRaw(e.target.value)}
            onFocus={(e) => {
              setFocused(true);
              e.target.select();
            }}
            onBlur={() => {
              setFocused(false);
              setRaw(fmt(value));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="h-11 w-full rounded-xl border px-2 pr-9 text-center font-semibold tabular-nums outline-none focus:border-orange-500"
            style={{
              borderColor: 'var(--bdr)',
              background: 'var(--surf)',
              color: 'var(--text)',
              fontSize: 16,
            }}
          />
          <span
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px]"
            style={{ color: 'var(--muted)' }}
          >
            {unit}
          </span>
        </div>
        <button
          type="button"
          className={btn}
          style={btnStyle}
          aria-label={`Augmenter ${label}`}
          onClick={() => bump(1)}
          disabled={max !== undefined && value + step > max}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};
