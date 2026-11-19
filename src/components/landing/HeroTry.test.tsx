import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./HeroDemo', () => ({ HeroDemo: () => <div data-testid="hero-demo" /> }));

import { HeroTry } from './HeroTry';

describe('Démonstration de la page d’accueil', () => {
  it('« Cliquer pour tester » ouvre l’essai en grand ; fermeture par la croix ou Échap', async () => {
    render(<HeroTry />);
    expect(screen.getByTestId('hero-demo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cliquer pour tester' }));
    const dialog = screen.getByRole('dialog', { name: 'Essai gratuit de CaléPlan' });
    expect(await screen.findByTestId('try-it')).toBeTruthy();
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer l’essai' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cliquer pour tester' }));
    await screen.findByTestId('try-it');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
