// Prix affichés — décidés le 17/11/2026 (particuliers) et le 19/11/2026 (professionnels),
// voir docs/superpowers/plans/2026-11-17-paywall-integration.md.
// Source unique pour la page d'accueil, la modale « Limite atteinte » et l'onglet Forfait.
// Les montants réellement facturés seront ceux configurés dans Stripe : garder les deux alignés.
import type { AccountType } from '@/lib/accountType';

/** Particuliers : prix TTC */
export const PRICE_PRO_MONTHLY = '6,90 €';
export const PRICE_EXTRA_PROJECT = '1,99 €';

/** Professionnels : prix HT (même prix unitaire, abonnement à 9,80 €) */
export const PRICE_PRO_MONTHLY_BUSINESS = '9,80 €';
export const PRICE_EXTRA_PROJECT_BUSINESS = '1,99 €';

export interface PriceSet {
  monthly: string;
  extraProject: string;
  /** Mention fiscale affichée après le prix */
  tax: 'TTC' | 'HT';
}

/** Grille de prix selon le type de compte (particulier par défaut) */
export function pricesFor(type: AccountType | null | undefined): PriceSet {
  return type === 'professionnel'
    ? { monthly: PRICE_PRO_MONTHLY_BUSINESS, extraProject: PRICE_EXTRA_PROJECT_BUSINESS, tax: 'HT' }
    : { monthly: PRICE_PRO_MONTHLY, extraProject: PRICE_EXTRA_PROJECT, tax: 'TTC' };
}
