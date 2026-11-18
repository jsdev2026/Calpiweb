'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CLICKS,
  CUTS,
  LOOP,
  ROOM,
  STILL_FRAME,
  T,
  TILE_H,
  TILE_W,
  WHOLE,
  counterAt,
  cursorAt,
  drawnPath,
  formatCm,
  loopFade,
  prog,
  pulseAt,
  sceneAt,
  staggerAt,
  startCotes,
  tilesAt,
  type DemoScene,
} from './heroTimeline';

// Couleurs du thème sombre de la page d'accueil
const ACCENT = '#E8671A';
const PANEL = '#161B22';
const LINE = 'rgba(255,255,255,0.08)';
const TEXT = '#E6EDF3';
const MUTED = 'rgba(255,255,255,0.42)';
const FONT = 'system-ui, -apple-system, sans-serif';

const W = 560;
const H = 330;

/**
 * Temps de l'animation : boucle continue, en pause hors écran, figé si animations réduites.
 * `range` limite la boucle à un extrait du scénario (tutoriel : une étape à la fois).
 */
export function useDemoClock(
  ref: React.RefObject<HTMLElement>,
  range?: readonly [number, number],
): number {
  const from = range?.[0] ?? 0;
  const to = range?.[1] ?? LOOP;
  const hasRange = !!range;
  const [t, setT] = useState(from);
  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setT(hasRange ? to - 0.05 : STILL_FRAME);
      return;
    }
    let visible = true;
    let raf = 0;
    let last: number | null = null;
    let acc = 0;
    setT(from);
    const tick = (now: number) => {
      if (last !== null && visible && document.visibilityState === 'visible') {
        // Temps réel même si l'appareil affiche peu d'images par seconde (sinon ralenti) ;
        // plafond de 1 s : pas de saut au retour sur l'onglet (le temps masqué n'est pas compté)
        acc = (acc + Math.min(1, (now - last) / 1000)) % (to - from);
        setT(from + acc);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const el = ref.current;
    const io =
      el && 'IntersectionObserver' in window
        ? new IntersectionObserver(([e]) => {
            visible = !!e?.isIntersecting;
          })
        : null;
    if (el && io) io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [ref, from, to, hasRange]);
  return t;
}

// ── Éléments du panneau (SVG) ────────────────────────────────────────────────

const Label = ({ x, y, children }: { x: number; y: number; children: string }) => (
  <text
    x={x}
    y={y}
    fontSize="6.5"
    fontWeight="700"
    letterSpacing="0.08em"
    fill={MUTED}
    fontFamily={FONT}
  >
    {children}
  </text>
);

