import { describe, it, expect } from 'vitest';
import type { Room } from '@/types/project';
import { computeFitView, computeInitialView, visibleCanvasArea } from './PlanEditor';

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

  it("retourne null si les pièces n'ont pas de points", () => {
    const rooms: Room[] = [makeRoom([])];
    expect(computeInitialView(rooms, 800, 600)).toBeNull();
  });

  it('centre la bounding box dans le viewport', () => {
    // Pièce 1000×1000 mm centrée en (500, 500)
    const rooms = [
      makeRoom([
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 },
      ]),
    ];
    const result = computeInitialView(rooms, 800, 600);
    expect(result).not.toBeNull();
    // Centre monde (500, 500) doit mapper au centre viewport (400, 300)
    expect(result!.pan.x + 500 * result!.scale).toBeCloseTo(400);
    expect(result!.pan.y + 500 * result!.scale).toBeCloseTo(300);
  });

  it('scale plafonné à 0.5', () => {
    // Pièce minuscule → scale serait > 0.5 sans cap
    const rooms = [
      makeRoom([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    ];
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

describe('computeFitView', () => {
  it('centre dans la zone visible décalée (offset)', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
    ];
    const v = computeFitView(pts, 375, 500, 0, 40)!;
    expect(v.pan.x + 500 * v.scale).toBeCloseTo(375 / 2);
    expect(v.pan.y + 500 * v.scale).toBeCloseTo(40 + 250);
  });

  it('marge réduite sur petit écran : le plan occupe plus de place', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 4000, y: 4000 },
    ];
    const v = computeFitView(pts, 375, 600)!;
    // ancienne marge fixe de 80 px → 215 px utiles ; désormais > 300 px
    expect(4000 * v.scale).toBeGreaterThan(300);
  });
});

describe('visibleCanvasArea', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;

  function setup(overlays: DOMRect[]) {
    const container = document.createElement('div');
    container.getBoundingClientRect = () => rect(0, 100, 375, 700);
    for (const r of overlays) {
      const el = document.createElement('div');
      el.setAttribute('data-canvas-overlay', '');
      el.getBoundingClientRect = () => r;
      container.appendChild(el);
    }
    return container;
  }

  it('retire la barre d’outils / le panneau en bas de l’écran (smartphone)', () => {
    const area = visibleCanvasArea(setup([rect(0, 700, 375, 100)]));
    expect(area).toEqual({ x: 0, y: 0, w: 375, h: 600 });
  });

  it('ignore les éléments masqués', () => {
    const area = visibleCanvasArea(setup([rect(0, 0, 0, 0)]));
    expect(area.h).toBe(700);
  });

  it('retire un panneau latéral haut (ordinateur), pas un panneau replié', () => {
    const c = document.createElement('div');
    c.getBoundingClientRect = () => rect(0, 0, 1200, 800);
    const side = document.createElement('div');
    side.setAttribute('data-canvas-overlay', '');
    side.getBoundingClientRect = () => rect(850, 12, 340, 776);
    const collapsed = document.createElement('div');
    collapsed.setAttribute('data-canvas-overlay', '');
    collapsed.getBoundingClientRect = () => rect(868, 12, 320, 54);
    c.append(side, collapsed);
    expect(visibleCanvasArea(c).w).toBe(850);
  });
});
