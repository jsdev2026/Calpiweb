import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DimensionPopup } from './DimensionPopup';

const defaultProps = {
  fromFace: 'INSIDE' as const,
  toFace: 'OUTSIDE' as const,
  dimType: 'H_DISTANCE' as const,
  onDimTypeChange: vi.fn(),
  value: '285.0',
  onValueChange: vi.fn(),
  hasExistingConstraint: false,
  onRelease: vi.fn(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('DimensionPopup', () => {
  it('affiche le label de référence I→E', () => {
    render(<DimensionPopup {...defaultProps} />);
    expect(screen.getByText('I→E')).toBeInTheDocument();
  });

  it('affiche la valeur pré-remplie', () => {
    render(<DimensionPopup {...defaultProps} />);
    expect(screen.getByDisplayValue('285.0')).toBeInTheDocument();
  });

  it('appelle onSubmit sur Enter', async () => {
    const onSubmit = vi.fn();
    render(<DimensionPopup {...defaultProps} onSubmit={onSubmit} />);
    const input = screen.getByDisplayValue('285.0');
    await userEvent.type(input, '{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('appelle onCancel sur Escape', async () => {
    const onCancel = vi.fn();
    render(<DimensionPopup {...defaultProps} onCancel={onCancel} />);
    const input = screen.getByDisplayValue('285.0');
    await userEvent.type(input, '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('bouton Libérer visible si hasExistingConstraint=true', () => {
    render(<DimensionPopup {...defaultProps} hasExistingConstraint={true} />);
    expect(screen.getByTitle('Libérer la contrainte')).toBeInTheDocument();
  });

  it('bouton Libérer absent si hasExistingConstraint=false', () => {
    render(<DimensionPopup {...defaultProps} hasExistingConstraint={false} />);
    expect(screen.queryByTitle('Libérer la contrainte')).not.toBeInTheDocument();
  });
});
