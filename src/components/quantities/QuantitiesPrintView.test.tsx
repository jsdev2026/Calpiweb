import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const { mockResult, startMark } = vi.hoisted(() => {
  const mockResult = {
    tileW: 600,
    tileH: 600,
    joint: 2,
    wholeCount: 48,
    cuts: Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      roomId: 'r1',
      tileW: 600,
      tileH: 600,
      usedW: 300,
      usedH: 600,
      pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
      chuteW: 300,
      chuteH: 600,
      chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
      chuteArea: 180000,
      clipCx: 150,
      clipCy: 300,
      coveredById: null,
      reusedForId: null,
    })),
    cutGroups: [
      {
        usedW: 300,
        usedH: 600,
        totalCount: 12,
        reuseCount: 3,
        netTiles: 9,
        pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
        chuteW: 300,
        chuteH: 600,
        chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
      },
    ],
    totalReuseCount: 3,
    tilesForCuts: 9,
    totalTiles: 60,
    toOrder: 66,
    roomArea: 8_500_000,
    tiles: [],
    margin: 0.05,
    consumables: {
      colle: { total: 34, bags: 2, bagSize: 25, rendement: 4 },
      joint: { total: 0.05, bags: 1, bagSize: 5, rendement: 0.006 },
      croisillons: { total: 72, bags: 1, bagSize: 200, rendement: 1.2 },
    },
  };
  const startMark = {
    roomId: 'r1',
    tile: [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 600 },
      { x: 0, y: 600 },
    ],
    corner: { x: 0, y: 0 },
    secondCorner: { x: 600, y: 0 },
    roomCorner: { x: 0, y: 0 },
    cotes: [
      { from: { x: 0, y: 300 }, to: { x: 125, y: 300 }, value: 125 },
      { from: { x: 300, y: 0 }, to: { x: 300, y: 80 }, value: 80 },
      { from: { x: 900, y: 0 }, to: { x: 900, y: 82 }, value: 82 },
    ],
    manual: false,
  };
  return { mockResult, startMark };
});

vi.mock('@/engine/quantities/quantityEngine', () => ({
  analyzeQuantities: vi.fn().mockReturnValue(mockResult),
}));

vi.mock('@/engine/tiling/startTile', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  computeStartTiles: vi.fn().mockReturnValue([startMark]),
}));

vi.mock('./QuantityPrintPlan', () => ({
  QuantityPrintPlan: () => <svg data-testid="plan-svg" />,
}));

import { QuantitiesPrintView } from './QuantitiesPrintView';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import type { Project } from '@/types/project';

const square = (id: string, name: string, size = 3000) => ({
  id,
  name,
  edges: [],
  points: [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ],
});

const baseProject: Project = {
  id: 'ab12cd34-0000',
  name: 'Appartement Dupont',
  description: 'Rénovation complète',
  status: 'wip',
  createdAt: new Date('2026-03-02T10:00:00Z').getTime(),
  updatedAt: 0,
  wallThickness: 0,
  constraints: [],
  notes: [],
  config: {
    layout: 'STRAIGHT',
    width: 600,
    height: 600,
    joint: 2,
    angle: 0,
    offsetX: 0,
    offsetY: 0,
    stagger: 0,
    chevronAngle: 45,
    color: '#93c5fd',
  },
  rooms: [square('r1', 'Salle de bain')],
};

const NOW = new Date('2026-11-18T10:00:00Z');
const view = (
  p: Partial<Project> = {},
  extra: Partial<Parameters<typeof QuantitiesPrintView>[0]> = {},
) => render(<QuantitiesPrintView project={{ ...baseProject, ...p }} now={NOW} {...extra} />);

describe('QuantitiesPrintView — en-tête et marque', () => {
  it('titre, projet, référence, date et marque CaléPlan', () => {
    view();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Quantitatif de calepinage' }),
    ).toBeTruthy();
    expect(screen.getByText('Appartement Dupont')).toBeTruthy();
    expect(screen.getByText('CP-2026-AB12CD')).toBeTruthy();
    expect(screen.getByText('18 novembre 2026')).toBeTruthy();
    // En-tête de la page 1 + pied de chaque page (2 pages)
    expect(screen.getAllByTestId('print-brand').length).toBe(3);
  });

  it('coordonnées de l’entreprise en tête', () => {
    view(
      {},
      {
        company: {
          name: 'Martin Carrelage',
          logoUrl: null,
          address: '4 avenue Jean Jaurès, 69007 Lyon',
          phone: '04 78 00 00 00',
          email: null,
          siret: '812 345 678 00019',
        },
      },
    );
    const block = screen.getByTestId('print-company');
    expect(within(block).getByText('Martin Carrelage')).toBeTruthy();
    expect(within(block).getByText('SIRET 812 345 678 00019')).toBeTruthy();
  });

  it('client affiché s’il est renseigné, sinon un tiret', () => {
    const { unmount } = view({
      client: {
        name: 'Pierre Dupont',
        phone: '07 00 00 00 00',
        email: 'p@d.fr',
        address: '12 rue de la Paix',
      },
    });
    const client = screen.getByTestId('print-client');
    expect(within(client).getByText('Pierre Dupont')).toBeTruthy();
    expect(within(client).getByText('07 00 00 00 00 · p@d.fr')).toBeTruthy();
    expect(screen.getByText('12 rue de la Paix')).toBeTruthy();
    unmount();
    view({ client: undefined });
    expect(within(screen.getByTestId('print-client')).getByText('—')).toBeTruthy();
  });
});

