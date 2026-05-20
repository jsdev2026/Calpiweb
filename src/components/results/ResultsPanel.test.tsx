import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultsPanel } from './ResultsPanel';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';

const makeResult = (overrides: Partial<QuantityResult> = {}): QuantityResult => ({
  tileW: 300, tileH: 300, joint: 3,
  wholeCount: 10,
  cuts: Array.from({ length: 3 }) as QuantityResult['cuts'],
  cutGroups: [],
  totalReuseCount: 2,
  tilesForCuts: 3,
  totalTiles: 13,
  toOrder: 15,
  roomArea: 9.5,
  tiles: [],
  ...overrides,
});

describe('ResultsPanel', () => {
  it('shows Quantitatif heading', () => {
    render(<ResultsPanel result={makeResult()} />);
    expect(screen.getByText('Quantitatif')).toBeDefined();
  });

  it('shows wholeCount, cuts.length, totalReuseCount, toOrder', () => {
    render(<ResultsPanel result={makeResult()} />);
    expect(screen.getByText('10')).toBeDefined();  // wholeCount
    expect(screen.getByText('3')).toBeDefined();   // cuts.length
    expect(screen.getByText('2')).toBeDefined();   // totalReuseCount
    expect(screen.getByText('15')).toBeDefined();  // toOrder
  });

  it('shows empty state when totalTiles is 0', () => {
    render(<ResultsPanel result={makeResult({ totalTiles: 0, roomArea: 0 })} />);
    expect(screen.getByText(/Tracez une pièce/i)).toBeDefined();
  });
});
