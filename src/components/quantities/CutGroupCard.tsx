'use client';
import type { CutGroup, PieceEdges } from '@/engine/quantities/quantityEngine';
import { formatCm } from '@/utils/formatters';

export const GROUP_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee',
  '#818cf8', '#e879f9', '#f472b6', '#a78bfa', '#34d399',
];

interface ThumbnailProps {
  tileW: number;
  tileH: number;
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  color: string;
  reused?: boolean;
}

const TileThumbnail = ({ tileW, tileH, usedW, usedH, pieceEdges, color, reused }: ThumbnailProps) => {
  const maxDim = 44;
  const scale = Math.min(maxDim / tileW, maxDim / tileH);
  const tw = tileW * scale;
  const th = tileH * scale;
  const uw = Math.min(usedW * scale, tw);
  const uh = Math.min(usedH * scale, th);
  const px = 0;
  const py = th - uh;
  const cutColor = '#f97316';
  const factoryColor = '#52525b';
  const sw = 1.5;
  const dash = '3,2';

  return (
    <svg width={tw} height={th} className="shrink-0 overflow-visible">
      <rect x={0} y={0} width={tw} height={th} fill="var(--tile-thumb-bg)" rx="2" />
      <rect x={px} y={py} width={uw} height={uh} fill={reused ? '#86efac' : color} rx="1" />
      <line x1={px} y1={py} x2={px} y2={py + uh} stroke={pieceEdges.left === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.left === 'cut' ? dash : undefined} />
      <line x1={px + uw} y1={py} x2={px + uw} y2={py + uh} stroke={pieceEdges.right === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.right === 'cut' ? dash : undefined} />
      <line x1={px} y1={py} x2={px + uw} y2={py} stroke={pieceEdges.top === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.top === 'cut' ? dash : undefined} />
      <line x1={px} y1={py + uh} x2={px + uw} y2={py + uh} stroke={pieceEdges.bottom === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.bottom === 'cut' ? dash : undefined} />
      <rect x={0} y={0} width={tw} height={th} fill="none" stroke="var(--tile-thumb-bdr)" strokeWidth="0.5" rx="2" />
    </svg>
  );
};

export interface CutGroupCardProps {
  group: CutGroup;
  groupIndex: number;
  groupColor: string;
  tileW: number;
  tileH: number;
  tileColor: string;
  onHighlight: (group: number | null) => void;
}

export const CutGroupCard = ({
  group,
  groupIndex,
  groupColor,
  tileW,
  tileH,
  tileColor,
  onHighlight,
}: CutGroupCardProps) => {
  const hasBigChute = group.chuteW > 20 && group.chuteH > 20;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:bg-zinc-800"
      style={{ borderLeftColor: groupColor, borderLeftWidth: 3 }}
      onMouseEnter={() => onHighlight(groupIndex + 1)}
      onMouseLeave={() => onHighlight(null)}
    >
      {/* Badge */}
      <span
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
        style={{
          background: `${groupColor}20`,
          color: groupColor,
          border: `1.5px solid ${groupColor}40`,
        }}
      >
        {groupIndex + 1}
      </span>

      {/* Thumbnail */}
      <TileThumbnail
        tileW={tileW}
        tileH={tileH}
        usedW={group.usedW}
        usedH={group.usedH}
        pieceEdges={group.pieceEdges}
        color={tileColor}
        reused={group.reuseCount > 0}
      />

      {/* Info block */}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-bold text-zinc-100">
          {formatCm(group.usedW)} × {formatCm(group.usedH)}
        </div>
        {hasBigChute && (
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Chute disponible&nbsp;: {formatCm(group.chuteW)} × {formatCm(group.chuteH)}
          </div>
        )}
        {group.reuseCount > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            ↩&nbsp;{group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
          </div>
        )}
      </div>

      {/* Qty block */}
      <div className="shrink-0 text-right">
        <div className="text-xs text-zinc-500">×{group.totalCount} total</div>
        <div className={`text-sm font-black tabular-nums ${group.reuseCount > 0 ? 'text-emerald-400' : 'text-zinc-100'}`}>
          {group.netTiles} nets
        </div>
      </div>
    </div>
  );
};
