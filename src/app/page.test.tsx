import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PRICE_EXTRA_PROJECT, PRICE_PRO_MONTHLY } from '@/constants/pricing';

vi.mock('@/components/landing/HeroDemo', () => ({ HeroDemo: () => <div /> }));

import LandingPage from './page';

describe('page d’accueil — tarifs', () => {
  it('propose trois offres : Gratuit, À l’unité, Pro', () => {
    render(<LandingPage />);
    const tarifs = document.getElementById('tarifs')!;
    expect(within(tarifs).getByText('Gratuit')).toBeTruthy();
    expect(within(tarifs).getByText('À l’unité'.replace('’', "'"))).toBeTruthy();
    expect(within(tarifs).getByText(PRICE_PRO_MONTHLY)).toBeTruthy();
  });

  it('carte « À l’unité » : prix par projet, sans abonnement, bouton d’achat', () => {
    render(<LandingPage />);
    const card = screen.getByTestId('plan-unit');
    expect(within(card).getByText(PRICE_EXTRA_PROJECT)).toBeTruthy();
    expect(within(card).getByText('TTC / projet')).toBeTruthy();
    expect(within(card).getByText('Sans abonnement')).toBeTruthy();
    const cta = within(card).getByRole('link', { name: 'Acheter un projet' });
    expect(cta.getAttribute('href')).toBe('/auth');
  });
});
