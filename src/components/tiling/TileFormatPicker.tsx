'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import type { TileFormat } from '@/constants/tileDefaults';
import { MAX_TILE_FORMATS, sameFormat, useTileFormatsStore } from '@/store/tileFormatsStore';
import { PanelChip, PanelSection } from '@/components/panel/SidePanel';
import { CompactNumberInput } from './NumberStepper';

const cm = (mm: number) => String(Math.round(mm) / 10).replace('.', ',');

/**
 * Section « Format » du Calepinage : formats enregistrés de l'utilisateur
 * (grille compacte), saisie sur mesure, enregistrement et suppression de formats.
 */
export const TileFormatPicker = ({
  width,
  height,
  onChange,
  readOnly = false,
}: {
  width: number;
  height: number;
  onChange: (format: TileFormat) => void;
  readOnly?: boolean;
}) => {
  const formats = useTileFormatsStore((s) => s.formats);
  const custom = useTileFormatsStore((s) => s.custom);
  const add = useTileFormatsStore((s) => s.add);
  const remove = useTileFormatsStore((s) => s.remove);
  const reset = useTileFormatsStore((s) => s.reset);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void useTileFormatsStore.getState().load();
  }, []);

  const current: TileFormat = [width, height];
  const saved = formats.some((f) => sameFormat(f, current));
  const canSave = !readOnly && !saved && formats.length < MAX_TILE_FORMATS;

  return (
    <PanelSection
      id="format"
      title="Format (cm)"
      aside={
        !readOnly && (
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
            className="text-[11.5px] font-semibold underline-offset-2 hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {editing ? 'Terminé' : 'Modifier'}
          </button>
        )
      }
    >
      {formats.length === 0 ? (
        <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
          Aucun format enregistré — saisissez des dimensions puis touchez +.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {formats.map(([w, h]) =>
            editing ? (
              <PanelChip
                key={`${w}x${h}`}
                size="sm"
                ariaLabel={`Supprimer le format ${cm(w)} par ${cm(h)} cm`}
                title="Supprimer"
                onClick={() => remove([w, h])}
                className="gap-0.5"
              >
                {cm(w)}×{cm(h)}
                <X size={12} aria-hidden style={{ color: '#dc2626' }} />
              </PanelChip>
            ) : (
              <PanelChip
                key={`${w}x${h}`}
                size="sm"
                active={sameFormat([w, h], current)}
                ariaLabel={`Format ${cm(w)} par ${cm(h)} cm`}
                onClick={() => onChange([w, h])}
              >
                {cm(w)}×{cm(h)}
              </PanelChip>
            ),
          )}
        </div>
      )}

      <div className="flex items-center gap-1">
        <CompactNumberInput
          label="Largeur"
          unit="cm"
          value={width / 10}
          min={1}
          max={400}
          onChange={(v) => onChange([Math.round(v * 10), height])}
          className="flex-1"
        />
        <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
          ×
        </span>
        <CompactNumberInput
          label="Longueur"
          unit="cm"
          value={height / 10}
          min={1}
          max={400}
          onChange={(v) => onChange([width, Math.round(v * 10)])}
          className="flex-1"
        />
        <PanelChip
          size="sm"
          ariaLabel="Inverser largeur et longueur"
          title="Inverser"
          onClick={() => onChange([height, width])}
          className="w-8 px-0"
        >
          <ArrowLeftRight size={15} />
        </PanelChip>
        {canSave && (
          <PanelChip
            size="sm"
            ariaLabel={`Enregistrer le format ${cm(width)} par ${cm(height)} cm`}
            title="Enregistrer ce format"
            onClick={() => add(current)}
            className="w-8 px-0"
          >
            <Plus size={15} />
          </PanelChip>
        )}
      </div>

      {editing && (
        <div className="flex items-center justify-between gap-2 text-[11.5px]">
          <span style={{ color: 'var(--muted)' }}>Touchez un format pour le retirer.</span>
          {custom && (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--text2)' }}
            >
              Formats par défaut
            </button>
          )}
        </div>
      )}
    </PanelSection>
  );
};
