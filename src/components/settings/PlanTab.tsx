'use client';

import type { UserProfile } from '@/types/profile';
import { pricesFor } from '@/constants/pricing';
import { accountTypeOf } from '@/lib/accountType';
import { FREE_PROJECT_LIMIT } from '@/lib/entitlements';
import { Section } from './settingsUi';

export const PlanTab = ({
  profile,
  ownedProjects,
}: {
  profile: UserProfile;
  ownedProjects: number;
}) => {
  const isPro = profile.plan === 'pro';
  const business = accountTypeOf(profile.profileType) === 'professionnel';
  const prices = pricesFor(accountTypeOf(profile.profileType));
  const limit = FREE_PROJECT_LIMIT + profile.projectCredits;

  return (
    <Section title="Forfait actuel">
      <div className="flex items-center justify-between">
        <span className="text-[14px]" style={{ color: 'var(--text2)' }}>
          {isPro
            ? 'Projets illimités, sauvegarde cloud automatique.'
            : `${Math.min(ownedProjects, limit)} / ${limit} projet${limit > 1 ? 's' : ''} utilisé${ownedProjects > 1 ? 's' : ''}`}
        </span>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-bold"
          style={
            isPro
              ? { background: 'var(--accent)', color: '#fff' }
              : {
                  background: 'var(--surf2)',
                  color: 'var(--text2)',
                  border: '1px solid var(--bdr)',
                }
          }
        >
          {isPro ? 'Pro' : 'Gratuit'}
        </span>
      </div>
      {!isPro && profile.projectCredits > 0 && (
        <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>
          Dont {profile.projectCredits} projet{profile.projectCredits > 1 ? 's' : ''} supplémentaire
          {profile.projectCredits > 1 ? 's' : ''} acheté{profile.projectCredits > 1 ? 's' : ''}.
        </p>
      )}

      {!isPro && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--bdr)' }}>
              <p className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                +1 projet
              </p>
              <p className="mb-2 text-[12px]" style={{ color: 'var(--text2)' }}>
                Un projet supplémentaire, sans engagement.
              </p>
              <p className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>
                {prices.extraProject}
                <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                  {' '}
                  {prices.tax} / projet
                </span>
              </p>
            </div>
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--accent)', background: 'var(--accent-l)' }}
            >
              <p className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                Pro — projets illimités
              </p>
              <p className="mb-2 text-[12px]" style={{ color: 'var(--text2)' }}>
                Partage de projets, PDF sans mention CaléPlan.
              </p>
              <p className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>
                {prices.monthly}
                <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                  {' '}
                  {prices.tax} / mois
                </span>
              </p>
            </div>
          </div>
          <p
            data-testid="price-grid"
            className="text-center text-[12px]"
            style={{ color: 'var(--muted)' }}
          >
            {business
              ? 'Tarifs professionnels, hors taxes (compte professionnel).'
              : 'Tarifs particuliers, toutes taxes comprises.'}{' '}
            Le type de compte se change dans l’onglet Profil.
          </p>
          <p className="text-center text-[12px]" style={{ color: 'var(--muted)' }}>
            Paiement en ligne disponible prochainement — en attendant, faites une demande dans
            l&apos;onglet Contact.
          </p>
        </>
      )}
    </Section>
  );
};
