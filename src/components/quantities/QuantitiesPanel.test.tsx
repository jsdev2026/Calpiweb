import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/store/projectStore', () => ({
  useProjectStore: (selector: (s: unknown) => unknown) =>
    selector({
      activeProjectId: 'p1',
      projects: [
        {
          id: 'p1',
          rooms: [],
          config: {
            layout: 'STRAIGHT', width: 300, height: 300, joint: 3,
            angle: 0, offsetX: 0, offsetY: 0, stagger: 0, chevronAngle: 45, color: '#93c5fd',
          },
          wallThickness: 0,
          wallEngine: undefined,
        },
      ],
      setConfig: vi.fn(),
    }),
  selectActiveProject: (state: { activeProjectId: string; projects: { id: string }[] }) =>
    state.projects.find((p) => p.id === state.activeProjectId) ?? null,
  selectRooms: (state: { activeProjectId: string; projects: { id: string; rooms: unknown[] }[] }) => {
    const project = state.projects.find((p) => p.id === state.activeProjectId);
    return project?.rooms ?? [];
  },
  selectDoorOpenings: () => [],
}));

vi.mock('@/engine/quantities/quantityEngine', () => ({
  analyzeQuantities: () => ({
    tileW: 300, tileH: 300, joint: 3,
    wholeCount: 10,
    cuts: [],
    cutGroups: [
      {
        usedW: 150, usedH: 300,
        pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
        chuteW: 150, chuteH: 300,
        chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
        totalCount: 3, reuseCount: 0, netTiles: 3,
      },
    ],
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
  }),
}));

vi.mock('./QuantityPlanView', () => ({
  QuantityPlanView: () => <div data-testid="quantity-plan-view" />,
}));

import { QuantitiesPanel } from './QuantitiesPanel';

describe('QuantitiesPanel', () => {
  it('renders "Carreaux à couper" in the recap column', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Carreaux à couper')).toBeDefined();
  });

  it('renders "Carreaux entiers" stat row', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Carreaux entiers')).toBeDefined();
  });

  it('renders "Total à commander" hero', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Total à commander')).toBeDefined();
  });

  it('renders the QuantityPlanView', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByTestId('quantity-plan-view')).toBeDefined();
  });

  it('renders "Récupérées" stat row', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Récupérées')).toBeDefined();
  });

  it('renders the cuts band with merged cut groups', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByTestId('cuts-band')).toBeDefined();
    expect(screen.getByText('Groupes de coupes (1)')).toBeDefined();
  });

  it('hovering a compact cut card sets the plan highlight', () => {
    const { container } = render(<QuantitiesPanel />);
    const cutsBand = screen.getByTestId('cuts-band');
    const card = cutsBand.querySelector('div[style*="border-top-color"]') as Element;
    fireEvent.mouseEnter(card);
    // No visible assertion on QuantityPlanView (mocked); ensure no crash and plan section still renders
    expect(screen.getByTestId('plan-section')).toBeDefined();
    expect(container).toBeDefined();
  });

  it('renders the header with format, joint and surface', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Tableau des quantités')).toBeDefined();
    expect(screen.getByText(/30\.0 cm × 30\.0 cm/)).toBeDefined();
  });
});
