'use client';

import { CheckCircle2, Unlink } from 'lucide-react';
import type { KeyboardEvent } from 'react';

interface WallEdgeEditorProps {
  screenX?: number;
  screenY?: number;
  above?: boolean;
  dimValue: string;
  onDimChange: (v: string) => void;
  constraintType: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';
  onConstraintTypeChange: (t: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH') => void;
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
  dimValue,
  onDimChange,
  constraintType,
  onConstraintTypeChange,
  thicknessValue,
  onThicknessChange,
  hasExistingConstraint,
  onRelease,
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
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 px-0.5">Mur</p>

      {/* Constraint type + dim value on one row */}
      <div className="flex items-center gap-1">
        {/* H / V / L buttons */}
        <div className="flex gap-0.5">
          {(['H_DISTANCE', 'V_DISTANCE', 'LENGTH'] as const).map((t) => (
            <button
              key={t}
              type="button"
              title={t === 'H_DISTANCE' ? 'Distance horizontale' : t === 'V_DISTANCE' ? 'Distance verticale' : 'Longueur'}
              onClick={() => onConstraintTypeChange(t)}
              className={`w-6 h-6 rounded text-[10px] font-black transition-colors ${
                constraintType === t
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {t === 'H_DISTANCE' ? 'H' : t === 'V_DISTANCE' ? 'V' : 'L'}
            </button>
          ))}
        </div>
        {/* Dim input */}
        <input
          type="number"
          step="0.1"
          autoFocus
          className="w-16 rounded-md bg-zinc-800 px-1.5 py-1 text-center text-[11px] font-bold text-orange-400 outline-none"
          value={dimValue}
          onChange={(e) => onDimChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="text-[10px] font-semibold text-zinc-500">cm</span>
      </div>

      {/* Thickness row */}
      <div className="flex items-center gap-1">
        <span className="w-[4.5rem] text-[9px] font-semibold uppercase tracking-wider text-zinc-500">Ép.</span>
        <input
          type="number"
          step="1"
          min="1"
          className="w-16 rounded-md bg-zinc-800 px-1.5 py-1 text-center text-[11px] font-bold text-violet-400 outline-none"
          value={thicknessValue}
          onChange={(e) => onThicknessChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="text-[10px] font-semibold text-zinc-500">cm</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 pt-0.5">
        {hasExistingConstraint && (
          <button
            type="button"
            title="Libérer la cote"
            onClick={onRelease}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-zinc-800 py-1 text-[10px] font-bold text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-red-400"
          >
            <Unlink size={11} />
            Libérer
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-orange-600 py-1 text-[10px] font-bold text-white transition-colors hover:bg-orange-500"
        >
          <CheckCircle2 size={11} />
          Valider
        </button>
      </div>
    </div>
  );
};
