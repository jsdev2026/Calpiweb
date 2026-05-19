// src/engine/quantities/groupCuts.test.ts
import { describe, it, expect } from 'vitest';
import { groupCuts } from './groupCuts';
import type { CutRecord, PieceEdges } from './types';

const FACTORY: PieceEdges = {
  left: 'factory', right: 'factory', top: 'factory', bottom: 'factory',
};
const RIGHT_CUT: PieceEdges = {
  left: 'factory', right: 'cut', top: 'factory', bottom: 'factory',
};
const LEFT_CUT: PieceEdges = {
  left: 'cut', right: 'factory', top: 'factory', bottom: 'factory',
};

function makeRecord(
  id: string,
  usedW: number,
  usedH: number,
  pieceEdges: PieceEdges = RIGHT_CUT,
  coveredById: string | null = null,
): CutRecord {
  return {
    id, roomId: 'r1',
    tileW: 100, tileH: 100,
    usedW, usedH,
    pieceEdges,
    chuteW: 0, chuteH: 0, chuteEdges: FACTORY, chuteArea: 0,
    clipCx: 0, clipCy: 0,
    coveredById,
    reusedForId: null,
  };
}

describe('groupCuts', () => {
  it('deux records identiques → 1 groupe, totalCount=2', () => {
    const groups = groupCuts([makeRecord('a', 30, 45), makeRecord('b', 30, 45)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.totalCount).toBe(2);
    expect(groups[0]!.netTiles).toBe(2);
  });

  it('un record couvert → reuseCount=1, netTiles=1', () => {
    const groups = groupCuts([makeRecord('a', 30, 45), makeRecord('b', 30, 45, RIGHT_CUT, 'a')]);
    expect(groups[0]!.reuseCount).toBe(1);
    expect(groups[0]!.netTiles).toBe(1);
  });

  it('30×45 et 45×30 avec bords différents → 2 groupes distincts', () => {
    const a = makeRecord('a', 30, 45, RIGHT_CUT);
    const b = makeRecord('b', 45, 30, LEFT_CUT);
    const groups = groupCuts([a, b]);
    expect(groups).toHaveLength(2);
  });

  it('mêmes dimensions mais bords différents → 2 groupes distincts', () => {
    const a = makeRecord('a', 30, 45, RIGHT_CUT);
    const b = makeRecord('b', 30, 45, LEFT_CUT);
    const groups = groupCuts([a, b]);
    expect(groups).toHaveLength(2);
  });

  it('tableau vide → tableau vide', () => {
    expect(groupCuts([])).toHaveLength(0);
  });

  it('groupes triés par netTiles*usedW*usedH décroissant', () => {
    // Groupe A : 1 tile nette de 80×80 = score 6400
    // Groupe B : 2 tiles nettes de 30×45 = score 2700
    const records = [
      makeRecord('a', 30, 45, RIGHT_CUT),
      makeRecord('b', 30, 45, LEFT_CUT),       // groupe distinct
      makeRecord('c', 80, 80, FACTORY),
    ];
    const groups = groupCuts(records);
    expect(groups[0]!.usedW).toBe(80);
  });
});
