import { describe, expect, it } from 'vitest';
import { clean, phoneError, postalCodeError, siretError, vatError } from './validation';

describe('siretError', () => {
  it('accepte un SIRET valide (clé de Luhn), avec ou sans espaces', () => {
    expect(siretError('732 829 320 00074')).toBeNull();
    expect(siretError('73282932000074')).toBeNull();
  });
  it('refuse une mauvaise clé ou une mauvaise longueur', () => {
    expect(siretError('73282932000075')).toMatch(/incorrect/);
    expect(siretError('1234')).toMatch(/14 chiffres/);
  });
  it('vide = pas d’erreur (champ facultatif)', () => {
    expect(siretError('')).toBeNull();
  });
});

describe('phoneError', () => {
  it('accepte les formats français et internationaux', () => {
    expect(phoneError('06 12 34 56 78')).toBeNull();
    expect(phoneError('06.12.34.56.78')).toBeNull();
    expect(phoneError('+33612345678')).toBeNull();
  });
  it('refuse un numéro trop court', () => {
    expect(phoneError('0612')).not.toBeNull();
  });
});

describe('vatError', () => {
  it('accepte un numéro FR et un autre pays de l’UE', () => {
    expect(vatError('FR 40 303265045')).toBeNull();
    expect(vatError('DE123456789')).toBeNull();
  });
  it('refuse un numéro FR mal formé', () => {
    expect(vatError('FR123')).not.toBeNull();
  });
});

describe('postalCodeError / clean', () => {
  it('code postal à 5 chiffres', () => {
    expect(postalCodeError('69001')).toBeNull();
    expect(postalCodeError('6900')).not.toBeNull();
  });
  it('clean normalise les espaces et renvoie null si vide', () => {
    expect(clean('  Jean   Pierre ')).toBe('Jean Pierre');
    expect(clean('   ')).toBeNull();
  });
});
