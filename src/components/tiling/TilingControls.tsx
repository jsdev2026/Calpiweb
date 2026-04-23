'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import type { TilingConfig } from '@/types/tiling';
import { Input } from '@/components/ui/Input';
import { LAYOUT_PRESETS, STAGGER_PRESETS } from '@/constants/tileDefaults';

interface TilingControlsProps {
  config: TilingConfig;
  onChange: (config: TilingConfig) => void;
}

export const TilingControls = ({ config, onChange }: TilingControlsProps) => {
  const update = (patch: Partial<TilingConfig>) => onChange({ ...config, ...patch });

  const [widthStr, setWidthStr] = useState(String(config.width));
  const [heightStr, setHeightStr] = useState(String(config.height));
  const [jointStr, setJointStr] = useState(String(config.joint));

  useEffect(() => setWidthStr(String(config.width)), [config.width]);
  useEffect(() => setHeightStr(String(config.height)), [config.height]);
  useEffect(() => setJointStr(String(config.joint)), [config.joint]);

  const commitWidth = () => {
    const v = parseInt(widthStr, 10);
    if (!isNaN(v) && v > 0) update({ width: v });
    else setWidthStr(String(config.width));
  };
  const commitHeight = () => {
    const v = parseInt(heightStr, 10);
    if (!isNaN(v) && v > 0) update({ height: v });
    else setHeightStr(String(config.height));
  };
  const commitJoint = () => {
    const v = parseInt(jointStr, 10);
    if (!isNaN(v) && v >= 0) update({ joint: v });
    else setJointStr(String(config.joint));
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-100">
        <Settings size={18} className="text-orange-500" /> Configuration
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            label="Largeur (mm)"
            value={widthStr}
            onChange={(e) => setWidthStr(e.target.value)}
            onBlur={commitWidth}
          />
          <Input
            type="number"
            label="Longueur (mm)"
            value={heightStr}
            onChange={(e) => setHeightStr(e.target.value)}
            onBlur={commitHeight}
          />
        </div>
        <Input
          type="number"
          label="Joint (mm)"
          value={jointStr}
          onChange={(e) => setJointStr(e.target.value)}
          onBlur={commitJoint}
        />
      </div>

      {/* Layout (pose) selector */}
      <div className="space-y-3 border-t border-zinc-800 pt-6">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          Mode de pose
        </label>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => update({ layout: preset.value })}
              className={`flex flex-col items-center rounded-lg border py-2 text-xs font-bold transition-all ${
                config.layout === preset.value
                  ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              <span className="leading-tight text-center">{preset.label}</span>
              <span className="text-[10px] opacity-60">{preset.sublabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stagger: only relevant for straight layout */}
      {config.layout === 'STRAIGHT' && (
        <div className="space-y-3 border-t border-zinc-800 pt-6">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Décalage
          </label>
          <div className="grid grid-cols-3 gap-2">
            {STAGGER_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => update({ stagger: preset.value })}
                className={`flex flex-col items-center rounded-lg border py-2 text-xs font-bold transition-all ${
                  config.stagger === preset.value
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                <span>{preset.label}</span>
                <span className="text-[10px] opacity-60">{preset.sublabel}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
