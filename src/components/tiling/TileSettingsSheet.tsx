'use client';

import { useState } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, Hand, RotateCcw } from 'lucide-react';
import type { TileLayout, TilingConfig } from '@/types/tiling';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { formatM2 } from '@/utils/formatters';
import { NumberStepper } from './NumberStepper';

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

const POSES: { id: PoseId; label: string; layout: TileLayout; stagger?: number }[] = [
  { id: 'STRAIGHT_0', label: 'Droit', layout: 'STRAIGHT', stagger: 0 },
  { id: 'STRAIGHT_33', label: 'Décalé 1/3', layout: 'STRAIGHT', stagger: 33 },
  { id: 'STRAIGHT_50', label: 'Décalé 1/2', layout: 'STRAIGHT', stagger: 50 },
  { id: 'HERRINGBONE', label: 'Bâton rompu', layout: 'HERRINGBONE' },
  { id: 'CHEVRON', label: 'Pt de Hongrie', layout: 'CHEVRON' },
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
  return `${cm(config.width)} × ${cm(config.height)} cm · joint ${String(config.joint).replace('.', ',')} mm · ${pose}`;
}

// ── Vignettes de pose ────────────────────────────────────────────────────────

const PoseIcon = ({ id }: { id: PoseId }) => {
  const s = { fill: 'currentColor', fillOpacity: 0.85 };
  const g = { fill: 'currentColor', fillOpacity: 0.45 };
  switch (id) {
    case 'STRAIGHT_0':
      return (
        <svg viewBox="0 0 36 24" width="36" height="24">
          <rect x="0" y="0" width="17" height="11" {...s} />
          <rect x="19" y="0" width="17" height="11" {...g} />
          <rect x="0" y="13" width="17" height="11" {...g} />
          <rect x="19" y="13" width="17" height="11" {...s} />
        </svg>
      );
    case 'STRAIGHT_33':
      return (
        <svg viewBox="0 0 36 24" width="36" height="24">
          <rect x="0" y="0" width="17" height="11" {...s} />
          <rect x="19" y="0" width="17" height="11" {...g} />
          <rect x="-6" y="13" width="17" height="11" {...g} />
          <rect x="13" y="13" width="17" height="11" {...s} />
          <rect x="32" y="13" width="17" height="11" {...g} />
        </svg>
      );
    case 'STRAIGHT_50':
      return (
        <svg viewBox="0 0 36 24" width="36" height="24">
          <rect x="0" y="0" width="17" height="11" {...s} />
          <rect x="19" y="0" width="17" height="11" {...g} />
          <rect x="-9" y="13" width="17" height="11" {...g} />
          <rect x="10" y="13" width="17" height="11" {...s} />
          <rect x="29" y="13" width="17" height="11" {...g} />
        </svg>
      );
    case 'HERRINGBONE':
      return (
        <svg viewBox="0 0 36 24" width="36" height="24">
          <rect x="2" y="2" width="16" height="7" {...s} />
          <rect x="18" y="2" width="7" height="16" {...g} />
          <rect x="11" y="11" width="7" height="13" {...g} />
          <rect x="25" y="11" width="11" height="7" {...s} />
        </svg>
      );
    case 'CHEVRON':
      return (
        <svg viewBox="0 0 36 24" width="36" height="24">
          <path d="M2 4 L18 12 L18 19 L2 11 Z" {...s} />
          <path d="M18 12 L34 4 L34 11 L18 19 Z" {...g} />
          <path d="M2 13 L18 21 L18 24 L8 24 L2 21 Z" {...g} />
          <path d="M18 21 L34 13 L34 21 L28 24 L18 24 Z" {...s} />
        </svg>
      );
  }
};

// ── UI ───────────────────────────────────────────────────────────────────────

