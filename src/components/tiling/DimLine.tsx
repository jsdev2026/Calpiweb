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

  const ux = dx / len, uy = dy / len;     // unit tangent
  const nx = -dy / len, ny = dx / len;    // left normal

  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;

  // Direction from measured line toward dim line
  const perpSign = perpOffset >= 0 ? 1 : -1;
  const absPerp = Math.abs(perpOffset);
  const enx = nx * perpSign, eny = ny * perpSign;

  // Extension lines: small gap at measured point, small overshoot past dim line
  const GAP = 60, OVER = 130;

  // Adaptive arrowheads: cap at 20% of dim length so short dims stay legible
  const AL = Math.min(180, len * 0.20);
  const AW = AL * 0.42;

  // Arrowhead tip at each end of the dim line, pointing outward
  const a1 = `${dlx1},${dly1} ${dlx1 + AL * ux + AW * nx},${dly1 + AL * uy + AW * ny} ${dlx1 + AL * ux - AW * nx},${dly1 + AL * uy - AW * ny}`;
  const a2 = `${dlx2},${dly2} ${dlx2 - AL * ux + AW * nx},${dly2 - AL * uy + AW * ny} ${dlx2 - AL * ux - AW * nx},${dly2 - AL * uy - AW * ny}`;

  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;

  return (
    <g className={onContextMenu ? undefined : 'pointer-events-none'} onContextMenu={onContextMenu}>
      {/* Extension lines — solid thin, gap at start, overshoot at end */}
      <line
        x1={x1 + enx * GAP} y1={y1 + eny * GAP}
        x2={x1 + enx * (absPerp + OVER)} y2={y1 + eny * (absPerp + OVER)}
        stroke="#94a3b8" strokeWidth={12}
      />
      <line
        x1={x2 + enx * GAP} y1={y2 + eny * GAP}
        x2={x2 + enx * (absPerp + OVER)} y2={y2 + eny * (absPerp + OVER)}
        stroke="#94a3b8" strokeWidth={12}
      />
      {/* Dim line between arrowhead bases */}
      {len > 2 * AL && (
        <line
          x1={dlx1 + AL * ux} y1={dly1 + AL * uy}
          x2={dlx2 - AL * ux} y2={dly2 - AL * uy}
          stroke="#f97316" strokeWidth={14}
        />
      )}
      {/* Filled arrowheads */}
      <polygon points={a1} fill="#f97316" />
      <polygon points={a2} fill="#f97316" />
      {/* Label: white pill with dark text */}
      <g transform={`translate(${midX}, ${midY}) rotate(${ang})`}>
        <rect x="-270" y="-185" width="540" height="220" fill="white" rx="44" />
        <text x="0" y="-62" textAnchor="middle" fontSize="138" fill="#0f172a" fontWeight="700">
          {label}
        </text>
      </g>
    </g>
  );
};
