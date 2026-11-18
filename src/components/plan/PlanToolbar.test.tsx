import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelStore } from '@/store/panelStore';

vi.mock('./PlanRoomsList', () => ({
  PlanRoomsList: () => <div data-testid="rooms-list" />,
}));

import { PlanToolbar } from './PlanToolbar';

const defaultProps = {
  tool: 'SELECT' as const,
  canUndo: false,
  canRedo: false,
  onChangeTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  wallThickness: 100,
  onWallThicknessChange: vi.fn(),
};

beforeEach(() => {
  act(() => usePanelStore.setState({ collapsed: false, mobileOpen: false }));
});

/** Rangée d'icônes smartphone = premier bloc de la barre toujours visible */
const mobileRow = () => {
  const panel = screen.getByTestId('plan-toolbar');
  return within(panel.querySelector('.mouse\\:hidden.md\\:hidden.flex') as HTMLElement);
};

describe('PlanToolbar — panneau latéral Plan 2D', () => {
  it('affiche l’en-tête du mode et l’outil actif', () => {
    render(<PlanToolbar {...defaultProps} tool="WALL" />);
    expect(screen.getByText('Plan 2D')).toBeTruthy();
    expect(screen.getAllByText('Cliquez pour poser un point').length).toBeGreaterThan(0);
  });

  it('smartphone : les outils restent accessibles, panneau replié', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    fireEvent.click(mobileRow().getByRole('button', { name: 'Tracer des murs' }));
    expect(onChangeTool).toHaveBeenCalledWith('WALL');
    fireEvent.click(mobileRow().getByRole('button', { name: 'Verrouiller' }));
    expect(onChangeTool).toHaveBeenCalledWith('LOCK');
  });

  it('outil actif signalé (aria-pressed), suppression en rouge', () => {
    render(<PlanToolbar {...defaultProps} tool="DELETE" />);
    const del = mobileRow().getByRole('button', { name: 'Mode suppression' });
    expect(del.getAttribute('aria-pressed')).toBe('true');
    expect(del.style.color).toBe('rgb(220, 38, 38)');
  });

  it('annuler / rétablir désactivés sans historique', () => {
    const onUndo = vi.fn();
    render(<PlanToolbar {...defaultProps} canUndo onUndo={onUndo} />);
    fireEvent.click(mobileRow().getByRole('button', { name: 'Annuler' }));
    expect(onUndo).toHaveBeenCalled();
    expect(
      (mobileRow().getByRole('button', { name: 'Rétablir' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('sections Épaisseur des murs et Pièces dans le panneau', () => {
    render(<PlanToolbar {...defaultProps} />);
    expect(screen.getByText('Épaisseur des murs', { selector: 'h3' })).toBeTruthy();
    expect(screen.getByTestId('rooms-list')).toBeTruthy();
  });

  it('barre repliée (ordinateur) : choisir un outil sans déplier le panneau', () => {
    act(() => usePanelStore.setState({ collapsed: true }));
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const rail = screen.getByRole('navigation', { name: /Plan 2D/ });
    fireEvent.click(within(rail).getByRole('button', { name: 'Porte / Ouverture' }));
    expect(onChangeTool).toHaveBeenCalledWith('DOOR');
    expect(usePanelStore.getState().collapsed).toBe(true);
  });

  it('lecture seule : pas d’outils de dessin', () => {
    render(<PlanToolbar {...defaultProps} readOnly />);
    expect(screen.queryByRole('button', { name: 'Tracer des murs' })).toBeNull();
    expect(screen.getByTestId('rooms-list')).toBeTruthy();
  });
});
