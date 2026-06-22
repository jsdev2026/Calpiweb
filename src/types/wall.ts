// src/types/wall.ts
import type { Point } from './plan';

export interface WallNode {
  id: string;
  x: number;
  y: number;
  locked?: boolean;
}

export interface Wall {
  id: string;
  node1Id: string;
  node2Id: string;
  thickness: number;
  isDoor?: boolean;
}

export interface ExcludeNode {
  id: string;
  x: number;
  y: number;
}

export interface WallExcludedZone {
  id: string;
  nodes: ExcludeNode[];
  label?: string;
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv' | 'perpendicular' | 'collinear';
  wallId?: string;
  nodeId?: string;
  axis?: 'h' | 'v';
  dir?: Point;  // direction normalisée — utilisée par le snap colinéaire
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

export interface DoorOpening {
  from: Point;
  to: Point;
  thickness: number;
}
