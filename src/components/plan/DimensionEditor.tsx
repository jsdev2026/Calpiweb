'use client';

import { CheckCircle2 } from 'lucide-react';
import type { KeyboardEvent } from 'react';

interface DimensionEditorProps {
  screenX: number;
  screenY: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const DimensionEditor = ({
  screenX,
  screenY,
  value,
  onChange,
  onSubmit,
  onCancel,
}: DimensionEditorProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="absolute z-20 flex items-center gap-1 rounded-lg border-2 border-blue-500 bg-white p-1.5 shadow-xl"
      style={{ left: screenX, top: screenY, transform: 'translate(-50%, -50%)' }}
    >
      <input
        type="number"
        step="0.1"
        autoFocus
        className="w-20 px-2 py-1 text-center text-base font-bold text-slate-800 outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="pr-2 text-sm font-bold text-slate-500">cm</span>
      <button
        type="button"
        onClick={onSubmit}
        className="rounded bg-blue-600 p-1 text-white hover:bg-blue-700"
      >
        <CheckCircle2 size={16} />
      </button>
    </div>
  );
};
