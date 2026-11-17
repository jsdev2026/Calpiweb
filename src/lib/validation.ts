// Validations des champs du profil. Toutes renvoient null si la valeur est valide (ou vide),
// sinon un message d'erreur en français.

const digits = (s: string) => s.replace(/\s|\./g, '');

/** SIRET : 14 chiffres, clé de Luhn (exception : La Poste, SIREN 356000000). */
export function siretError(raw: string): string | null {
  const s = digits(raw);
  if (!s) return null;
  if (!/^\d{14}$/.test(s)) return 'Le SIRET doit comporter 14 chiffres.';
  if (s.startsWith('356000000')) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(s[13 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? null : 'Ce numéro de SIRET semble incorrect.';
}

/** Téléphone : format français (0X XX XX XX XX) ou international (+XX…). */
export function phoneError(raw: string): string | null {
  const s = raw.replace(/[\s.\-()]/g, '');
  if (!s) return null;
  if (/^0[1-9]\d{8}$/.test(s) || /^\+\d{8,15}$/.test(s)) return null;
  return 'Numéro de téléphone invalide.';
}

/** N° de TVA intracommunautaire : 2 lettres pays + 2 à 13 caractères (FR : FR + 2 + 9 chiffres). */
export function vatError(raw: string): string | null {
  const s = raw.replace(/\s/g, '').toUpperCase();
  if (!s) return null;
  if (s.startsWith('FR'))
    return /^FR[0-9A-Z]{2}\d{9}$/.test(s) ? null : 'Format attendu : FR + 11 caractères.';
  return /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(s) ? null : 'Numéro de TVA invalide.';
}

export function postalCodeError(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  return /^\d{5}$/.test(s) ? null : 'Code postal à 5 chiffres.';
}

/** Normalise une saisie : espaces superflus retirés, chaîne vide → null. */
export function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').trim().replace(/\s+/g, ' ');
  return t ? t : null;
}
