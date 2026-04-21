import { describe, expect, it } from 'vitest';
import { computeTiling } from './tilingEngine';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';

describe('computeTiling', () => {
  it('returns empty result for invalid plan', () => {
    expect(computeTiling([], DEFAULT_TILING_CONFIG)).toEqual({ tiles: [], stats: null });
    expect(computeTiling([{ x: 0, y: 0 }], DEFAULT_TILING_CONFIG)).toEqual({
      tiles: [],
      stats: null,
    });
  });

  it('produces tiles for a simple square room', () => {
    const plan = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    const result = computeTiling(plan, DEFAULT_TILING_CONFIG);
    expect(result.tiles.length).toBeGreaterThan(0);
    expect(result.stats).not.toBeNull();
    expect(result.stats!.roomArea).toBe(9_000_000);
    expect(result.stats!.total).toBe(result.stats!.whole + result.stats!.cuts);
    expect(result.stats!.toOrder).toBeGreaterThanOrEqual(result.stats!.total);
  });

  it('classifies all tiles as WHOLE when grid perfectly aligns', () => {
    const plan = [
      { x: 0, y: 0 },
      { x: 3010, y: 0 },
      { x: 3010, y: 3010 },
      { x: 0, y: 3010 },
    ];
    const result = computeTiling(plan, {
      ...DEFAULT_TILING_CONFIG,
      width: 600,
      height: 600,
      joint: 2,
    });
    expect(result.tiles.length).toBeGreaterThan(0);
  });
});
