import { describe, expect, it } from 'vitest';
import { formatM2 } from '@/utils/formatters';

describe('QuantitiesPanel tile surface formula', () => {
  it('wholeCount surface: 10 × 300 × 300 mm = 0.90 m²', () => {
    expect(formatM2(10 * 300 * 300)).toBe('0.90 m²');
  });

  it('toOrder surface: 15 × 300 × 300 mm = 1.35 m²', () => {
    expect(formatM2(15 * 300 * 300)).toBe('1.35 m²');
  });

  it('sub string for total: includes m² value', () => {
    const toOrder = 15;
    const totalTiles = 13;
    const tileW = 300, tileH = 300;
    const sub = `+10% marge · ${totalTiles} nets · ${formatM2(toOrder * tileW * tileH)}`;
    expect(sub).toBe('+10% marge · 13 nets · 1.35 m²');
  });
});
