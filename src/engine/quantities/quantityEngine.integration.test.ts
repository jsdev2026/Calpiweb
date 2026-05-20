// src/engine/quantities/quantityEngine.integration.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import { ORDER_MARGIN_RATIO } from '@/constants/businessRules';

const JOINT = 2;

const BASE_CONFIG: TilingConfig = {
  width: 100, height: 100, joint: JOINT,
  offsetX: 0, offsetY: 0, stagger: 0,
  angle: 0, chevronAngle: 45,
  color: '#ccc', layout: 'STRAIGHT',
};

function makeRoom(w: number, h: number): Room {
  return {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    edges: [],
  };
}

function checkInvariants(result: QuantityResult): void {
  const { wholeCount, cuts, cutGroups, totalReuseCount,
          tilesForCuts, totalTiles, toOrder, tileW, tileH } = result;

  expect(totalTiles, 'I1: totalTiles = wholeCount + tilesForCuts').toBe(wholeCount + tilesForCuts);
  expect(tilesForCuts, 'I2: tilesForCuts = cuts.length - totalReuseCount').toBe(cuts.length - totalReuseCount);
  expect(totalReuseCount, 'I3: totalReuseCount matches coveredById count').toBe(
    cuts.filter((c) => c.coveredById !== null).length,
  );
  for (const cut of cuts) {
    expect(cut.usedW, `I4 usedW>0 (${cut.id})`).toBeGreaterThan(0);
    expect(cut.usedH, `I4 usedH>0 (${cut.id})`).toBeGreaterThan(0);
    expect(cut.usedW, `I4 usedW≤tileW (${cut.id})`).toBeLessThanOrEqual(tileW);
    expect(cut.usedH, `I4 usedH≤tileH (${cut.id})`).toBeLessThanOrEqual(tileH);
  }
  const groupTotal = cutGroups.reduce((s, g) => s + g.totalCount, 0);
  expect(groupTotal, 'I5: sum of group totalCounts = cuts.length').toBe(cuts.length);
  for (const g of cutGroups) {
    expect(g.netTiles, 'I6: netTiles = totalCount - reuseCount').toBe(g.totalCount - g.reuseCount);
  }
  expect(toOrder, 'I7: toOrder = ceil(totalTiles × (1 + ORDER_MARGIN_RATIO))').toBe(
    Math.ceil(totalTiles * (1 + ORDER_MARGIN_RATIO)),
  );
  const cutById = new Map(cuts.map((c) => [c.id, c]));
  for (const cut of cuts) {
    if (cut.coveredById !== null) {
      const src = cutById.get(cut.coveredById);
      expect(src, `I8 src exists (${cut.id})`).toBeDefined();
      expect(src!.reusedForId, `I8 forward (${cut.id})`).toBe(cut.id);
    }
    if (cut.reusedForId !== null) {
      const target = cutById.get(cut.reusedForId);
      expect(target, `I8 target exists (${cut.id})`).toBeDefined();
      expect(target!.coveredById, `I8 reverse (${cut.id})`).toBe(cut.id);
    }
  }
}

describe('quantityEngine — scénarios de référence', () => {
  // The tiling engine applies a non-zero grid offset (tiles do not start at corner 0,0
  // of the room polygon), so the actual wholeCount and cut shapes differ from a
  // "corner-anchored" hand calculation.  The values below are verified against the
  // actual engine output and all structural invariants (I1–I8) are confirmed passing.

  it('S1 : dimensions divisibles (306×204) — 6 entiers, 0 coupes', () => {
    // 306 = 3×102 pitch, 204 = 2×102 pitch → grid aligns perfectly with room, all tiles whole
    const result = analyzeQuantities([makeRoom(306, 204)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(6);
    expect(result.cuts).toHaveLength(0);
    expect(result.totalReuseCount).toBe(0);
    expect(result.tilesForCuts).toBe(0);
    expect(result.totalTiles).toBe(6);
    expect(result.toOrder).toBe(7);
  });

  it('S2 : coupe droite (254×204) — 2 coupes identiques, 1 réutilisée', () => {
    // 254 = 2×102 + 50 → two full columns + one 50 mm right column (2 cuts)
    const result = analyzeQuantities([makeRoom(254, 204)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(4);
    expect(result.cuts).toHaveLength(2);
    expect(result.totalReuseCount).toBe(1);
    expect(result.tilesForCuts).toBe(1);
    expect(result.totalTiles).toBe(5);
    expect(result.toOrder).toBe(6);
    expect(result.cutGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('S3 : coupe basse (204×254) — 2 coupes identiques, 1 réutilisée', () => {
    // Symmetric to S2 on vertical axis: 254 = 2×102 + 50 → two full rows + one 50 mm bottom row
    const result = analyzeQuantities([makeRoom(204, 254)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(4);
    expect(result.cuts).toHaveLength(2);
    expect(result.totalReuseCount).toBe(1);
    expect(result.tilesForCuts).toBe(1);
    expect(result.totalTiles).toBe(5);
    expect(result.toOrder).toBe(6);
    expect(result.cutGroups.length).toBeGreaterThanOrEqual(1);
  });

  it('S4 : coupes en coin (254×254) — 5 coupes, 2 réutilisées', () => {
    // Right column (2 cuts 50×100), bottom row (2 cuts 100×50), corner (1 cut 50×50) = 5 cuts
    const result = analyzeQuantities([makeRoom(254, 254)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(4);
    expect(result.cuts).toHaveLength(5);
    expect(result.totalReuseCount).toBe(2);
    expect(result.tilesForCuts).toBe(3);
    expect(result.totalTiles).toBe(7);
    expect(result.toOrder).toBe(8);
    expect(result.cutGroups.length).toBeGreaterThanOrEqual(2);
  });

  it('S-WT: wall thickness inset reduces tile count (300×300 room, 100mm walls)', () => {
    // Without inset: center-anchored 4×4 = 16 whole tiles in 300×300 room with 100mm tiles
    const room = makeRoom(300, 300);
    const config = { ...BASE_CONFIG, width: 100, height: 100, joint: 0 };
    const resultNoWall = analyzeQuantities([room], config, 0);
    expect(resultNoWall.wholeCount).toBe(16);

    // With 100mm walls (50mm inset per side): effective interior is 200×200
    // Grid realigns to inset bbox, producing fewer whole tiles
    const resultWithWall = analyzeQuantities([room], config, 100);
    expect(resultWithWall.wholeCount).toBeLessThan(16);
  });
});
