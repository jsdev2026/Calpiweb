import { describe, expect, it } from 'vitest';
import type { Room } from '@/types/project';
import { computeBoxes, computeSkirting, skirtingLength } from './packaging';
import { analyzeQuantities } from './quantityEngine';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';

const rect = (id: string, x: number, y: number, w: number, h: number): Room => ({
  id,
  edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  points: [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ],
});

describe('cartons', () => {
  it('arrondit au carton entier et donne la surface d’un carton', () => {
    // 158 carreaux 60 × 30, 8 par carton → 20 cartons de 1,44 m²
    expect(computeBoxes(158, 600, 300, { tilesPerBox: 8 })).toEqual({
      perBox: 8,
      count: 20,
      boxArea: 1_440_000,
    });
    expect(computeBoxes(160, 600, 300, { tilesPerBox: 8 })!.count).toBe(20);
  });

  it('rien si le conditionnement n’est pas renseigné ou invalide', () => {
    expect(computeBoxes(158, 600, 300, undefined)).toBeUndefined();
    expect(computeBoxes(158, 600, 300, { tilesPerBox: 0 })).toBeUndefined();
    expect(computeBoxes(158, 600, 300, { tilesPerBox: -3 })).toBeUndefined();
  });
});

describe('plinthes', () => {
  it('périmètre intérieur de la pièce (murs de 10 cm)', () => {
    // Axe des murs 4 m × 3 m, faces intérieures 3,9 m × 2,9 m → 13,6 m
    expect(skirtingLength([rect('r', 0, 0, 4000, 3000)], 100)).toBeCloseTo(13_600, 0);
  });

  it('déduit les portes, des deux côtés quand elles relient deux pièces', () => {
    const a = rect('a', 0, 0, 4000, 3000);
    const b = rect('b', 4000, 0, 3000, 3000);
    // Porte de 80 cm dans le mur commun (x = 4000)
    const door = { from: { x: 4000, y: 1000 }, to: { x: 4000, y: 1800 }, thickness: 100 };
    const without = skirtingLength([a, b], 100);
    const withDoor = skirtingLength([a, b], 100, [door]);
    expect(without - withDoor).toBeCloseTo(1600, 0);
    // Une porte posée ailleurs ne touche aucune des deux pièces
    const far = { from: { x: 9000, y: 9000 }, to: { x: 9800, y: 9000 }, thickness: 100 };
    expect(skirtingLength([a, b], 100, [far])).toBeCloseTo(without, 0);
  });

  it('anciennes pièces : côté marqué « porte » déduit', () => {
    const r = rect('r', 0, 0, 4000, 3000);
    r.edges = ['WALL', 'DOOR', 'WALL', 'WALL'];
    expect(skirtingLength([r], 0)).toBeCloseTo(14_000 - 3000, 0);
  });

  it('nombre de plinthes avec 10 % de marge, longueur réglable', () => {
    const rooms = [rect('r', 0, 0, 4000, 3000)];
    const s = computeSkirting(rooms, 100, [], { skirting: true });
    // 13,6 m × 1,1 = 14,96 m → 25 plinthes de 60 cm
    expect(s).toMatchObject({ included: true, pieceLength: 600, pieces: 25, margin: 0.1 });
    expect(computeSkirting(rooms, 100, [], { skirtingPieceLength: 1200 }).pieces).toBe(13);
    expect(computeSkirting(rooms, 100, [], undefined).included).toBe(false);
  });
});

describe('quantitatif complet', () => {
  it('ajoute cartons et plinthes au résultat', () => {
    const r = analyzeQuantities(
      [rect('r', 0, 0, 4000, 3000)],
      {
        ...DEFAULT_TILING_CONFIG,
        width: 600,
        height: 300,
        consumableParams: { tilesPerBox: 8, skirting: true },
      },
      100,
    );
    expect(r.boxes!.count).toBe(Math.ceil(r.toOrder / 8));
    expect(r.skirting!.included).toBe(true);
    expect(r.skirting!.length).toBeCloseTo(13_600, 0);
  });
});
