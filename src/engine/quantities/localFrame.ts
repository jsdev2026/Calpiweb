// src/engine/quantities/localFrame.ts
import type { Point } from '@/types/plan';

export interface LocalFrame {
  Hlen: number;
  Wlen: number;
  toLocal(p: Point): Point;
  toGlobal(p: Point): Point;
}

// Builds an affine local frame from a CHEVRON tile's parallelogram corners
// (tile.points = [P0, P1, P2, P3]).
//
// Local x runs along eW = P3-P0 (range [0, Wlen], Wlen = config.width).
// Local y runs along eH = P1-P0 (range [0, Hlen], Hlen = config.height).
// This (x = W axis, y = H axis) convention matches computeCutFromBBox, so
// the existing rectangle cut/chute/edge logic applies unchanged once a
// clipped polygon is expressed in these local coordinates.
export function localFrameFromPoints(points: Point[]): LocalFrame {
  const origin = points[0]!;
  const eH = { x: points[1]!.x - origin.x, y: points[1]!.y - origin.y };
  const eW = { x: points[3]!.x - origin.x, y: points[3]!.y - origin.y };
  const Hlen = Math.hypot(eH.x, eH.y);
  const Wlen = Math.hypot(eW.x, eW.y);

  // Solve [eH | eW] · (alpha, beta)^T = (P - origin) via the 2x2 inverse.
  const det = eH.x * eW.y - eW.x * eH.y;

  return {
    Hlen,
    Wlen,
    toLocal(p: Point): Point {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      const alpha = (eW.y * dx - eW.x * dy) / det;
      const beta = (eH.x * dy - eH.y * dx) / det;
      return { x: beta * Wlen, y: alpha * Hlen };
    },
    toGlobal(p: Point): Point {
      const alpha = p.y / Hlen;
      const beta = p.x / Wlen;
      return {
        x: origin.x + alpha * eH.x + beta * eW.x,
        y: origin.y + alpha * eH.y + beta * eW.y,
      };
    },
  };
}
