'use client';

import type { MouseEvent, PointerEvent } from 'react';

interface DimLineProps {
  x1: number; y1: number;
  x2: number; y2: number;
  label: string;
  perpOffset?: number;
  scale?: number;
  onContextMenu?: (e: MouseEvent<SVGGElement>) => void;
  onPointerDown?: (e: PointerEvent<SVGGElement>) => void;
}

export const DimLine = ({
  x1, y1, x2, y2, label,
  perpOffset = 500, scale = 1,
  onContextMenu, onPointerDown,
}: DimLineProps) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 10) return null;

  const ux = dx / len, uy = dy / len;   // unit tangent
  const nx = -dy / len, ny = dx / len;  // left normal

  const ox = nx * perpOffset, oy = ny * perpOffset;
  const dlx1 = x1 + ox, dly1 = y1 + oy;
  const dlx2 = x2 + ox, dly2 = y2 + oy;

  const perpSign = perpOffset >= 0 ? 1 : -1;
  const absPerp = Math.abs(perpOffset);
  const enx = nx * perpSign, eny = ny * perpSign;

  // All sizes in screen-pixels / scale = world units that render at constant px size
  const S = scale;
  const ARROW_L  = 12 / S;
  const ARROW_W  = 6  / S;
  const EXT_GAP  = 6  / S;
  const EXT_OVER = 8  / S;
  const FONT_PX  = 12 / S;
  const PILL_H   = 20 / S;
  const PILL_W   = (label.length * 7.5 + 16) / S;
  const LABEL_GAP = 8 / S;

  const a1 = `${dlx1},${dly1} ${dlx1 + ARROW_L*ux + ARROW_W*nx},${dly1 + ARROW_L*uy + ARROW_W*ny} ${dlx1 + ARROW_L*ux - ARROW_W*nx},${dly1 + ARROW_L*uy - ARROW_W*ny}`;
  const a2 = `${dlx2},${dly2} ${dlx2 - ARROW_L*ux + ARROW_W*nx},${dly2 - ARROW_L*uy + ARROW_W*ny} ${dlx2 - ARROW_L*ux - ARROW_W*nx},${dly2 - ARROW_L*uy - ARROW_W*ny}`;

  const midX = (dlx1 + dlx2) / 2, midY = (dly1 + dly2) / 2;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;

  // Label centre: 8 screen-px above dim line, away from measured segment
  const labelOffset = LABEL_GAP + PILL_H / 2;
  const lx = midX + nx * perpSign * labelOffset;
  const ly = midY + ny * perpSign * labelOffset;

  return (
    <g
      className={onPointerDown ? 'cursor-grab' : onContextMenu ? undefined : 'pointer-events-none'}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
      {/* Extension lines */}
      <line
        x1={x1 + enx * EXT_GAP} y1={y1 + eny * EXT_GAP}
        x2={x1 + enx * (absPerp + EXT_OVER)} y2={y1 + eny * (absPerp + EXT_OVER)}
        stroke="#94a3b8" strokeWidth={1 / S}
      />
      <line
        x1={x2 + enx * EXT_GAP} y1={y2 + eny * EXT_GAP}
        x2={x2 + enx * (absPerp + EXT_OVER)} y2={y2 + eny * (absPerp + EXT_OVER)}
        stroke="#94a3b8" strokeWidth={1 / S}
      />
      {/* Dim line between arrowhead bases */}
      {len > 2 * ARROW_L && (
        <line
          x1={dlx1 + ARROW_L * ux} y1={dly1 + ARROW_L * uy}
          x2={dlx2 - ARROW_L * ux} y2={dly2 - ARROW_L * uy}
          stroke="#f97316" strokeWidth={2 / S}
        />
      )}
      {/* Arrowheads */}
      <polygon points={a1} fill="#f97316" />
      <polygon points={a2} fill="#f97316" />
      {/* Label: translucent pill, 8 px above dim line */}
      <g transform={`translate(${lx}, ${ly}) rotate(${ang})`}>
        <rect
          x={-PILL_W / 2} y={-PILL_H / 2}
          width={PILL_W} height={PILL_H}
          fill="rgba(255,255,255,0.82)" rx={PILL_H / 2}
        />
        <text
          x="0" y="1"
          textAnchor="middle" dominantBaseline="middle"
          fontSize={FONT_PX} fill="#475569" fontWeight="600"
        >
          {label}
        </text>
      </g>
    </g>
  );
};
