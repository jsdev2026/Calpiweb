// src/engine/quantities/cutFromBBox.test.ts
import { describe, it, expect } from 'vitest';
import { computeCutFromBBox } from './cutFromBBox';

describe('computeCutFromBBox', () => {
  it('coupe à droite : usedW < width, bord droit cut, autres factory', () => {
    // tuile 60x60, pièce 0..200 — clip → bbox x:[170,200] y:[50,110]
    const result = computeCutFromBBox(60, 60, { minX: 170, minY: 50, maxX: 200, maxY: 110 }, 170, 50);
    expect(result.usedW).toBe(30);
    expect(result.usedH).toBe(60);
    expect(result.pieceEdges.right).toBe('cut');
    expect(result.pieceEdges.left).toBe('factory');
    expect(result.pieceEdges.top).toBe('factory');
    expect(result.pieceEdges.bottom).toBe('factory');
  });

  it('coupe en coin : bords droit et bas cut, chute non viable si strips < 50mm', () => {
    // tuile 60x60 à (170,170), pièce 0..200 — clip → bbox x:[170,200] y:[170,200]
    const result = computeCutFromBBox(60, 60, { minX: 170, minY: 170, maxX: 200, maxY: 200 }, 170, 170);
    expect(result.pieceEdges.right).toBe('cut');
    expect(result.pieceEdges.bottom).toBe('cut');
    expect(result.chuteArea).toBe(0);
  });

  it('chute >= MIN_CHUTE_MM (50mm) : chute renseignée et viable', () => {
    // tuile 100x100 à x=150, pièce 0..200 — clip → bbox x:[150,200] y:[50,150]
    const result = computeCutFromBBox(100, 100, { minX: 150, minY: 50, maxX: 200, maxY: 150 }, 150, 50);
    expect(result.chuteW).toBeGreaterThanOrEqual(50);
    expect(result.chuteH).toBeGreaterThanOrEqual(50);
    expect(result.chuteArea).toBeGreaterThan(0);
  });
});