describe('QuantitiesPrintView — synthèse', () => {
  it('chiffres clés et liste de commande', () => {
    view();
    const figures = screen.getByTestId('print-key-figures');
    expect(within(figures).getByText('8,50 m²')).toBeTruthy();
    expect(within(figures).getByText('60')).toBeTruthy();
    expect(within(figures).getByText('12')).toBeTruthy();
    expect(within(figures).getByText('66')).toBeTruthy();

    const rows = within(screen.getByTestId('print-order')).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      'DésignationCaractéristiquesQuantitéUnité',
      'Carreaux 60,0 × 60,0 cmSoit 23,76 m² · marge 5 % incluse66carreaux',
      'Mortier-colleSac de 25 kg · 4,0 kg/m²2sacs',
      'Mortier jointSac de 5 kg · joint 2 mm1sac',
      'Croisillons 2 mmSachet de 200 · 72 pièces1sachet',
    ]);
  });

  it('répartition par pièce avec renvoi de page', () => {
    view();
    const rows = within(screen.getByTestId('print-rooms')).getAllByRole('row');
    expect(rows[1]!.textContent).toBe('Salle de bain8,50 m²4812602');
    expect(rows[2]!.textContent).toMatch(/^Total/);
  });

  it('bloc observations et bon pour accord', () => {
    view();
    expect(
      within(screen.getByTestId('print-approval')).getByText(
        'Bon pour accord — date et signature du client',
      ),
    ).toBeTruthy();
  });
});

describe('QuantitiesPrintView — pages des pièces', () => {
  it('une page par pièce valide, numérotées', () => {
    view({ rooms: [square('r1', 'Séjour'), square('r2', 'Cuisine')] });
    expect(screen.getAllByTestId('print-sheet').length).toBe(3);
    expect(screen.getAllByTestId('plan-svg').length).toBe(2);
    expect(screen.getByRole('heading', { level: 2, name: /^1\.\s*Séjour$/ })).toBeTruthy();
    expect(screen.getByText('Page 3 / 3')).toBeTruthy();
  });

  it('ignore les pièces invalides et celles sans carreau', () => {
    (analyzeQuantities as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ ...mockResult, totalTiles: 0 })
      .mockReturnValueOnce(mockResult);
    view({
      rooms: [
        {
          id: 'x',
          name: 'Invalide',
          edges: [],
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        },
        square('r1', 'Vide'),
        square('r2', 'Valide'),
      ],
    });
    expect(screen.queryByText('Invalide')).toBeNull();
    expect(screen.queryByText('Vide')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: /^1\.\s*Valide$/ })).toBeTruthy();
  });

  it('tableau des coupes : repère, dimension, nombre, réemploi des chutes', () => {
    view();
    const rows = within(screen.getByTestId('print-cuts')).getAllByRole('row');
    expect(rows[1]!.textContent).toBe('130,0 cm × 60,0 cm12330,0 cm × 60,0 cm');
  });

  it('implantation du carreau de départ seulement si elle est activée', () => {
    const { unmount } = view();
    expect(screen.queryByTestId('print-implantation')).toBeNull();
    unmount();
    view({ config: { ...baseProject.config, showStartTile: true } });
    const rows = within(screen.getByTestId('print-implantation')).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      'Coin 1 → mur de gauche12,5 cm',
      'Coin 1 → mur du haut8,0 cm',
      'Coin 2 → mur du haut8,2 cm',
    ]);
  });
});

describe('QuantitiesPrintView — charte', () => {
  it('pas d’aplats de couleur : seulement du noir, des gris et l’orange CaléPlan', () => {
    const { container } = view({ config: { ...baseProject.config, showStartTile: true } });
    const allowed = new Set([
      '#111827',
      '#374151',
      '#6b7280',
      '#9ca3af',
      '#d1d5db',
      '#e5e7eb',
      '#4b5563',
      '#fff',
      '#ffffff',
      '#e8671a',
      '#fef3ec',
    ]);
    const html = container.innerHTML.toLowerCase();
    const colors = new Set(html.match(/#[0-9a-f]{3,8}\b/g) ?? []);
    const rgb = html.match(/rgb\((\d+), (\d+), (\d+)\)/g) ?? [];
    const toHex = (s: string) =>
      '#' +
      s
        .match(/\d+/g)!
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('');
    for (const c of [...colors, ...rgb.map(toHex)]) expect(allowed).toContain(c);
  });
});
