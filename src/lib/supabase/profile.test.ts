import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ createClient: () => ({}) }));

import { profilePatchToRow, rowToProfile } from './profile';

describe('profile ↔ colonnes', () => {
  it('convertit une ligne profiles en profil', () => {
    const p = rowToProfile({
      id: 'u1',
      email: 'jean@exemple.fr',
      plan: 'pro',
      project_credits: 2,
      first_name: 'Jean',
      last_name: 'Dupont',
      profile_type: 'artisan',
      newsletter_opt_in: true,
      default_wall_thickness: 120,
    });
    expect(p).toMatchObject({
      plan: 'pro',
      projectCredits: 2,
      firstName: 'Jean',
      lastName: 'Dupont',
      profileType: 'artisan',
      newsletterOptIn: true,
      defaultWallThickness: 120,
      siret: null,
    });
  });

  it('valeurs par défaut prudentes avant la migration 004 (colonnes absentes)', () => {
    const p = rowToProfile({ id: 'u1', plan: 'free' });
    expect(p.plan).toBe('free');
    expect(p.projectCredits).toBe(0);
    expect(p.newsletterOptIn).toBe(false);
    expect(p.firstName).toBeNull();
  });

  it("n'envoie que les colonnes modifiables — jamais plan ni crédits", () => {
    const row = profilePatchToRow({
      firstName: 'Jean',
      siret: '73282932000074',
      newsletterOptIn: false,
      // champs non éditables injectés de force : ignorés
      ...({ plan: 'pro', projectCredits: 99 } as object),
    });
    expect(row).toEqual({ first_name: 'Jean', siret: '73282932000074', newsletter_opt_in: false });
  });
});
