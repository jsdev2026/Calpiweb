import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock child components that use canvas/SVG (not needed for tab logic test)
vi.mock('./TilingCanvas', () => ({ TilingCanvas: () => <div data-testid="tiling-canvas" /> }));
vi.mock('./TilingControls', () => ({ TilingControls: () => <div data-testid="tiling-controls" /> }));
vi.mock('@/components/results/ResultsPanel', () => ({ ResultsPanel: () => <div data-testid="results-panel" /> }));
vi.mock('@/engine/quantities/quantityEngine', () => ({
  analyzeQuantities: () => ({
    tileW: 300, tileH: 300, joint: 3,
    wholeCount: 0, cuts: [], cutGroups: [],
    totalReuseCount: 0, tilesForCuts: 0, totalTiles: 0, toOrder: 0, roomArea: 0,
    tiles: [],
  }),
}));
vi.mock('@/engine/geometry/polygon', () => ({ getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 }) }));

// Resize observer not available in jsdom
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

import { TilingEditor } from './TilingEditor';
import type { TilingConfig } from '@/types/tiling';

const config: TilingConfig = {
  layout: 'STRAIGHT', width: 300, height: 300, joint: 3,
  angle: 0, offsetX: 0, offsetY: 0, stagger: 0, chevronAngle: 45, color: '#ffffff',
};

describe('TilingEditor mobile tabs', () => {
  it('renders Aperçu and Réglages tab buttons on mobile', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    expect(screen.getByRole('button', { name: /Aperçu/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Réglages/i })).toBeDefined();
  });

  it('starts on Aperçu tab (canvas visible, controls hidden)', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    const aperçuBtn = screen.getByRole('button', { name: /Aperçu/i });
    // Aperçu is active by default — button has aria-selected or data-active
    expect(aperçuBtn.getAttribute('data-active')).toBe('true');
  });

  it('switches to Réglages tab on click', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    const reglagesBtn = screen.getByRole('button', { name: /Réglages/i });
    fireEvent.click(reglagesBtn);
    expect(reglagesBtn.getAttribute('data-active')).toBe('true');
  });
});

describe('TilingEditor controls bar', () => {
  it('renders Déc. X and Déc. Y as separate rows', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    expect(screen.getByTestId('dec-x-row')).toBeDefined();
    expect(screen.getByTestId('dec-y-row')).toBeDefined();
  });

  it('controls bar className includes bottom-20', () => {
    render(<TilingEditor rooms={[]} config={config} wallThickness={0} setConfig={() => {}} />);
    const bar = screen.getByTestId('controls-bar');
    expect(bar.className).toContain('bottom-20');
  });
});
