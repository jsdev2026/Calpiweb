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
    } else if (record.chuteW > 0 && record.chuteH > 0) {
      pool.push({
        w: record.chuteW, h: record.chuteH,
        edges: record.chuteEdges, fromId: record.id, used: false,
      });
    }
  }
}
