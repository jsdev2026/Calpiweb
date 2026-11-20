import { describe, expect, it } from 'vitest';
import { authErrorMessage, isExistingAccount } from './authErrors';

describe('isExistingAccount', () => {
  it('adresse déjà inscrite : utilisateur renvoyé sans identité', () => {
    expect(isExistingAccount({ identities: [] })).toBe(true);
  });
  it('nouvelle inscription : une identité e-mail', () => {
    expect(isExistingAccount({ identities: [{ provider: 'email' }] as never })).toBe(false);
  });
  it('codes d’erreur « compte existant »', () => {
    expect(isExistingAccount(null, { code: 'user_already_exists' })).toBe(true);
    expect(isExistingAccount(null, { code: 'email_exists' })).toBe(true);
    expect(isExistingAccount(null, { code: 'weak_password' })).toBe(false);
    expect(isExistingAccount(null, null)).toBe(false);
  });
});

describe('authErrorMessage', () => {
  it('traduit les erreurs courantes', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: '', status: 400 })).toBe(
      'Email ou mot de passe incorrect.',
    );
    expect(authErrorMessage({ code: 'email_not_confirmed', message: '', status: 400 })).toMatch(
      /pas encore confirmée/,
    );
    expect(
      authErrorMessage({ code: 'over_email_send_rate_limit', message: '', status: 429 }),
    ).toMatch(/Trop d’e-mails/);
  });
  it('message générique en français pour une erreur inconnue', () => {
    expect(authErrorMessage({ code: undefined, message: 'Boom', status: 500 })).toBe(
      'Une erreur est survenue. Réessayez dans un instant.',
    );
    expect(authErrorMessage({ code: undefined, message: 'x', status: 429 })).toMatch(
      /Trop de tentatives/,
    );
  });

  it('erreurs serveur : e-mail non envoyé, compte non enregistré', () => {
    expect(
      authErrorMessage({
        code: 'unexpected_failure',
        message: 'Error sending confirmation email',
        status: 500,
      }),
    ).toMatch(/e-mail n’a pas pu être envoyé.*contact@caleplan.com/);
    expect(
      authErrorMessage({ code: undefined, message: 'Error sending recovery email', status: 500 }),
    ).toMatch(/e-mail n’a pas pu être envoyé/);
    expect(
      authErrorMessage({
        code: 'unexpected_failure',
        message: 'Database error saving new user',
        status: 500,
      }),
    ).toMatch(/compte n’a pas pu être enregistré/);
  });
});
