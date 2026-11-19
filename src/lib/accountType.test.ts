import { describe, expect, it } from 'vitest';
import {
  PRO_ACTIVITIES,
  accountTypeOf,
  companyComplete,
  companyErrors,
  normalizeCompany,
} from './accountType';
import { pricesFor } from '@/constants/pricing';

const company = {
  companyName: 'Dupont Carrelage',
  siret: '732 829 320 00074',
  vatNumber: '',
  addressLine: '12 rue des Lilas',
  postalCode: '69003',
  city: 'Lyon',
};

describe('type de compte', () => {
  it('particulier si « particulier » ou inconnu, professionnel sinon', () => {
    expect(accountTypeOf('particulier')).toBe('particulier');
    expect(accountTypeOf(null)).toBe('particulier');
    expect(accountTypeOf(undefined)).toBe('particulier');
    expect(accountTypeOf('artisan')).toBe('professionnel');
    expect(accountTypeOf('autre')).toBe('professionnel');
    expect(PRO_ACTIVITIES.map((a) => a.value)).not.toContain('particulier');
  });

  it('grille de prix : particuliers TTC, professionnels HT', () => {
    expect(pricesFor('particulier')).toEqual({
      monthly: '6,90 €',
      extraProject: '1,99 €',
      tax: 'TTC',
    });
    expect(pricesFor('professionnel')).toEqual({
      monthly: '9,80 €',
      extraProject: '1,99 €',
      tax: 'HT',
    });
    expect(pricesFor(undefined).tax).toBe('TTC');
  });
});

describe('société d’un compte professionnel', () => {
  it('raison sociale, SIRET et adresse obligatoires ; TVA facultative', () => {
    expect(companyComplete(company)).toBe(true);
    const e = companyErrors({}, true);
    expect(e.companyName).toMatch(/raison sociale/);
    expect(e.siret).toMatch(/SIRET/);
    expect(e.addressLine).toMatch(/adresse/);
    expect(e.postalCode).toMatch(/code postal/);
    expect(e.city).toMatch(/ville/);
    expect(e.vatNumber).toBeNull();
  });

  it('formats vérifiés, même pour un particulier', () => {
    expect(companyErrors({ siret: '123' }, false).siret).toMatch(/14 chiffres/);
    expect(companyErrors({ postalCode: '6900' }, false).postalCode).toMatch(/5 chiffres/);
    expect(companyErrors({}, false)).toEqual({
      companyName: null,
      siret: null,
      vatNumber: null,
      addressLine: null,
      postalCode: null,
      city: null,
    });
    expect(companyComplete({ ...company, siret: '73282932000075' })).toBe(false);
  });

  it('normalisation : espaces, SIRET compact, TVA en majuscules', () => {
    expect(normalizeCompany({ ...company, vatNumber: 'fr 32 732829320' })).toEqual({
      companyName: 'Dupont Carrelage',
      siret: '73282932000074',
      vatNumber: 'FR32732829320',
      addressLine: '12 rue des Lilas',
      postalCode: '69003',
      city: 'Lyon',
    });
  });
});
