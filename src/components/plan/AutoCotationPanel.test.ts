// src/components/plan/AutoCotationPanel.test.ts
import { describe, it, expect } from 'vitest';
import { computeNewNode2 } from './AutoCotationPanel';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function w(id: string, n1: string, n2: string, t: number): Wall {
  return { id, node1Id: n1, node2Id: n2, thickness: t };
}

// Mur horizontal : node1=(0,0) node2=(200,0) épaisseur=10
const wallH = w('w1', 'n1', 'n2', 10);
const nodesH = [nd('n1', 0, 0), nd('n2', 200, 0)];

describe('computeNewNode2', () => {
  it('exterior — soustrait l\'épaisseur pour trouver node_dist', () => {
    // label ext = node_dist + thickness => on entre 300mm (ext), thickness=10 => node_dist=290
    const result = computeNewNode2(wallH, nodesH, 300, 'exterior');
    expect(result.x).toBeCloseTo(290);
    expect(result.y).toBeCloseTo(0);
  });

  it('interior — ajoute l\'épaisseur pour trouver node_dist', () => {
    // label int = node_dist - thickness => on entre 180mm (int), thickness=10 => node_dist=190
    const result = computeNewNode2(wallH, nodesH, 180, 'interior');
    expect(result.x).toBeCloseTo(190);
    expect(result.y).toBeCloseTo(0);
  });

  it('isolated — node_dist = valeur directe', () => {
    const result = computeNewNode2(wallH, nodesH, 300, 'isolated');
    expect(result.x).toBeCloseTo(300);
    expect(result.y).toBeCloseTo(0);
  });

  it('mur diagonal — direction normalisée respectée', () => {
    // node1=(0,0) node2=(300,400) => len=500, dir=(0.6, 0.8)
    const wallD = w('wd', 'a', 'b', 10);
    const nodesD = [nd('a', 0, 0), nd('b', 300, 400)];
    // exterior, new_label=600 => node_dist=590 => newNode2 = (354, 472)
    const result = computeNewNode2(wallD, nodesD, 600, 'exterior');
    expect(result.x).toBeCloseTo(0.6 * 590, 0);
    expect(result.y).toBeCloseTo(0.8 * 590, 0);
  });
});