const Chip = ({
  x,
  y,
  w,
  h = 16,
  label,
  active = false,
  opacity = 1,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  label: string;
  active?: boolean;
  opacity?: number;
}) => (
  <g opacity={opacity}>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx="4"
      fill={active ? 'rgba(232,103,26,0.16)' : 'rgba(255,255,255,0.04)'}
      stroke={active ? ACCENT : LINE}
      strokeWidth="0.8"
    />
    <text
      x={x + w / 2}
      y={y + h / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="7"
      fontWeight="600"
      fill={active ? ACCENT : 'rgba(255,255,255,0.62)'}
      fontFamily={FONT}
    >
      {label}
    </text>
  </g>
);

const Row = ({
  y,
  label,
  value,
  opacity = 1,
}: {
  y: number;
  label: string;
  value: string;
  opacity?: number;
}) => (
  <g opacity={opacity} fontFamily={FONT}>
    <text x={22} y={y} fontSize="7.5" fill="rgba(255,255,255,0.62)">
      {label}
    </text>
    <text x={148} y={y} fontSize="7.5" fontWeight="700" textAnchor="end" fill={TEXT}>
      {value}
    </text>
    <line x1={22} y1={y + 5} x2={148} y2={y + 5} stroke={LINE} strokeWidth="0.6" />
  </g>
);

const HEAD: Record<DemoScene, { title: string; prev?: string; next: string }> = {
  PLAN: { title: 'Plan 2D', next: 'Calepinage →' },
  TILING: { title: 'Calepinage', prev: '← Plan 2D', next: 'Quantitatif →' },
  QUANTITIES: { title: 'Quantitatif', prev: '← Calepinage', next: 'Exporter en PDF' },
};

function Panel({ t }: { t: number }) {
  const scene = sceneAt(t);
  const head = HEAD[scene];
  const closed = t >= T.closed;
  const pulse = pulseAt(t);
  const stagger = t >= T.poseClick;
  const summary =
    scene === 'PLAN'
      ? closed
        ? 'Pièce fermée · 8,5 m²'
        : 'Outil : tracer des murs'
      : scene === 'TILING'
        ? `30 × 60 cm · joint 3 mm · ${stagger ? 'Décalé 1/3' : 'Droit'}`
        : `À commander : ${counterAt(t)} carreaux`;
  const nextX = 152;
  const nextW = head.next.length * 4.1 + 10;

  return (
    <g fontFamily={FONT}>
      <rect
        x="10"
        y="10"
        width="150"
        height="310"
        rx="10"
        fill={PANEL}
        stroke={LINE}
        strokeWidth="0.8"
      />
      {/* En-tête */}
      <rect
        x="20"
        y="22"
        width="12"
        height="12"
        rx="3"
        fill="rgba(232,103,26,0.18)"
        stroke={ACCENT}
        strokeWidth="0.8"
      />
      <text x="38" y="29" fontSize="9.5" fontWeight="700" fill={TEXT}>
        {head.title}
      </text>
      <text x="38" y="40" fontSize="6.5" fill={MUTED}>
        {summary}
      </text>
      {/* Bandeau précédent / suivant */}
      <rect x="10" y="50" width="150" height="22" fill="rgba(255,255,255,0.03)" />
      <line x1="10" y1="50" x2="160" y2="50" stroke={LINE} strokeWidth="0.6" />
      <line x1="10" y1="72" x2="160" y2="72" stroke={LINE} strokeWidth="0.6" />
      {head.prev && (
        <text x="20" y="64" fontSize="7.5" fontWeight="700" fill={ACCENT}>
          {head.prev}
        </text>
      )}
      {pulse > 0 && (
        <rect
          x={nextX - nextW + 4 - pulse * 3}
          y={54 - pulse * 3}
          width={nextW + pulse * 6}
          height={14 + pulse * 6}
          rx={10}
          fill="rgba(232,103,26,0.12)"
          stroke={ACCENT}
          strokeOpacity={0.7 * (1 - pulse)}
          strokeWidth="1.2"
        />
      )}
      <text x={nextX} y="64" fontSize="7.5" fontWeight="700" textAnchor="end" fill={ACCENT}>
        {head.next}
      </text>

      {scene === 'PLAN' && (
        <g>
          {[
            ['Sélection', 18, 82],
            ['Murs', 88, 82],
            ['Porte', 18, 104],
            ['Zone exclue', 88, 104],
            ['Verrouiller', 18, 126],
            ['Supprimer', 88, 126],
          ].map(([l, x, y]) => (
            <Chip
              key={l as string}
              x={x as number}
              y={y as number}
              w={64}
              h={18}
              label={l as string}
              active={l === 'Murs'}
            />
          ))}
          <Label x={20} y={165}>
            ÉPAISSEUR DES MURS
          </Label>
          <Chip x={18} y={171} w={134} label="10 cm" />
          <Label x={20} y={206}>
            PIÈCES
          </Label>
          <Row y={222} label="Salon" value="8,5 m²" opacity={prog(t, T.closed, T.closed + 0.3)} />
        </g>
      )}

      {scene === 'TILING' && (
        <g>
          <Label x={20} y={86}>
            FORMAT (CM)
          </Label>
          {['30×30', '45×45', '60×60', '80×80', '30×60', '60×120', '20×120', '15×90'].map(
            (l, i) => (
              <Chip
                key={l}
                x={18 + (i % 4) * 34}
                y={91 + Math.floor(i / 4) * 18}
                w={31}
                h={15}
                label={l}
                active={l === '30×60'}
              />
            ),
          )}
          <Label x={20} y={140}>
            POSE
          </Label>
          <Chip x={18} y={145} w={64} label="Droit" active={!stagger} />
          <Chip x={88} y={145} w={64} label="Décalé 1/3" active={stagger} />
          <Chip x={18} y={165} w={64} label="Bâton rompu" />
          <Chip x={88} y={165} w={64} label="Hongrie" />
          <Label x={20} y={200}>
            DÉPART DE LA POSE
          </Label>
          <Chip
            x={18}
            y={205}
            w={134}
            label="Coter le carreau de départ"
            active={t >= T.startTile}
          />
        </g>
      )}

      {scene === 'QUANTITIES' && (
        <g>
          <Label x={20} y={86}>
            À COMMANDER
          </Label>
          <rect
            x="18"
            y="91"
            width="134"
            height="46"
            rx="6"
            fill="rgba(232,103,26,0.1)"
            stroke={ACCENT}
            strokeWidth="0.8"
          />
          <text x="85" y="117" textAnchor="middle" fontSize="22" fontWeight="800" fill={ACCENT}>
            {counterAt(t)}
          </text>
          <text x="85" y="130" textAnchor="middle" fontSize="7" fill={MUTED}>
            carreaux · marge 5 %
          </text>
          <Row
            y={152}
            label="Carreaux entiers"
            value={String(Math.round(WHOLE * prog(t, T.countFrom, T.countTo)))}
          />
          <Row
            y={168}
            label="Carreaux à couper"
            value={String(Math.round(CUTS * prog(t, T.countFrom, T.countTo)))}
          />
          <Label x={20} y={196}>
            CONSOMMABLES
          </Label>
          <Row
            y={212}
            label="Colle"
            value="5 sacs"
            opacity={prog(t, T.consumables, T.consumables + 0.3)}
          />
          <Row
            y={228}
            label="Joint"
            value="3 sacs"
            opacity={prog(t, T.consumables + 0.3, T.consumables + 0.6)}
          />
          <Row
            y={244}
            label="Croisillons"
            value="2 sachets"
            opacity={prog(t, T.consumables + 0.6, T.consumables + 0.9)}
          />
        </g>
      )}
    </g>
  );
}

// ── Plan, carreaux, cotes ────────────────────────────────────────────────────

function Canvas({ t }: { t: number }) {
  const scene = sceneAt(t);
  const { pts, closed } = drawnPath(t);
  const roomPts = ROOM.map((p) => `${p.x},${p.y}`).join(' ');
  const showTiles = scene !== 'PLAN';
  const stagger = staggerAt(t);
  const tiles = showTiles ? tilesAt(stagger) : [];
  const cotes = startCotes(1);
  const startOpacity = scene === 'TILING' ? prog(t, T.startTile, T.startTile + 0.4) : 0;
  const cutHighlight = scene === 'QUANTITIES' ? prog(t, T.toQuantities, T.toQuantities + 0.5) : 0;
  const dimOpacity = (i: number) =>
    prog(t, T.drawStart + (i + 1) * T.segment, T.drawStart + (i + 1) * T.segment + 0.25);

  return (
    <g>
      <defs>
        <pattern id="hd-dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.65" fill="rgba(255,255,255,0.12)" />
        </pattern>
        <clipPath id="hd-room">
          <polygon points={roomPts} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#0A0B0E" />
      <rect x="0" y="0" width={W} height={H} fill="url(#hd-dots)" />

      {/* Pièce fermée : remplissage discret */}
      {closed && (
        <polygon
          points={roomPts}
          fill="rgba(232,103,26,0.05)"
          opacity={prog(t, T.closed, T.closed + 0.3)}
        />
      )}

      {/* Carreaux, posés en cascade puis décalés */}
      {showTiles && (
        <g clipPath="url(#hd-room)">
          {tiles.map((tile) => {
            const a = prog(t, T.tilesIn + tile.order * 0.07, T.tilesIn + tile.order * 0.07 + 0.35);
            const cut = tile.cut ? cutHighlight : 0;
            return (
              <rect
                key={tile.key}
                x={tile.x + 1}
                y={tile.y + 1}
                width={TILE_W - 2}
                height={TILE_H - 2}
                rx="1"
                opacity={a}
                fill={cut ? `rgba(232,103,26,${0.06 + 0.16 * cut})` : 'rgba(255,255,255,0.055)'}
                stroke={cut ? `rgba(232,103,26,${0.25 + 0.35 * cut})` : 'rgba(255,255,255,0.13)'}
                strokeWidth="0.7"
              />
            );
          })}
        </g>
      )}

      {/* Carreau de départ « D » et ses cotes */}
      {startOpacity > 0 && (
        <g opacity={startOpacity} fontFamily={FONT}>
          <rect
            x={cotes.tile.x + 1}
            y={cotes.tile.y + 1}
            width={TILE_W - 2}
            height={TILE_H - 2}
            fill="rgba(249,115,22,0.25)"
            stroke="#f97316"
            strokeWidth="1.4"
          />
          <circle
            cx={cotes.tile.x + TILE_W / 2}
            cy={cotes.tile.y + TILE_H / 2}
            r="6"
            fill="#f97316"
          />
          <text
            x={cotes.tile.x + TILE_W / 2}
            y={cotes.tile.y + TILE_H / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fontWeight="800"
            fill="white"
          >
            D
          </text>
          <line
            x1={ROOM[0]!.x}
            y1={cotes.tile.y + 1}
            x2={cotes.tile.x + 1}
            y2={cotes.tile.y + 1}
            stroke="#f97316"
            strokeWidth="0.8"
          />
          <line
            x1={cotes.tile.x + 1}
            y1={ROOM[0]!.y}
            x2={cotes.tile.x + 1}
            y2={cotes.tile.y + 1}
            stroke="#f97316"
            strokeWidth="0.8"
          />
          <text
            x={ROOM[0]!.x + cotes.left / 2}
            y={cotes.tile.y - 3}
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="600"
            fill="#fb923c"
          >
            {formatCm(cotes.left)}
          </text>
          <text
            x={cotes.tile.x + 4}
            y={ROOM[0]!.y + cotes.top / 2 + 2}
            fontSize="6.5"
            fontWeight="600"
            fill="#fb923c"
          >
            {formatCm(cotes.top)}
          </text>
        </g>
      )}

      {/* Contour (tracé progressif) */}
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={ACCENT}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.slice(0, closed ? ROOM.length : pts.length).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.8" fill={ACCENT} />
      ))}

      {/* Cotes des murs, au fil du tracé */}
      <g fontFamily="monospace" fontSize="7.5" fill="rgba(255,255,255,0.5)">
        <g opacity={dimOpacity(0)}>
          <line
            x1="200"
            y1="40"
            x2="520"
            y2="40"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.7"
          />
          <text x="360" y="35" textAnchor="middle">
            320 cm
          </text>
        </g>
        <g opacity={dimOpacity(1)}>
          <text x="530" y="114">
            118
          </text>
        </g>
        <g opacity={dimOpacity(5)}>
          <line
            x1="188"
            y1="52"
            x2="188"
            y2="300"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.7"
          />
          <text x="181" y="176" textAnchor="middle" transform="rotate(-90 181 176)">
            248 cm
          </text>
        </g>
      </g>

      {/* Confirmation d'export */}
      {t >= T.pdfClick + 0.1 && (
        <g opacity={prog(t, T.pdfClick + 0.1, T.pdfClick + 0.4)} fontFamily={FONT}>
          <rect
            x="420"
            y="230"
            width="132"
            height="26"
            rx="13"
            fill={PANEL}
            stroke={ACCENT}
            strokeWidth="0.8"
          />
          <text
            x="486"
            y="243"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="8"
            fontWeight="600"
            fill={TEXT}
          >
            ✓ Bon de commande prêt
          </text>
        </g>
      )}
    </g>
  );
}

