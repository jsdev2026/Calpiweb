'use client';

import { CheckCircle2, Unlink } from 'lucide-react';
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
  hasExistingConstraint,
  onRelease,
  onSubmit,
  onCancel,
}: WallEdgeEditorProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
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
      {/* Header */}
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 px-0.5">Mur — Épaisseur</p>

      {/* Thickness row */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.1"
          min="0.1"
          aria-label="Épaisseur du mur"
          className="h-7 w-20 rounded border border-zinc-700 bg-zinc-800 px-2 text-right text-sm font-semibold text-zinc-100 focus:border-orange-500 focus:outline-none"
          value={thicknessValue}
          onChange={(e) => onThicknessChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <span className="text-[10px] text-zinc-500">cm</span>

        <button
          type="button"
          aria-label="Valider l'épaisseur"
          title="Valider"
          onClick={onSubmit}
          className="flex h-7 w-7 items-center justify-center rounded bg-orange-600 text-white hover:bg-orange-500"
        >
          <CheckCircle2 size={14} />
        </button>

        {hasExistingConstraint && (
          <button
            type="button"
            aria-label="Libérer la contrainte"
            title="Libérer la contrainte"
            onClick={onRelease}
            className="flex h-7 w-7 items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          >
            <Unlink size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
