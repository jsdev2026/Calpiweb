'use client';

import {
  BrickWall,
  Crosshair,
  LayoutGrid,
  Pointer,
  RotateCcw,
  RotateCw,
  Ruler,
  SeparatorVertical,
} from 'lucide-react';
import type { TileLayout, TilingConfig } from '@/types/tiling';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { formatM2 } from '@/utils/formatters';
import { CompactNumberInput } from './NumberStepper';
import { TileFormatPicker } from './TileFormatPicker';
import { PanelChip, PanelSection, SidePanel, panelChipStyle } from '@/components/panel/SidePanel';

// ── Données ──────────────────────────────────────────────────────────────────

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

// ── Panneau ──────────────────────────────────────────────────────────────────

export interface TileSettingsSheetProps {
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
  result: QuantityResult;
  onOrigin: (origin: 'CORNER' | 'CENTER') => void;
  onShowQuantities: () => void;
  /** Retour au Plan 2D */
  onShowPlan?: () => void;
  /** Passe en mode « toucher un carreau » pour choisir le carreau de départ */
  onPickStart?: () => void;
  readOnly?: boolean;
}

const ICON = 16;

/** Panneau du mode Calepinage (panneau latéral commun aux trois modes). */
export const TileSettingsSheet = ({
  config,
  onChange,
  result,
  onOrigin,
  onShowQuantities,
  onShowPlan,
  onPickStart,
  readOnly = false,
}: TileSettingsSheetProps) => {
  const update = (patch: Partial<TilingConfig>) => {
    if (!readOnly) onChange({ ...config, ...patch });
  };
  const poseId = poseIdOf(config);

  return (
    <SidePanel
      testId="tile-settings-sheet"
      icon={<LayoutGrid size={18} />}
      title="Calepinage"
      summary={tileSummary(config)}
      railItems={[
        { id: 'format', label: 'Format', icon: <Ruler size={ICON} /> },
        { id: 'joint', label: 'Joint', icon: <SeparatorVertical size={ICON} /> },
        { id: 'pose', label: 'Pose', icon: <BrickWall size={ICON} /> },
        { id: 'rotation', label: 'Rotation', icon: <RotateCw size={ICON} /> },
        { id: 'depart', label: 'Départ de la pose', icon: <Crosshair size={ICON} /> },
      ]}
      context={
        result.roomArea > 0 && (
          <span title={`${formatM2(result.roomArea)} · ${result.toOrder} carreaux à commander`}>
            <strong style={{ color: 'var(--text2)' }}>{result.toOrder}</strong> carreaux
          </span>
        )
      }
      prev={onShowPlan ? { label: 'Plan 2D', onClick: onShowPlan } : undefined}
      next={{ label: 'Quantitatif', onClick: onShowQuantities }}
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
      <TileFormatPicker
        width={config.width}
        height={config.height}
        onChange={([width, height]) => update({ width, height })}
        readOnly={readOnly}
      />

      <PanelSection id="joint" title="Joint (mm)">
        <div className="flex items-center gap-1.5">
          {JOINT_PRESETS.map((j) => (
            <PanelChip
              key={j}
              size="sm"
              active={config.joint === j}
              onClick={() => update({ joint: j })}
              ariaLabel={`Joint ${j} mm`}
              className="flex-1"
            >
              {j}
            </PanelChip>
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
      </PanelSection>

      <PanelSection id="pose" title="Pose">
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
              style={panelChipStyle(poseId === p.id)}
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
              <PanelChip
                key={a}
                active={config.chevronAngle === a}
                onClick={() => update({ chevronAngle: a })}
                className="flex-1"
              >
                {a}°
              </PanelChip>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection id="rotation" title="Rotation">
        <div className="flex items-center gap-1.5">
          {ANGLE_PRESETS.map((a) => (
            <PanelChip
              key={a}
              active={config.angle === a}
              onClick={() => update({ angle: a })}
              ariaLabel={`Rotation ${a}°`}
            >
              {a}°
            </PanelChip>
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
      </PanelSection>

      {/* Point de départ (le réglage fin se fait au doigt sur le plan) */}
      <PanelSection id="depart" title="Départ de la pose">
        <div className="flex items-center gap-1.5">
          <PanelChip onClick={() => !readOnly && onOrigin('CENTER')} className="flex-1">
            Centré
          </PanelChip>
          {config.layout === 'STRAIGHT' && (
            <PanelChip onClick={() => !readOnly && onOrigin('CORNER')} className="flex-1">
              Angle ↖
            </PanelChip>
          )}
          <PanelChip
            ariaLabel="Remettre la pose à zéro"
            title="Remettre la pose à zéro"
            onClick={() => update({ offsetX: 0, offsetY: 0, angle: 0 })}
          >
            <RotateCcw size={14} />
          </PanelChip>
        </div>
        <PanelChip
          active={!!config.showStartTile}
          onClick={() => update({ showStartTile: !config.showStartTile })}
        >
          <Ruler size={14} aria-hidden />
          Coter le carreau de départ
        </PanelChip>
        {config.showStartTile && (
          <>
            <div className="flex items-center gap-1.5">
              {onPickStart && !readOnly && (
                <PanelChip onClick={onPickStart} className="flex-1">
                  <Pointer size={14} aria-hidden />
                  Choisir le carreau
                </PanelChip>
              )}
              {config.startTile && (
                <PanelChip onClick={() => update({ startTile: undefined })} className="flex-1">
                  Automatique
                </PanelChip>
              )}
            </div>
            <span className="text-[11.5px] leading-snug" style={{ color: 'var(--text2)' }}>
              {config.startTile
                ? 'Le carreau « D » choisi est coté depuis les murs de l’angle le plus proche.'
                : 'Le carreau « D » est coté depuis les murs de l’angle haut-gauche de chaque pièce.'}
            </span>
          </>
        )}
      </PanelSection>
    </SidePanel>
  );
};
