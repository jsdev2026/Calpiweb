export interface TilingConfig {
  width: number;
  height: number;
  joint: number;
  offsetX: number;
  offsetY: number;
  stagger: number;
  color: string;
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