const Chip = ({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) => (
  <button
    type="button"
    aria-pressed={active}
    aria-label={ariaLabel}
    onClick={onClick}
    className="flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-[13px] font-semibold transition-colors active:scale-95"
    style={
      active
        ? {
            borderColor: 'var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            color: 'var(--accent)',
          }
        : { borderColor: 'var(--bdr)', background: 'var(--surf2)', color: 'var(--text2)' }
    }
  >
    {children}
  </button>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h4
      className="text-[11px] font-bold uppercase tracking-wider"
      style={{ color: 'var(--muted)' }}
    >
      {title}
    </h4>
    {children}
  </section>
);

export interface TileSettingsSheetProps {
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
  result: QuantityResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moveMode: boolean;
  onMoveModeChange: (on: boolean) => void;
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
  moveMode,
  onMoveModeChange,
  onOrigin,
  onShowQuantities,
  readOnly = false,
}: TileSettingsSheetProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const update = (patch: Partial<TilingConfig>) => {
    if (!readOnly) onChange({ ...config, ...patch });
  };

  const poseId = poseIdOf(config);
  const isPreset = FORMAT_PRESETS.some(([w, h]) => w === config.width && h === config.height);

  return (
    <div
      data-testid="tile-settings-sheet"
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t mouse:inset-x-auto mouse:bottom-3 mouse:right-3 mouse:top-3 mouse:w-[340px] mouse:rounded-2xl mouse:border md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:w-[340px] md:rounded-2xl md:border"
      style={{
        background: 'var(--surf)',
        borderColor: 'var(--bdr)',
        boxShadow: 'var(--sh-lg)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* En-tête = résumé toujours visible, touche pour ouvrir / fermer */}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="flex w-full shrink-0 flex-col items-stretch px-4 pb-2.5 pt-1.5 text-left"
      >
        <span
          className="mx-auto mb-1.5 h-1 w-10 rounded-full mouse:hidden md:hidden"
          style={{ background: 'var(--bdr2, var(--bdr))' }}
        />
        <span className="flex items-center gap-2">
          <span
            className="h-4 w-4 shrink-0 rounded"
            style={{ background: config.color, border: '1px solid var(--bdr)' }}
          />
          <span
            className="min-w-0 flex-1 truncate text-[14px] font-bold"
            style={{ color: 'var(--text)' }}
          >
            {tileSummary(config)}
          </span>
          <span className="mouse:hidden md:hidden">
            {open ? (
              <ChevronDown size={18} style={{ color: 'var(--muted)' }} />
            ) : (
              <ChevronUp size={18} style={{ color: 'var(--muted)' }} />
            )}
          </span>
        </span>
        {result.roomArea > 0 && (
          <span className="mt-0.5 pl-6 text-[12px]" style={{ color: 'var(--muted)' }}>
            {formatM2(result.roomArea)} ·{' '}
            <strong style={{ color: 'var(--text2)' }}>{result.toOrder} carreaux</strong> à commander
          </span>
        )}
      </button>

      {/* Mobile : ouvert / fermé. Ordinateur : toujours ouvert (panneau latéral). */}
      <div
        data-open={open}
        className={`${open ? 'flex' : 'hidden'} max-h-[46svh] flex-col gap-5 overflow-y-auto border-t px-4 pb-4 pt-4 mouse:flex mouse:max-h-none mouse:flex-1 md:flex md:max-h-none md:flex-1`}
        style={{ borderColor: 'var(--bdr)' }}
      >
        {readOnly && (
          <p
            className="rounded-lg px-3 py-2 text-[12px]"
            style={{ background: 'var(--surf2)', color: 'var(--muted)' }}
          >
            Lecture seule — les réglages ne peuvent pas être modifiés.
          </p>
        )}

        {/* Format */}
        <Section title="Format du carreau">
          <div className="grid grid-cols-4 gap-2">
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
          <div className="mt-1 grid grid-cols-1 gap-2">
            <NumberStepper
              label="Largeur"
              unit="cm"
              value={config.width / 10}
              step={1}
              min={1}
              max={400}
              onChange={(v) => update({ width: Math.round(v * 10) })}
            />
            <NumberStepper
              label="Longueur"
              unit="cm"
              value={config.height / 10}
              step={1}
              min={1}
              max={400}
              onChange={(v) => update({ height: Math.round(v * 10) })}
            />
            <button
              type="button"
              aria-label="Inverser largeur et longueur"
              onClick={() => update({ width: config.height, height: config.width })}
              className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold"
              style={{ color: 'var(--text2)' }}
            >
              <ArrowLeftRight size={15} /> Inverser (pose en largeur / en longueur)
            </button>
          </div>
          {!isPreset && (
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              Format sur mesure
            </p>
          )}
        </Section>

        {/* Joint */}
        <Section title="Joint">
          <div className="flex items-end gap-2">
            <div className="grid flex-1 grid-cols-4 gap-2">
              {JOINT_PRESETS.map((j) => (
                <Chip
                  key={j}
                  active={config.joint === j}
                  onClick={() => update({ joint: j })}
                  ariaLabel={`Joint ${j} mm`}
                >
                  {j} mm
                </Chip>
              ))}
            </div>
          </div>
          {!JOINT_PRESETS.includes(config.joint) && (
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              Joint actuel : {String(config.joint).replace('.', ',')} mm
            </p>
          )}
          <NumberStepper
            label="Autre valeur"
            unit="mm"
            value={config.joint}
            step={0.5}
            min={0}
            max={30}
            onChange={(v) => update({ joint: v })}
          />
        </Section>

        {/* Pose */}
        <Section title="Pose">
          <div className="grid grid-cols-3 gap-2 mouse:grid-cols-3 sm:grid-cols-5 md:grid-cols-3">
            {POSES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={poseId === p.id}
                onClick={() =>
                  update({
                    layout: p.layout,
                    ...(p.stagger !== undefined ? { stagger: p.stagger } : {}),
                  })
                }
                className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[12px] font-semibold transition-colors active:scale-95"
                style={
                  poseId === p.id
                    ? {
                        borderColor: 'var(--accent)',
                        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        color: 'var(--accent)',
                      }
                    : {
                        borderColor: 'var(--bdr)',
                        background: 'var(--surf2)',
                        color: 'var(--text2)',
                      }
                }
              >
                <PoseIcon id={p.id} />
                <span className="leading-tight">{p.label}</span>
              </button>
            ))}
          </div>
          {config.layout === 'CHEVRON' && (
            <div className="mt-1 flex flex-col gap-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
                Angle de coupe
              </span>
              <div className="grid grid-cols-3 gap-2">
                {CHEVRON_PRESETS.map((a) => (
                  <Chip
                    key={a}
                    active={config.chevronAngle === a}
                    onClick={() => update({ chevronAngle: a })}
                  >
                    {a}°
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Ajustements */}
        <section
          className="flex flex-col gap-3 rounded-xl border p-3"
          style={{ borderColor: 'var(--bdr)' }}
        >
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="flex min-h-[32px] items-center justify-between text-[13px] font-bold"
            style={{ color: 'var(--text)' }}
          >
            Ajustements
            {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Déplacer la pose au doigt : toujours accessible */}
          <button
            type="button"
            aria-pressed={moveMode}
            onClick={() => onMoveModeChange(!moveMode)}
            disabled={readOnly}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors"
            style={
              moveMode
                ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: '#fff' }
                : { borderColor: 'var(--bdr)', background: 'var(--surf2)', color: 'var(--text2)' }
            }
          >
            <Hand size={16} />
            {moveMode
              ? 'Glissez les carreaux sur le plan — toucher pour terminer'
              : 'Déplacer la pose au doigt'}
          </button>

          {advancedOpen && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
                  Point de départ
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Chip active={false} onClick={() => !readOnly && onOrigin('CENTER')}>
                    Centré
                  </Chip>
                  <Chip active={false} onClick={() => !readOnly && onOrigin('CORNER')}>
                    {config.layout === 'STRAIGHT' ? 'Depuis l’angle ↖' : 'Réinitialiser'}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
                  Orientation
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {ANGLE_PRESETS.map((a) => (
                    <Chip key={a} active={config.angle === a} onClick={() => update({ angle: a })}>
                      {a}°
                    </Chip>
                  ))}
                </div>
                <NumberStepper
                  label="Angle libre"
                  unit="°"
                  value={config.angle}
                  step={1}
                  min={0}
                  max={90}
                  onChange={(v) => update({ angle: Math.round(v) })}
                />
              </div>

              {config.layout === 'STRAIGHT' && (
                <div className="grid grid-cols-1 gap-2">
                  <NumberStepper
                    label="Décalage horizontal"
                    unit="mm"
                    value={config.offsetX}
                    step={5}
                    min={-10000}
                    max={10000}
                    onChange={(v) => update({ offsetX: Math.round(v) })}
                  />
                  <NumberStepper
                    label="Décalage vertical"
                    unit="mm"
                    value={config.offsetY}
                    step={5}
                    min={-10000}
                    max={10000}
                    onChange={(v) => update({ offsetY: Math.round(v) })}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => update({ offsetX: 0, offsetY: 0, angle: 0 })}
                className="flex min-h-[40px] items-center justify-center gap-1.5 text-[12px] font-semibold"
                style={{ color: 'var(--muted)' }}
              >
                <RotateCcw size={14} /> Remettre la pose à zéro
              </button>
            </>
          )}
        </section>

        <button
          type="button"
          onClick={onShowQuantities}
          className="btn-secondary min-h-[44px] text-[13px]"
        >
          Voir le quantitatif détaillé
        </button>
      </div>
    </div>
  );
};
