// Messages d'authentification en français, à partir des réponses de Supabase Auth.
import type { AuthError, User } from '@supabase/supabase-js';

/** Codes signalant qu'un compte existe déjà pour cette adresse */
const EXISTS = new Set(['user_already_exists', 'email_exists', 'identity_already_exists']);

/**
 * Supabase ne renvoie pas d'erreur quand on s'inscrit avec l'adresse d'un compte existant
 * et confirmé (protection contre l'énumération des comptes) : il renvoie un utilisateur
 * factice sans identité, et n'envoie aucun email.
 */
export function isExistingAccount(
  user: Pick<User, 'identities'> | null | undefined,
  error?: Pick<AuthError, 'code'> | null,
): boolean {
  if (error?.code && EXISTS.has(error.code)) return true;
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

export function authErrorMessage(error: Pick<AuthError, 'code' | 'message' | 'status'>): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email ou mot de passe incorrect.';
    case 'email_not_confirmed':
      return 'Votre adresse e-mail n’est pas encore confirmée. Cliquez sur le lien reçu par e-mail, ou renvoyez-le ci-dessous.';
    case 'user_already_exists':
    case 'email_exists':
    case 'identity_already_exists':
      return 'Un compte existe déjà avec cette adresse e-mail.';
    case 'weak_password':
      return 'Mot de passe trop faible : utilisez au moins 8 caractères, avec lettres et chiffres.';
    case 'email_address_invalid':
      return 'Adresse e-mail invalide.';
    case 'email_address_not_authorized':
      return 'L’envoi d’e-mails vers cette adresse n’est pas autorisé pour le moment. Contactez-nous via la page d’accueil.';
    case 'over_email_send_rate_limit':
      return 'Trop d’e-mails envoyés en peu de temps. Patientez quelques minutes avant de réessayer.';
    case 'over_request_rate_limit':
      return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
    case 'signup_disabled':
      return 'Les inscriptions sont momentanément fermées.';
    case 'otp_expired':
      return 'Le lien a expiré. Demandez-en un nouveau.';
  }
  if (error.status === 429)
    return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
  // Erreurs serveur de Supabase : seul le texte (en anglais) dit ce qui a échoué
  const msg = (error.message ?? '').toLowerCase();
  if (msg.includes('sending') && msg.includes('email'))
    return 'L’e-mail n’a pas pu être envoyé pour le moment. Réessayez dans quelques minutes ; si le problème persiste, écrivez-nous à contact@caleplan.com.';
  if (msg.includes('database error'))
    return 'Votre compte n’a pas pu être enregistré. Réessayez dans un instant ; si le problème persiste, écrivez-nous à contact@caleplan.com.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
