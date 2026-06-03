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
        },
      ],
    }),
  selectActiveProject: (state: { activeProjectId: string; projects: { id: string }[] }) =>
    state.projects.find((p) => p.id === state.activeProjectId) ?? null,
  selectRooms: (state: { activeProjectId: string; projects: { id: string; rooms: unknown[] }[] }) => {
    const project = state.projects.find((p) => p.id === state.activeProjectId);
    return project?.rooms ?? [];
  },
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
    roomArea: 9_500_000,
    tiles: [],
  }),
}));

vi.mock('./QuantityPlanView', () => ({
  QuantityPlanView: () => <div data-testid="quantity-plan-view" />,
}));

import { QuantitiesPanel } from './QuantitiesPanel';

describe('QuantitiesPanel', () => {
  it('renders "Carreaux à couper" (new label replacing "Coupes nécessaires")', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Carreaux à couper')).toBeDefined();
    expect(screen.queryByText('Coupes nécessaires')).toBeNull();
  });

  it('renders "Carreaux entiers" stat box', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Carreaux entiers')).toBeDefined();
  });

  it('renders "Total à commander" in the stat strip', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Total à commander')).toBeDefined();
  });

  it('renders the QuantityPlanView', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByTestId('quantity-plan-view')).toBeDefined();
  });

  it('renders "Récupérées" stat box', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Récupérées')).toBeDefined();
  });

  it('hides and shows the cut groups sidebar', () => {
    render(<QuantitiesPanel />);
    const closeBtn = screen.getByLabelText('Masquer le panneau');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Groupes de coupes')).toBeNull();
    const openBtn = screen.getByLabelText('Afficher le panneau');
    fireEvent.click(openBtn);
    expect(screen.getByText('Groupes de coupes')).toBeDefined();
  });

  it('renders Plan and Coupes mobile tab buttons', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByRole('tab', { name: 'Plan' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Coupes' })).toBeDefined();
  });

  it('plan section is visible by default (no hidden class)', () => {
    render(<QuantitiesPanel />);
    const planSection = screen.getByTestId('plan-section');
    expect(planSection.className).not.toContain('hidden');
  });

  it('clicking Coupes tab adds hidden class to plan section', () => {
    render(<QuantitiesPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Coupes' }));
    const planSection = screen.getByTestId('plan-section');
    expect(planSection.className).toContain('hidden');
  });

  it('clicking Plan tab removes hidden class from plan section', () => {
    render(<QuantitiesPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Coupes' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    const planSection = screen.getByTestId('plan-section');
    expect(planSection.className).not.toContain('hidden');
  });

  it('collapsed-bar is absent by default', () => {
    render(<QuantitiesPanel />);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('coupes scroll > 20px shows collapsed-bar', () => {
    render(<QuantitiesPanel />);
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.getByTestId('collapsed-bar')).toBeDefined();
  });

  it('"▲ Afficher" button restores bandeaux', () => {
    render(<QuantitiesPanel />);
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    fireEvent.click(screen.getByLabelText('Afficher les statistiques'));
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('scroll back to top auto-restores when not pinned', () => {
    render(<QuantitiesPanel />);
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    Object.defineProperty(coupes, 'scrollTop', { value: 0, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('pin prevents auto-collapse on scroll', () => {
    render(<QuantitiesPanel />);
    fireEvent.click(screen.getByLabelText('Épingler les statistiques'));
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
  });

  it('unpinning re-enables auto-collapse on scroll', () => {
    render(<QuantitiesPanel />);
    // Pin first
    fireEvent.click(screen.getByLabelText('Épingler les statistiques'));
    // Scroll while pinned — should NOT collapse
    const coupes = screen.getByTestId('coupes-section');
    Object.defineProperty(coupes, 'scrollTop', { value: 50, writable: true });
    fireEvent.scroll(coupes);
    expect(screen.queryByTestId('collapsed-bar')).toBeNull();
    // Unpin — pin button label should now be "Épingler les statistiques" again
    fireEvent.click(screen.getByLabelText('Désépingler les statistiques'));
    // Now scroll should trigger collapse
    fireEvent.scroll(coupes);
    expect(screen.getByTestId('collapsed-bar')).toBeDefined();
  });
});
