'use client';

import { useEffect, useState } from 'react';

/** Lit un nombre saisi à la française ou à l'anglaise (« 2,5 » ou « 2.5 »). */
export function parseDecimal(raw: string): number {
  return parseFloat(raw.trim().replace(',', '.'));
}

const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

interface CompactNumberInputProps {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max?: number;
  onChange: (v: number) => void;
  className?: string;
}

/**
 * Champ numérique compact : pavé décimal, virgule acceptée, valeur appliquée
 * en direct dès qu'elle est valide, police 16 px (pas de zoom iOS au focus).
 */
export const CompactNumberInput = ({
  label,
  unit,
  value,
  min,
  max,
  onChange,
  className = '',
}: CompactNumberInputProps) => {
  const [raw, setRaw] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setRaw(fmt(value));
  }, [value, focused]);

  const commitRaw = (s: string) => {
    setRaw(s);
    const v = parseDecimal(s);
    if (!isNaN(v) && v >= min && (max === undefined || v <= max)) onChange(v);
  };

  return (
    <div className={`relative min-w-0 ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={label}
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
        className={`h-9 w-full rounded-lg border px-1.5 text-center text-[16px] font-semibold tabular-nums outline-none focus:border-orange-500 mouse:h-8 mouse:text-[13px] md:h-8 md:text-[13px] ${unit ? 'pr-6' : ''}`}
        style={{
          borderColor: 'var(--bdr)',
          background: 'var(--surf)',
          color: 'var(--text)',
        }}
      />
      {unit && (
        <span
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10.5px]"
          style={{ color: 'var(--muted)' }}
        >
          {unit}
        </span>
      )}
    </div>
  );
};
