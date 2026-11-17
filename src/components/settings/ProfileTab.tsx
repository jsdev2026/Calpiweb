'use client';

import { useState } from 'react';
import { ACQUISITION_SOURCES, PROFILE_TYPES, type UserProfile } from '@/types/profile';
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

const KEYS = ['firstName', 'lastName', 'phone', 'profileType', 'acquisitionSource'] as const;

export const ProfileTab = ({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<void>;
}) => {
  const form = useProfileForm(
    profile,
    KEYS,
    onSaved,
    (d) => ({
      firstName: clean(d.firstName) ? null : 'Le prénom est requis.',
      lastName: clean(d.lastName) ? null : 'Le nom est requis.',
      phone: phoneError(d.phone ?? ''),
    }),
    (d) => ({
      ...d,
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
          <Field label="Vous êtes">
            <SelectInput
              value={draft.profileType ?? ''}
              onChange={(e) =>
                set('profileType', (e.target.value || null) as UserProfile['profileType'])
              }
              options={PROFILE_TYPES}
              placeholder="Choisir…"
            />
          </Field>
        </Grid2>
        <Field label="Comment nous avez-vous connus ?">
          <SelectInput
            value={draft.acquisitionSource ?? ''}
            onChange={(e) => set('acquisitionSource', e.target.value || null)}
            options={ACQUISITION_SOURCES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <SaveBar
          state={form.state}
          error={form.error}
          disabled={!form.dirty}
          onSave={() => void form.save()}
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
