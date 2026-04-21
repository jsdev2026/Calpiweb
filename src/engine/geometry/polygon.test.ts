import { describe, expect, it } from 'vitest';
import {
  angle,
  distance,
  getBoundingBox,
  getIntersection,
  getPolygonArea,
  pointInPolygon,
} from './polygon';

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
