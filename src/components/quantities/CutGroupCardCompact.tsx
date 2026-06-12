'use client';
import type { CutGroup } from '@/engine/quantities/quantityEngine';
import { formatCm } from '@/utils/formatters';
import { TileThumbnail } from './CutGroupCard';

export interface CutGroupCardCompactProps {
  group: CutGroup;
  groupIndex: number;
  groupColor: string;
  tileW: number;
  tileH: number;
  tileColor: string;
  onHighlight: (group: number | null) => void;
}

export const CutGroupCardCompact = ({
  group,
  groupIndex,
  groupColor,
  tileW,
  tileH,
  tileColor,
  onHighlight,
}: CutGroupCardCompactProps) => {
  const hasBigChute = group.chuteW > 20 && group.chuteH > 20;

  return (
    <div
      className="flex w-[112px] shrink-0 flex-col items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-2 text-center transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      style={{ borderTopColor: groupColor, borderTopWidth: 3 }}
      onMouseEnter={() => onHighlight(groupIndex + 1)}
      onMouseLeave={() => onHighlight(null)}
    >
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
        style={{
          background: `${groupColor}20`,
          color: groupColor,
          border: `1.5px solid ${groupColor}40`,
        }}
      >
        {groupIndex + 1}
      </span>

      <TileThumbnail
        tileW={tileW}
        tileH={tileH}
        usedW={group.usedW}
        usedH={group.usedH}
        pieceEdges={group.pieceEdges}
        color={tileColor}
        reused={group.reuseCount > 0}
      />

      <span className="font-mono text-[11px] font-bold text-gray-900 dark:text-zinc-100">
        {formatCm(group.usedW)}×{formatCm(group.usedH)}
      </span>

      {hasBigChute ? (
        <span className="text-[9px] leading-tight text-gray-400 dark:text-zinc-500">
          Chute {formatCm(group.chuteW)}×{formatCm(group.chuteH)}
        </span>
      ) : group.reuseCount > 0 ? (
        <span className="text-[9px] leading-tight font-semibold text-emerald-500 dark:text-emerald-400">
          ↩ {group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
        </span>
      ) : null}

      <span
        className={`text-[11px] font-black tabular-nums ${
          group.reuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-100'
        }`}
      >
        {group.netTiles}
        <span className="text-[8px] font-normal text-gray-400 dark:text-zinc-500">&nbsp;nets</span>
      </span>
    </div>
  );
};
