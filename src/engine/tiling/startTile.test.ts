import { describe, expect, it } from 'vitest';
import type { Room } from '@/types/project';
import type { Tile, TilingConfig } from '@/types/tiling';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { computeStartTiles, formatCote, pickStartTile } from './startTile';

// Pièce 3000 × 2000 (axes des murs), murs de 100 → faces intérieures de 50 à 2950 / 50 à 1950
const room: Room = {
  id: 'r1',
  points: [
    { x: 0, y: 0 },
    { x: 3000, y: 0 },
    { x: 3000, y: 2000 },
    { x: 0, y: 2000 },
  ],
  edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  partitions: [],
  excludedZones: [],
};

const cfg = (patch: Partial<TilingConfig> = {}): TilingConfig => ({
  ...DEFAULT_TILING_CONFIG,
  width: 600,
  height: 600,
  joint: 3,
  angle: 0,
  ...patch,
});

const tile = (x: number, y: number, type: Tile['type'] = 'WHOLE'): Tile => ({
  id: `${x}-${y}`,
  rect: { x, y, w: 600, h: 600 },
  type,
});

describe('computeStartTiles', () => {
  it('choisit le carreau entier le plus proche de l’angle haut-gauche et le cote aux deux murs', () => {
    const tiles = [
      tile(-200, -200, 'CUT'), // coupé dans l'angle
      tile(400, 150),
      tile(150, 400),
      tile(1200, 1200),
    ];
    const [m] = computeStartTiles([room], tiles, cfg(), 100);
    expect(m).toBeDefined();
    // Coin le plus proche de (50, 50) : (150, 400) → d ≈ 364 ; (400, 150) → d ≈ 364 aussi ;
    // le premier rencontré gagne, mais les deux cotes doivent valoir la distance aux murs.
    const values = m!.cotes.map((c) => Math.round(c.value)).sort((a, b) => a - b);
    expect(values).toEqual([100, 350]);
    expect(m!.roomCorner).toEqual({ x: 50, y: 50 });
  });

  it('cotes perpendiculaires : pied de la cote sur la face intérieure du mur', () => {
    const [m] = computeStartTiles([room], [tile(300, 200)], cfg(), 100);
    const feet = m!.cotes.map((c) => c.from);
    expect(feet).toContainEqual({ x: 300, y: 50 }); // mur du haut
    expect(feet).toContainEqual({ x: 50, y: 200 }); // mur de gauche
    expect(m!.corner).toEqual({ x: 300, y: 200 });
  });

  it('aucun carreau entier dans la pièce → pas de repère', () => {
    expect(computeStartTiles([room], [tile(0, 0, 'CUT')], cfg(), 100)).toHaveLength(0);
  });

  it('pose tournée : le contour du carreau est exprimé dans le repère monde', () => {
    const [m] = computeStartTiles([room], [tile(1200, 700)], cfg({ angle: 45 }), 100);
    expect(m).toBeDefined();
    // Le carreau est tourné : ses côtés ne sont plus alignés sur les axes
    const [a, b] = m!.tile;
    expect(Math.abs(a!.x - b!.x)).toBeGreaterThan(1);
    expect(Math.abs(a!.y - b!.y)).toBeGreaterThan(1);
  });
});

describe('formatCote', () => {
  it('formate en cm avec une décimale', () => {
    expect(formatCote(325)).toBe('32,5 cm');
    expect(formatCote(1000)).toBe('100,0 cm');
  });
});

describe('carreau de départ choisi par l’utilisateur', () => {
  it('pickStartTile mémorise le centre du carreau touché, moins le décalage de pose', () => {
    const tiles = [tile(300, 200), tile(1200, 700)];
    const picked = pickStartTile(
      { x: 1400, y: 900 },
      [room],
      tiles,
      cfg({ offsetX: 40, offsetY: 10 }),
    );
    expect(picked).toEqual({ x: 1500 - 40, y: 1000 - 10 });
  });

  it('pickStartTile renvoie null hors des carreaux', () => {
    expect(pickStartTile({ x: 5000, y: 5000 }, [room], [tile(300, 200)], cfg())).toBeNull();
  });

  it('le carreau choisi est coté depuis l’angle de la pièce le plus proche', () => {
    // Carreau près de l'angle bas-droite (2950, 1950)
    const tiles = [tile(300, 200), tile(2200, 1200)];
    const [m] = computeStartTiles(
      [room],
      tiles,
      cfg({ startTile: { x: 2500, y: 1500 }, offsetX: 0, offsetY: 0 }),
      100,
    );
    expect(m!.manual).toBe(true);
    expect(m!.roomCorner).toEqual({ x: 2950, y: 1950 });
    expect(m!.corner).toEqual({ x: 2800, y: 1800 });
    expect(m!.cotes.map((c) => Math.round(c.value)).sort((a, b) => a - b)).toEqual([150, 150]);
  });

  it('le choix suit la pose quand on la fait glisser (décalage)', () => {
    // Le carreau choisi (centre 2500,1500 à décalage nul) se retrouve en 2600,1550
    const tiles = [tile(2300, 1250), tile(2200, 1200, 'OUTSIDE')];
    const [m] = computeStartTiles(
      [room],
      tiles,
      cfg({ startTile: { x: 2500, y: 1500 }, offsetX: 100, offsetY: 50 }),
      100,
    );
    expect(m!.manual).toBe(true);
    expect(m!.tile[0]).toEqual({ x: 2300, y: 1250 });
  });
});
