import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { mockResult } = vi.hoisted(() => {
  const mockResult = {
    tileW: 600, tileH: 600, joint: 2,
    wholeCount: 48, cuts: Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`, roomId: 'r1', tileW: 600, tileH: 600,
      usedW: 300, usedH: 600,
      pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
      chuteW: 300, chuteH: 600,
      chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
      chuteArea: 180000, clipCx: 150, clipCy: 300, coveredById: null, reusedForId: null,
    })),
    cutGroups: [{
      usedW: 300, usedH: 600, totalCount: 12, reuseCount: 0, netTiles: 12,
      pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
      chuteW: 300, chuteH: 600,
      chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
    }],
    totalReuseCount: 0, tilesForCuts: 12, totalTiles: 60, toOrder: 66,
    roomArea: 8_500_000, tiles: [],
    margin: 0.05,
    consumables: {
      colle: { total: 34, bags: 2, bagSize: 25, rendement: 4 },
      joint: { total: 0.05, bags: 1, bagSize: 5, rendement: 0.006 },
      croisillons: { total: 72, bags: 1, bagSize: 200, rendement: 1.2 },
    },
  };
  return { mockResult };
});

vi.mock('@/engine/quantities/quantityEngine', () => ({
  analyzeQuantities: vi.fn().mockReturnValue(mockResult),
}));

vi.mock('./QuantityPlanSvg', () => ({
  QuantityPlanSvg: () => <svg data-testid="plan-svg" />,
}));

import { QuantitiesPrintView } from './QuantitiesPrintView';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import type { Project } from '@/types/project';

const baseProject: Project = {
  id: 'p1',
  name: 'Appartement Dupont',
  description: 'Rénovation complète',
  status: 'wip',
  createdAt: 0,
  updatedAt: 0,
  wallThickness: 0,
  constraints: [],
  notes: [],
  config: {
    layout: 'STRAIGHT', width: 600, height: 600, joint: 2,
    angle: 0, offsetX: 0, offsetY: 0, stagger: 0, chevronAngle: 45, color: '#93c5fd',
  },
  rooms: [
    {
      id: 'r1', name: 'Salle de bain', edges: [],
      points: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }],
    },
  ],
};

describe('QuantitiesPrintView', () => {
  it('renders the CaléPlan header with project name', () => {
    render(<QuantitiesPrintView project={baseProject} />);
    expect(screen.getByText('CaléPlan')).toBeDefined();
    expect(screen.getByText('Appartement Dupont')).toBeDefined();
  });

  it('renders client section when client is present', () => {
    const project: Project = {
      ...baseProject,
      client: { name: 'Pierre Dupont', phone: '07 00 00 00 00', email: 'p@d.fr', address: '12 rue de la Paix' },
    };
    render(<QuantitiesPrintView project={project} />);
    expect(screen.getByText('Pierre Dupont')).toBeDefined();
    expect(screen.getByText('07 00 00 00 00')).toBeDefined();
  });

  it('does not render client section when client is absent', () => {
    const { queryByText } = render(<QuantitiesPrintView project={{ ...baseProject, client: undefined }} />);
    expect(queryByText('Client')).toBeNull();
  });

  it('renders room section for each valid room', () => {
    render(<QuantitiesPrintView project={baseProject} />);
    expect(screen.getByText('Salle de bain')).toBeDefined();
  });

  it('skips rooms with fewer than 3 points', () => {
    const project: Project = {
      ...baseProject,
      rooms: [
        { id: 'r1', name: 'Invalide', edges: [], points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
        { id: 'r2', name: 'Valide', edges: [], points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] },
      ],
    };
    render(<QuantitiesPrintView project={project} />);
    expect(screen.queryByText('Invalide')).toBeNull();
    expect(screen.getByText('Valide')).toBeDefined();
  });

  it('skips rooms where analyzeQuantities returns totalTiles === 0', async () => {
    (analyzeQuantities as ReturnType<typeof vi.fn>).mockReturnValueOnce({ ...mockResult, totalTiles: 0 });
    const project: Project = {
      ...baseProject,
      rooms: [
        { id: 'r1', name: 'Vide', edges: [], points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] },
      ],
    };
    render(<QuantitiesPrintView project={project} />);
    expect(screen.queryByText('Vide')).toBeNull();
  });

  it('renders the plan SVG for each valid room', () => {
    const { getAllByTestId } = render(<QuantitiesPrintView project={baseProject} />);
    expect(getAllByTestId('plan-svg').length).toBe(1);
  });

  it('renders stat cards with correct values', () => {
    render(<QuantitiesPrintView project={baseProject} />);
    // toOrder = 66, wholeCount = 48, cuts.length = 12, totalTiles = 60
    // '66' now appears in both the Récapitulatif chantier section AND the stat card — use getAllByText
    expect(screen.getAllByText('66').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('48')).toBeDefined();
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('60')).toBeDefined();
  });

  it('renders cut group table when cutGroups are present', () => {
    render(<QuantitiesPrintView project={baseProject} />);
    expect(screen.getByText('Détail des groupes de coupes')).toBeDefined();
  });

  it('renders footer with CaléPlan watermark', () => {
    render(<QuantitiesPrintView project={baseProject} />);
    expect(screen.getByText(/Document généré par CaléPlan/)).toBeDefined();
  });
});
