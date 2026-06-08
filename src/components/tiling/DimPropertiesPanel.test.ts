import { describe, it, expect } from 'vitest';
import { computeNewP2 } from './DimPropertiesPanel';
import type { TilingDimension } from '@/types/tilingDimension';

const base: TilingDimension = {
  id: 'd1',
  p1: { x: 0, y: 0 },
  p2: { x: 3000, y: 0 },
  direction: 'H',
  perpOffset: 600,
  p2NodeId: 'n2',
};

describe('computeNewP2', () => {
  it('direction H — déplace uniquement X, préserve Y', () => {
    const result = computeNewP2(base, 4000);
    expect(result.x).toBeCloseTo(4000);
    expect(result.y).toBeCloseTo(0);
  });

  it('direction H inversée (p2 à gauche de p1) — signe correct', () => {
    const dim: TilingDimension = { ...base, p2: { x: -3000, y: 0 } };
    const result = computeNewP2(dim, 4000);
    expect(result.x).toBeCloseTo(-4000);
    expect(result.y).toBeCloseTo(0);
  });

  it('direction V — déplace uniquement Y, préserve X', () => {
    const dim: TilingDimension = { ...base, direction: 'V', p2: { x: 0, y: 3000 } };
    const result = computeNewP2(dim, 4000);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(4000);
  });

  it('direction parallel — suit l\'angle', () => {
    const angle = Math.PI / 4; // 45°
    const dim: TilingDimension = {
      ...base,
      direction: 'parallel',
      parallelAngle: angle,
      p2: { x: 2121, y: 2121 }, // ~3000 à 45°
    };
    const dist = 4000;
    const result = computeNewP2(dim, dist);
    expect(result.x).toBeCloseTo(Math.cos(angle) * dist, 0);
    expect(result.y).toBeCloseTo(Math.sin(angle) * dist, 0);
  });
});
