'use client';

import { CheckCircle2 } from 'lucide-react';
import type { KeyboardEvent } from 'react';

interface DimensionEditorProps {
  screenX?: number;
  screenY?: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onAlignH?: () => void;
  onAlignV?: () => void;
}

export const DimensionEditor = ({
  screenX,
  screenY,
  value,
  onChange,
  onSubmit,
  onCancel,
  onAlignH,
  onAlignV,
}: DimensionEditorProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };

  const positioned = screenX !== undefined && screenY !== undefined;

  return (
    <div
      className="absolute z-30 flex items-center gap-1.5 rounded-xl border border-orange-500 bg-zinc-900 p-1.5 shadow-2xl"
      style={
        positioned
          ? { left: screenX, top: screenY, transform: 'translate(-50%, -110%)' }
          : { left: '50%', top: '1rem', transform: 'translateX(-50%)' }
      }
    >
      {onAlignH && (
        <button
          type="button"
          onClick={onAlignH}
          title="Aligner horizontal"
          className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[10px] font-black text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-orange-400"
        >
          H
        </button>
      )}
      {onAlignV && (
        <button
          type="button"
          onClick={onAlignV}
          title="Aligner vertical"
          className="rounded-lg bg-zinc-800 px-2 py-1.5 text-[10px] font-black text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-orange-400"
        >
          V
        </button>
      )}
      <input
        type="number"
        step="0.1"
        autoFocus
        className="w-24 rounded-lg bg-zinc-800 px-3 py-1.5 text-center font-bold text-orange-400 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="pr-1 text-xs font-bold text-zinc-500">cm</span>
      <button
        type="button"
        onClick={onSubmit}
        className="rounded-lg bg-orange-600 p-1.5 text-white transition-colors hover:bg-orange-500"
      >
        <CheckCircle2 size={16} />
      </button>
    </div>
  );
};
