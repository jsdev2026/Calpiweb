import type { TileLayout, TilingConfig } from '@/types/tiling';

export const DEFAULT_TILING_CONFIG: TilingConfig = {
  width: 300,
  height: 600,
  joint: 3,
  offsetX: 0,
  offsetY: 0,
  stagger: 33,
  angle: 0,
  color: '#93c5fd',
  layout: 'STRAIGHT',
};

export const STAGGER_PRESETS = [
  { value: 0, label: '0%', sublabel: 'Droit' },
  { value: 33, label: '33%', sublabel: '1/3' },
  { value: 50, label: '50%', sublabel: '1/2' },
] as const;

export const COLOR_PRESETS = ['#93c5fd', '#d6d3d1', '#86efac', '#fca5a5', '#c4b5fd'];

export const LAYOUT_PRESETS: { value: TileLayout; label: string; sublabel: string }[] = [
  { value: 'STRAIGHT',    label: 'Droit',            sublabel: 'Classique'        },
  { value: 'HERRINGBONE', label: 'Bâton rompu',      sublabel: 'Alterné'          },
  { value: 'CHEVRON',     label: 'Pte de hongrie',   sublabel: '45°'              },
];
