import { describe, expect, it } from 'vitest';
import { formatCm, formatM2 } from './formatters';

describe('formatCm', () => {
  it('converts mm to cm with one decimal', () => {
    expect(formatCm(1234)).toBe('123.4 cm');
    expect(formatCm(0)).toBe('0.0 cm');
  });
});

describe('formatM2', () => {
  it('converts mm² to m² with two decimals', () => {
    expect(formatM2(1_000_000)).toBe('1.00 m²');
    expect(formatM2(9_500_000)).toBe('9.50 m²');
  });
});
