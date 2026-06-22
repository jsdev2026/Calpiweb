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

  it('renders title and both options', () => {
    render(<UpgradeModal onClose={onClose} />);
    expect(screen.getByText('Limite atteinte')).toBeDefined();
    expect(screen.getByText('+1 projet')).toBeDefined();
    expect(screen.getByText('Illimité')).toBeDefined();
    expect(screen.queryByText(/9 €/)).toBeNull();
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

  it('navigates to /account and calls onClose when Acheter is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Acheter →'));
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to /account and calls onClose when S'abonner is clicked", () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText("S'abonner →"));
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when secondary link is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continuer avec le plan gratuit'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
