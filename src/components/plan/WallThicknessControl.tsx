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
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
        ép.
      </span>
      <input
        key={wallThickness}
        type="number"
        step="0.5"
        min="5"
        defaultValue={defaultCm}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        className="h-8 w-8 rounded-xl text-center text-[11px] font-bold outline-none transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
        style={{ background: 'var(--surf)', color: 'var(--text1)' }}
      />
    </div>
  );
};
