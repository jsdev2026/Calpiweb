'use client';

import type { MouseEvent } from 'react';

interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
}

export const DimLine = ({ x1, y1, x2, y2, label, perpOffset = 500, onContextMenu }: DimLineProps) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return null;
  const nx = -dy / len, ny = dx / len;
  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;
  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const tLen = 120;

  return (
    <g
      className={onContextMenu ? undefined : 'pointer-events-none'}
      onContextMenu={onContextMenu}
    >
      <line x1={x1} y1={y1} x2={dlx1 + ox * 0.15} y2={dly1 + oy * 0.15} stroke="#475569" strokeWidth={18} strokeDasharray="60,40" />
      <line x1={x2} y1={y2} x2={dlx2 + ox * 0.15} y2={dly2 + oy * 0.15} stroke="#475569" strokeWidth={18} strokeDasharray="60,40" />
      <line x1={dlx1} y1={dly1} x2={dlx2} y2={dly2} stroke="#64748b" strokeWidth={22} />
      <line x1={dlx1 - nx * tLen} y1={dly1 - ny * tLen} x2={dlx1 + nx * tLen} y2={dly1 + ny * tLen} stroke="#64748b" strokeWidth={22} />
      <line x1={dlx2 - nx * tLen} y1={dly2 - ny * tLen} x2={dlx2 + nx * tLen} y2={dly2 + ny * tLen} stroke="#64748b" strokeWidth={22} />
      <g transform={`translate(${midX}, ${midY}) rotate(${ang})`}>
        <rect x="-280" y="-210" width="560" height="240" fill="#0f172a" rx="50" />
        <text x="0" y="-65" textAnchor="middle" fontSize="145" fill="#94a3b8" fontWeight="bold">
          {label}
        </text>
      </g>
    </g>
  );
};
