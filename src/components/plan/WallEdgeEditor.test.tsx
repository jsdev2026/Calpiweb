import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { WallEdgeEditor } from './WallEdgeEditor';

const defaultProps = {
  thicknessValue: '20.0',
  onThicknessChange: vi.fn(),
  hasExistingConstraint: false,
  onRelease: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('WallEdgeEditor (thickness-only)', () => {
  it('affiche le champ épaisseur avec la valeur', () => {
    render(<WallEdgeEditor {...defaultProps} />);
    expect(screen.getByDisplayValue('20.0')).toBeInTheDocument();
  });

  it('n\'affiche pas de sélecteur H/V/L', () => {
    render(<WallEdgeEditor {...defaultProps} />);
    // Should NOT have H, V, L constraint type buttons
    expect(screen.queryByTitle('Distance horizontale')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Distance verticale')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Longueur')).not.toBeInTheDocument();
  });

  it('appelle onSubmit sur Enter', async () => {
    const onSubmit = vi.fn();
    render(<WallEdgeEditor {...defaultProps} onSubmit={onSubmit} />);
    const input = screen.getByDisplayValue('20.0');
    await userEvent.type(input, '{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('appelle onCancel sur Escape', async () => {
    const onCancel = vi.fn();
    render(<WallEdgeEditor {...defaultProps} onCancel={onCancel} />);
    const input = screen.getByDisplayValue('20.0');
    await userEvent.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('bouton Libérer visible si hasExistingConstraint=true', () => {
    render(<WallEdgeEditor {...defaultProps} hasExistingConstraint={true} />);
    expect(screen.getByTitle('Libérer la contrainte')).toBeInTheDocument();
  });

  it('bouton Libérer absent si hasExistingConstraint=false', () => {
    render(<WallEdgeEditor {...defaultProps} hasExistingConstraint={false} />);
    expect(screen.queryByTitle('Libérer la contrainte')).not.toBeInTheDocument();
  });
});
