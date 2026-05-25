import { describe, it, expect } from 'vitest';
import { mergeSimilarCutGroups } from './mergeSimilarCutGroups';
import type { CutGroup } from './types';

const PE_CUT = { left: 'cut' as const, right: 'factory' as const, top: 'factory' as const, bottom: 'factory' as const };
const PE_FACT = { left: 'factory' as const, right: 'cut' as const, top: 'factory' as const, bottom: 'factory' as const };

const g = (usedW: number, usedH: number, extras: Partial<CutGroup> = {}): CutGroup => ({
  usedW,
  usedH,
  pieceEdges: PE_CUT,
  chuteEdges: PE_FACT,
  chuteW: 0,
  chuteH: 0,
  totalCount: 2,
  reuseCount: 0,
  netTiles: 2,
  ...extras,
});

describe('mergeSimilarCutGroups', () => {
  it('tableau vide → []', () => {
    expect(mergeSimilarCutGroups([])).toEqual([]);
  });

  it('un seul groupe → originalIndices: [0]', () => {
    const result = mergeSimilarCutGroups([g(600, 300)]);
    expect(result).toHaveLength(1);
    expect(result[0]!.originalIndices).toEqual([0]);
    expect(result[0]!.usedW).toBe(600);
    expect(result[0]!.usedH).toBe(300);
  });

  it('deux groupes hors tolérance → 2 lignes distinctes', () => {
    // écart H: |300-600|/600 = 50% >> 2%
    const result = mergeSimilarCutGroups([g(600, 300), g(600, 600)]);
    expect(result).toHaveLength(2);
  });

  it('deux groupes dans la tolérance → fusionnés, netTiles sommé', () => {
    // écart H: |306-300|/306 = 1.96% ≤ 2%
    const result = mergeSimilarCutGroups([
      g(600, 300, { netTiles: 3, totalCount: 3 }),
      g(600, 306, { netTiles: 4, totalCount: 4 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.netTiles).toBe(7);
    expect(result[0]!.totalCount).toBe(7);
  });

  it('médiane correcte sur 3 groupes : 600×297, 600×300, 600×303 → usedH = 300', () => {
    const result = mergeSimilarCutGroups([g(600, 303), g(600, 297), g(600, 300)]);
    expect(result).toHaveLength(1);
    // sorted usedH = [297, 300, 303], Math.floor(3/2) = 1 → 300
    // 297 vs 300: |297-300|/300 = 1% ✓
    // 300 vs 303: |300-303|/303 = 0.99% ✓
    // 297 vs 303: |297-303|/303 = 1.98% ✓ (all within 2%)
    expect(result[0]!.usedH).toBe(300);
    expect(result[0]!.usedW).toBe(600);
  });

  it('médiane de la chute correcte', () => {
    const result = mergeSimilarCutGroups([
      g(600, 297, { chuteW: 100, chuteH: 100 }),
      g(600, 300, { chuteW: 200, chuteH: 200 }),
      g(600, 303, { chuteW: 300, chuteH: 300 }),
    ]);
    // sorted chuteW = [100, 200, 300], idx 1 → 200
    expect(result[0]!.chuteW).toBe(200);
    expect(result[0]!.chuteH).toBe(200);
  });

  it('dérive chaînée autorisée : A≈B≈C et A≈C → 1 cluster', () => {
    // A(100) ≈ C(102) : |102-100|/102 = 1.96% ≤ 2%
    const result = mergeSimilarCutGroups([g(300, 100), g(300, 101), g(300, 102)]);
    expect(result).toHaveLength(1);
    // sorted usedH = [100,101,102], idx 1 → 101
    expect(result[0]!.usedH).toBe(101);
  });

  it('dérive chaînée bloquée : A≈B mais A≉C → 2 clusters', () => {
    // A(100)≈B(101) (0.99%), A≉C(103) : |103-100|/103 = 2.91% > 2%
    // comparaison au PREMIER du cluster : C vs A → hors tolérance
    const result = mergeSimilarCutGroups([g(300, 100), g(300, 101), g(300, 103)]);
    expect(result).toHaveLength(2);
    expect(result[0]!.originalIndices).toHaveLength(2); // {A, B}
    expect(result[1]!.originalIndices).toHaveLength(1); // {C}
  });

  it('tolerance = 0 → aucune fusion', () => {
    const result = mergeSimilarCutGroups([g(600, 300), g(600, 301), g(600, 302)], 0);
    expect(result).toHaveLength(3);
  });

  it('originalIndices reflètent les positions dans le tableau original (avant tri)', () => {
    // Donné dans l'ordre inverse : C=303, B=300, A=297
    // Après tri : A(origIdx=2), B(origIdx=1), C(origIdx=0)
    const result = mergeSimilarCutGroups([
      g(600, 303), // origIdx 0
      g(600, 300), // origIdx 1
      g(600, 297), // origIdx 2
    ]);
    expect(result).toHaveLength(1);
    // originalIndices dans l'ordre après tri : [2, 1, 0]
    expect(result[0]!.originalIndices).toEqual([2, 1, 0]);
  });

  it('reuseCount sommé correctement', () => {
    const result = mergeSimilarCutGroups([
      g(600, 300, { totalCount: 4, reuseCount: 1, netTiles: 3 }),
      g(600, 304, { totalCount: 6, reuseCount: 2, netTiles: 4 }),
    ]);
    expect(result[0]!.reuseCount).toBe(3);
    expect(result[0]!.totalCount).toBe(10);
    expect(result[0]!.netTiles).toBe(7);
  });
});
