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

  it('trois coupes identiques : 1ère génère chute, 2ème couverte, résidu couvre la 3ème', () => {
    // usedW=60, usedH=80 ; chute=140×80 → couvre b, résidu 80×80 → couvre c
    const records = [
      makeRecord('a', 60, 80, 140, 80),
      makeRecord('b', 60, 80, 140, 80),
      makeRecord('c', 60, 80, 140, 80),
    ];
    assignOffcuts(records);
    const covered = records.filter((r) => r.coveredById !== null);
    expect(covered).toHaveLength(2);
    // 1 tuile nette pour 3 coupes (chute secondaire en action)
    const nets = records.filter((r) => r.coveredById === null).length;
    expect(nets).toBe(1);
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

  it('chute secondaire : 50×100 couvre 50×50, résidu 50×50 couvre un second 50×50', () => {
    // An edge cut (50×100) produces a 50×100 chute.
    // That chute covers corner1 (50×50), leaving a 50×50 residual.
    // The residual then covers corner2 (50×50).
    // Net result: 1 tile instead of 2 for the three cuts.
    // chuteEdges: left='cut' because the chute is the strip to the right of the RIGHT_CUT edge piece.
    const cornerEdges: PieceEdges = { left: 'factory', right: 'cut', top: 'factory', bottom: 'cut' };
    const chuteEdges: PieceEdges = { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' };
    const edge    = makeRecord('edge',    50, 100, 50, 100, RIGHT_CUT, chuteEdges);
    const corner1 = makeRecord('corner1', 50,  50,  0,   0, cornerEdges);
    const corner2 = makeRecord('corner2', 50,  50,  0,   0, cornerEdges);
    assignOffcuts([edge, corner1, corner2]);
    // edge's chute covers corner1
    expect(corner1.coveredById).toBe('edge');
    expect(edge.reusedForId).toBe('corner1');
    // corner1's residual (50×50) covers corner2
    expect(corner2.coveredById).toBe('corner1');
    expect(corner1.reusedForId).toBe('corner2');
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

describe('canReuseFor — tolérance 10mm', () => {
  it('chute 6mm plus petite que le besoin est réutilisable', () => {
    const BOTTOM_CUT: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' };
    // chute 14×200, besoin 20×180 → diff de 6mm en largeur
    // échoue avec tolérance 5mm (14 < 20−5=15), passe avec REUSE_TOLERANCE_MM=10mm (14 >= 20−10=10)
    expect(canReuseFor(14, 200, FACTORY, 20, 180, BOTTOM_CUT)).toBe(true);
  });

  it('assignOffcuts : réemploie une chute 6mm plus petite que le besoin', () => {
    const BOTTOM_CUT: PieceEdges = { left: 'factory', right: 'factory', top: 'factory', bottom: 'cut' };
    // src génère une chute 14×200 ; target a besoin de 20×180
    const src = makeRecord('src', 186, 200, 14, 200, { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' }, FACTORY);
    const target = makeRecord('target', 20, 180, 0, 0, BOTTOM_CUT, FACTORY);
    assignOffcuts([src, target]);
    expect(target.coveredById).toBe('src');
  });
});
