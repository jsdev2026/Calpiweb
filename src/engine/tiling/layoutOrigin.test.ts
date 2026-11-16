import { describe, expect, it } from 'vitest';
import type { Room } from '@/types/project';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { dragOffset, normalizeOffset, originOffset, snapOffset } from './layoutOrigin';

const room = (w: number, h: number): Room =>
  ({
    id: 'r1',
    name: 'P',
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
  }) as unknown as Room;

const cfg = {
  ...DEFAULT_TILING_CONFIG,
  width: 300,
  height: 600,
  joint: 3,
  angle: 0,
  offsetX: 0,
  offsetY: 0,
};

describe('dragOffset', () => {
  it('ajoute le déplacement tel quel à 0°', () => {
    expect(dragOffset(cfg, 40, -20)).toEqual({ offsetX: 40, offsetY: -20 });
  });

  it('ramène le déplacement dans le repère des carreaux à 90°', () => {
    const r = dragOffset({ ...cfg, angle: 90 }, 100, 0);
    expect(r.offsetX).toBeCloseTo(0, 6);
    expect(r.offsetY).toBeCloseTo(-100, 6);
  });
});

describe('normalizeOffset', () => {
  it('ramène la pose droite dans [0, pas[', () => {
    expect(normalizeOffset(cfg, -10, 700)).toEqual({ offsetX: 293, offsetY: 97 });
  });

  it('ne normalise pas les poses non périodiques', () => {
    expect(normalizeOffset({ ...cfg, layout: 'HERRINGBONE' }, -10.4, 700)).toEqual({
      offsetX: -10,
      offsetY: 700,
    });
  });
});

describe('originOffset', () => {
  it("CORNER démarre dans l'angle", () => {
    expect(originOffset('CORNER', [room(2000, 3000)], cfg, 0)).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('CENTER centre un carreau sur la pièce', () => {
    // largeur 2000 : centre 1000, carreau 300 → bord gauche à 850 ; 850 mod 303 = 244
    // hauteur 3000 : centre 1500, carreau 600 → 1200 mod 603 = 597
    expect(originOffset('CENTER', [room(2000, 3000)], cfg, 0)).toEqual({
      offsetX: 244,
      offsetY: 597,
    });
  });
});

describe('snapOffset', () => {
  it("s'accroche à une cible proche, modulo le pas", () => {
    expect(snapOffset(cfg, { offsetX: 290, offsetY: 400 }, [{ offsetX: 0, offsetY: 0 }])).toEqual({
      offsetX: 0,
      offsetY: 400,
    });
  });

  it('ne bouge pas si la cible est loin', () => {
    expect(snapOffset(cfg, { offsetX: 150, offsetY: 150 }, [{ offsetX: 0, offsetY: 0 }])).toEqual({
      offsetX: 150,
      offsetY: 150,
    });
  });
});
