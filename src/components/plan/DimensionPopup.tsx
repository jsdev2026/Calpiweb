'use client';

import type { KeyboardEvent } from 'react';
import { CheckCircle2, Unlink } from 'lucide-react';

type Face = 'INSIDE' | 'AXIS' | 'OUTSIDE';
type DimType = 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH';

const FACE_LABEL: Record<Face, string> = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' };

export interface DimensionPopupProps {
  screenX?: number;
  screenY?: number;
  above?: boolean;
  fromFace: Face;
  toFace: Face;
  dimType: DimType;
  onDimTypeChange: (t: DimType) => void;
  value: string;
  onValueChange: (v: string) => void;
  hasExisting: boolean;
  onRelease: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export const DimensionPopup = ({
  screenX,
  screenY,
  above = true,
  fromFace,
  toFace,
  dimType,
  onDimTypeChange,
  value,
  onValueChange,
  hasExisting,
  onRelease,
  onSubmit,
  onCancel,
}: DimensionPopupProps) => {
  const refLabel = `${FACE_LABEL[fromFace]}→${FACE_LABEL[toFace]}`;
  const positioned = screenX !== undefined && screenY !== undefined;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit(); }
    if (e.key === 'Escape') onCancel();
  };

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
      {/* Header: "Cote" + reference label */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Cote</p>
        <span className="text-[9px] font-black tracking-widest text-orange-400">{refLabel}</span>
      </div>

      {/* Type selector + value input */}
      <div className="flex items-center gap-1">
        {/* H / V / L type buttons */}
        <div className="flex gap-0.5">
          {(['H_DISTANCE', 'V_DISTANCE', 'LENGTH'] as const).map((t) => (
            <button
              key={t}
              type="button"
              title={
                t === 'H_DISTANCE' ? 'Distance horizontale'
                  : t === 'V_DISTANCE' ? 'Distance verticale'
                  : 'Longueur'
              }
              onClick={() => onDimTypeChange(t)}
              className={`h-6 w-6 rounded text-[10px] font-black transition-colors ${
                dimType === t
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              {t === 'H_DISTANCE' ? 'H' : t === 'V_DISTANCE' ? 'V' : 'L'}
            </button>
          ))}
        </div>

        {/* Value input */}
        <input
          type="number"
          step="0.1"
          className="h-7 w-20 rounded border border-zinc-700 bg-zinc-800 px-2 text-right text-sm font-semibold text-zinc-100 focus:border-orange-500 focus:outline-none"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <span className="text-[10px] text-zinc-500">cm</span>

        {/* Submit */}
        <button
          type="button"
          title="Valider"
          onClick={onSubmit}
          className="flex h-7 w-7 items-center justify-center rounded bg-orange-600 text-white hover:bg-orange-500"
        >
          <CheckCircle2 size={14} />
        </button>

        {/* Release existing constraint */}
        {hasExisting && (
          <button
            type="button"
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
