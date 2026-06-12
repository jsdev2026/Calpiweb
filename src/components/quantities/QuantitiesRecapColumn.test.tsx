import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuantitiesRecapColumn } from './QuantitiesRecapColumn';
import type { QuantityResult } from '@/engine/quantities/types';

const makeResult = (overrides: Partial<QuantityResult> = {}): QuantityResult => ({
  tileW: 300,
  tileH: 300,
  joint: 3,
  wholeCount: 10,
  cuts: [],
  cutGroups: [],
  totalReuseCount: 0,
  tilesForCuts: 3,
  totalTiles: 13,
  toOrder: 15,
  margin: 0.05,
  roomArea: 9_500_000,
  tiles: [],
  consumables: {
    colle: { total: 10, bags: 1, bagSize: 25, rendement: 4 },
    joint: { total: 2, bags: 1, bagSize: 5, rendement: 0.4 },
    croisillons: { total: 50, bags: 1, bagSize: 200, rendement: 4 },
  },
  ...overrides,
});

const defaultProps = {
  result: makeResult(),
  marginOverride: undefined as number | undefined,
  onMarginCommit: vi.fn(),
  onMarginReset: vi.fn(),
  consumableParams: undefined,
  onConsumableParamChange: vi.fn(),
};

describe('QuantitiesRecapColumn', () => {
  it('renders the "Total à commander" hero with toOrder value', () => {
    render(<QuantitiesRecapColumn {...defaultProps} />);
    expect(screen.getByText('Total à commander')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
  });

  it('renders the stat list', () => {
    render(<QuantitiesRecapColumn {...defaultProps} />);
    expect(screen.getByText('Carreaux entiers')).toBeDefined();
    expect(screen.getByText('Carreaux à couper')).toBeDefined();
    expect(screen.getByText('Récupérées')).toBeDefined();
  });

  it('opens the margin editor and commits a new value', () => {
    const onMarginCommit = vi.fn();
    render(<QuantitiesRecapColumn {...defaultProps} onMarginCommit={onMarginCommit} />);
    fireEvent.click(screen.getByText('× 5%'));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.blur(input);
    expect(onMarginCommit).toHaveBeenCalledWith(10);
  });

  it('toggles the consumables accordion', () => {
    render(<QuantitiesRecapColumn {...defaultProps} />);
    expect(screen.queryByText('Colle')).toBeNull();
    fireEvent.click(screen.getByText('Consommables'));
    expect(screen.getByText('Colle')).toBeDefined();
  });
});
