'use client';

import { CheckCircle2 } from 'lucide-react';
import type { KeyboardEvent } from 'react';

interface WallEdgeEditorProps {
  screenX?: number;
  screenY?: number;
  above?: boolean;
  thicknessValue: string;
  onThicknessChange: (v: string) => void;
  hasExistingConstraint: boolean;
  onRelease: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const WallEdgeEditor = ({
  screenX,
  screenY,
  above = true,
  thicknessValue,
  onThicknessChange,
  onSubmit,
  onCancel,
}: WallEdgeEditorProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };

  const positioned = screenX !== undefined && screenY !== undefined;

  return (
    <div
      className="absolute z-30 flex flex-col gap-1.5 rounded-xl border border-orange-500/70 bg-zinc-900 p-2 shadow-2xl"
      style={
        positioned
          ? {
              left: screenX,
              top: screenY,
              transform: above
                ? 'translate(-50%, calc(-100% - 10px))'
                : 'translate(-50%, 10px)',
            }
          : { left: '50%', top: '1rem', transform: 'translateX(-50%)' }
      }
    >
      {/* Header label */}
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 px-0.5">Épaisseur mur</p>

      {/* Thickness row */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="1"
          min="1"
          autoFocus
          className="w-16 rounded-md bg-zinc-800 px-1.5 py-1 text-center text-[11px] font-bold text-violet-400 outline-none"
          value={thicknessValue}
          onChange={(e) => onThicknessChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="text-[10px] font-semibold text-zinc-500">cm</span>

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          className="flex h-7 w-7 items-center justify-center rounded bg-orange-600 text-white hover:bg-orange-500"
        >
          <CheckCircle2 size={14} />
        </button>
      </div>
    </div>
  );
};
