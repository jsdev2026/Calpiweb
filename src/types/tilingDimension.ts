import type { Point } from '@/types/plan';

export type DimDirection = 'H' | 'V' | 'parallel';

export interface TilingDimension {
  id: string;
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
  perpOffset: number;
}
