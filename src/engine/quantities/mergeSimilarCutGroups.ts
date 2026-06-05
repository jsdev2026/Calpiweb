import type { CutGroup } from './types';

export interface MergedCutGroup extends CutGroup {
  /**
   * Indices des groupes originaux (positions dans le tableau cutGroups du moteur,
   * avant toute fusion) qui composent cette entrée. Toujours ≥ 1 élément.
   */
  originalIndices: [number, ...number[]];
}

function edgesMatch(a: CutGroup, b: CutGroup): boolean {
  return (
    a.pieceEdges.left   === b.pieceEdges.left &&
    a.pieceEdges.right  === b.pieceEdges.right &&
    a.pieceEdges.top    === b.pieceEdges.top &&
    a.pieceEdges.bottom === b.pieceEdges.bottom
  );
}

function withinTolerance(a: CutGroup, b: CutGroup, tol: number): boolean {
  const maxW = Math.max(a.usedW, b.usedW);
  const maxH = Math.max(a.usedH, b.usedH);
  const wOk = maxW === 0 ? a.usedW === b.usedW : Math.abs(a.usedW - b.usedW) / maxW <= tol;
  const hOk = maxH === 0 ? a.usedH === b.usedH : Math.abs(a.usedH - b.usedH) / maxH <= tol;
  return wOk && hOk && edgesMatch(a, b);
}

function median(sorted: number[]): number {
  // sorted doit déjà être trié croissant
  return sorted[Math.floor(sorted.length / 2)]!;
}

/**
 * Regroupe les CutGroups dont usedW et usedH sont tous deux dans un écart
 * ≤ tolerance (défaut 2%) par rapport au premier élément du cluster courant.
 *
 * Valeurs représentatives : médiane pour les dimensions numériques,
 * somme pour les compteurs, pieceEdges/chuteEdges du groupe médian.
 */
export function mergeSimilarCutGroups(
  groups: CutGroup[],
  tolerance = 0.02,
): MergedCutGroup[] {
  if (groups.length === 0) return [];

  // Associer chaque groupe à son index original avant le tri
  const tagged = groups.map((g, i) => ({ g, origIdx: i }));

  // Trier par usedW croissant, puis usedH croissant
  tagged.sort((a, b) => a.g.usedW - b.g.usedW || a.g.usedH - b.g.usedH);

  // Clustering glouton : comparaison au PREMIER du cluster courant
  const clusters: Array<{ items: typeof tagged }> = [];
  let current: typeof tagged = [];

  for (const item of tagged) {
    if (current.length === 0 || withinTolerance(current[0]!.g, item.g, tolerance)) {
      current.push(item);
    } else {
      clusters.push({ items: current });
      current = [item];
    }
  }
  clusters.push({ items: current });

  // Réduire chaque cluster en un MergedCutGroup
  return clusters.map(({ items }) => {
    const n = items.length;
    const medianIdx = Math.floor(n / 2);
    const representative = items[medianIdx]!;

    const usedWs = [...items].sort((a, b) => a.g.usedW - b.g.usedW).map(x => x.g.usedW);
    const usedHs = [...items].sort((a, b) => a.g.usedH - b.g.usedH).map(x => x.g.usedH);
    const chuteWs = [...items].sort((a, b) => a.g.chuteW - b.g.chuteW).map(x => x.g.chuteW);
    const chuteHs = [...items].sort((a, b) => a.g.chuteH - b.g.chuteH).map(x => x.g.chuteH);

    return {
      usedW: median(usedWs),
      usedH: median(usedHs),
      chuteW: median(chuteWs),
      chuteH: median(chuteHs),
      pieceEdges: representative.g.pieceEdges,
      chuteEdges: representative.g.chuteEdges,
      totalCount: items.reduce((s, x) => s + x.g.totalCount, 0),
      reuseCount: items.reduce((s, x) => s + x.g.reuseCount, 0),
      netTiles: items.reduce((s, x) => s + x.g.netTiles, 0),
      originalIndices: items.map(x => x.origIdx) as [number, ...number[]],
    };
  });
}
