'use client';

import type { Point } from '@/types/plan';
import { formatCote, type StartCote, type StartTileMark } from '@/engine/tiling/startTile';

const ACCENT = '#f97316';

export interface StartTileLayerProps {
  marks: StartTileMark[];
  /** Échelle du plan (px par mm) : tailles de trait et de texte constantes à l'écran */
  scale: number;
}

function Cote({ cote, px }: { cote: StartCote; px: (v: number) => number }) {
  const { from, to, value } = cote;
  if (value < 1) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  // Petites barres de fin, perpendiculaires à la cote
  const nx = (-dy / len) * px(6);
  const ny = (dx / len) * px(6);
  const mid: Point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const label = formatCote(value);
  const fontSize = px(12);
  const w = label.length * fontSize * 0.58 + px(10);
  const h = fontSize + px(6);
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={ACCENT}
        strokeWidth={px(1.5)}
        strokeDasharray={`${px(4)} ${px(3)}`}
      />
      {[from, to].map((p, i) => (
        <line
          key={i}
          x1={p.x - nx}
          y1={p.y - ny}
          x2={p.x + nx}
          y2={p.y + ny}
          stroke={ACCENT}
          strokeWidth={px(1.5)}
        />
      ))}
      <rect
        x={mid.x - w / 2}
        y={mid.y - h / 2}
        width={w}
        height={h}
        rx={px(4)}
        fill="white"
        stroke={ACCENT}
        strokeWidth={px(1)}
      />
      <text
        x={mid.x}
        y={mid.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
        fill={ACCENT}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Repère du carreau de départ, en coordonnées monde (mm), dans le même
 * <g> transformé que la couche de carreaux.
 */
export const StartTileLayer = ({ marks, scale }: StartTileLayerProps) => {
  if (marks.length === 0) return null;
  const px = (v: number) => v / Math.max(scale, 1e-6);
  return (
    <g className="pointer-events-none" data-testid="start-tile-layer">
      {marks.map((m) => {
        const c = m.tile.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
        const center = { x: c.x / m.tile.length, y: c.y / m.tile.length };
        return (
          <g key={m.roomId}>
            <polygon
              points={m.tile.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={ACCENT}
              fillOpacity={0.18}
              stroke={ACCENT}
              strokeWidth={px(2.5)}
            />
            {[m.corner, m.secondCorner].map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={px(4)} fill={ACCENT} />
            ))}
            <circle cx={center.x} cy={center.y} r={px(11)} fill={ACCENT} />
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={px(12)}
              fontWeight="800"
              fontFamily="system-ui, -apple-system, sans-serif"
              fill="white"
            >
              D
            </text>
            {m.cotes.map((cote, i) => (
              <Cote key={i} cote={cote} px={px} />
            ))}
          </g>
        );
      })}
    </g>
  );
};
