import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import robots from './robots';
import sitemap from './sitemap';
import { metadata } from './layout';
import { FAQ, LandingFaq, StructuredData, structuredData } from '@/components/landing/seo';
import { SITE_URL } from '@/constants/site';
import { SITE_URL as CONFIG_SITE_URL } from '../../next.config.mjs';

vi.mock('next/font/local', () => ({ default: () => ({ variable: '' }) }));

describe('référencement', () => {
  it('une seule adresse officielle, la même partout', () => {
    expect(SITE_URL).toBe('https://www.caleplan.com');
    expect(CONFIG_SITE_URL).toBe(SITE_URL);
    expect(String(metadata.metadataBase)).toBe('https://www.caleplan.com/');
  });

  it('robots.txt : site public indexable, pages du compte exclues, plan du site annoncé', () => {
    const r = robots();
    expect(r.sitemap).toBe('https://www.caleplan.com/sitemap.xml');
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rule.allow).toBe('/');
    expect(rule.disallow).toEqual(['/dashboard', '/project', '/settings', '/account', '/auth']);
  });

  it('plan du site : la page d’accueil', () => {
    expect(sitemap().map((e) => e.url)).toEqual(['https://www.caleplan.com/']);
  });

  it('titre et description de la page d’accueil', () => {
    const title = metadata.title as { default: string; template: string };
    expect(title.default).toMatch(/^Calepinage carrelage en ligne gratuit.*\| CaléPlan$/);
    expect(title.template).toBe('%s | CaléPlan');
    expect(metadata.description!.length).toBeLessThanOrEqual(170);
    expect(metadata.openGraph).toMatchObject({ locale: 'fr_FR', siteName: 'CaléPlan' });
  });

  it('données structurées : logiciel avec ses offres et FAQ identique à celle affichée', () => {
    const [app, faq] = structuredData() as unknown as [
      { offers: { price: string }[] },
      { mainEntity: { name: string; acceptedAnswer: { text: string } }[] },
    ];
    expect(app.offers.map((o) => o.price)).toEqual(['0', '1.99', '6.90']);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(FAQ.map((f) => f.q));

    render(
      <>
        <LandingFaq />
        <StructuredData />
      </>,
    );
    const section = screen.getByRole('region', { name: 'Tout savoir sur le calepinage' });
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(FAQ.length);
    fireEvent.click(within(section).getByText(FAQ[0]!.q));
    expect(within(section).getByText(FAQ[0]!.a)).toBeTruthy();
    const json = document.querySelector('script[type="application/ld+json"]')!.textContent!;
    expect(JSON.parse(json)).toEqual(structuredData());
  });
});
