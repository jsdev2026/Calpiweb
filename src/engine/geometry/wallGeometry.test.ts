// src/engine/geometry/wallGeometry.test.ts
import { describe, it, expect } from 'vitest';
import { computeCornerGeometry, computeJointLines, computeNodeCaps } from './wallGeometry';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode {
  return { id, x, y };
}
function near(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number },
  eps = 0.1,
): boolean {
  if (!a) return false;
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

// ── computeCornerGeometry ──────────────────────────────────────────────────

describe('computeCornerGeometry', () => {
  it('preserves wallId', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0)];
    const walls: Wall[] = [{ id: 'abc', node1Id: 'a', node2Id: 'b', thickness: 10 }];
    expect(computeCornerGeometry(walls, nodes)[0]!.wallId).toBe('abc');
  });

  it('returns empty points for zero-length wall (same node)', () => {
    const nodes = [nd('a', 0, 0)];
    const walls: Wall[] = [{ id: 'z', node1Id: 'a', node2Id: 'a', thickness: 10 }];
    expect(computeCornerGeometry(walls, nodes)[0]!.points).toHaveLength(0);
  });

  it('single horizontal wall — flat caps at both ends', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0)];
    const walls: Wall[] = [{ id: 'h', node1Id: 'a', node2Id: 'b', thickness: 10 }];
    const pts = computeCornerGeometry(walls, nodes)[0]!.points;
    expect(pts).toHaveLength(4);
    expect(near(pts[0], { x: 0, y: 5 })).toBe(true);
    expect(near(pts[1], { x: 100, y: 5 })).toBe(true);
    expect(near(pts[2], { x: 100, y: -5 })).toBe(true);
    expect(near(pts[3], { x: 0, y: -5 })).toBe(true);
  });

  it('single vertical wall — flat caps', () => {
    const nodes = [nd('a', 0, 0), nd('b', 0, 100)];
    const walls: Wall[] = [{ id: 'v', node1Id: 'a', node2Id: 'b', thickness: 10 }];
    const pts = computeCornerGeometry(walls, nodes)[0]!.points;
    expect(near(pts[0], { x: -5, y: 0 })).toBe(true);
    expect(near(pts[1], { x: -5, y: 100 })).toBe(true);
    expect(near(pts[2], { x: 5, y: 100 })).toBe(true);
    expect(near(pts[3], { x: 5, y: 0 })).toBe(true);
  });

  it('two walls at 90° — correct extensions', () => {
    const nodes = [nd('n1', 0, 0), nd('n2', 100, 0), nd('n3', 100, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find((p) => p.wallId === 'w1')!;
    const p2 = polys.find((p) => p.wallId === 'w2')!;
    expect(near(p1.points[0]!, { x: 0, y: 5 })).toBe(true);
    expect(near(p1.points[3]!, { x: 0, y: -5 })).toBe(true);
    expect(near(p1.points[1]!, { x: 95, y: 5 })).toBe(true); // ← 105→95
    expect(near(p1.points[2]!, { x: 105, y: -5 })).toBe(true);
    expect(near(p2.points[0]!, { x: 95, y: 5 })).toBe(true); // ← -5→5
    expect(near(p2.points[3]!, { x: 105, y: -5 })).toBe(true);
  });

  it('45° corner — correct extension (not T/2)', () => {
    const nodes = [nd('n1', 0, 0), nd('n2', 100, 0), nd('n3', 170, 70)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find((p) => p.wallId === 'w1')!;
    const extX = p1.points[1]!.x - 100;
    expect(extX).toBeLessThan(0); // coin intérieur se rétracte avant P
    expect(extX).toBeGreaterThan(-5); // mais de moins d'un demi-épaisseur
  });

  it('120° corner — extension greater than T/2', () => {
    const angle = (120 * Math.PI) / 180;
    const nodes = [
      nd('n1', 0, 0),
      nd('n2', 100, 0),
      nd('n3', 100 + Math.cos(angle) * 80, Math.sin(angle) * 80),
    ];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const p1 = polys.find((p) => p.wallId === 'w1')!;
    const extX = p1.points[1]!.x - 100;
    expect(extX).toBeLessThan(-5); // rétraction > T/2 = 5
  });

  // Bug : en reprenant le dessin depuis un nœud existant, deux murs partent du même nœud
  // (node1 commun) → l'angle était coupé à 45° au lieu d'un angle droit.
  it('90° — deux murs qui partent du même nœud donnent un angle droit (pas 45°)', () => {
    const nodes = [nd('p', 0, 0), nd('x', 100, 0), nd('y', 0, 100)];
    const walls: Wall[] = [
      { id: 'a', node1Id: 'p', node2Id: 'x', thickness: 10 },
      { id: 'b', node1Id: 'p', node2Id: 'y', thickness: 10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const a = polys.find((p) => p.wallId === 'a')!.points;
    const b = polys.find((p) => p.wallId === 'b')!.points;
    const corners = [a[0]!, a[3]!];
    expect(corners.some((c) => near(c, { x: 5, y: 5 }))).toBe(true); // coin intérieur
    expect(corners.some((c) => near(c, { x: -5, y: -5 }))).toBe(true); // coin extérieur
    const bCorners = [b[0]!, b[3]!];
    expect(bCorners.some((c) => near(c, { x: 5, y: 5 }))).toBe(true);
    expect(bCorners.some((c) => near(c, { x: -5, y: -5 }))).toBe(true);
  });

  it('90° — même résultat quel que soit le sens de tracé des murs', () => {
    const nodes = [nd('p', 0, 0), nd('x', 100, 0), nd('y', 0, 100)];
    const sets: Wall[][] = [
      [
        { id: 'a', node1Id: 'x', node2Id: 'p', thickness: 10 },
        { id: 'b', node1Id: 'p', node2Id: 'y', thickness: 10 },
      ],
      [
        { id: 'a', node1Id: 'x', node2Id: 'p', thickness: 10 },
        { id: 'b', node1Id: 'y', node2Id: 'p', thickness: 10 },
      ],
      [
        { id: 'a', node1Id: 'p', node2Id: 'x', thickness: 10 },
        { id: 'b', node1Id: 'y', node2Id: 'p', thickness: 10 },
      ],
    ];
    for (const walls of sets) {
      const a = computeCornerGeometry(walls, nodes).find((p) => p.wallId === 'a')!.points;
      const all = a.filter((pt) => Math.hypot(pt.x, pt.y) < 20);
      expect(all.some((c) => near(c, { x: 5, y: 5 }))).toBe(true);
      expect(all.some((c) => near(c, { x: -5, y: -5 }))).toBe(true);
    }
  });

  it('jonction en T — le mur traversant garde ses faces droites, la branche s’arrête sur sa face', () => {
    const nodes = [nd('l', -100, 0), nd('p', 0, 0), nd('r', 100, 0), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'wl', node1Id: 'l', node2Id: 'p', thickness: 10 },
      { id: 'wr', node1Id: 'p', node2Id: 'r', thickness: 10 },
      { id: 'wd', node1Id: 'p', node2Id: 'd', thickness: 10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const wl = polys.find((p) => p.wallId === 'wl')!.points;
    const wd = polys.find((p) => p.wallId === 'wd')!.points;
    // Face du haut (côté opposé à la branche) : arrive jusqu'au nœud, sans biais
    const wlTop = [wl[1]!, wl[2]!].find((pt) => pt.y < 0)!;
    expect(near(wlTop, { x: 0, y: -5 })).toBe(true);
    // Branche : ses deux faces s'arrêtent sur la face basse du mur traversant (y = 5)
    expect(near(wd[0]!, { x: -5, y: 5 })).toBe(true);
    expect(near(wd[3]!, { x: 5, y: 5 })).toBe(true);
  });

  it('nœud à 3 murs (aigu + obtus) — chaque face rejoint son voisin angulaire', () => {
    const a = (deg: number, r = 100) => ({
      x: Math.cos((deg * Math.PI) / 180) * r,
      y: Math.sin((deg * Math.PI) / 180) * r,
    });
    const nodes = [
      nd('p', 0, 0),
      nd('n0', a(0).x, a(0).y),
      nd('n1', a(35).x, a(35).y),
      nd('n2', a(200).x, a(200).y),
    ];
    const walls: Wall[] = [
      { id: 'w0', node1Id: 'p', node2Id: 'n0', thickness: 10 },
      { id: 'w1', node1Id: 'n1', node2Id: 'p', thickness: 10 },
      { id: 'w2', node1Id: 'p', node2Id: 'n2', thickness: 10 },
    ];
    const polys = computeCornerGeometry(walls, nodes);
    const corners = (id: string) => {
      const pts = polys.find((p) => p.wallId === id)!.points;
      return pts.filter((pt) => Math.hypot(pt.x, pt.y) < 60);
    };
    // Coins partagés : chaque coin d'un mur coïncide avec un coin d'un voisin
    const all = ['w0', 'w1', 'w2'].map(corners);
    for (let i = 0; i < 3; i++) {
      for (const c of all[i]!) {
        const shared = all.some((other, j) => j !== i && other.some((o) => near(o, c, 0.01)));
        expect(shared).toBe(true);
      }
    }
  });

  it('angle très aigu — la pointe est bornée (pas de pic démesuré)', () => {
    const ang = (10 * Math.PI) / 180;
    const nodes = [
      nd('p', 0, 0),
      nd('x', 200, 0),
      nd('y', Math.cos(ang) * 200, Math.sin(ang) * 200),
    ];
    const walls: Wall[] = [
      { id: 'a', node1Id: 'p', node2Id: 'x', thickness: 10 },
      { id: 'b', node1Id: 'p', node2Id: 'y', thickness: 10 },
    ];
    for (const poly of computeCornerGeometry(walls, nodes)) {
      for (const pt of poly.points) {
        expect(pt.x).toBeGreaterThan(-25);
      }
    }
    expect(computeNodeCaps(walls, nodes)).toHaveLength(1);
  });
});

// ── computeJointLines ──────────────────────────────────────────────────────

describe('computeJointLines', () => {
  it('returns no lines for isolated walls', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 200, 0), nd('d', 300, 0)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 10 },
      { id: 'w2', node1Id: 'c', node2Id: 'd', thickness: 10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(0);
  });

  it('returns one line for two connected walls', () => {
    const nodes = [nd('n1', 0, 0), nd('n2', 100, 0), nd('n3', 100, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(1);
  });

  it('does not duplicate lines', () => {
    const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'a', node2Id: 'b', thickness: 10 },
      { id: 'w2', node1Id: 'b', node2Id: 'c', thickness: 10 },
      { id: 'w3', node1Id: 'c', node2Id: 'd', thickness: 10 },
    ];
    expect(computeJointLines(walls, nodes)).toHaveLength(2);
  });

  it('90° equal-thickness — joint at (95,5) and (105,-5)', () => {
    const nodes = [nd('n1', 0, 0), nd('n2', 100, 0), nd('n3', 100, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 10 },
    ];
    const lines = computeJointLines(walls, nodes);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    const a = near(l.p1, { x: 95, y: 5 }) && near(l.p2, { x: 105, y: -5 });
    const b = near(l.p1, { x: 105, y: -5 }) && near(l.p2, { x: 95, y: 5 });
    expect(a || b).toBe(true);
  });

  it('45° — joint endpoints stay within wall boundaries (|y|≤5)', () => {
    const nodes = [nd('n1', 0, 0), nd('n2', 100, 0), nd('n3', 170, 70)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 10 },
    ];
    const lines = computeJointLines(walls, nodes);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(Math.abs(l.p1.y)).toBeLessThanOrEqual(5.01);
    expect(Math.abs(l.p2.y)).toBeLessThanOrEqual(5.01);
  });

  it('different thicknesses — angle = arctan(h1/h2)', () => {
    const nodes = [nd('n1', 0, 0), nd('n2', 100, 0), nd('n3', 100, 100)];
    const walls: Wall[] = [
      { id: 'w1', node1Id: 'n1', node2Id: 'n2', thickness: 10 },
      { id: 'w2', node1Id: 'n2', node2Id: 'n3', thickness: 20 },
    ];
    const lines = computeJointLines(walls, nodes);
    const l = lines[0]!;
    const dx = Math.abs(l.p2.x - l.p1.x);
    const dy = Math.abs(l.p2.y - l.p1.y);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    expect(angle).toBeCloseTo((Math.atan2(5, 10) * 180) / Math.PI, 1);
  });
});
