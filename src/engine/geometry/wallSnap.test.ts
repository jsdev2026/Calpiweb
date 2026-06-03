// src/engine/geometry/wallSnap.test.ts
import { describe, it, expect } from 'vitest';
import { snapToWalls } from './wallSnap';
import type { Wall, WallNode } from '@/types/wall';

const SCALE = 1;
const EP_R = 12;
const FA_R = 8;
const HV_R = 8;

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

// Two walls sharing node 'n2' at (100,0)
const nodes: WallNode[] = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,200)];
const horizontal: Wall = { id:'h', node1Id:'n1', node2Id:'n2', thickness:20 };
const vertical:   Wall = { id:'v', node1Id:'n2', node2Id:'n3', thickness:20 };

describe('snapToWalls — endpoint', () => {
  it('snaps to node1 position within radius', () => {
    const r = snapToWalls({ x:5, y:3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x:0, y:0 });
    expect(r?.nodeId).toBe('n1');
  });

  it('snaps to node2 position within radius', () => {
    const r = snapToWalls({ x:97, y:-2 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
    expect(r?.point).toEqual({ x:100, y:0 });
    expect(r?.nodeId).toBe('n2');
  });

  it('returns null far from all walls', () => {
    const r = snapToWalls({ x:500, y:500 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over face snap', () => {
    const r = snapToWalls({ x:100, y:5 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
  });
});

describe('snapToWalls — face', () => {
  it('snaps to projected point on centerline within face radius', () => {
    const r = snapToWalls({ x:50, y:5 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('face');
    expect(r?.point.x).toBeCloseTo(50);
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('does not snap to face beyond wall bounds', () => {
    const r = snapToWalls({ x:300, y:20 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });
});

describe('snapToWalls — H/V snap without walls (first chain node)', () => {
  it('snaps horizontally to a node even when no walls exist', () => {
    // First node placed at (0,0), cursor at (150, 3) — should snap to y=0
    const startNode = nd('start', 0, 0);
    const r = snapToWalls({ x: 150, y: 3 }, [], [startNode], SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
    expect(r?.point.y).toBeCloseTo(0);
  });

  it('snaps vertically to a node even when no walls exist', () => {
    const startNode = nd('start', 0, 0);
    const r = snapToWalls({ x: 3, y: 150 }, [], [startNode], SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('v');
    expect(r?.point.x).toBeCloseTo(0);
  });
});

describe('snapToWalls — H/V snap', () => {
  it('snaps horizontally when cursor is near same Y as a node', () => {
    // cursor at (150, 3) — near y=0 of n1/n2 but far from endpoint and face
    const r = snapToWalls({ x:150, y:3 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('h');
    expect(r?.point.y).toBeCloseTo(0);
    expect(r?.point.x).toBeCloseTo(150);
  });

  it('snaps vertically when cursor is near same X as a node', () => {
    // cursor at (3, 150) — near x=0 of n1
    const r = snapToWalls({ x:3, y:150 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('hv');
    expect(r?.axis).toBe('v');
    expect(r?.point.x).toBeCloseTo(0);
    expect(r?.point.y).toBeCloseTo(150);
  });

  it('H/V snap does not activate when cursor is beyond snap radius', () => {
    const r = snapToWalls({ x:150, y:20 }, [horizontal], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r).toBeNull();
  });

  it('endpoint snap takes priority over H/V snap', () => {
    // near n2=(100,0) but also near y=0 axis
    const r = snapToWalls({ x:100, y:3 }, [horizontal, vertical], nodes, SCALE, EP_R, FA_R, HV_R);
    expect(r?.type).toBe('endpoint');
  });
});
