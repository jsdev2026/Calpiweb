'use client';

import { useEffect, useState } from 'react';
import type { EditableProfile, UserProfile } from '@/types/profile';
import { profileDb } from '@/lib/supabase/profile';
import { friendlyError, type SaveState } from './settingsUi';

/**
 * Brouillon local d'un sous-ensemble du profil + enregistrement.
 * `validate` renvoie les erreurs par champ ; rien n'est envoyé tant qu'il en reste.
 */
export function useProfileForm<K extends keyof EditableProfile>(
  profile: UserProfile,
  keys: readonly K[],
  onSaved: () => Promise<void> | void,
  validate?: (draft: Pick<EditableProfile, K>) => Partial<Record<K, string | null>>,
  normalize?: (draft: Pick<EditableProfile, K>) => Pick<EditableProfile, K>,
) {
  const initial = () =>
    Object.fromEntries(keys.map((k) => [k, profile[k as keyof UserProfile]])) as Pick<
      EditableProfile,
      K
    >;
  const [draft, setDraft] = useState(initial);
  // Après enregistrement, le profil relu (valeurs normalisées) remplace le brouillon
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(initial()), [profile]);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<K, string | null>>>({});

  const set = <F extends K>(field: F, value: EditableProfile[F]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (state !== 'saving') setState('idle');
    setFieldErrors((e) => ({ ...e, [field]: null }));
  };

  const dirty = keys.some(
    (k) =>
      JSON.stringify(draft[k] ?? null) !== JSON.stringify(profile[k as keyof UserProfile] ?? null),
  );

  const save = async () => {
    const errs = validate?.(draft) ?? {};
    if (Object.values(errs).some(Boolean)) {
      setFieldErrors(errs);
      setState('error');
      setError('Corrigez les champs indiqués.');
      return;
    }
    setState('saving');
    setError(null);
    try {
      const payload = normalize ? normalize(draft) : draft;
      await profileDb.update(payload);
      await onSaved();
      setState('saved');
    } catch (e) {
      setState('error');
      setError(friendlyError(e));
    }
  };

  /** Erreur de validation propre à l'appelant (champ hors du brouillon, ex. choix en cours) */
  const fail = (message: string) => {
    setState('error');
    setError(message);
  };

  return { draft, set, save, fail, state, error, fieldErrors, dirty };
}
