import { describe, expect, it } from 'vitest';
import {
  angle,
  distance,
  getBoundingBox,
  getIntersection,
  getPolygonArea,
  insetRoomPolygon,
  pointInPolygon,
} from './polygon';
import type { Room } from '@/types/project';

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('angle', () => {
  it('returns 0 for a horizontal rightward segment', () => {
    expect(angle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  it('returns PI/2 for a downward vertical segment', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
  });
});

describe('getPolygonArea', () => {
  it('returns 0 for fewer than 3 points', () => {
    expect(getPolygonArea([])).toBe(0);
    expect(getPolygonArea([{ x: 0, y: 0 }])).toBe(0);
    expect(getPolygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
  });

  it('computes the area of a 1000x1000 square', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];
    expect(getPolygonArea(square)).toBe(1_000_000);
  });

  it('is invariant to winding direction', () => {
    const cw = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];
    const ccw = [...cw].reverse();
    expect(getPolygonArea(cw)).toBe(getPolygonArea(ccw));
  });
});

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('detects a point inside a square', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
  });

  it('detects a point outside a square', () => {
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
  });
});

describe('getIntersection', () => {
  it('returns null for parallel segments', () => {
    expect(
      getIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    ).toBeNull();
  });

  it('finds the intersection of two crossing segments', () => {
    const p = getIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(5);
    expect(p!.y).toBeCloseTo(5);
  });

  it('returns null for non-intersecting segments', () => {
    expect(
      getIntersection({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 100, y: 100 }, { x: 200, y: 200 }),
    ).toBeNull();
  });
});

describe('getBoundingBox', () => {
  it('returns zeros for empty input', () => {
    expect(getBoundingBox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('computes bounds of a polygon', () => {
    const poly = [
      { x: 10, y: 20 },
      { x: 100, y: 5 },
      { x: 50, y: 200 },
    ];
    expect(getBoundingBox(poly)).toEqual({ minX: 10, minY: 5, maxX: 100, maxY: 200 });
  });
});

// CW rectangle in y-down SVG: (0,0)→(2000,0)→(2000,3000)→(0,3000)
function makeRect(w: number, h: number, edgeThicknesses?: (number | undefined)[]): Room {
  return {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    edgeThicknesses,
  };
}

describe('insetRoomPolygon', () => {
  it('returns copy of points when thickness is 0', () => {
    const room = makeRect(2000, 3000);
    const result = insetRoomPolygon(room, 0);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 2000, y: 0 });
    expect(result[2]).toEqual({ x: 2000, y: 3000 });
    expect(result[3]).toEqual({ x: 0, y: 3000 });
  });

  it('insets uniformly: 100mm walls → 50mm inset per side', () => {
    const room = makeRect(2000, 3000);
    const result = insetRoomPolygon(room, 100);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ x: 50, y: 50 });
    expect(result[1]).toEqual({ x: 1950, y: 50 });
    expect(result[2]).toEqual({ x: 1950, y: 2950 });
    expect(result[3]).toEqual({ x: 50, y: 2950 });
  });

  it('respects per-edge thickness: edges [100,200,100,200]', () => {
    const room = makeRect(2000, 3000, [100, 200, 100, 200]);
    const result = insetRoomPolygon(room, 0);
    expect(result[0]).toEqual({ x: 100, y: 50 });
    expect(result[1]).toEqual({ x: 1900, y: 50 });
    expect(result[2]).toEqual({ x: 1900, y: 2950 });
    expect(result[3]).toEqual({ x: 100, y: 2950 });
  });

  it('returns original points for degenerate polygon (< 3 pts)', () => {
    const room: Room = { id: 'r', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], edges: [] };
    expect(insetRoomPolygon(room, 100)).toEqual(room.points);
  });

  it('handles CCW winding: reversed rectangle insets correctly', () => {
    // CCW in y-down: (0,0)→(0,3000)→(2000,3000)→(2000,0)
    const room: Room = {
      id: 'r2',
      points: [{ x: 0, y: 0 }, { x: 0, y: 3000 }, { x: 2000, y: 3000 }, { x: 2000, y: 0 }],
      edges: ['WALL', 'WALL', 'WALL', 'WALL'],
    };
    const result = insetRoomPolygon(room, 100); // 50mm inset
    expect(result).toHaveLength(4);
    // Inset should shrink the polygon inward regardless of winding direction
    expect(result[0]!.x).toBeGreaterThanOrEqual(0);
    expect(result[0]!.y).toBeGreaterThanOrEqual(0);
    expect(result[2]!.x).toBeLessThanOrEqual(2000);
    expect(result[2]!.y).toBeLessThanOrEqual(3000);
    // The bounding box of inset polygon should be strictly smaller
    const minX = Math.min(...result.map(p => p.x));
    const maxX = Math.max(...result.map(p => p.x));
    const minY = Math.min(...result.map(p => p.y));
    const maxY = Math.max(...result.map(p => p.y));
    expect(maxX - minX).toBeLessThan(2000); // narrower than original
    expect(maxY - minY).toBeLessThan(3000); // shorter than original
  });
});