function Cursor({ t }: { t: number }) {
  const c = cursorAt(t);
  const ring = CLICKS.map((k) => (t >= k && t < k + 0.45 ? (t - k) / 0.45 : -1)).find(
    (v) => v >= 0,
  );
  return (
    <g pointerEvents="none">
      {ring !== undefined && (
        <circle
          cx={c.x}
          cy={c.y}
          r={4 + ring * 12}
          fill="none"
          stroke={ACCENT}
          strokeOpacity={1 - ring}
          strokeWidth="1.5"
        />
      )}
      <g transform={`translate(${c.x} ${c.y}) scale(${c.pressed ? 0.85 : 1})`}>
        <path
          d="M0 0 L0 13 L3.6 9.6 L6.2 15 L8.4 14 L5.8 8.7 L10.5 8.7 Z"
          fill="white"
          stroke="#0A0B0E"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/**
 * Démonstration animée du produit (page d'accueil) : tracé d'une pièce, calepinage,
 * quantitatif puis export PDF, en boucle (~16 s).
 */
export const HeroDemoFrame = ({
  t,
  frameRef,
}: {
  t: number;
  frameRef?: React.Ref<HTMLDivElement>;
}) => {
  const scene = sceneAt(t);

  return (
    <div ref={frameRef} className="relative select-none" data-testid="hero-demo" data-scene={scene}>
      {/* Halo d'ambiance */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '50%',
          background: 'radial-gradient(ellipse, rgba(232,103,26,0.35) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          background: '#0D1117',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 48px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Barre de fenêtre */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: '#161B22',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 5 }} aria-hidden>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <span
            style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}
          >
            Salon — CaléPlan
          </span>
          <div style={{ width: 48 }} />
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Démonstration : tracé d’une pièce, calepinage des carreaux, quantitatif et export PDF"
          style={{ display: 'block' }}
        >
          <g opacity={loopFade(t)}>
            <Canvas t={t} />
            <Panel t={t} />
            <Cursor t={t} />
          </g>
        </svg>
      </div>
    </div>
  );
};

export const HeroDemo = () => {
  const ref = useRef<HTMLDivElement>(null);
  const t = useDemoClock(ref);
  return <HeroDemoFrame t={t} frameRef={ref} />;
};
