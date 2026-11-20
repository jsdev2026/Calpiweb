'use client';
// Choix du nouveau mot de passe, après le lien « Mot de passe oublié » reçu par e-mail.
// Le lien passe d'abord par /auth/callback, qui ouvre une session de récupération.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { authErrorMessage } from '@/lib/authErrors';

const MIN_LENGTH = 8;

export default function NewPasswordPage() {
  const router = useRouter();
  // Client créé dans le navigateur seulement (pas pendant le pré-rendu de la page)
  const client = useRef<ReturnType<typeof createClient> | null>(null);
  const supabase = () => (client.current ??= createClient());
  const [session, setSession] = useState<'checking' | 'ok' | 'missing'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void supabase()
      .auth.getUser()
      .then(({ data }) => setSession(data.user ? 'ok' : 'missing'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (password.length < MIN_LENGTH) {
      setError(`Le mot de passe doit comporter au moins ${MIN_LENGTH} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await supabase().auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(
        error.code === 'same_password'
          ? 'Choisissez un mot de passe différent de l’ancien.'
          : authErrorMessage(error),
      );
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);
  };

  const inputCls =
    'w-full rounded-[var(--rs)] border px-[11px] py-2 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]';
  const inputStyle = {
    borderColor: 'var(--bdr2)',
    background: 'var(--surf)',
    color: 'var(--text)',
  };
  const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px]';

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 shadow-[var(--sh-lg)] md:p-9"
        style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}
      >
        <h1
          className="mb-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Nouveau mot de passe
        </h1>

        {session === 'checking' && (
          <p className="mt-4 text-[13px]" style={{ color: 'var(--text2)' }}>
            Vérification du lien…
          </p>
        )}

        {session === 'missing' && (
          <div role="alert" className="mt-4 text-[13px]" style={{ color: 'var(--text2)' }}>
            <p className="rounded-lg p-3" style={{ background: '#fef2f2', color: '#dc2626' }}>
              Ce lien de réinitialisation est invalide ou a expiré.
            </p>
            <Link
              href="/auth"
              className="mt-4 inline-block font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              Demander un nouveau lien
            </Link>
          </div>
        )}

        {session === 'ok' &&
          (done ? (
            <p
              role="status"
              className="mt-4 rounded-lg p-4 text-[13px]"
              style={{ background: '#f0fdf4', color: '#16a34a' }}
            >
              Mot de passe modifié. Redirection vers vos projets…
            </p>
          ) : (
            <>
              <p className="mb-6 text-[13px]" style={{ color: 'var(--text2)' }}>
                Choisissez le mot de passe de votre compte CaléPlan.
              </p>
              {error && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg p-3 text-[12.5px]"
                  style={{ background: '#fef2f2', color: '#dc2626' }}
                >
                  {error}
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <label className={labelCls} style={{ color: 'var(--text2)' }} htmlFor="np-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="np-1"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`${MIN_LENGTH} caractères minimum`}
                    autoComplete="new-password"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text2)' }} htmlFor="np-2">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="np-2"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === 'Enter' && void save()}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
              </button>
            </>
          ))}
      </div>
    </div>
  );
}
