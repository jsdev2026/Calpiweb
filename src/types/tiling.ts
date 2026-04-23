import type { Point } from '@/types/plan';

export type TileLayout = 'STRAIGHT' | 'HERRINGBONE' | 'CHEVRON';

export interface TilingConfig {
  width: number;
  height: number;
  joint: number;
  offsetX: number;
  offsetY: number;
  stagger: number;
  angle: number;
  color: string;
  layout: TileLayout;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TileType = 'WHOLE' | 'CUT' | 'OUTSIDE';

export interface Tile {
  id: string;
  rect: TileRect;
  type: TileType;
  points?: Point[];
}

export interface TilingStats {
  whole: number;
  cuts: number;
  total: number;
  toOrder: number;
  roomArea: number;
  wastePercent: number;
}

export interface TilingResult {
  tiles: Tile[];
  stats: TilingStats | null;
}
