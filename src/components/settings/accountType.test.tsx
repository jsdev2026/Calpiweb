import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { UserProfile } from '@/types/profile';

const update = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/profile', () => ({
  profileDb: {
    update,
    changeEmail: vi.fn(),
    logoUrl: () => null,
    uploadLogo: vi.fn(),
    removeLogo: vi.fn(),
  },
}));

import { ProfileTab } from './ProfileTab';
import { CompanyTab } from './CompanyTab';
import { PlanTab } from './PlanTab';

const base: UserProfile = {
  id: 'u1',
  email: 'jean@exemple.fr',
  plan: 'free',
  projectCredits: 0,
  displayName: 'Jean Dupont',
  firstName: 'Jean',
  lastName: 'Dupont',
  phone: null,
  profileType: 'particulier',
  companyName: null,
  siret: null,
  vatNumber: null,
  addressLine: null,
  postalCode: null,
  city: null,
  interventionArea: null,
  companySize: null,
  monthlyJobs: null,
  acquisitionSource: null,
  newsletterOptIn: false,
  newsletterOptInAt: null,
  logoPath: null,
  defaultTileConfig: null,
  defaultWallThickness: null,
  tileFormats: null,
};
const company = {
  companyName: 'Dupont Carrelage',
  siret: '73282932000074',
  addressLine: '12 rue des Lilas',
  postalCode: '69003',
  city: 'Lyon',
};

beforeEach(() => update.mockReset().mockResolvedValue(undefined));

const save = () => fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

describe('Paramètres — passage en compte professionnel', () => {
  it('particulier → professionnel : activité puis société obligatoires', async () => {
    render(<ProfileTab profile={base} onSaved={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /^Particulier/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: /^Professionnel/ }));
    const box = screen.getByTestId('pro-account');
    expect(box.textContent).toMatch(/Renseignez votre société/);
    expect(box.textContent).toMatch(/9,80 € HT \/ mois/);

    save();
    expect(await screen.findAllByText('Indiquez votre activité.')).not.toHaveLength(0);
    expect(update).not.toHaveBeenCalled();

    fireEvent.change(within(box).getByRole('combobox'), { target: { value: 'artisan' } });
    save();
    expect(await screen.findByText('La raison sociale est requise.')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();

    const fill = (label: string, value: string) =>
      fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } });
    fill('Raison sociale', company.companyName);
    fill('SIRET', '732 829 320 00074');
    fill('Adresse', company.addressLine);
    fill('Code postal', company.postalCode);
    fill('Ville', company.city);
    save();
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]![0]).toMatchObject({ profileType: 'artisan', ...company });
  });

  it('société déjà renseignée : seule l’activité est demandée', () => {
    render(<ProfileTab profile={{ ...base, ...company }} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /^Professionnel/ }));
    expect(screen.queryByRole('textbox', { name: 'SIRET' })).toBeNull();
  });

  it('professionnel → particulier : libre, la société est conservée', async () => {
    render(
      <ProfileTab profile={{ ...base, ...company, profileType: 'artisan' }} onSaved={vi.fn()} />,
    );
    expect(screen.getByRole('radio', { name: /^Professionnel/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: /^Particulier/ }));
    expect(screen.queryByTestId('pro-account')).toBeNull();
    save();
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]![0]).toMatchObject({ profileType: 'particulier', ...company });
  });
});

describe('Paramètres — onglet Entreprise', () => {
  it('compte professionnel : raison sociale, SIRET et adresse obligatoires', async () => {
    render(<CompanyTab profile={{ ...base, profileType: 'entreprise' }} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ville' }), { target: { value: 'Lyon' } });
    save();
    expect(await screen.findByText('La raison sociale est requise.')).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it('compte particulier : société facultative', async () => {
    render(<CompanyTab profile={base} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Ville' }), { target: { value: 'Lyon' } });
    save();
    await waitFor(() => expect(update).toHaveBeenCalled());
  });
});

describe('Onglet Forfait — prix selon le type de compte', () => {
  it('particulier : prix TTC', () => {
    render(<PlanTab profile={base} ownedProjects={1} />);
    expect(screen.getByText(/6,90 €/).textContent).toMatch(/TTC \/ mois/);
    expect(screen.getByTestId('price-grid').textContent).toMatch(/toutes taxes comprises/);
  });

  it('professionnel : 9,80 € HT par mois, 1,99 € HT le projet', () => {
    render(<PlanTab profile={{ ...base, profileType: 'negoce' }} ownedProjects={1} />);
    expect(screen.getByText(/9,80 €/).textContent).toMatch(/HT \/ mois/);
    expect(screen.getByText(/1,99 €/).textContent).toMatch(/HT \/ projet/);
    expect(screen.getByTestId('price-grid').textContent).toMatch(/hors taxes/);
  });
});
