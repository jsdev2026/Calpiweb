import { describe, expect, it } from 'vitest';
import { formatM2 } from '@/utils/formatters';

describe('QuantitiesPanel tile surface formula', () => {
  it('wholeCount surface: 10 × 300 × 300 mm = 0.90 m²', () => {
    expect(formatM2(10 * 300 * 300)).toBe('0.90 m²');
  });

  it('toOrder surface: 15 × 300 × 300 mm = 1.35 m²', () => {
    expect(formatM2(15 * 300 * 300)).toBe('1.35 m²');
  });
});
