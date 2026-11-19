'use client';

import { useRef, useState } from 'react';
import { COMPANY_SIZES, MONTHLY_JOBS, type UserProfile } from '@/types/profile';
import { clean } from '@/lib/validation';
import { accountTypeOf, companyErrors, normalizeCompany } from '@/lib/accountType';
import { CompanyFieldsForm } from './CompanyFieldsForm';
import { profileDb } from '@/lib/supabase/profile';
import {
  Field,
  Grid2,
  SaveBar,
  Section,
  SelectInput,
  TextInput,
  friendlyError,
} from './settingsUi';
import { useProfileForm } from './useProfileForm';

const KEYS = [
  'companyName',
  'siret',
  'vatNumber',
  'addressLine',
  'postalCode',
  'city',
  'interventionArea',
  'companySize',
  'monthlyJobs',
] as const;

export const CompanyTab = ({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<void>;
}) => {
  const isPro = accountTypeOf(profile.profileType) === 'professionnel';
  const form = useProfileForm(
    profile,
    KEYS,
    onSaved,
    (d) => companyErrors(d, isPro),
    (d) => ({
      ...normalizeCompany(d),
      interventionArea: clean(d.interventionArea),
      companySize: d.companySize || null,
      monthlyJobs: d.monthlyJobs || null,
    }),
  );
  const { draft, set, fieldErrors } = form;

  // ── Logo ────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoUrl = profileDb.logoUrl(profile.logoPath);

  const onLogoPicked = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      const path = await profileDb.uploadLogo(file);
      const previous = profile.logoPath;
      await profileDb.update({ logoPath: path });
      if (previous) await profileDb.removeLogo(previous);
      await onSaved();
    } catch (e) {
      setLogoError(friendlyError(e));
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    if (!profile.logoPath) return;
    setLogoBusy(true);
    setLogoError(null);
    try {
      await profileDb.update({ logoPath: null });
      await profileDb.removeLogo(profile.logoPath);
      await onSaved();
    } catch (e) {
      setLogoError(friendlyError(e));
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Logo"
        description="Affiché en tête de vos PDF de quantitatif. PNG, JPG, WebP ou SVG, 1 Mo maximum."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex h-20 w-36 items-center justify-center rounded-xl border"
            style={{ borderColor: 'var(--bdr)', background: '#fff' }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo de l'entreprise"
                className="max-h-16 max-w-32 object-contain"
              />
            ) : (
              <span className="text-[12px]" style={{ color: '#9ca3af' }}>
                Aucun logo
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => void onLogoPicked(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={logoBusy}
              className="btn-secondary min-h-[44px] px-4 disabled:opacity-50"
            >
              {logoBusy ? 'Envoi…' : logoUrl ? 'Remplacer' : 'Ajouter un logo'}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={() => void removeLogo()}
                disabled={logoBusy}
                className="min-h-[44px] px-3 text-[13px] font-semibold disabled:opacity-50"
                style={{ color: '#dc2626' }}
              >
                Retirer
              </button>
            )}
          </div>
        </div>
        {logoError && (
          <p role="alert" className="text-[12.5px]" style={{ color: '#dc2626' }}>
            {logoError}
          </p>
        )}
      </Section>

      <Section
        title="Entreprise"
        description={
          isPro
            ? 'Compte professionnel : raison sociale, SIRET et adresse obligatoires. Elles apparaissent sur vos PDF et serviront à vos factures.'
            : 'Ces informations apparaissent sur vos PDF et serviront à vos factures.'
        }
      >
        <CompanyFieldsForm
          draft={draft}
          set={(k, v) => set(k, v)}
          errors={fieldErrors}
          required={isPro}
        />
      </Section>

      <Section title="Activité" description="Nous aide à adapter CaléPlan à votre métier.">
        <Field label="Zone d'intervention" hint="Ex. : 69, 01, 38 ou « Lyon et alentours »">
          <TextInput
            value={draft.interventionArea ?? ''}
            onChange={(e) => set('interventionArea', e.target.value)}
          />
        </Field>
        <Grid2>
          <Field label="Taille de l'entreprise">
            <SelectInput
              value={draft.companySize ?? ''}
              onChange={(e) =>
                set('companySize', (e.target.value || null) as UserProfile['companySize'])
              }
              options={COMPANY_SIZES}
            />
          </Field>
          <Field label="Chantiers de carrelage par mois">
            <SelectInput
              value={draft.monthlyJobs ?? ''}
              onChange={(e) => set('monthlyJobs', e.target.value || null)}
              options={MONTHLY_JOBS.map((m) => ({ value: m, label: m }))}
            />
          </Field>
        </Grid2>
        <SaveBar
          state={form.state}
          error={form.error}
          disabled={!form.dirty}
          onSave={() => void form.save()}
        />
      </Section>
    </div>
  );
};
