import type { BoundingBox } from '@/engine/geometry/polygon';

export const computeGridStart = (
  bbox: BoundingBox,
  stepX: number,
  stepY: number,
  offsetX: number,
  offsetY: number,
): { startX: number; startY: number } => ({
  startX: bbox.minX - (Math.abs(bbox.minX) % stepX) - stepX + (offsetX % stepX),
  startY: bbox.minY - (Math.abs(bbox.minY) % stepY) - stepY + (offsetY % stepY),
});

export const computeStagger = (
  rowIndex: number,
  stepX: number,
  stagger: number,
): number => {
  const modulus = 1 / stagger >= 1 ? Math.round(1 / stagger) : 1;
  return (rowIndex % modulus) * (stepX * stagger);
};
