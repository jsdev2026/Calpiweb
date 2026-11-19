'use client';
// Essai sans compte (page d'accueil) : tracer une pièce et voir son calepinage et son
// quantitatif, avec un seul format de carreau. Toutes les autres options sont visibles mais
// verrouillées : un clic renvoie vers l'inscription.
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, RotateCcw, Undo2, X } from 'lucide-react';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import {
  AREA_H,
  AREA_W,
  CLOSE_RADIUS,
  addPoint,
  distance,
  formatLength,
  snapPoint,
} from './tryItGeometry';

const ACCENT = '#E8671A';
const TEXT = '#E6EDF3';
const MUTED = 'rgba(255,255,255,0.45)';
const LINE = 'rgba(255,255,255,0.08)';
export const SIGNUP_URL = '/auth?step=register&from=essai';

/** Seul format disponible dans l'essai */
export const TRY_CONFIG: TilingConfig = {
  ...DEFAULT_TILING_CONFIG,
  width: 600,
  height: 600,
  joint: 3,
  stagger: 0,
  layout: 'STRAIGHT',
};

const HINTS = {
  start: 'Cliquez pour poser le premier angle de la pièce',
  drawing: 'Cliquez pour poser l’angle suivant',
  canClose: 'Cliquez sur le premier point pour fermer la pièce',
  'too-short': 'Mur trop court : éloignez le point',
  crossing: 'Les murs ne peuvent pas se croiser',
  done: 'Votre quantitatif est prêt',
} as const;

const Chip = ({
  children,
  active = false,
  locked = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  locked?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={locked ? `${String(children)} (inscription requise)` : undefined}
    className="flex h-7 items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] font-semibold transition-colors"
    style={{
      borderColor: active ? ACCENT : LINE,
      background: active ? 'rgba(232,103,26,0.15)' : 'rgba(255,255,255,0.03)',
      color: active ? ACCENT : locked ? MUTED : TEXT,
      cursor: active ? 'default' : 'pointer',
    }}
  >
    {children}
    {locked && <Lock size={10} aria-hidden />}
  </button>
);

/**
 * Surface floutée : la vraie valeur n'est jamais écrite dans la page (c'est un faux nombre
 * qui est flouté) ; un clic renvoie vers l'inscription.
 */
export const BlurredArea = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Surface (inscription requise)"
    title="Créez un compte gratuit pour voir la surface"
    data-testid="blurred-area"
    className="inline-flex items-center gap-1 align-baseline"
  >
    <span aria-hidden className="select-none" style={{ filter: 'blur(4px)' }}>
      88,88 m²
    </span>
    <Lock size={10} aria-hidden style={{ color: MUTED }} />
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-3">
    <p
      className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em]"
      style={{ color: MUTED }}
    >
      {title}
    </p>
    {children}
  </div>
);

