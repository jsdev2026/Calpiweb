'use client';

import type { Point } from '@/types/plan';
import { formatCote, type StartCote, type StartTileMark } from '@/engine/tiling/startTile';

const ACCENT = '#f97316';
/** Fond des étiquettes : orange foncé, texte blanc lisible (contraste ≈ 5:1) */
const LABEL_BG = '#c2410c';
const FONT = 'system-ui, -apple-system, sans-serif';

export interface StartTileLayerProps {
  marks: StartTileMark[];
  /** Échelle du plan (px par mm) : tailles de trait et de texte constantes à l'écran */
  scale: number;
}

interface Box {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface CoteLabel extends Box {
  text: string;
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.cx + a.w / 2, b.cx + b.w / 2) - Math.max(a.cx - a.w / 2, b.cx - b.w / 2)) *
  Math.max(0, Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2));

/** Le segment [p, q] traverse-t-il la boîte (approximation par échantillonnage) ? */
function segmentHits(p: Point, q: Point, b: Box): boolean {
  for (let i = 0; i <= 12; i++) {
    const x = p.x + ((q.x - p.x) * i) / 12;
    const y = p.y + ((q.y - p.y) * i) / 12;
    if (Math.abs(x - b.cx) < b.w / 2 && Math.abs(y - b.cy) < b.h / 2) return true;
  }
  return false;
}

/**
 * Place les étiquettes des cotes sans qu'elles se chevauchent ni masquent les traits :
 * sur la cote quand elle est assez longue, sinon à côté (de part et d'autre) ou
 * au-delà du mur. Toutes les tailles sont en mm (repère monde), `px` convertit des
 * pixels écran en mm.
 */
export function layoutCoteLabels(
  cotes: StartCote[],
  tile: Point[],
  px: (v: number) => number,
): (CoteLabel | null)[] {
  const fontSize = px(13);
  const xs = tile.map((p) => p.x);
  const ys = tile.map((p) => p.y);
  const tileBox: Box = {
    cx: (Math.min(...xs) + Math.max(...xs)) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
  const placed: Box[] = [];
  return cotes.map((cote, ci) => {
    const { from, to, value } = cote;
    if (value < 1) return null;
    const text = formatCote(value);
    const w = text.length * fontSize * 0.6 + px(14);
    const h = fontSize + px(10);
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const u = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
    const n = { x: -u.y, y: u.x };
    const along = Math.abs(u.x) * w + Math.abs(u.y) * h; // emprise le long de la cote
    const across = Math.abs(n.x) * w + Math.abs(n.y) * h; // emprise en travers
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const gap = px(5);

    const candidates: { c: Point; penalty: number }[] = [];
    if (len >= along + px(16)) candidates.push({ c: mid, penalty: 0 });
    for (const s of [1, -1]) {
      candidates.push({
        c: { x: mid.x + s * n.x * (across / 2 + gap), y: mid.y + s * n.y * (across / 2 + gap) },
        penalty: 1,
      });
    }
    candidates.push({
      c: { x: from.x - u.x * (along / 2 + gap), y: from.y - u.y * (along / 2 + gap) },
      penalty: 12, // au-delà du mur : dernier recours
    });

    let best: { box: Box; cost: number } | null = null;
    for (const { c, penalty } of candidates) {
      const box: Box = { cx: c.x, cy: c.y, w, h };
      const area = w * h;
      let cost = penalty * 0.05;
      for (const p of placed) cost += (overlap(box, p) / area) * 20;
      cost += (overlap(box, tileBox) / area) * 1.5;
      cotes.forEach((other, oi) => {
        if (oi !== ci && other.value >= 1 && segmentHits(other.from, other.to, box)) cost += 3;
      });
      if (!best || cost < best.cost) best = { box, cost };
    }
    placed.push(best!.box);
    return { ...best!.box, text };
  });
}

function CoteLine({ cote, px }: { cote: StartCote; px: (v: number) => number }) {
  const { from, to, value } = cote;
  if (value < 1) return null;
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  // Petites barres de fin, perpendiculaires à la cote
  const nx = (-(to.y - from.y) / len) * px(6);
  const ny = ((to.x - from.x) / len) * px(6);
  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="white"
        strokeWidth={px(4)}
        strokeLinecap="round"
      />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={ACCENT} strokeWidth={px(2)} />
      {[from, to].map((p, i) => (
        <line
          key={i}
          x1={p.x - nx}
          y1={p.y - ny}
          x2={p.x + nx}
          y2={p.y + ny}
          stroke={ACCENT}
          strokeWidth={px(2)}
        />
      ))}
    </g>
  );
}

function Label({ label, px }: { label: CoteLabel; px: (v: number) => number }) {
  return (
    <g>
      <rect
        x={label.cx - label.w / 2}
        y={label.cy - label.h / 2}
        width={label.w}
        height={label.h}
        rx={label.h / 2}
        fill={LABEL_BG}
        stroke="white"
        strokeWidth={px(1.5)}
      />
      <text
        x={label.cx}
        y={label.cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={px(13)}
        fontWeight="700"
        fontFamily={FONT}
        fill="white"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label.text}
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
        const labels = layoutCoteLabels(m.cotes, m.tile, px);
        return (
          <g key={m.roomId}>
            <polygon
              points={m.tile.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={ACCENT}
              fillOpacity={0.18}
              stroke={ACCENT}
              strokeWidth={px(2.5)}
            />
            {m.cotes.map((cote, i) => (
              <CoteLine key={i} cote={cote} px={px} />
            ))}
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
              fontFamily={FONT}
              fill="white"
            >
              D
            </text>
            {labels.map((l, i) => l && <Label key={i} label={l} px={px} />)}
          </g>
        );
      })}
    </g>
  );
};
