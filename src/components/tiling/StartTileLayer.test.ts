import { describe, expect, it } from 'vitest';
import type { StartCote } from '@/engine/tiling/startTile';
import { layoutCoteLabels } from './StartTileLayer';

// Carreau 600 × 300 à 50 mm des murs (coin 100,100 ; murs en x = 50 et y = 50)
const tile = [
  { x: 100, y: 100 },
  { x: 700, y: 100 },
  { x: 700, y: 400 },
  { x: 100, y: 400 },
];
const cotes: StartCote[] = [
  { from: { x: 50, y: 100 }, to: { x: 100, y: 100 }, value: 50 },
  { from: { x: 100, y: 50 }, to: { x: 100, y: 100 }, value: 50 },
  { from: { x: 700, y: 50 }, to: { x: 700, y: 100 }, value: 50 },
];

describe('layoutCoteLabels', () => {
  it('cotes courtes : étiquettes sans chevauchement', () => {
    const px = (v: number) => v / 0.3; // zoom écran mobile
    const labels = layoutCoteLabels(cotes, tile, px).filter((l) => l !== null);
    expect(labels).toHaveLength(3);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!;
        const b = labels[j]!;
        const sep =
          Math.abs(a.cx - b.cx) >= (a.w + b.w) / 2 || Math.abs(a.cy - b.cy) >= (a.h + b.h) / 2;
        expect(sep).toBe(true);
      }
    }
  });

  it('cote longue : texte à côté du trait, à mi-longueur, sans le recouvrir', () => {
    const long: StartCote = { from: { x: 0, y: 0 }, to: { x: 0, y: 2000 }, value: 2000 };
    const [l] = layoutCoteLabels([long], tile, (v) => v / 0.3);
    expect(l).toMatchObject({ cy: 1000, text: '200,0 cm' });
    expect(Math.abs(l!.cx)).toBeGreaterThan(l!.w / 2);
  });
});
