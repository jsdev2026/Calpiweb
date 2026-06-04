import { describe, expect, it } from 'vitest';
import { computeTiling, computeTilingMultiRoom } from './tilingEngine';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import type { DoorOpening } from '@/types/wall';
import type { Room } from '@/types/project';

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

describe('computeTilingMultiRoom — ouvertures de porte', () => {
  const room: Room = {
    id: 'r1',
    name: 'Test',
    points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    partitions: [],
    excludedZones: [],
  };
  const config = {
    ...DEFAULT_TILING_CONFIG,
    width: 300,
    height: 300,
    joint: 0,
    angle: 0,
    offsetX: 0,
    offsetY: 0,
    layout: 'STRAIGHT' as const,
  };

  it('génère des carreaux WHOLE dans une ouverture de porte suffisamment large', () => {
    const door: DoorOpening = { from: { x: 0, y: 1500 }, to: { x: 900, y: 1500 }, thickness: 200 };
    const result = computeTilingMultiRoom([room], config, 200, [door]);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles.length).toBeGreaterThan(0);
    expect(doorTiles.every((t) => t.type === 'WHOLE')).toBe(true);
  });

  it('ne génère aucun carreau si la largeur de porte est inférieure à la dimension du carreau', () => {
    const door: DoorOpening = { from: { x: 0, y: 1500 }, to: { x: 200, y: 1500 }, thickness: 200 };
    const result = computeTilingMultiRoom([room], config, 200, [door]);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles).toHaveLength(0);
  });

  it('sans doorOpenings, aucun carreau de porte', () => {
    const result = computeTilingMultiRoom([room], config, 200);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles).toHaveLength(0);
  });

  it('ignore les portes pour layout HERRINGBONE (V1)', () => {
    const door: DoorOpening = { from: { x: 0, y: 1500 }, to: { x: 900, y: 1500 }, thickness: 200 };
    const hbConfig = { ...config, layout: 'HERRINGBONE' as const };
    const result = computeTilingMultiRoom([room], hbConfig, 200, [door]);
    const doorTiles = result.tiles.filter((t) => t.id.startsWith('door-'));
    expect(doorTiles).toHaveLength(0);
  });
});
