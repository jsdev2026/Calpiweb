// src/engine/quantities/groupCuts.ts
import type { CutRecord, CutGroup, PieceEdges } from './types';

function edgeKey(pe: PieceEdges): string {
  return `${pe.left[0]}${pe.right[0]}${pe.top[0]}${pe.bottom[0]}`;
}

export function groupCuts(records: CutRecord[]): CutGroup[] {
  const map = new Map<string, CutGroup>();

  for (const rec of records) {
    const key = `${rec.usedW}×${rec.usedH}|${edgeKey(rec.pieceEdges)}`;
    if (!map.has(key)) {
      map.set(key, {
        usedW: rec.usedW,
        usedH: rec.usedH,
        pieceEdges: rec.pieceEdges,
        chuteW: rec.chuteW,
        chuteH: rec.chuteH,
        chuteEdges: rec.chuteEdges,
        totalCount: 0,
        reuseCount: 0,
        netTiles: 0,
      });
    }
    const g = map.get(key)!;
    g.totalCount += 1;
    if (rec.coveredById !== null) g.reuseCount += 1;
  }

  for (const g of map.values()) g.netTiles = g.totalCount - g.reuseCount;

  return [...map.values()].sort(
    (a, b) => b.netTiles * b.usedW * b.usedH - a.netTiles * a.usedW * a.usedH,
  );
}
