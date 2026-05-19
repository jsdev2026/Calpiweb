// src/engine/quantities/assignOffcuts.ts
import type { CutRecord, PieceEdges, TileEdgeSide } from './types';
import { CUT_TOLERANCE_MM } from './constants';

export function canReuseFor(
  cw: number, ch: number, ce: PieceEdges,
  nw: number, nh: number, ne: PieceEdges,
): boolean {
  let ew = cw, eh = ch;
  let el: TileEdgeSide = ce.left,  er: TileEdgeSide = ce.right;
  let et: TileEdgeSide = ce.top,   eb: TileEdgeSide = ce.bottom;

  for (let r = 0; r < 4; r++) {
    if (ew >= nw - CUT_TOLERANCE_MM && eh >= nh - CUT_TOLERANCE_MM) {
      const ok =
        (ne.left   === 'factory' ? el === 'factory' : true) &&
        (ne.right  === 'factory' ? er === 'factory' : true) &&
        (ne.top    === 'factory' ? et === 'factory' : true) &&
        (ne.bottom === 'factory' ? eb === 'factory' : true);
      if (ok) return true;
    }
    // Rotate 90° CW: left←bottom, top←left, right←top, bottom←right
    [el, et, er, eb] = [eb, el, et, er];
    [ew, eh] = [eh, ew];
  }
  return false;
}

// When a chute of (cw×ch) is used to cut piece (nw×nh), returns the largest rectangular
// residual that remains, or null if the cut is an exact fit.
// The fromId of this residual should be the covered cut, not the original source.
function computeResidual(
  cw: number, ch: number, ce: PieceEdges,
  nw: number, nh: number, ne: PieceEdges,
): { w: number; h: number; edges: PieceEdges } | null {
  let ew = cw, eh = ch;
  let el: TileEdgeSide = ce.left, er: TileEdgeSide = ce.right;
  let et: TileEdgeSide = ce.top,  eb: TileEdgeSide = ce.bottom;

  for (let r = 0; r < 4; r++) {
    if (ew >= nw - CUT_TOLERANCE_MM && eh >= nh - CUT_TOLERANCE_MM) {
      const ok =
        (ne.left   === 'factory' ? el === 'factory' : true) &&
        (ne.right  === 'factory' ? er === 'factory' : true) &&
        (ne.top    === 'factory' ? et === 'factory' : true) &&
        (ne.bottom === 'factory' ? eb === 'factory' : true);
      if (ok) {
        // Two candidate residuals after making the two straight cuts:
        //   right strip : (ew-nw) × eh  — the portion to the right of the vertical cut
        //   bottom strip: nw × (eh-nh)  — the portion below the horizontal cut, left side
        const rW = ew - nw, rH = eh;
        const bW = nw,      bH = eh - nh;

        if (rW * rH >= bW * bH && rW > CUT_TOLERANCE_MM) {
          return { w: rW, h: rH, edges: { left: 'cut', right: er, top: et, bottom: eb } };
        }
        if (bW > CUT_TOLERANCE_MM && bH > CUT_TOLERANCE_MM) {
          // If no vertical cut was needed (rW ≈ 0), right edge is the chute's original right edge.
          const rightEdge: TileEdgeSide = rW > CUT_TOLERANCE_MM ? 'cut' : er;
          return { w: bW, h: bH, edges: { left: el, right: rightEdge, top: 'cut', bottom: eb } };
        }
        return null;
      }
    }
    [el, et, er, eb] = [eb, el, et, er];
    [ew, eh] = [eh, ew];
  }
  return null;
}

export function assignOffcuts(records: CutRecord[]): void {
  // Process largest cuts first so their offcuts populate the pool early
  const sorted = [...records].sort((a, b) => b.usedW * b.usedH - a.usedW * a.usedH);

  const pool: {
    w: number; h: number; edges: PieceEdges; fromId: string; used: boolean;
  }[] = [];

  const recordById = new Map(records.map((r) => [r.id, r]));

  for (const record of sorted) {
    // Best-fit: find smallest chute in pool that still satisfies this cut
    let bestIdx = -1;
    let bestArea = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const chute = pool[i]!;
      if (chute.used) continue;
      if (canReuseFor(chute.w, chute.h, chute.edges, record.usedW, record.usedH, record.pieceEdges)) {
        const area = chute.w * chute.h;
        if (area < bestArea) { bestArea = area; bestIdx = i; }
      }
    }

    if (bestIdx >= 0) {
      const chosen = pool[bestIdx]!;
      chosen.used = true;
      record.coveredById = chosen.fromId;
      const src = recordById.get(chosen.fromId);
      if (src) src.reusedForId = record.id;

      // When the chute is larger than the cut, the leftover goes back into the pool.
      // fromId is this cut's id so the chain link (record.reusedForId) points correctly.
      const residual = computeResidual(
        chosen.w, chosen.h, chosen.edges,
        record.usedW, record.usedH, record.pieceEdges,
      );
      if (residual) {
        pool.push({ w: residual.w, h: residual.h, edges: residual.edges, fromId: record.id, used: false });
      }
    } else if (record.chuteW > 0 && record.chuteH > 0) {
      pool.push({
        w: record.chuteW, h: record.chuteH,
        edges: record.chuteEdges, fromId: record.id, used: false,
      });
    }
  }
}
