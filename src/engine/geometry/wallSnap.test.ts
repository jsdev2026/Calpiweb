import { describe, it, expect } from 'vitest';
import { snapToWalls } from './wallSnap';
import type { Wall } from '@/types/wall';

const SCALE = 1;
const EP_R = 12;  // endpoint radius px
const FA_R = 8;   // face radius px

const horizontal: Wall = { id: 'h', p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, thickness: 20 };
const vertical: Wall   = { id: 'v', p1: { x: 100, y: 0 }, p2: { x: 100, y: 200 }, thickness: 20 };

describe('snapToWalls — endpoint', () => {
  it('snaps to p1 within radius', () => {
    const r = snapToWalls({ x: 5, y: 3 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x: 0, y: 0 });
    expect(r?.wallId).toBe('h');
  });

  it('snaps to p2 within radius', () => {
    const r = snapToWalls({ x: 197, y: -2 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x: 200, y: 0 });
  });

  it('returns null far from all walls', () => {
    const r = snapToWalls({ x: 500, y: 500 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over face snap', () => {
    // cursor near p2 of horizontal AND near the face — should be endpoint
    const r = snapToWalls({ x: 200, y: 5 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('endpoint');
  });
});

describe('snapToWalls — face (T-junction)', () => {
  it('snaps to projected point on centerline within face radius', () => {
    // cursor at (100, 5) — near centerline of horizontal wall at (100, 0)
    const r = snapToWalls({ x: 100, y: 5 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r?.type).toBe('face');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
    expect(r?.wallId).toBe('h');
  });

  it('does not snap to face when projection is outside wall bounds', () => {
    // cursor at (300, 2) — projection at (300, 0) is beyond p2=(200, 0)
    const r = snapToWalls({ x: 300, y: 2 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r).toBeNull();
  });

  it('does not snap to face when distance exceeds face radius', () => {
    // cursor at (100, 50) — far from wall
    const r = snapToWalls({ x: 100, y: 50 }, [horizontal], SCALE, EP_R, FA_R);
    expect(r).toBeNull();
  });
});

describe('snapToWalls — multiple walls', () => {
  it('picks the closest endpoint when two walls have nearby endpoints', () => {
    const r = snapToWalls({ x: 100, y: 3 }, [horizontal, vertical], SCALE, EP_R, FA_R);
    // (100, 0) is p2 of horizontal AND p1 of vertical — both equidistant
    // either is acceptable, but must be type 'endpoint'
    expect(r?.type).toBe('endpoint');
    expect(r?.point.x).toBeCloseTo(100);
    expect(r?.point.y).toBeCloseTo(0);
  });
});
