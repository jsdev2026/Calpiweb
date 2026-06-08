import { describe, it, expect } from 'vitest';
import { computeAutoCotations } from './wallCotation';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function w(id: string, n1: string, n2: string, t = 10): Wall {
  return { id, node1Id: n1, node2Id: n2, thickness: t };
}

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

describe('computeAutoCotations — T-junction (2 pièces adjacentes)', () => {
  // Pièce gauche a-b-e-f (100×100mm), pièce droite b-c-d-e (100×100mm)
  // Mur partagé e-b
  const nodes = [
    nd('a',0,0), nd('b',100,0), nd('c',200,0),
    nd('d',200,100), nd('e',100,100), nd('f',0,100),
  ];
  const walls = [
    w('w1','a','b'), w('w2','b','c'), w('w3','c','d'),
    w('w4','d','e'), w('w5','e','b'), w('w6','e','f'), w('w7','f','a'),
  ];

  it('retourne des cotations (non vide malgré la T-junction)', () => {
    const result = computeAutoCotations(walls, nodes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('le mur partagé w5 a une cotation intérieure ou extérieure (pas isolated)', () => {
    const result = computeAutoCotations(walls, nodes);
    expect(result.some(c => c.wallId === 'w5' && (c.side === 'interior' || c.side === 'exterior'))).toBe(true);
  });
});

// Helper visible dans ce fichier uniquement (copie de l'helper interne)
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

describe('computeAutoCotations — cloisons', () => {
  // Scénario : mur horizontal w1(a→b, t=20) + cloison wC(b→c, t=10) verticale
  // a(0,0) b(100,0) c(100,100)
  // degré : a=1, b=2, c=1
  // wC : p1=b(connecté, deg2), p2=c(libre, deg1)
  //   dir b→c = (0,1)  ;  adjWalls à b hors wC = [w1] t=20
  //   anchor1 = b + (20/2)*(0,1) = (100,10)
  //   anchor2 = c = (100,100)
  //   label = dist = 90mm = "9.0 cm"
  const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100)];
  const walls = [w('w1', 'a', 'b', 20), w('wC', 'b', 'c', 10)];

  it('Cas 1 (deg2=1) — anchor1 ajusté à la face intérieure du mur de connexion', () => {
    const result = computeAutoCotations(walls, nodes);
    const cot = result.find((c) => c.wallId === 'wC')!;
    expect(cot).toBeDefined();
    expect(cot.side).toBe('isolated');
    expect(cot.anchor1.x).toBeCloseTo(100);
    expect(cot.anchor1.y).toBeCloseTo(10);  // b + (20/2)*(0,1)
    expect(cot.anchor2.x).toBeCloseTo(100);
    expect(cot.anchor2.y).toBeCloseTo(100);
    expect(cot.label).toBe('9.0 cm');
  });

  it('Cas 1 (deg1=1) — anchor2 ajusté quand le nœud1 est libre', () => {
    // w1 : a(libre,deg1) → b(connecté,deg2)
    // dir a→b = (1,0) ; adjWalls à b hors w1 = [wC] t=10
    // anchor1 = a = (0,0)   anchor2 = b - (10/2)*(1,0) = (95,0)
    // label = 95mm = "9.5 cm"
    const result = computeAutoCotations(walls, nodes);
    const cot = result.find((c) => c.wallId === 'w1')!;
    expect(cot).toBeDefined();
    expect(cot.side).toBe('isolated');
    expect(cot.anchor1.x).toBeCloseTo(0);
    expect(cot.anchor1.y).toBeCloseTo(0);
    expect(cot.anchor2.x).toBeCloseTo(95);  // b - (10/2)*(1,0)
    expect(cot.anchor2.y).toBeCloseTo(0);
    expect(cot.label).toBe('9.5 cm');
  });

  it('Cas 2 (deux bouts libres) — anchor inchangé', () => {
    const freeNodes = [nd('p', 0, 0), nd('q', 150, 0)];
    const freeWalls = [w('wf', 'p', 'q', 10)];
    const result = computeAutoCotations(freeWalls, freeNodes);
    expect(result).toHaveLength(1);
    const cot = result[0]!;
    expect(cot.anchor1).toMatchObject({ x: 0, y: 0 });
    expect(cot.anchor2).toMatchObject({ x: 150, y: 0 });
    expect(cot.label).toBe('15.0 cm');
  });

  it('cloison dans une pièce — pas de cotation isolated pour les murs de pièce', () => {
    const rNodes = [
      nd('a', 0, 0), nd('b', 200, 0), nd('c', 200, 200), nd('d', 0, 200),
      nd('m', 100, 0), nd('f', 100, 100),
    ];
    const rWalls = [
      w('r1', 'a', 'm', 20), w('r2', 'm', 'b', 20),
      w('r3', 'b', 'c', 20), w('r4', 'c', 'd', 20), w('r5', 'd', 'a', 20),
      w('rC', 'm', 'f', 15),
    ];
    const result = computeAutoCotations(rWalls, rNodes);
    const isolated = result.filter((c) => c.side === 'isolated');
    expect(isolated).toHaveLength(1);
    expect(isolated[0]!.wallId).toBe('rC');
    // anchor1 = m(100,0) + (20/2)*(0,1) = (100,10)
    expect(isolated[0]!.anchor1.y).toBeCloseTo(10);
    expect(isolated[0]!.anchor2).toMatchObject({ x: 100, y: 100 });
  });
});