export const TryIt = ({ onClose }: { onClose?: () => void }) => {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [warning, setWarning] = useState<'too-short' | 'crossing' | null>(null);
  const signup = () => router.push(SIGNUP_URL);

  const result = useMemo(
    () =>
      closed
        ? analyzeQuantities(
            [{ id: 'essai', name: 'Ma pièce', points, edges: points.map(() => 'WALL' as const) }],
            TRY_CONFIG,
            0,
          )
        : null,
    [closed, points],
  );

  const toWorld = (e: React.PointerEvent): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  const onDown = (e: React.PointerEvent) => {
    if (closed) return;
    const raw = toWorld(e);
    if (!raw) return;
    const r = addPoint(points, raw);
    if (r.kind === 'rejected') {
      setWarning(r.reason);
      return;
    }
    setWarning(null);
    if (r.kind === 'closed') setClosed(true);
    else setPoints(r.points);
  };

  const onMove = (e: React.PointerEvent) => {
    if (closed || e.pointerType === 'touch') return;
    const raw = toWorld(e);
    if (raw) setCursor(snapPoint(raw, points[points.length - 1]));
  };

  const reset = () => {
    setPoints([]);
    setClosed(false);
    setWarning(null);
  };

  const first = points[0];
  const last = points[points.length - 1];
  const nearFirst =
    !!cursor && !!first && points.length >= 3 && distance(cursor, first) <= CLOSE_RADIUS;
  const hint = closed
    ? HINTS.done
    : warning
      ? HINTS[warning]
      : points.length === 0
        ? HINTS.start
        : points.length >= 3
          ? HINTS.canClose
          : HINTS.drawing;
  const pts = (p: Point[]) => p.map((q) => `${q.x},${q.y}`).join(' ');
  const label = 170;

  return (
    <div
      className="relative select-none [--try-radius:0px] sm:[--try-radius:16px]"
      data-testid="try-it"
    >
      <div
        style={{
          background: '#0D1117',
          borderRadius: 'var(--try-radius, 16px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 48px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Barre de fenêtre */}
        <div
          className="flex items-center gap-2.5 px-4 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#161B22' }}
        >
          <div className="flex gap-[5px]" aria-hidden>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <div key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <span className="flex-1 text-center text-[11px]" style={{ color: MUTED }}>
            Essai gratuit — CaléPlan
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer l’essai"
              className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/10"
              style={{ color: MUTED }}
            >
              <X size={16} />
            </button>
          ) : (
            <span className="w-7" />
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row">
          {/* ── Panneau : une seule option active, le reste verrouillé ── */}
          <div
            className="shrink-0 p-3 sm:w-[210px]"
            style={{ background: '#161B22', borderRight: `1px solid ${LINE}` }}
          >
            <Section title="Outils">
              <div className="grid grid-cols-2 gap-1">
                <Chip active>Tracer</Chip>
                <Chip locked onClick={signup}>
                  Porte
                </Chip>
                <Chip locked onClick={signup}>
                  Zone
                </Chip>
                <Chip locked onClick={signup}>
                  Cotes
                </Chip>
              </div>
            </Section>
            <Section title="Carreau (cm)">
              <div className="grid grid-cols-2 gap-1">
                <Chip active>60×60</Chip>
                {['30×60', '60×120', '20×120'].map((f) => (
                  <Chip key={f} locked onClick={signup}>
                    {f}
                  </Chip>
                ))}
              </div>
            </Section>
            <Section title="Pose">
              <div className="grid grid-cols-2 gap-1">
                <Chip active>Droite</Chip>
                <Chip locked onClick={signup}>
                  Décalée
                </Chip>
                <Chip locked onClick={signup}>
                  Chevron
                </Chip>
                <Chip locked onClick={signup}>
                  Joint
                </Chip>
              </div>
            </Section>

            {result && result.totalTiles > 0 ? (
              <div data-testid="try-quantities">
                <Section title="Quantitatif">
                  <div
                    className="rounded-lg border px-2.5 py-2 text-center"
                    style={{ borderColor: ACCENT, background: 'rgba(232,103,26,0.1)' }}
                  >
                    <div className="text-[9.5px] font-bold uppercase" style={{ color: MUTED }}>
                      À commander
                    </div>
                    <div
                      data-testid="try-to-order"
                      className="text-[22px] font-black leading-tight"
                      style={{ color: ACCENT }}
                    >
                      {result.toOrder}
                    </div>
                    <div className="text-[10.5px]" style={{ color: TEXT }}>
                      carreaux 60×60 · <BlurredArea onClick={signup} />
                    </div>
                  </div>
                  <dl className="mt-2 space-y-1 text-[11px]" style={{ color: MUTED }}>
                    {(
                      [
                        ['Surface', <BlurredArea key="surface" onClick={signup} />],
                        ['Carreaux entiers', String(result.wholeCount)],
                        ['Carreaux coupés', String(result.cuts.length)],
                        ['Marge', `${Math.round(result.margin * 100)} %`],
                      ] as [string, React.ReactNode][]
                    ).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt>{k}</dt>
                        <dd className="font-semibold" style={{ color: TEXT }}>
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 grid gap-1">
                    {['Cartons', 'Colle et joint', 'Plinthes', 'Plan des coupes', 'Export PDF'].map(
                      (k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={signup}
                          aria-label={`${k} (inscription requise)`}
                          className="flex h-7 items-center justify-between rounded-md border px-2 text-[11px]"
                          style={{ borderColor: LINE, color: MUTED }}
                        >
                          {k}
                          <Lock size={10} aria-hidden />
                        </button>
                      ),
                    )}
                  </div>
                </Section>
              </div>
            ) : (
              <p className="text-[10.5px] leading-relaxed" style={{ color: MUTED }}>
                Tracez une pièce pour obtenir son calepinage et le nombre de carreaux à commander.
              </p>
            )}
          </div>

          {/* ── Zone de dessin ── */}
          <div className="relative min-w-0 flex-1">
            <div
              role="status"
              className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{
                background: warning ? 'rgba(239,68,68,0.9)' : 'rgba(22,27,34,0.92)',
                color: warning ? '#fff' : TEXT,
                border: `1px solid ${warning ? 'transparent' : LINE}`,
              }}
            >
              {hint}
            </div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${AREA_W} ${AREA_H}`}
              role="img"
              aria-label="Zone de dessin de la pièce"
              data-testid="try-canvas"
              className="block w-full"
              style={{ touchAction: 'none', cursor: closed ? 'default' : 'crosshair' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerLeave={() => setCursor(null)}
            >
              <defs>
                <pattern id="try-grid" width="500" height="500" patternUnits="userSpaceOnUse">
                  <path
                    d="M500 0H0V500"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="8"
                  />
                </pattern>
                {closed && (
                  <clipPath id="try-clip">
                    <polygon points={pts(points)} />
                  </clipPath>
                )}
              </defs>
              <rect width={AREA_W} height={AREA_H} fill="url(#try-grid)" />

              {/* Calepinage */}
              {closed && result && (
                <g clipPath="url(#try-clip)">
                  <polygon points={pts(points)} fill="#0b0e13" />
                  {result.tiles.map((t) => (
                    <rect
                      key={t.id}
                      x={t.rect.x}
                      y={t.rect.y}
                      width={t.rect.w}
                      height={t.rect.h}
                      fill={t.type === 'WHOLE' ? '#232a33' : 'rgba(232,103,26,0.32)'}
                      stroke="#0b0e13"
                      strokeWidth={TRY_CONFIG.joint * 3}
                    />
                  ))}
                </g>
              )}

              {/* Murs */}
              {points.length > 0 &&
                (closed ? (
                  <polygon points={pts(points)} fill="none" stroke={ACCENT} strokeWidth={60} />
                ) : (
                  <polyline points={pts(points)} fill="none" stroke={ACCENT} strokeWidth={50} />
                ))}
              {!closed && last && cursor && (
                <line
                  x1={last.x}
                  y1={last.y}
                  x2={nearFirst ? first!.x : cursor.x}
                  y2={nearFirst ? first!.y : cursor.y}
                  stroke={ACCENT}
                  strokeWidth={30}
                  strokeDasharray="120 80"
                />
              )}

              {/* Longueurs des murs */}
              {points.map((a, i) => {
                // Mur suivant, mur de fermeture, ou mur en cours vers le curseur
                const b = points[i + 1] ?? (closed ? points[0] : (cursor ?? undefined));
                if (!b || distance(a, b) < 400) return null;
                return (
                  <text
                    key={`l${i}`}
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 90}
                    textAnchor="middle"
                    fontSize={label}
                    fontWeight={600}
                    fill={TEXT}
                    stroke="#0D1117"
                    strokeWidth={40}
                    paintOrder="stroke"
                    style={{ fontFamily: 'system-ui, sans-serif' }}
                  >
                    {formatLength(distance(a, b))}
                  </text>
                );
              })}

              {/* Angles */}
              {points.map((p, i) => (
                <circle
                  key={`p${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={i === 0 && (nearFirst || points.length >= 3) && !closed ? 120 : 70}
                  fill={i === 0 && nearFirst ? ACCENT : '#0D1117'}
                  stroke={ACCENT}
                  strokeWidth={30}
                />
              ))}
            </svg>

            {/* Actions */}
            <div
              className="flex flex-wrap items-center gap-2 px-3 py-2"
              style={{ borderTop: `1px solid ${LINE}` }}
            >
              {!closed && points.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPoints((p) => p.slice(0, -1));
                    setWarning(null);
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px]"
                  style={{ borderColor: LINE, color: TEXT }}
                >
                  <Undo2 size={13} aria-hidden />
                  Annuler le point
                </button>
              )}
              {points.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px]"
                  style={{ borderColor: LINE, color: TEXT }}
                >
                  <RotateCcw size={13} aria-hidden />
                  Recommencer
                </button>
              )}
              <button
                type="button"
                onClick={signup}
                className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #E8671A 0%, #C45510 100%)' }}
              >
                {closed ? 'Enregistrer mon projet — gratuit' : 'Créer un compte gratuit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
