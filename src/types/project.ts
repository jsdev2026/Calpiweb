import type { Point } from './plan';
import type { TilingConfig } from './tiling';

export type EdgeType = 'WALL' | 'DOOR';

export interface Room {
  id: string;
  name?: string;
  points: Point[];
  edges: EdgeType[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  rooms: Room[];
  config: TilingConfig;
  wallThickness: number;
}
