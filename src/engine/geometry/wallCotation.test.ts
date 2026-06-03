import { describe, it, expect } from 'vitest';
import { detectClosedPolygons, computeAutoCotations } from './wallCotation';
import type { Wall, WallNode, AutoCotation } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function w(id: string, n1: string, n2: string, t = 10): Wall {
  return { id, node1Id: n1, node2Id: n2, thickness: t };
}

// ── detectClosedPolygons ──────────────────────────────────────────────────

describe('detectClosedPolygons', () => {
  it('pièce rectangulaire 4 murs → 1 polygone avec 4 wallIds', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
    const walls = [w('w1','a','b'), w('w2','b','c'), w('w3','c','d'), w('w4','d','a')];
    const result = detectClosedPolygons(walls, nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.wallIds).toHaveLength(4);
    expect(new Set(result[0]!.wallIds)).toEqual(new Set(['w1','w2','w3','w4']));
  });

  it('4 murs fermés + 1 mur isolé → 1 polygone, mur isolé non inclus', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140),
                   nd('e',400,0), nd('f',500,0)];
    const walls = [w('w1','a','b'), w('w2','b','c'), w('w3','c','d'), w('w4','d','a'),
                   w('wi','e','f')];
    const result = detectClosedPolygons(walls, nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.wallIds).not.toContain('wi');
  });

  it('T-junction → 0 polygones', () => {
    // node b a 3 connexions : w1(a-b), w2(b-c), w3(b-m)
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0), nd('m',100,100)];
    const walls = [w('w1','a','b'), w('w2','b','c'), w('w3','b','m')];
    expect(detectClosedPolygons(walls, nodes)).toHaveLength(0);
  });

  it('2 murs ouverts → 0 polygones', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0)];
    const walls = [w('w1','a','b'), w('w2','b','c')];
    expect(detectClosedPolygons(walls, nodes)).toHaveLength(0);
  });

  it('mur unique isolé → 0 polygones', () => {
    const nodes = [nd('a',0,0), nd('b',100,0)];
    const walls = [w('w1','a','b')];
    expect(detectClosedPolygons(walls, nodes)).toHaveLength(0);
  });
});
