import { describe, expect, it } from 'vitest';
import type { CutGroup, CutRecord, QuantityResult } from '@/engine/quantities/quantityEngine';
import { cutNumbers, documentRef, poseLabel, printCm, printM2, wallName } from './printHelpers';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';

const edges = { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' } as const;
const group = (usedW: number, usedH: number): CutGroup => ({
  usedW,
  usedH,
  pieceEdges: edges,
  chuteW: 0,
  chuteH: 0,
  chuteEdges: edges,
  totalCount: 1,
  reuseCount: 0,
  netTiles: 1,
});
const cut = (usedW: number, usedH: number) =>
  ({ id: `${usedW}x${usedH}`, usedW, usedH, pieceEdges: edges }) as unknown as CutRecord;

describe('printHelpers', () => {
  it('formats français', () => {
    expect(printCm(605)).toBe('60,5 cm');
    expect(printM2(18_030_000)).toBe('18,03 m²');
  });

  it('libellé du type de pose', () => {
    const c = DEFAULT_TILING_CONFIG;
    expect(poseLabel({ ...c, layout: 'STRAIGHT', stagger: 0 })).toBe('Pose droite');
    expect(poseLabel({ ...c, layout: 'STRAIGHT', stagger: 33 })).toBe('Pose décalée 1/3');
    expect(poseLabel({ ...c, layout: 'STRAIGHT', stagger: 50 })).toBe('Pose décalée 1/2');
    expect(poseLabel({ ...c, layout: 'HERRINGBONE' })).toBe('Bâton rompu');
  });

  it('référence du document : année de création + identifiant', () => {
    expect(documentRef({ id: 'ab12-cd34-ef', createdAt: Date.UTC(2025, 5, 1) })).toBe(
      'CP-2025-AB12CD',
    );
    expect(documentRef({ id: 'xyz', createdAt: 0 }, new Date('2026-01-10'))).toBe('CP-2026-XYZ');
  });

  it('repères de coupe identiques entre plan et tableau, après fusion des coupes proches', () => {
    // 300 × 600 et 301 × 600 sont fusionnés (tolérance 2 %) : même repère
    const result = {
      cutGroups: [group(1000, 600), group(300, 600), group(301, 600)],
    } as unknown as QuantityResult;
    const { groups, numberOf } = cutNumbers(result);
    expect(groups.length).toBe(2);
    const small = numberOf(cut(300, 600));
    expect(small).toBe(numberOf(cut(301, 600)));
    expect(numberOf(cut(1000, 600))).not.toBe(small);
    expect(groups[small! - 1]!.usedW).toBeLessThan(400);
    expect(numberOf(cut(5, 5))).toBeUndefined();
  });

  it('nom du mur au pied d’une cote', () => {
    const room = {
      id: 'r',
      edges: [],
      points: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
    };
    expect(wallName({ x: 50, y: 1500 }, room, 100)).toBe('mur de gauche');
    expect(wallName({ x: 2000, y: 50 }, room, 100)).toBe('mur du haut');
    expect(wallName({ x: 3950, y: 1500 }, room, 100)).toBe('mur de droite');
    expect(wallName({ x: 2000, y: 2950 }, room, 100)).toBe('mur du bas');
  });
});
