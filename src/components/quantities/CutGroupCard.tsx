'use client';
import type { PieceEdges } from '@/engine/quantities/quantityEngine';

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

export const TileThumbnail = ({ tileW, tileH, usedW, usedH, pieceEdges, color, reused }: ThumbnailProps) => {
  const maxDim = 18;
  const scale = Math.min(maxDim / tileW, maxDim / tileH);
  const tw = tileW * scale;
  const th = tileH * scale;
  const uw = Math.min(usedW * scale, tw);
  const uh = Math.min(usedH * scale, th);
  const px = 0;
  const py = th - uh;
  const cutColor = '#f97316';
  const factoryColor = '#52525b';
  const sw = 1.2;
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
