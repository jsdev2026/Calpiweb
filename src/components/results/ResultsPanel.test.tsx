import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultsPanel } from './ResultsPanel';
import type { QuantityResult, CutRecord } from '@/engine/quantities/quantityEngine';

const makeResult = (overrides: Partial<QuantityResult> = {}): QuantityResult => ({
  tileW: 300, tileH: 300, joint: 3,
  wholeCount: 10,
  cuts: Array(3).fill({} as CutRecord) as QuantityResult['cuts'],
  cutGroups: [],
  totalReuseCount: 2,
  tilesForCuts: 3,
  totalTiles: 13,
  toOrder: 15,
  roomArea: 9_500_000,
  tiles: [],
  margin: 0.05,
  consumables: {
    colle: { total: 0, bags: 0, bagSize: 25, rendement: 4 },
    joint: { total: 0, bags: 0, bagSize: 5, rendement: 0 },
    croisillons: { total: 0, bags: 0, bagSize: 200, rendement: 1.2 },
  },
  ...overrides,
});

describe('ResultsPanel', () => {
  it('shows Quantitatif heading', () => {
    render(<ResultsPanel result={makeResult()} />);
    expect(screen.getByText('Quantitatif')).toBeDefined();
  });

  it('shows wholeCount, cuts.length, totalReuseCount, toOrder', () => {
    render(<ResultsPanel result={makeResult()} />);
    expect(screen.getByText('10')).toBeDefined();       // wholeCount
    expect(screen.getByText('3')).toBeDefined();        // cuts.length
    expect(screen.getByText('2')).toBeDefined();        // totalReuseCount
    expect(screen.getByText('15')).toBeDefined();       // toOrder
    expect(screen.getByText('9.50 m²')).toBeDefined(); // surface
  });

  it('shows toOrder tile surface in m²', () => {
    render(<ResultsPanel result={makeResult()} />);
    // toOrder=15, tileW=300, tileH=300 → 15 × 300 × 300 = 1 350 000 mm² = 1.35 m²
    expect(screen.getByText('1.35 m²')).toBeDefined();
  });

  it('shows empty state when totalTiles is 0', () => {
    render(<ResultsPanel result={makeResult({ totalTiles: 0, roomArea: 0 })} />);
    expect(screen.getByText(/Tracez une pièce/i)).toBeDefined();
  });
});
