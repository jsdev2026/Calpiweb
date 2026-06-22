'use client';

interface WallThicknessControlProps {
  wallThickness: number;
  onChange: (mm: number) => void;
  compact?: boolean;
}

const MIN_THICKNESS_MM = 50;

const BTN = 'flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export const WallThicknessControl = ({ wallThickness, onChange, compact = false }: WallThicknessControlProps) => {
  const cm = Math.round(wallThickness / 10);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Réduire l'épaisseur"
          disabled={wallThickness <= MIN_THICKNESS_MM}
          onClick={() => onChange(wallThickness - 5)}
          className={BTN}
          style={{ color: 'var(--text2)' }}
        >
          −
        </button>
        <span className="w-10 text-center text-[12px] font-bold select-none" style={{ color: 'var(--text2)' }}>
          {cm}cm
        </span>
        <button
          type="button"
          aria-label="Augmenter l'épaisseur"
          onClick={() => onChange(wallThickness + 5)}
          className={BTN}
          style={{ color: 'var(--text2)' }}
        >
          +
        </button>
      </div>
    );
  }

  const commit = (raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= MIN_THICKNESS_MM / 10) onChange(Math.round(v * 10));
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
        ép.
      </span>
      <input
        key={wallThickness}
        type="number"
        step="0.5"
        min="5"
        defaultValue={cm}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        className="h-8 w-8 rounded-xl text-center text-[11px] font-bold outline-none transition-colors bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
        style={{ color: 'var(--text2)' }}
      />
      <span className="text-[9px] font-semibold" style={{ color: 'var(--muted)' }}>cm</span>
    </div>
  );
};
