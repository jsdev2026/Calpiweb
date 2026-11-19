'use client';

import { useState } from 'react';
import { ACQUISITION_SOURCES, type ProfileType, type UserProfile } from '@/types/profile';
import {
  PRO_ACTIVITIES,
  accountTypeOf,
  companyComplete,
  companyErrors,
  normalizeCompany,
  type AccountType,
} from '@/lib/accountType';
import { pricesFor } from '@/constants/pricing';
import { CompanyFieldsForm } from './CompanyFieldsForm';
import { clean, phoneError } from '@/lib/validation';
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
  'firstName',
  'lastName',
  'phone',
  'profileType',
  'acquisitionSource',
  'companyName',
  'siret',
  'vatNumber',
  'addressLine',
  'postalCode',
  'city',
] as const;

export const ProfileTab = ({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<void>;
}) => {
  // La société n'est demandée ici que si elle manque (sinon : onglet Entreprise)
  const companyMissing = !companyComplete(profile);
  const form = useProfileForm(
    profile,
    KEYS,
    onSaved,
    (d) => {
      const pro = accountTypeOf(d.profileType) === 'professionnel';
      return {
        firstName: clean(d.firstName) ? null : 'Le prénom est requis.',
        lastName: clean(d.lastName) ? null : 'Le nom est requis.',
        phone: phoneError(d.phone ?? ''),
        ...(pro ? companyErrors(d, true) : {}),
      };
    },
    (d) => ({
      ...normalizeCompany(d),
      firstName: clean(d.firstName),
      lastName: clean(d.lastName),
      phone: clean(d.phone),
      profileType: d.profileType || null,
      acquisitionSource: d.acquisitionSource || null,
    }),
  );

  // Changement d'e-mail (confirmation par lien envoyé à la nouvelle adresse)
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const changeEmail = async () => {
    const e = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      setEmailMsg({ ok: false, text: 'Adresse e-mail invalide.' });
      return;
    }
    setEmailBusy(true);
    try {
      await profileDb.changeEmail(e);
      setEmailMsg({
        ok: true,
        text: `Un lien de confirmation a été envoyé à ${e}. L'adresse sera modifiée après validation.`,
      });
      setNewEmail('');
    } catch (err) {
      setEmailMsg({ ok: false, text: friendlyError(err) });
    } finally {
      setEmailBusy(false);
    }
  };

  const { draft, set, fieldErrors } = form;
  // Type de compte choisi dans le brouillon : « professionnel » tant que l'activité n'est
  // pas « particulier » (une activité vide reste professionnelle le temps de la choisir)
  const [proPending, setProPending] = useState(false);
  const draftType: AccountType =
    proPending || accountTypeOf(draft.profileType) === 'professionnel'
      ? 'professionnel'
      : 'particulier';
  const chooseType = (t: AccountType) => {
    if (t === 'particulier') {
      setProPending(false);
      set('profileType', 'particulier');
    } else {
      setProPending(true);
      if (accountTypeOf(draft.profileType) !== 'professionnel') set('profileType', null);
    }
  };
  const activityMissing = draftType === 'professionnel' && !draft.profileType;
  const pro = pricesFor('professionnel');

  return (
    <div className="flex flex-col gap-5">
      <Section title="Identité">
        <Grid2>
          <Field label="Prénom *" error={fieldErrors.firstName}>
            <TextInput
              value={draft.firstName ?? ''}
              onChange={(e) => set('firstName', e.target.value)}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Nom *" error={fieldErrors.lastName}>
            <TextInput
              value={draft.lastName ?? ''}
              onChange={(e) => set('lastName', e.target.value)}
              autoComplete="family-name"
            />
          </Field>
        </Grid2>
        <Grid2>
          <Field
            label="Téléphone"
            error={fieldErrors.phone}
            hint="Facultatif — pour vous recontacter."
          >
            <TextInput
              type="tel"
              inputMode="tel"
              value={draft.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="06 12 34 56 78"
              autoComplete="tel"
            />
          </Field>
        </Grid2>
        {/* Pas de <label> autour des boutons : chacun garde son propre nom */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
            Type de compte
          </span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de compte">
            {(
              [
                ['particulier', 'Particulier', 'Prix TTC'],
                ['professionnel', 'Professionnel', 'Prix HT, infos société'],
              ] as const
            ).map(([value, label, hint]) => {
              const active = draftType === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseType(value)}
                  className="min-h-[44px] rounded-[var(--rs)] border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--bdr2)',
                    background: active ? 'var(--accent-l)' : 'var(--surf)',
                  }}
                >
                  <span
                    className="block text-[13.5px] font-semibold"
                    style={{ color: active ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {label}
                  </span>
                  <span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>
                    {hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {draftType === 'professionnel' && (
          <div
            data-testid="pro-account"
            className="flex flex-col gap-4 rounded-[var(--rs)] border p-3"
            style={{ borderColor: 'var(--bdr)', background: 'var(--surf2)' }}
          >
            <Field
              label="Activité *"
              error={activityMissing && form.state === 'error' ? 'Indiquez votre activité.' : null}
            >
              <SelectInput
                value={
                  draft.profileType && draft.profileType !== 'particulier' ? draft.profileType : ''
                }
                onChange={(e) => set('profileType', (e.target.value || null) as ProfileType | null)}
                options={PRO_ACTIVITIES}
                placeholder="Choisir…"
              />
            </Field>
            {companyMissing && (
              <>
                <p className="text-[12.5px]" style={{ color: 'var(--text2)' }}>
                  Renseignez votre société pour passer en compte professionnel.
                </p>
                <CompanyFieldsForm
                  draft={draft}
                  set={(k, v) => set(k, v)}
                  errors={fieldErrors}
                  required
                />
              </>
            )}
            <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>
              Tarifs professionnels hors taxes : {pro.extraProject} HT le projet, abonnement Pro{' '}
              {pro.monthly} HT / mois.
            </p>
          </div>
        )}
        <Field label="Comment nous avez-vous connus ?">
          <SelectInput
            value={draft.acquisitionSource ?? ''}
            onChange={(e) => set('acquisitionSource', e.target.value || null)}
            options={ACQUISITION_SOURCES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <SaveBar
          state={form.state}
          error={
            activityMissing && form.state === 'error' ? 'Indiquez votre activité.' : form.error
          }
          disabled={!form.dirty && !activityMissing}
          onSave={() => {
            if (activityMissing) return form.fail('Indiquez votre activité.');
            void form.save().then(() => setProPending(false));
          }}
        />
      </Section>

      <Section
        title="Adresse e-mail"
        description="Elle sert à vous connecter et à recevoir vos notifications."
      >
        <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
          {profile.email ?? '—'}
        </p>
        <Field label="Nouvelle adresse e-mail">
          <TextInput
            type="email"
            inputMode="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setEmailMsg(null);
            }}
            placeholder="nouvelle@adresse.fr"
            autoComplete="email"
          />
        </Field>
        {emailMsg && (
          <p
            role="status"
            className="rounded-lg px-3 py-2 text-[12.5px]"
            style={
              emailMsg.ok
                ? { background: '#f0fdf4', color: '#16a34a' }
                : { background: '#fef2f2', color: '#dc2626' }
            }
          >
            {emailMsg.text}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void changeEmail()}
            disabled={emailBusy || !newEmail.trim()}
            className="btn-secondary min-h-[44px] px-5 disabled:opacity-50"
          >
            {emailBusy ? 'Envoi…' : "Changer d'adresse"}
          </button>
        </div>
      </Section>
    </div>
  );
};
