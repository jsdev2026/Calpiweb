import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

describe('horloge de l’animation', () => {
  it('avance en temps réel même à faible cadence d’images', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    render(<HeroDemo />);
    // 3 images par seconde pendant 6 s → le scénario doit être au Calepinage (≥ 4,6 s)
    act(() => {
      for (let i = 0; i <= 18; i++) frames.shift()?.(i * 333);
    });
    expect(screen.getByTestId('hero-demo').getAttribute('data-scene')).toBe('TILING');
    raf.mockRestore();
  });
});
