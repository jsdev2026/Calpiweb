// src/engine/quantities/cutFromBBox.ts
import type { PieceEdges } from './types';
import { MIN_CHUTE_MM, CUT_TOLERANCE_MM } from './constants';

export const ALL_FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};

export interface BBox {
  minX: number; minY: number; maxX: number; maxY: number;
}

export interface CutFromBBoxResult {
  usedW: number; usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number; chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;
}

// Computes used/chute dimensions and edge classification for a tile of size
// width x height, given the bounding box of the clipped (in-room) piece,
// expressed relative to a reference corner (refX, refY).
//
// For STRAIGHT/HERRINGBONE tiles: width/height = tile.rect.w/h, bbox/ref are
// in plan (global) coordinates, refX/refY = tile.rect.x/y.
// For CHEVRON tiles: width/height = Wlen/Hlen (the tile's local frame),
// bbox is in local (x = W axis, y = H axis) coordinates, refX = refY = 0.
export function computeCutFromBBox(
  width: number,
  height: number,
  bbox: BBox,
  refX: number,
  refY: number,
): CutFromBBoxResult {
  const { minX, minY, maxX, maxY } = bbox;

  const usedW = Math.max(1, Math.round(Math.min(width, maxX - minX)));
  const usedH = Math.max(1, Math.round(Math.min(height, maxY - minY)));

  const isCutLeft   = minX > refX + CUT_TOLERANCE_MM;
  const isCutRight  = maxX < refX + width - CUT_TOLERANCE_MM;
  const isCutTop    = minY > refY + CUT_TOLERANCE_MM;
  const isCutBottom = maxY < refY + height - CUT_TOLERANCE_MM;

  const pieceEdges: PieceEdges = {
    left:   isCutLeft   ? 'cut' : 'factory',
    right:  isCutRight  ? 'cut' : 'factory',
    top:    isCutTop    ? 'cut' : 'factory',
    bottom: isCutBottom ? 'cut' : 'factory',
  };

  const isCutH = isCutLeft || isCutRight;
  const isCutV = isCutTop  || isCutBottom;
  const hTrim = isCutLeft ? (minX - refX) : isCutRight ? (refX + width - maxX) : 0;
  const vTrim = isCutTop  ? (minY - refY) : isCutBottom ? (refY + height - maxY) : 0;

  let chuteW = 0, chuteH = 0;
  let chuteEdges: PieceEdges = ALL_FACTORY;

  if (isCutH && isCutV) {
    // Corner cut: choose the larger strip
    if (hTrim * height >= width * vTrim) {
      chuteW = hTrim; chuteH = height;
      chuteEdges = isCutLeft
        ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
        : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
    } else {
      chuteW = width; chuteH = vTrim;
      chuteEdges = isCutTop
        ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
        : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
    }
  } else if (isCutH) {
    chuteW = hTrim; chuteH = height;
    chuteEdges = isCutLeft
      ? { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }
      : { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
  } else if (isCutV) {
    chuteW = width; chuteH = vTrim;
    chuteEdges = isCutTop
      ? { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' }
      : { left: 'factory', right: 'factory', top: 'cut', bottom: 'factory' };
  }

  // Both dims must be >= MIN_CHUTE_MM for any cut type (spec requirement)
  const viable = chuteW >= MIN_CHUTE_MM && chuteH >= MIN_CHUTE_MM;

  return {
    usedW, usedH, pieceEdges,
    chuteW:     viable ? chuteW : 0,
    chuteH:     viable ? chuteH : 0,
    chuteEdges: viable ? chuteEdges : ALL_FACTORY,
    chuteArea:  viable ? chuteW * chuteH : 0,
  };
}
