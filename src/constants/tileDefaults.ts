import type { TilingConfig } from '@/types/tiling';

export const DEFAULT_TILING_CONFIG: TilingConfig = {
  width: 600,
  height: 600,
  joint: 2,
  offsetX: 0,
  offsetY: 0,
  stagger: 0,
  color: '#e0f2fe',
};

export const STAGGER_PRESETS = [
  { value: 0, label: 'Droit (0%)' },
  { value: 0.5, label: 'Décalé 1/2 (50%)' },
  { value: 0.333, label: 'Décalé 1/3 (33%)' },
  { value: 0.25, label: 'Décalé 1/4 (25%)' },
] as const;
