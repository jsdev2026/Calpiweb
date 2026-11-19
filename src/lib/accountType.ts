// Compte particulier ou professionnel (à ne pas confondre avec l'abonnement Pro).
// Le type de compte se déduit de l'activité (`profile_type`) : « particulier », ou une
// activité professionnelle (artisan, entreprise, architecte, négoce, autre).
import { PROFILE_TYPES, type ProfileType, type UserProfile } from '@/types/profile';
import { clean, postalCodeError, siretError, vatError } from './validation';

export type AccountType = 'particulier' | 'professionnel';

/** Activités proposées aux comptes professionnels */
export const PRO_ACTIVITIES = PROFILE_TYPES.filter((p) => p.value !== 'particulier');

/** Particulier si l'activité est « particulier » ou inconnue, professionnel sinon. */
export function accountTypeOf(profileType: ProfileType | null | undefined): AccountType {
  return profileType && profileType !== 'particulier' ? 'professionnel' : 'particulier';
}

export type CompanyFields = Pick<
  UserProfile,
  'companyName' | 'siret' | 'vatNumber' | 'addressLine' | 'postalCode' | 'city'
>;

/** Champs obligatoires d'un compte professionnel */
export const REQUIRED_COMPANY_FIELDS = [
  'companyName',
  'siret',
  'addressLine',
  'postalCode',
  'city',
] as const;

const REQUIRED_MESSAGES: Record<(typeof REQUIRED_COMPANY_FIELDS)[number], string> = {
  companyName: 'La raison sociale est requise.',
  siret: 'Le SIRET est requis.',
  addressLine: 'L’adresse est requise.',
  postalCode: 'Le code postal est requis.',
  city: 'La ville est requise.',
};

/**
 * Erreurs des champs société : format toujours vérifié ; présence exigée pour un compte
 * professionnel (le n° de TVA reste facultatif).
 */
export function companyErrors(
  d: Partial<CompanyFields>,
  required: boolean,
): Partial<Record<keyof CompanyFields, string | null>> {
  // Dans l'ordre du formulaire : la première erreur est celle du premier champ à corriger
  const missing = (f: (typeof REQUIRED_COMPANY_FIELDS)[number]) =>
    required && !clean(d[f]) ? REQUIRED_MESSAGES[f] : null;
  return {
    companyName: missing('companyName'),
    siret: missing('siret') ?? siretError(d.siret ?? ''),
    vatNumber: vatError(d.vatNumber ?? ''),
    addressLine: missing('addressLine'),
    postalCode: missing('postalCode') ?? postalCodeError(d.postalCode ?? ''),
    city: missing('city'),
  };
}

/** Les informations obligatoires de la société sont-elles toutes renseignées et valides ? */
export function companyComplete(d: Partial<CompanyFields>): boolean {
  return !Object.values(companyErrors(d, true)).some(Boolean);
}

/** Normalisation avant enregistrement (SIRET sans espaces, TVA en majuscules) */
export function normalizeCompany<T extends Partial<CompanyFields>>(d: T): T {
  return {
    ...d,
    companyName: clean(d.companyName),
    siret: clean(d.siret)?.replace(/\s|\./g, '') ?? null,
    vatNumber: clean(d.vatNumber)?.replace(/\s/g, '').toUpperCase() ?? null,
    addressLine: clean(d.addressLine),
    postalCode: clean(d.postalCode),
    city: clean(d.city),
  };
}
