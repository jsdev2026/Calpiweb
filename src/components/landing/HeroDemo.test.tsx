import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroDemo, HeroDemoFrame } from './HeroDemo';

describe('HeroDemo', () => {
  it('affiche chaque étape selon le temps', () => {
    const { rerender } = render(<HeroDemoFrame t={1} />);
    expect(screen.getByTestId('hero-demo').getAttribute('data-scene')).toBe('PLAN');
    expect(screen.getByText('Plan 2D')).toBeTruthy();
    rerender(<HeroDemoFrame t={6} />);
    expect(screen.getByText('Calepinage')).toBeTruthy();
    rerender(<HeroDemoFrame t={13} />);
    expect(screen.getByText('172')).toBeTruthy();
    expect(screen.getByText('Exporter en PDF')).toBeTruthy();
  });

  it('animations réduites : image fixe du quantitatif complet', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    render(<HeroDemo />);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(screen.getByTestId('hero-demo').getAttribute('data-scene')).toBe('QUANTITIES');
    expect(screen.getByRole('img', { name: /Démonstration/ })).toBeTruthy();
  });
});
