'use client';

import { Settings } from 'lucide-react';
import type { TilingConfig } from '@/types/tiling';
import { Input } from '@/components/ui/Input';
import { STAGGER_PRESETS } from '@/constants/tileDefaults';

interface TilingControlsProps {
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
}

export const TilingControls = ({ config, onChange }: TilingControlsProps) => {
  const update = (patch: Partial<TilingConfig>) => onChange({ ...config, ...patch });

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
        <Settings size={20} /> Paramètres
      </h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            label="Largeur (mm)"
            value={config.width}
            onChange={(e) => update({ width: parseInt(e.target.value, 10) || 0 })}
          />
          <Input
            type="number"
            label="Longueur (mm)"
            value={config.height}
            onChange={(e) => update({ height: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <Input
          type="number"
          label="Épaisseur joint (mm)"
          value={config.joint}
          onChange={(e) => update({ joint: parseInt(e.target.value, 10) || 0 })}
        />

        <div className="flex flex-col space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Décalage du motif</label>
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={config.stagger}
            onChange={(e) => update({ stagger: parseFloat(e.target.value) })}
          >
            {STAGGER_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Couleur principale</label>
          <input
            type="color"
            value={config.color}
            onChange={(e) => update({ color: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-md border border-slate-300 p-1"
          />
        </div>
      </div>
    </div>
  );
};
