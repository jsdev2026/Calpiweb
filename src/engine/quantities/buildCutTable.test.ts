// src/engine/quantities/buildCutTable.test.ts
import { describe, it, expect } from 'vitest';
import { buildCutTable } from './buildCutTable';
import type { Tile } from '@/types/tiling';
import type { Point } from '@/types/plan';

// Pièce carrée 200×200 en CCW
const ROOM: Point[] = [
  { x: 0, y: 0 }, { x: 200, y: 0 },
  { x: 200, y: 200 }, { x: 0, y: 200 },
];

// Pièce 300x1000 en CCW — pour les tuiles CHEVRON (mur vertical à x=300)
const ROOM_CHEVRON: Point[] = [
  { x: 0, y: 0 }, { x: 300, y: 0 },
  { x: 300, y: 1000 }, { x: 0, y: 1000 },
];

describe('buildCutTable', () => {
  it('filtre les tuiles WHOLE et retourne uniquement les CUT', () => {
    const tiles: Tile[] = [
      { id: 'w1', rect: { x: 10, y: 10, w: 60, h: 60 }, type: 'WHOLE' },
      { id: 'c1', rect: { x: 170, y: 10, w: 60, h: 60 }, type: 'CUT' },
    ];
    const result = buildCutTable(tiles, [ROOM], ['r1']);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('c1');
  });

  it('coupe droite à droite : usedW < tileW, bord droit cut, autres factory', () => {
    // Tuile à x=170, largeur 60 → dépasse la pièce de 30px à droite
    const tile: Tile = { id: 't1', rect: { x: 170, y: 50, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.usedW).toBe(30);
    expect(rec!.usedH).toBe(60);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.pieceEdges.left).toBe('factory');
    expect(rec!.pieceEdges.top).toBe('factory');
    expect(rec!.pieceEdges.bottom).toBe('factory');
  });

  it('coupe en coin bas-droit : bords droit et bas cut', () => {
    // Tuile à (170, 170, 60, 60) — dépasse à droite et en bas de 30px chacun
    const tile: Tile = { id: 't2', rect: { x: 170, y: 170, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.pieceEdges.bottom).toBe('cut');
    // Both strips are 30mm wide < MIN_CHUTE_MM=50 → chute not viable
    expect(rec!.chuteArea).toBe(0);
  });

  it('chute de 40 mm (< 50 mm) → chuteW=0, chuteH=0, chuteArea=0', () => {
    // Tuile à x=162, w=60 → partie dans la pièce = 200-162 = 38px, chute = 22px
    const tile: Tile = { id: 't3', rect: { x: 162, y: 50, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.chuteW).toBe(0);
    expect(rec!.chuteH).toBe(0);
    expect(rec!.chuteArea).toBe(0);
  });

  it('chute de 50 mm (≥ 50 mm) → chute renseignée', () => {
    // Tuile à x=150, w=100 → usedW=50, chuteW=50 → exactement viable
    const tile: Tile = { id: 't4', rect: { x: 150, y: 50, w: 100, h: 100 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.chuteW).toBeGreaterThanOrEqual(50);
    expect(rec!.chuteH).toBeGreaterThanOrEqual(50);
    expect(rec!.chuteArea).toBeGreaterThan(0);
  });

  it('tuile chevron 300x600 a 45 degres coupee par un mur vertical (x=300) : repere local', () => {
    // Carreau CHEVRON : eW = points[3]-points[0] = (0,300) -> Wlen=300 (Largeur)
    //                   eH = points[1]-points[0] -> Hlen=600 (Longueur), angle=45deg
    const span = 600 * Math.cos(Math.PI / 4);
    const dy = 600 * Math.sin(Math.PI / 4);
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: span, y: dy },
      { x: span, y: dy + 300 },
      { x: 0, y: 300 },
    ];
    const tile: Tile = {
      id: 'tch1',
      rect: { x: 0, y: 0, w: span, h: dy + 300 },
      type: 'CUT',
      points: pts,
    };
    const [rec] = buildCutTable([tile], [ROOM_CHEVRON], ['r1']);
    expect(rec!.tileW).toBeCloseTo(300, 6);
    expect(rec!.tileH).toBeCloseTo(600, 6);
    expect(rec!.usedW).toBe(300);
    expect(rec!.usedH).toBe(424);
    expect(rec!.chuteW).toBe(300);
    expect(rec!.chuteH).toBeCloseTo(176, 0);
    expect(rec!.pieceEdges.left).toBe('factory');
    expect(rec!.pieceEdges.right).toBe('factory');
    expect(rec!.pieceEdges.top).toBe('factory');
    expect(rec!.pieceEdges.bottom).toBe('cut');
  });

  it('tuile HERRINGBONE H×W : tileW=90, tileH=45 stockés correctement', () => {
    const tile: Tile = {
      id: 't6',
      rect: { x: 170, y: 50, w: 90, h: 45 },
      type: 'CUT',
    };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.tileW).toBe(90);
    expect(rec!.tileH).toBe(45);
  });

  it('coveredById et reusedForId initialisés à null', () => {
    const tile: Tile = { id: 't7', rect: { x: 170, y: 50, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.coveredById).toBeNull();
    expect(rec!.reusedForId).toBeNull();
  });
});
