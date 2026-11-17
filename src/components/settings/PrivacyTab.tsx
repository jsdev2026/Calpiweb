'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@/types/profile';
import { profileDb } from '@/lib/supabase/profile';
import { Section, friendlyError, inputClass, inputStyle } from './settingsUi';

const CONFIRM_WORD = 'SUPPRIMER';

export const PrivacyTab = ({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => Promise<void>;
}) => {
  const router = useRouter();
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleNewsletter = async () => {
    setNewsletterBusy(true);
    setError(null);
    try {
      await profileDb.update({ newsletterOptIn: !profile.newsletterOptIn });
      await onSaved();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setNewsletterBusy(false);
    }
  };

  const exportData = async () => {
    setExportBusy(true);
    setError(null);
    try {
      const data = await profileDb.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caleplan-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setExportBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (confirm !== CONFIRM_WORD) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await profileDb.deleteAccount(profile.logoPath);
      router.push('/auth');
    } catch (e) {
      setError(friendlyError(e));
      setDeleteBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-[12.5px]"
          style={{ background: '#fef2f2', color: '#dc2626' }}
        >
          {error}
        </p>
      )}

      <Section title="Communications">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={profile.newsletterOptIn}
            disabled={newsletterBusy}
            onChange={() => void toggleNewsletter()}
            className="mt-0.5 h-5 w-5 shrink-0 accent-orange-500"
          />
          <span className="text-[13.5px]" style={{ color: 'var(--text)' }}>
            Recevoir les nouveautés et conseils CaléPlan par e-mail
            {profile.newsletterOptIn && profile.newsletterOptInAt && (
              <span className="block text-[11.5px]" style={{ color: 'var(--muted)' }}>
                Accepté le {new Date(profile.newsletterOptInAt).toLocaleDateString('fr-FR')}
              </span>
            )}
          </span>
        </label>
      </Section>

      <Section
        title="Mes données"
        description="Téléchargez une copie de votre profil, de vos projets et de vos demandes (format JSON)."
      >
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => void exportData()}
            disabled={exportBusy}
            className="btn-secondary min-h-[44px] px-5 disabled:opacity-50"
          >
            {exportBusy ? 'Préparation…' : 'Exporter mes données'}
          </button>
        </div>
      </Section>

      <Section
        title="Supprimer mon compte"
        description="Suppression définitive de votre compte, de vos projets et de vos demandes. Cette action est irréversible."
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
            Tapez {CONFIRM_WORD} pour confirmer
          </span>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.toUpperCase())}
            className={inputClass}
            style={inputStyle}
            autoComplete="off"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={confirm !== CONFIRM_WORD || deleteBusy}
            className="min-h-[44px] rounded-lg px-5 text-[13.5px] font-semibold text-white disabled:opacity-40"
            style={{ background: '#dc2626' }}
          >
            {deleteBusy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </Section>
    </div>
  );
};
