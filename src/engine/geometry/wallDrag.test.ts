import { describe, it, expect } from 'vitest';
import { computeWallNormal, computeWallPerpMove } from './wallDrag';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }

describe('computeWallNormal', () => {
  it('mur horizontal → normale (0, 1)', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    const nodes = [nd('a', 0, 0), nd('b', 200, 0)];
    const n = computeWallNormal(wall, nodes);
    expect(n).not.toBeNull();
    expect(n!.x).toBeCloseTo(0);
    expect(n!.y).toBeCloseTo(1);
  });

  it('mur vertical → |normale.x| = 1, normale.y = 0', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    const nodes = [nd('a', 0, 0), nd('b', 0, 200)];
    const n = computeWallNormal(wall, nodes);
    expect(n).not.toBeNull();
    expect(Math.abs(n!.x)).toBeCloseTo(1);
    expect(n!.y).toBeCloseTo(0);
  });

  it('mur de longueur nulle → null', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    const nodes = [nd('a', 100, 100), nd('b', 100, 100)];
    expect(computeWallNormal(wall, nodes)).toBeNull();
  });

  it('nœud introuvable → null', () => {
    const wall: Wall = { id: 'w', node1Id: 'a', node2Id: 'b', thickness: 100 };
    expect(computeWallNormal(wall, [nd('a', 0, 0)])).toBeNull();
  });
});

describe('computeWallPerpMove', () => {
  const n1Start = { x: 0,   y: 0 };
  const n2Start = { x: 200, y: 0 };
  const normal  = { x: 0,   y: 1 };
  const pStart  = { x: 100, y: 0 };
  const noSnap: WallNode[] = [];
  const scale = 1;
  const snapPx = 28;

  it('déplace les deux nœuds de la même valeur perpendiculaire', () => {
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 100, y: 50 }, normal, noSnap, scale, snapPx);
    expect(r.node1Target).toEqual({ x: 0,   y: 50 });
    expect(r.node2Target).toEqual({ x: 200, y: 50 });
  });

  it('ignore la composante parallèle au mur', () => {
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 200, y: 30 }, normal, noSnap, scale, snapPx);
    expect(r.node1Target.x).toBeCloseTo(0);
    expect(r.node1Target.y).toBeCloseTo(30);
    expect(r.node2Target.x).toBeCloseTo(200);
    expect(r.node2Target.y).toBeCloseTo(30);
  });

  it('snappe vers un nœud proche dans la direction normale', () => {
    const snapNode = nd('s', 50, 48);
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 100, y: 50 }, normal, [snapNode], scale, snapPx);
    expect(r.node1Target.y).toBeCloseTo(48);
    expect(r.node2Target.y).toBeCloseTo(48);
  });

  it('ne snappe pas si le nœud est trop loin', () => {
    const farNode = nd('f', 50, 100);
    const r = computeWallPerpMove(n1Start, n2Start, pStart, { x: 100, y: 50 }, normal, [farNode], scale, snapPx);
    expect(r.node1Target.y).toBeCloseTo(50);
  });

  it('mouvement nul → nœuds restent à leurs positions initiales', () => {
    const r = computeWallPerpMove(n1Start, n2Start, pStart, pStart, normal, noSnap, scale, snapPx);
    expect(r.node1Target).toEqual(n1Start);
    expect(r.node2Target).toEqual(n2Start);
  });

  it('mur diagonal — déplace dans la direction normale', () => {
    const diag_n1  = { x: 0,   y: 0   };
    const diag_n2  = { x: 100, y: 100 };
    const diag_nor = { x: -1 / Math.SQRT2, y: 1 / Math.SQRT2 };
    const diag_ps  = { x: 50,  y: 50  };
    const cursor   = { x: 40,  y: 60  };
    const r = computeWallPerpMove(diag_n1, diag_n2, diag_ps, cursor, diag_nor, noSnap, scale, snapPx);
    expect(r.node1Target.x).toBeCloseTo(-10);
    expect(r.node1Target.y).toBeCloseTo(10);
    expect(r.node2Target.x).toBeCloseTo(90);
    expect(r.node2Target.y).toBeCloseTo(110);
  });
});
