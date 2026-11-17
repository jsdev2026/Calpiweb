'use client';

import { ArrowLeftRight, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { TileLayout, TilingConfig } from '@/types/tiling';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { formatM2 } from '@/utils/formatters';
import { CompactNumberInput } from './NumberStepper';

// ── Données ──────────────────────────────────────────────────────────────────

/** Formats courants (mm) — largeur × longueur. */
export const FORMAT_PRESETS: [number, number][] = [
  [300, 300],
  [450, 450],
  [600, 600],
  [800, 800],
  [300, 600],
  [600, 1200],
  [200, 1200],
  [150, 900],
];

const JOINT_PRESETS = [1, 2, 3, 5];
const ANGLE_PRESETS = [0, 45, 90];
const CHEVRON_PRESETS = [30, 45, 60];

type PoseId = 'STRAIGHT_0' | 'STRAIGHT_33' | 'STRAIGHT_50' | 'HERRINGBONE' | 'CHEVRON';

const POSES: { id: PoseId; label: string; short: string; layout: TileLayout; stagger?: number }[] =
  [
    { id: 'STRAIGHT_0', label: 'Droit', short: 'Droit', layout: 'STRAIGHT', stagger: 0 },
    { id: 'STRAIGHT_33', label: 'Décalé 1/3', short: '1/3', layout: 'STRAIGHT', stagger: 33 },
    { id: 'STRAIGHT_50', label: 'Décalé 1/2', short: '1/2', layout: 'STRAIGHT', stagger: 50 },
    { id: 'HERRINGBONE', label: 'Bâton rompu', short: 'Bâton', layout: 'HERRINGBONE' },
    { id: 'CHEVRON', label: 'Pt de Hongrie', short: 'Hongrie', layout: 'CHEVRON' },
  ];

export function poseIdOf(config: TilingConfig): PoseId {
  if (config.layout === 'HERRINGBONE') return 'HERRINGBONE';
  if (config.layout === 'CHEVRON') return 'CHEVRON';
  if (config.stagger >= 45) return 'STRAIGHT_50';
  if (config.stagger >= 20) return 'STRAIGHT_33';
  return 'STRAIGHT_0';
}

const cm = (mm: number) => String(Math.round(mm) / 10).replace('.', ',');

export function tileSummary(config: TilingConfig): string {
  const pose = POSES.find((p) => p.id === poseIdOf(config))!.label;
  const rot = config.angle ? ` · ${config.angle}°` : '';
  return `${cm(config.width)} × ${cm(config.height)} cm · joint ${String(config.joint).replace('.', ',')} mm · ${pose}${rot}`;
}

// ── Vignettes de pose ────────────────────────────────────────────────────────

const PoseIcon = ({ id }: { id: PoseId }) => {
  const s = { fill: 'currentColor', fillOpacity: 0.85 };
  const g = { fill: 'currentColor', fillOpacity: 0.45 };
  switch (id) {
    case 'STRAIGHT_0':
      return (
        <svg viewBox="0 0 36 24" width="30" height="20">
          <rect x="0" y="0" width="17" height="11" {...s} />
          <rect x="19" y="0" width="17" height="11" {...g} />
          <rect x="0" y="13" width="17" height="11" {...g} />
          <rect x="19" y="13" width="17" height="11" {...s} />
        </svg>
      );
    case 'STRAIGHT_33':
      return (
        <svg viewBox="0 0 36 24" width="30" height="20">
          <rect x="0" y="0" width="17" height="11" {...s} />
          <rect x="19" y="0" width="17" height="11" {...g} />
          <rect x="-6" y="13" width="17" height="11" {...g} />
          <rect x="13" y="13" width="17" height="11" {...s} />
          <rect x="32" y="13" width="17" height="11" {...g} />
        </svg>
      );
    case 'STRAIGHT_50':
      return (
        <svg viewBox="0 0 36 24" width="30" height="20">
          <rect x="0" y="0" width="17" height="11" {...s} />
          <rect x="19" y="0" width="17" height="11" {...g} />
          <rect x="-9" y="13" width="17" height="11" {...g} />
          <rect x="10" y="13" width="17" height="11" {...s} />
          <rect x="29" y="13" width="17" height="11" {...g} />
        </svg>
      );
    case 'HERRINGBONE':
      return (
        <svg viewBox="0 0 36 24" width="30" height="20">
          <rect x="2" y="2" width="16" height="7" {...s} />
          <rect x="18" y="2" width="7" height="16" {...g} />
          <rect x="11" y="11" width="7" height="13" {...g} />
          <rect x="25" y="11" width="11" height="7" {...s} />
        </svg>
      );
    case 'CHEVRON':
      return (
        <svg viewBox="0 0 36 24" width="30" height="20">
          <path d="M2 4 L18 12 L18 19 L2 11 Z" {...s} />
          <path d="M18 12 L34 4 L34 11 L18 19 Z" {...g} />
          <path d="M2 13 L18 21 L18 24 L8 24 L2 21 Z" {...g} />
          <path d="M18 21 L34 13 L34 21 L28 24 L18 24 Z" {...s} />
        </svg>
      );
  }
};

// ── UI compacte ──────────────────────────────────────────────────────────────

const activeStyle = {
  borderColor: 'var(--accent)',
  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
  color: 'var(--accent)',
};
const idleStyle = { borderColor: 'var(--bdr)', background: 'var(--surf2)', color: 'var(--text2)' };

const Chip = ({
  active,
  onClick,
  children,
  ariaLabel,
  className = '',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={ariaLabel}
    onClick={onClick}
    className={`flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors active:scale-95 ${className}`}
    style={active ? activeStyle : idleStyle}
  >
    {children}
  </button>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <span
      className="text-[10.5px] font-bold uppercase tracking-wider"
      style={{ color: 'var(--muted)' }}
    >
      {label}
    </span>
    {children}
  </div>
);

export interface TileSettingsSheetProps {
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
  result: QuantityResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrigin: (origin: 'CORNER' | 'CENTER') => void;
  onShowQuantities: () => void;
  readOnly?: boolean;
}

export const TileSettingsSheet = ({
  config,
  onChange,
  result,
  open,
  onOpenChange,
  onOrigin,
  onShowQuantities,
  readOnly = false,
}: TileSettingsSheetProps) => {
  const update = (patch: Partial<TilingConfig>) => {
    if (!readOnly) onChange({ ...config, ...patch });
  };
  const poseId = poseIdOf(config);

  return (
    <div
      data-testid="tile-settings-sheet"
      data-canvas-overlay
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t mouse:inset-x-auto mouse:bottom-auto mouse:right-3 mouse:top-3 mouse:max-h-[calc(100%-1.5rem)] mouse:w-[320px] mouse:rounded-2xl mouse:border md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[320px] md:rounded-2xl md:border"
      style={{
        background: 'var(--surf)',
        borderColor: 'var(--bdr)',
        boxShadow: 'var(--sh-lg)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Bandeau résumé — toujours visible, touche pour ouvrir / fermer */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label="Réglages du carreau"
        className="flex w-full shrink-0 items-center gap-2 px-3 py-2 text-left"
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded"
          style={{ background: config.color, border: '1px solid var(--bdr)' }}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-bold" style={{ color: 'var(--text)' }}>
            {tileSummary(config)}
          </span>
          {result.roomArea > 0 && (
            <span className="truncate text-[11.5px]" style={{ color: 'var(--muted)' }}>
              {formatM2(result.roomArea)} ·{' '}
              <strong style={{ color: 'var(--text2)' }}>{result.toOrder} carreaux</strong> à
              commander
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown size={18} style={{ color: 'var(--muted)' }} />
        ) : (
          <ChevronUp size={18} style={{ color: 'var(--muted)' }} />
        )}
      </button>

      <div
        data-open={open}
        className={`${open ? 'flex' : 'hidden'} max-h-[42svh] flex-col gap-3 overflow-y-auto border-t px-3 pb-3 pt-2.5 mouse:max-h-none md:max-h-none`}
        style={{ borderColor: 'var(--bdr)' }}
      >
        {readOnly && (
          <p
            className="rounded-lg px-2.5 py-1.5 text-[12px]"
            style={{ background: 'var(--surf2)', color: 'var(--muted)' }}
          >
            Lecture seule — les réglages ne peuvent pas être modifiés.
          </p>
        )}

        {/* Format : formats courants (défilement horizontal) + saisie libre */}
        <Row label="Format (cm)">
          <div
            className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5"
            style={{ scrollbarWidth: 'none' }}
          >
            {FORMAT_PRESETS.map(([w, h]) => (
              <Chip
                key={`${w}x${h}`}
                active={config.width === w && config.height === h}
                ariaLabel={`Format ${cm(w)} par ${cm(h)} cm`}
                onClick={() => update({ width: w, height: h })}
              >
                {cm(w)}×{cm(h)}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <CompactNumberInput
              label="Largeur"
              unit="cm"
              value={config.width / 10}
              min={1}
              max={400}
              onChange={(v) => update({ width: Math.round(v * 10) })}
              className="flex-1"
            />
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
              ×
            </span>
            <CompactNumberInput
              label="Longueur"
              unit="cm"
              value={config.height / 10}
              min={1}
              max={400}
              onChange={(v) => update({ height: Math.round(v * 10) })}
              className="flex-1"
            />
            <button
              type="button"
              aria-label="Inverser largeur et longueur"
              title="Inverser"
              onClick={() => update({ width: config.height, height: config.width })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={idleStyle}
            >
              <ArrowLeftRight size={15} />
            </button>
          </div>
        </Row>

        {/* Joint */}
        <Row label="Joint (mm)">
          <div className="flex items-center gap-1.5">
            {JOINT_PRESETS.map((j) => (
              <Chip
                key={j}
                active={config.joint === j}
                onClick={() => update({ joint: j })}
                ariaLabel={`Joint ${j} mm`}
                className="flex-1"
              >
                {j}
              </Chip>
            ))}
            <CompactNumberInput
              label="Joint"
              unit="mm"
              value={config.joint}
              min={0}
              max={30}
              onChange={(v) => update({ joint: v })}
              className="w-[76px] shrink-0"
            />
          </div>
        </Row>

        {/* Pose */}
        <Row label="Pose">
          <div className="grid grid-cols-5 gap-1.5">
            {POSES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={poseId === p.id}
                aria-label={p.label}
                title={p.label}
                onClick={() =>
                  update({
                    layout: p.layout,
                    ...(p.stagger !== undefined ? { stagger: p.stagger } : {}),
                  })
                }
                className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-[10.5px] font-semibold transition-colors active:scale-95"
                style={poseId === p.id ? activeStyle : idleStyle}
              >
                <PoseIcon id={p.id} />
                <span className="leading-none">{p.short}</span>
              </button>
            ))}
          </div>
          {config.layout === 'CHEVRON' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text2)' }}>
                Coupe
              </span>
              {CHEVRON_PRESETS.map((a) => (
                <Chip
                  key={a}
                  active={config.chevronAngle === a}
                  onClick={() => update({ chevronAngle: a })}
                  className="flex-1"
                >
                  {a}°
                </Chip>
              ))}
            </div>
          )}
        </Row>

        {/* Rotation */}
        <Row label="Rotation">
          <div className="flex items-center gap-1.5">
            {ANGLE_PRESETS.map((a) => (
              <Chip
                key={a}
                active={config.angle === a}
                onClick={() => update({ angle: a })}
                ariaLabel={`Rotation ${a}°`}
              >
                {a}°
              </Chip>
            ))}
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              aria-label="Rotation libre"
              value={config.angle}
              disabled={readOnly}
              onChange={(e) => update({ angle: parseInt(e.target.value, 10) })}
              className="h-9 min-w-0 flex-1 cursor-pointer accent-orange-500"
            />
            <span
              className="w-9 shrink-0 text-right text-[13px] font-bold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {config.angle}°
            </span>
          </div>
        </Row>

        {/* Point de départ (le réglage fin se fait au doigt sur le plan) */}
        <Row label="Départ de la pose">
          <div className="flex items-center gap-1.5">
            <Chip active={false} onClick={() => !readOnly && onOrigin('CENTER')} className="flex-1">
              Centré
            </Chip>
            {config.layout === 'STRAIGHT' && (
              <Chip
                active={false}
                onClick={() => !readOnly && onOrigin('CORNER')}
                className="flex-1"
              >
                Angle ↖
              </Chip>
            )}
            <Chip
              active={false}
              ariaLabel="Remettre la pose à zéro"
              onClick={() => update({ offsetX: 0, offsetY: 0, angle: 0 })}
            >
              <RotateCcw size={14} />
            </Chip>
          </div>
        </Row>

        <button
          type="button"
          onClick={onShowQuantities}
          className="self-end text-[12.5px] font-semibold underline-offset-2 hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          Voir le quantitatif →
        </button>
      </div>
    </div>
  );
};
