import type { TilingConfig } from '@/types/tiling';

export type ProfileType =
  | 'artisan'
  | 'entreprise'
  | 'architecte'
  | 'negoce'
  | 'particulier'
  | 'autre';
export type CompanySize = '1' | '2-5' | '6-20' | '20+';
export type SupportCategory = 'question' | 'bug' | 'suggestion' | 'facturation' | 'autre';

export const PROFILE_TYPES: { value: ProfileType; label: string }[] = [
  { value: 'artisan', label: 'Artisan carreleur' },
  { value: 'entreprise', label: 'Entreprise du bâtiment' },
  { value: 'architecte', label: 'Architecte / décorateur' },
  { value: 'negoce', label: 'Négoce / showroom' },
  { value: 'particulier', label: 'Particulier' },
  { value: 'autre', label: 'Autre' },
];

export const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: '1', label: 'Seul(e)' },
  { value: '2-5', label: '2 à 5' },
  { value: '6-20', label: '6 à 20' },
  { value: '20+', label: 'Plus de 20' },
];

export const MONTHLY_JOBS = ['Moins de 2', '2 à 5', '6 à 10', 'Plus de 10'] as const;

export const ACQUISITION_SOURCES = [
  'Recherche Google',
  'Réseaux sociaux',
  'Bouche-à-oreille',
  'Négoce / fournisseur',
  'Salon professionnel',
  'Autre',
] as const;

export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: 'question', label: 'Question' },
  { value: 'bug', label: 'Signaler un problème' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'facturation', label: 'Forfait / facturation' },
  { value: 'autre', label: 'Autre' },
];

/** Profil tel que stocké dans public.profiles (colonnes facultatives à null). */
export interface UserProfile {
  id: string;
  email: string | null;
  plan: 'free' | 'pro';
  projectCredits: number;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  profileType: ProfileType | null;
  companyName: string | null;
  siret: string | null;
  vatNumber: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  interventionArea: string | null;
  companySize: CompanySize | null;
  monthlyJobs: string | null;
  acquisitionSource: string | null;
  newsletterOptIn: boolean;
  newsletterOptInAt: string | null;
  logoPath: string | null;
  defaultTileConfig: Partial<TilingConfig> | null;
  defaultWallThickness: number | null;
}

/** Champs modifiables par l'utilisateur (alignés sur le GRANT UPDATE de la migration 004). */
export type EditableProfile = Partial<
  Pick<
    UserProfile,
    | 'firstName'
    | 'lastName'
    | 'phone'
    | 'profileType'
    | 'companyName'
    | 'siret'
    | 'vatNumber'
    | 'addressLine'
    | 'postalCode'
    | 'city'
    | 'interventionArea'
    | 'companySize'
    | 'monthlyJobs'
    | 'acquisitionSource'
    | 'newsletterOptIn'
    | 'logoPath'
    | 'defaultTileConfig'
    | 'defaultWallThickness'
  >
>;

export interface SupportRequest {
  id: string;
  category: SupportCategory;
  message: string;
  status: 'nouveau' | 'en_cours' | 'traite';
  createdAt: string;
}

/** Nom complet affiché (prénom nom, sinon nom d'affichage, sinon début de l'e-mail). */
export function fullName(
  p: Pick<UserProfile, 'firstName' | 'lastName' | 'displayName' | 'email'>,
): string {
  const n = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return n || p.displayName || p.email?.split('@')[0] || 'Utilisateur';
}
