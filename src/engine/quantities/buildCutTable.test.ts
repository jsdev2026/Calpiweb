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
    // Tuile à (170, 170, 60, 60) — dépasse à droite et en bas
    const tile: Tile = { id: 't2', rect: { x: 170, y: 170, w: 60, h: 60 }, type: 'CUT' };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.pieceEdges.bottom).toBe('cut');
    expect(rec!.chuteArea).toBeGreaterThan(0);
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

  it('tuile chevron avec tile.points : clipping sur le parallélogramme réel', () => {
    // Parallélogramme qui dépasse la pièce à droite (x > 200)
    const pts: Point[] = [
      { x: 160, y: 50 },
      { x: 210, y: 50 },
      { x: 210, y: 110 },
      { x: 160, y: 110 },
    ];
    const tile: Tile = {
      id: 't5',
      rect: { x: 160, y: 50, w: 50, h: 60 },
      type: 'CUT',
      points: pts,
    };
    const [rec] = buildCutTable([tile], [ROOM], ['r1']);
    expect(rec!.pieceEdges.right).toBe('cut');
    expect(rec!.usedW).toBeLessThan(50);
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
