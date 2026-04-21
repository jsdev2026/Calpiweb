import type { BoundingBox } from './polygon';

export interface GridParams {
  bbox: BoundingBox;
  stepX: number;
  stepY: number;
  offsetX: number;
  offsetY: number;
  stagger: number;
}

export interface GridCell {
  x: number;
  y: number;
  rowIndex: number;
  colIndex: number;
}

export function* iterateGridCells(params: GridParams): Generator<GridCell> {
  const { bbox, stepX, stepY, offsetX, offsetY, stagger } = params;

  const startX = bbox.minX - (Math.abs(bbox.minX) % stepX) - stepX + (offsetX % stepX);
  const startY = bbox.minY - (Math.abs(bbox.minY) % stepY) - stepY + (offsetY % stepY);

  const staggerModulus = 1 / stagger >= 1 ? Math.round(1 / stagger) : 1;

  let rowIndex = 0;
  for (let y = startY; y < bbox.maxY; y += stepY) {
    const staggerOffset = (rowIndex % staggerModulus) * (stepX * stagger);
    const rowStartX = startX - staggerOffset;

    let colIndex = 0;
    for (let x = rowStartX; x < bbox.maxX; x += stepX) {
      yield { x, y, rowIndex, colIndex };
      colIndex += 1;
    }
    rowIndex += 1;
  }
}
