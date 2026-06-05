import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { UpgradeModal } from './UpgradeModal';

describe('UpgradeModal', () => {
  const onClose = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders title and feature list', () => {
    render(<UpgradeModal onClose={onClose} />);
    expect(screen.getByText('Passez au plan Pro')).toBeDefined();
    expect(screen.getByText('Projets illimités')).toBeDefined();
    expect(screen.getByText('Sauvegarde cloud automatique')).toBeDefined();
    expect(screen.getByText('Accès depuis tous vos appareils')).toBeDefined();
    expect(screen.getByText('9 €/mois — annulation à tout moment')).toBeDefined();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('upgrade-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to /account and calls onClose when CTA is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Voir les offres Pro →'));
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when secondary link is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continuer avec le plan gratuit'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
