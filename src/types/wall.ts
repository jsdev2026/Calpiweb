import type { Point } from './plan';

export interface Wall {
  id: string;
  p1: Point;
  p2: Point;
  thickness: number;  // cm, default 20
}

export interface SnapResult {
  point: Point;
  type: 'endpoint' | 'face' | 'free';
  wallId?: string;
}

export type DrawingChain = {
  points: Point[];
  thickness: number;
} | null;
