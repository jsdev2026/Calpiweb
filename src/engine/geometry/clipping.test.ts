import { describe, expect, it } from 'vitest';
import { classifyTile } from './clipping';

const room = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

describe('classifyTile', () => {
  it('classifies a tile entirely inside as WHOLE', () => {
    expect(classifyTile({ x: 100, y: 100, w: 200, h: 200 }, room)).toBe('WHOLE');
  });

  it('classifies a tile entirely outside as OUTSIDE', () => {
    expect(classifyTile({ x: 2000, y: 2000, w: 200, h: 200 }, room)).toBe('OUTSIDE');
  });

  it('classifies a tile crossing a wall as CUT', () => {
    expect(classifyTile({ x: 900, y: 100, w: 200, h: 200 }, room)).toBe('CUT');
  });
});
