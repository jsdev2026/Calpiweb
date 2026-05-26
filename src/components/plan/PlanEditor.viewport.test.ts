import { describe, it, expect } from 'vitest';
import type { Room } from '@/types/project';
import { computeInitialView } from './PlanEditor';

const makeRoom = (pts: { x: number; y: number }[]): Room => ({
  id: 'r1',
  points: pts,
  edges: pts.map(() => 'WALL' as const),
  partitions: [],
  excludedZones: [],
});

describe('computeInitialView', () => {
  it('retourne null si aucune pièce', () => {
    expect(computeInitialView([], 800, 600)).toBeNull();
  });

  it('retourne null si les pièces n\'ont pas de points', () => {
    const rooms: Room[] = [makeRoom([])];
    expect(computeInitialView(rooms, 800, 600)).toBeNull();
  });

  it('centre la bounding box dans le viewport', () => {
    // Pièce 1000×1000 mm centrée en (500, 500)
    const rooms = [makeRoom([
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { x: 1000, y: 1000 }, { x: 0, y: 1000 },
    ])];
    const result = computeInitialView(rooms, 800, 600);
    expect(result).not.toBeNull();
    // Centre monde (500, 500) doit mapper au centre viewport (400, 300)
    expect(result!.pan.x + 500 * result!.scale).toBeCloseTo(400);
    expect(result!.pan.y + 500 * result!.scale).toBeCloseTo(300);
  });

  it('scale plafonné à 0.5', () => {
    // Pièce minuscule → scale serait > 0.5 sans cap
    const rooms = [makeRoom([
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 10 }, { x: 0, y: 10 },
    ])];
    const result = computeInitialView(rooms, 800, 600);
    expect(result!.scale).toBeLessThanOrEqual(0.5);
  });

  it('gère un seul point (bbox dégénérée → fallback 1000×1000)', () => {
    const rooms = [makeRoom([{ x: 500, y: 400 }])];
    const result = computeInitialView(rooms, 800, 600);
    expect(result).not.toBeNull();
    expect(result!.scale).toBeGreaterThan(0);
  });
});
