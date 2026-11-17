'use client';

import { useEffect, useState } from 'react';
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
  type SupportRequest,
  type UserProfile,
} from '@/types/profile';
import { profileDb } from '@/lib/supabase/profile';
import { Section, friendlyError, inputClass, inputStyle } from './settingsUi';

const MIN = 10;
const MAX = 5000;

const STATUS_LABEL: Record<SupportRequest['status'], string> = {
  nouveau: 'Envoyée',
  en_cours: 'En cours',
  traite: 'Traitée',
};

export const ContactTab = ({ profile }: { profile: UserProfile }) => {
  const [category, setCategory] = useState<SupportCategory>('question');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<SupportRequest[]>([]);

  const loadHistory = () =>
    profileDb
      .listRequests()
      .then(setHistory)
      .catch(() => setHistory([]));

  useEffect(() => {
    void loadHistory();
  }, []);

  const length = message.trim().length;

  const send = async () => {
    if (length < MIN) {
      setFeedback({ ok: false, text: `Votre message doit faire au moins ${MIN} caractères.` });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await profileDb.sendRequest(category, message, profile.email);
      setMessage('');
      setFeedback({
        ok: true,
        text: `Merci ! Votre demande a bien été envoyée. Nous vous répondrons à ${profile.email ?? 'votre adresse e-mail'}.`,
      });
      await loadHistory();
    } catch (e) {
      setFeedback({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Nous contacter"
        description="Une question, un problème, une idée ? Écrivez-nous, nous répondons par e-mail."
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de demande">
          {SUPPORT_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              onClick={() => setCategory(c.value)}
              className="min-h-[40px] rounded-full border px-3.5 text-[13px] font-semibold transition-colors"
              style={
                category === c.value
                  ? { borderColor: 'var(--accent)', background: 'var(--accent)', color: '#fff' }
                  : { borderColor: 'var(--bdr)', background: 'var(--surf2)', color: 'var(--text2)' }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--text2)' }}>
            Votre message
          </span>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value.slice(0, MAX));
              setFeedback(null);
            }}
            rows={6}
            placeholder="Décrivez votre demande… (pour un problème : ce que vous faisiez, ce qui s'est passé, sur quel appareil)"
            className={`${inputClass} resize-y`}
            style={inputStyle}
          />
          <span className="self-end text-[11.5px]" style={{ color: 'var(--muted)' }}>
            {length} / {MAX}
          </span>
        </label>
        {feedback && (
          <p
            role="status"
            className="rounded-lg px-3 py-2 text-[12.5px]"
            style={
              feedback.ok
                ? { background: '#f0fdf4', color: '#16a34a' }
                : { background: '#fef2f2', color: '#dc2626' }
            }
          >
            {feedback.text}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || length === 0}
            className="btn-primary min-h-[44px] px-5 disabled:opacity-50"
          >
            {busy ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </Section>

      {history.length > 0 && (
        <Section title="Mes demandes">
          <ul className="flex flex-col gap-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border px-3 py-2.5"
                style={{ borderColor: 'var(--bdr)', background: 'var(--surf2)' }}
              >
                <div
                  className="mb-1 flex items-center justify-between gap-2 text-[11.5px]"
                  style={{ color: 'var(--muted)' }}
                >
                  <span>
                    {SUPPORT_CATEGORIES.find((c) => c.value === r.category)?.label} ·{' '}
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: r.status === 'traite' ? '#16a34a' : 'var(--text2)' }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p
                  className="line-clamp-3 whitespace-pre-wrap text-[13px]"
                  style={{ color: 'var(--text)' }}
                >
                  {r.message}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};
