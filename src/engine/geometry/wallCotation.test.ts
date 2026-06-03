import { describe, it, expect } from 'vitest';
import { detectClosedPolygons, computeAutoCotations } from './wallCotation';
import type { Wall, WallNode } from '@/types/wall';

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

// ── computeAutoCotations ──────────────────────────────────────────────────

describe('computeAutoCotations', () => {
  // Pièce rectangulaire : 200mm × 140mm, épaisseur 10mm (h=5)
  const rectNodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
  const rectWalls = [w('w1','a','b'), w('w2','b','c'), w('w3','c','d'), w('w4','d','a')];

  it('pièce 4 murs → 8 cotations (2 par mur)', () => {
    expect(computeAutoCotations(rectWalls, rectNodes)).toHaveLength(8);
  });

  it('côte extérieure du mur du haut plus longue que la côte intérieure', () => {
    const result = computeAutoCotations(rectWalls, rectNodes);
    const ext = result.find((c) => c.wallId === 'w1' && c.side === 'exterior')!;
    const int = result.find((c) => c.wallId === 'w1' && c.side === 'interior')!;
    const extLen = dist(ext.anchor1, ext.anchor2);
    const intLen = dist(int.anchor1, int.anchor2);
    expect(extLen).toBeGreaterThan(intLen);
  });

  it('label côte extérieure top = hors-tout = "21.0 cm" (200+2×5 = 210mm)', () => {
    const result = computeAutoCotations(rectWalls, rectNodes);
    const ext = result.find((c) => c.wallId === 'w1' && c.side === 'exterior')!;
    expect(ext.label).toBe('21.0 cm');
  });

  it('label côte intérieure top = vide utile = "19.0 cm" (200−2×5 = 190mm)', () => {
    const result = computeAutoCotations(rectWalls, rectNodes);
    const int = result.find((c) => c.wallId === 'w1' && c.side === 'interior')!;
    expect(int.label).toBe('19.0 cm');
  });

  it('mur isolé horizontal 150mm → 1 cotation isolated, label "15.0 cm"', () => {
    const isoNodes = [nd('p',0,0), nd('q',150,0)];
    const isoWalls = [w('wi','p','q')];
    const result = computeAutoCotations(isoWalls, isoNodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.side).toBe('isolated');
    expect(result[0]!.label).toBe('15.0 cm');
  });

  it('mur longueur 0 → aucune cotation', () => {
    const isoNodes = [nd('p',0,0), nd('q',0,0)];
    const isoWalls = [w('wi','p','q')];
    expect(computeAutoCotations(isoWalls, isoNodes)).toHaveLength(0);
  });

  it('mur isolé horizontal → normal = (0,1) (perpendiculaire gauche)', () => {
    const isoNodes = [nd('p',0,0), nd('q',100,0)];
    const isoWalls = [w('wi','p','q')];
    const result = computeAutoCotations(isoWalls, isoNodes);
    expect(result[0]!.normal.x).toBeCloseTo(0);
    expect(result[0]!.normal.y).toBeCloseTo(1);
  });
});

// Helper visible dans ce fichier uniquement (copie de l'helper interne)
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}
