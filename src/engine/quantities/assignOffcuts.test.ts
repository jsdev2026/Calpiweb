// src/engine/quantities/assignOffcuts.test.ts
import { describe, it, expect } from 'vitest';
import { assignOffcuts, canReuseFor } from './assignOffcuts';
import type { CutRecord, PieceEdges } from './types';

const FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};
const RIGHT_CUT: PieceEdges = {
  left: 'factory', right: 'cut', top: 'factory', bottom: 'factory',
};

function makeRecord(
  id: string,
  usedW: number,
  usedH: number,
  chuteW: number,
  chuteH: number,
  pieceEdges: PieceEdges = RIGHT_CUT,
  chuteEdges: PieceEdges = FACTORY,
): CutRecord {
  return {
    id, roomId: 'r1',
    tileW: 200, tileH: 200,
    usedW, usedH,
    pieceEdges,
    chuteW, chuteH,
    chuteEdges,
    chuteArea: chuteW * chuteH,
    clipCx: 0, clipCy: 0,
    coveredById: null,
    reusedForId: null,
  };
}

describe('assignOffcuts', () => {
  it('grande coupe génère chute qui couvre la petite', () => {
    // grande: usedW=180, usedH=180, chute=20×180
    // petite: usedW=18×170 — couverte par chute 20×180
    const large = makeRecord('large', 180, 180, 20, 180, RIGHT_CUT, FACTORY);
    const small = makeRecord('small', 18, 170, 0, 0, RIGHT_CUT, FACTORY);
    assignOffcuts([large, small]);
    expect(small.coveredById).toBe('large');
    expect(large.reusedForId).toBe('small');
  });

  it('aucune réutilisation quand aucune chute disponible', () => {
    const a = makeRecord('a', 60, 60, 0, 0);
    const b = makeRecord('b', 40, 40, 0, 0);
    assignOffcuts([a, b]);
    expect(a.coveredById).toBeNull();
    expect(b.coveredById).toBeNull();
  });

  it('trois coupes identiques : 1ère génère chute, 2ème couverte, 3ème génère chute', () => {
    // usedW=60, usedH=80 ; chute=140×80 (suffisante pour couvrir 60×80)
    const records = [
      makeRecord('a', 60, 80, 140, 80),
      makeRecord('b', 60, 80, 140, 80),
      makeRecord('c', 60, 80, 140, 80),
    ];
    assignOffcuts(records);
    const covered = records.filter((r) => r.coveredById !== null);
    expect(covered).toHaveLength(1);
    // 2 tuiles nettes pour 3 coupes
    const nets = records.filter((r) => r.coveredById === null).length;
    expect(nets).toBe(2);
  });

  it('best-fit : utilise la plus petite chute suffisante (60×60) plutôt que 150×150', () => {
    // src1 a une chute 60×60 (aire 3600)
    // src2 a une chute 150×150 (aire 22500)
    // target a besoin de 55×55 — les deux chutes conviennent, doit utiliser 60×60
    const src2 = makeRecord('src2', 190, 190, 150, 150, RIGHT_CUT, FACTORY);
    const src1 = makeRecord('src1', 180, 180, 60, 60, RIGHT_CUT, FACTORY);
    const target = makeRecord('target', 55, 55, 0, 0, RIGHT_CUT, FACTORY);
    // Ordre dans le tableau : src2 (plus grande aire) traité en 1er
    assignOffcuts([src2, src1, target]);
    expect(target.coveredById).toBe('src1');
  });

  it('rotation 90° : chute 80×40 couvre un besoin de 35×70', () => {
    // chute 80×40 pivotée 90° donne 40×80, qui couvre 35×70
    const src = makeRecord('src', 160, 120, 80, 40, RIGHT_CUT, FACTORY);
    // target needs 35×70 — edges factory partout
    const target = makeRecord('target', 35, 70, 0, 0, FACTORY, FACTORY);
    assignOffcuts([src, target]);
    expect(target.coveredById).toBe('src');
  });

  it('seuil MIN_CHUTE_MM appliqué par buildCutTable : assignOffcuts tente la réutilisation si chuteW > 0', () => {
    // buildCutTable zeroes out sub-50mm offcuts before assignOffcuts runs.
    // Here we force chuteW=48 manually to verify assignOffcuts does not re-apply the threshold.
    const src = makeRecord('src', 160, 160, 48, 48, RIGHT_CUT, FACTORY);
    const target = makeRecord('target', 45, 45, 0, 0, FACTORY, FACTORY);
    assignOffcuts([src, target]);
    expect(target.coveredById).toBe('src');
  });
});

describe('canReuseFor', () => {
  it('dimensions exactes → true', () => {
    expect(canReuseFor(60, 60, FACTORY, 60, 60, FACTORY)).toBe(true);
  });

  it('chute trop petite → false', () => {
    expect(canReuseFor(40, 40, FACTORY, 60, 60, FACTORY)).toBe(false);
  });

  it('rotation 90° permet la couverture', () => {
    // Chute 80×40, besoin 35×70 → rotation donne 40×80 → ok
    expect(canReuseFor(80, 40, FACTORY, 35, 70, FACTORY)).toBe(true);
  });

  it('bord factory requis non satisfait → false', () => {
    const cutRight: PieceEdges = { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' };
    // Besoin : bord droit factory. Chute : bord droit cut. → false même si dimensions ok
    expect(canReuseFor(80, 80, cutRight, 60, 60, FACTORY)).toBe(false);
  });
});
