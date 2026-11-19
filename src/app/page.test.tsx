import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('les tarifs sont accessibles dès le haut de page, y compris sur smartphone', () => {
    render(<LandingPage />);
    const nav = screen.getByTestId('nav-tarifs');
    expect(nav.getAttribute('href')).toBe('#tarifs');
    expect(nav.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    const recap = screen.getByTestId('hero-pricing');
    expect(recap.getAttribute('href')).toBe('#tarifs');
    expect(recap.textContent).toContain(PRICE_EXTRA_PROJECT);
    expect(recap.textContent).toContain(PRICE_PRO_MONTHLY);
  });

  it('tarifs particuliers TTC par défaut, professionnels HT au choix', () => {
    render(<LandingPage />);
    const tarifs = document.getElementById('tarifs')!;
    const pro = () => within(tarifs).getByText(/(6,90|9,80) €/).parentElement!.textContent;
    expect(pro()).toContain('6,90 €TTC / mois');
    expect(within(screen.getByTestId('plan-unit')).getByText('TTC / projet')).toBeTruthy();
    fireEvent.click(within(tarifs).getByRole('radio', { name: 'Professionnel' }));
    expect(pro()).toContain('9,80 €HT / mois');
    expect(within(screen.getByTestId('plan-unit')).getByText('HT / projet')).toBeTruthy();
    expect(within(tarifs).getByText(/Prix hors taxes/)).toBeTruthy();
  });
});
