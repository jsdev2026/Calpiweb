'use client';

interface WallThicknessControlProps {
  wallThickness: number;
  onChange: (mm: number) => void;
}

export const WallThicknessControl = ({ wallThickness, onChange }: WallThicknessControlProps) => {
  const defaultCm = Math.round(wallThickness / 10);

  const commit = (raw: string) => {
    const cm = parseFloat(raw);
    if (!isNaN(cm) && cm >= 5) onChange(Math.round(cm * 10));
  };

  return (
    <div className="flex flex-col items-center gap-0.5 px-0.5 py-0.5">
      <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
        ép.
      </span>
      <div className="flex items-center gap-0.5">
        <input
          key={wallThickness}
          type="number"
          step="0.5"
          min="5"
          defaultValue={defaultCm}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
          className="w-10 rounded-md bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-center text-[10px] font-bold outline-none"
          style={{ color: 'var(--text1)' }}
        />
        <span className="text-[9px] font-semibold" style={{ color: 'var(--muted)' }}>cm</span>
      </div>
    </div>
  );
};
