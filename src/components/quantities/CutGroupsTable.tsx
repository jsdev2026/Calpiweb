'use client';

import type { MergedCutGroup } from '@/engine/quantities/mergeSimilarCutGroups';
import { formatCm } from '@/utils/formatters';
import { GROUP_COLORS, TileThumbnail } from './CutGroupCard';

export interface CutGroupsTableProps {
  groups: MergedCutGroup[];
  tileW: number;
  tileH: number;
  tileColor: string;
  onHighlight: (group: number | null) => void;
}

export const CutGroupsTable = ({ groups, tileW, tileH, tileColor, onHighlight }: CutGroupsTableProps) => {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-400 dark:text-zinc-500">
          <th className="px-2 py-1 font-normal">#</th>
          <th className="px-2 py-1 font-normal" />
          <th className="px-2 py-1 font-normal">Dimensions</th>
          <th className="px-2 py-1 font-normal">Détail</th>
          <th className="px-2 py-1 text-right font-normal">Nets</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group, i) => {
          const hasBigChute = group.chuteW > 20 && group.chuteH > 20;
          const groupColor = GROUP_COLORS[i % GROUP_COLORS.length]!;

          return (
            <tr
              key={group.originalIndices.join(',')}
              className="border-t border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
              // Plan highlighting is keyed by the original (pre-merge) cutGroups
              // index, not the merged display index `i` — use originalIndices[0].
              onMouseEnter={() => onHighlight(group.originalIndices[0]! + 1)}
              onMouseLeave={() => onHighlight(null)}
            >
              <td className="px-2 py-1">
                <span
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
                  style={{
                    background: `${groupColor}20`,
                    color: groupColor,
                    border: `1.5px solid ${groupColor}40`,
                  }}
                >
                  {i + 1}
                </span>
              </td>
              <td className="px-2 py-1">
                <TileThumbnail
                  tileW={tileW}
                  tileH={tileH}
                  usedW={group.usedW}
                  usedH={group.usedH}
                  pieceEdges={group.pieceEdges}
                  color={tileColor}
                  reused={group.reuseCount > 0}
                />
              </td>
              <td className="px-2 py-1 font-mono font-bold text-gray-900 dark:text-zinc-100">
                {formatCm(group.usedW)}×{formatCm(group.usedH)}
              </td>
              <td className="px-2 py-1">
                {hasBigChute ? (
                  <span className="text-gray-400 dark:text-zinc-500">
                    Chute {formatCm(group.chuteW)}×{formatCm(group.chuteH)}
                  </span>
                ) : group.reuseCount > 0 ? (
                  <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                    ↩ {group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
                  </span>
                ) : null}
              </td>
              <td
                className={`px-2 py-1 text-right font-black tabular-nums ${
                  group.reuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-100'
                }`}
              >
                {group.netTiles}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
