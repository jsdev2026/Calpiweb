// src/types/wall.ts
import type { Point } from './plan';

export interface WallNode {
  id: string;
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  node1Id: string;
  node2Id: string;
  thickness: number;
  isDoor?: boolean;
}

export interface WallExcludedZone {
  id: string;
  points: Point[];
  label?: string;
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv' | 'perpendicular';
  wallId?: string;
  nodeId?: string;
  axis?: 'h' | 'v';
}

export type DrawingChain = {
  nodeIds: string[];
  thickness: number;
} | null;

export interface AutoCotation {
  wallId: string;
  side: 'exterior' | 'interior' | 'isolated';
  anchor1: Point;
  anchor2: Point;
  normal: Point;
  offset: number;
  label: string;
}
