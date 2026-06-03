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
  thickness: number; // cm, default 20
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'hv';
  wallId?: string;
  nodeId?: string;   // set when type === 'endpoint'
  axis?: 'h' | 'v'; // set when type === 'hv'
}

export type DrawingChain = {
  nodeIds: string[];   // IDs of nodes already placed in the chain
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
