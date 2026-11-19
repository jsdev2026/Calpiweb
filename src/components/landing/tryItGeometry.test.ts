import { describe, expect, it } from 'vitest';
import { addPoint, polygonArea, snapPoint } from './tryItGeometry';

describe('essai — tracé de la pièce', () => {
  it('aimante sur 10 cm et redresse les murs presque droits', () => {
    expect(snapPoint({ x: 1234, y: 987 })).toEqual({ x: 1200, y: 1000 });
    // Presque horizontal → même hauteur que le point précédent
    expect(snapPoint({ x: 4000, y: 1240 }, { x: 1000, y: 1000 })).toEqual({ x: 4000, y: 1000 });
    // Presque vertical → même abscisse
    expect(snapPoint({ x: 1150, y: 4000 }, { x: 1000, y: 1000 })).toEqual({ x: 1000, y: 4000 });
    // Reste dans la zone de dessin
    expect(snapPoint({ x: -500, y: 99_999 })).toEqual({ x: 0, y: 6250 });
  });

  it('ajoute les angles puis ferme en cliquant près du premier point', () => {
    let pts: { x: number; y: number }[] = [];
    for (const p of [
      { x: 1000, y: 1000 },
      { x: 5000, y: 1000 },
      { x: 5000, y: 4000 },
      { x: 1000, y: 4000 },
    ]) {
      const r = addPoint(pts, p);
      expect(r.kind).toBe('added');
      if (r.kind === 'added') pts = r.points;
    }
    const close = addPoint(pts, { x: 1080, y: 1120 });
    expect(close.kind).toBe('closed');
    expect(polygonArea(pts)).toBe(12_000_000);
  });

  it('refuse un mur trop court ou qui croise un autre mur', () => {
    const pts = [
      { x: 1000, y: 1000 },
      { x: 5000, y: 1000 },
      { x: 5000, y: 4000 },
    ];
    expect(addPoint(pts, { x: 5050, y: 4050 })).toEqual({ kind: 'rejected', reason: 'too-short' });
    // De (5000,4000) vers (3000,0) : croise le premier mur
    expect(addPoint(pts, { x: 3000, y: 0 })).toEqual({ kind: 'rejected', reason: 'crossing' });
  });

  it('pas de fermeture avant trois angles', () => {
    const r = addPoint(
      [
        { x: 1000, y: 1000 },
        { x: 5000, y: 1000 },
      ],
      { x: 1000, y: 1050 },
    );
    expect(r.kind).toBe('added');
  });
});
