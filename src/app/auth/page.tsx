'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ACQUISITION_SOURCES, PROFILE_TYPES, type ProfileType } from '@/types/profile';
import { clean, phoneError } from '@/lib/validation';

type Step = 'login' | 'register' | 'forgot';

// ─── Brand panel ─────────────────────────────────────────────────────────────
const BrandPanel = () => (
  <div
    className="relative hidden w-[420px] shrink-0 flex-col overflow-hidden lg:flex"
    style={{ background: 'linear-gradient(145deg, #1a2332, #0f1520, #1C2A1A)' }}
  >
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="tiles" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="26" height="26" fill="#E8671A" rx="2" />
          <rect x="33" y="1" width="26" height="26" fill="#E8671A" rx="2" />
          <rect x="1" y="33" width="26" height="26" fill="#E8671A" rx="2" />
          <rect x="33" y="33" width="26" height="26" fill="#E8671A" rx="2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tiles)" />
    </svg>
    <div className="relative flex flex-1 flex-col p-10">
      <div className="mb-12 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: '#E8671A' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white" />
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity=".7" />
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity=".7" />
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white" />
          </svg>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.3px',
          }}
        >
          CaléPlan
        </span>
      </div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 34,
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.15,
        }}
        className="mb-4"
      >
        Calepinage de carrelage
      </h1>
      <p
        style={{ color: 'rgba(255,255,255,.55)', fontSize: 14.5 }}
        className="mb-10 leading-relaxed"
      >
        Concevez vos plans 2D, simulez la pose et générez des quantitatifs précis en quelques
        minutes.
      </p>
      <ul className="mb-auto space-y-4">
        {[
          'Tracé de plans 2D libre',
          'Simulation de 3 types de pose',
          'Quantitatif optimisé avec réutilisation des chutes',
          'Sauvegarde cloud automatique',
        ].map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(232,103,26,.25)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5l2 2 4-4"
                  stroke="#E8671A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileType, setProfileType] = useState<ProfileType | ''>('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [acquisitionSource, setAcquisitionSource] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    if (searchParams.get('error') === 'confirmation_failed') {
      setStep('login');
      setError('Le lien de confirmation est invalide ou a expiré. Réessayez de vous inscrire.');
    }
  }, [searchParams]);

  const inputCls =
    'w-full rounded-[var(--rs)] border px-[11px] py-2 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]';
  const inputStyle = {
    borderColor: 'var(--bdr2)',
    background: 'var(--surf)',
    color: 'var(--text)',
  };
  const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px]';
  const labelStyle = { color: 'var(--text2)' };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Email ou mot de passe incorrect.');
    } else {
      router.push('/dashboard');
      router.refresh();
    }
    setLoading(false);
  };

  const isPro = profileType !== '' && profileType !== 'particulier';

  const validateRegister = (): string | null => {
    if (!clean(firstName) || !clean(lastName)) return 'Indiquez votre prénom et votre nom.';
    if (!profileType) return 'Indiquez votre profil.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Adresse e-mail invalide.';
    if (password.length < 8) return 'Le mot de passe doit comporter au moins 8 caractères.';
    return phoneError(phone);
  };

  const handleRegister = async () => {
    const invalid = validateRegister();
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    const first = clean(firstName)!;
    const last = clean(lastName)!;
    // Les métadonnées sont recopiées dans public.profiles par le trigger handle_new_user (migration 004)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: `${first} ${last}`,
          full_name: `${first} ${last}`,
          first_name: first,
          last_name: last,
          profile_type: profileType,
          company_name: isPro ? clean(companyName) : null,
          phone: clean(phone),
          acquisition_source: acquisitionSource || null,
          newsletter_opt_in: newsletter,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    } else if (!data.session) {
      // Compte créé mais confirmation email requise avant qu'une session existe.
      setConfirmationSent(true);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?step=reset`,
    });
    if (error) {
      setError(error.message);
    } else {
      setForgotSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        {step === 'login' && (
          <div
            className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 shadow-[var(--sh-lg)] md:p-9"
            style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text)',
              }}
              className="mb-1"
            >
              Connexion
            </h2>
            <p className="mb-7 text-[13px]" style={{ color: 'var(--text2)' }}>
              Bienvenue sur CaléPlan
            </p>
            {error && (
              <p
                className="mb-4 rounded-lg p-3 text-[12.5px]"
                style={{ background: '#fef2f2', color: '#dc2626' }}
              >
                {error}
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>
                  Adresse e-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={labelCls} style={labelStyle}>
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('forgot')}
                    className="text-[11.5px]"
                    style={{ color: 'var(--accent)' }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                  style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={loading}
              className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="mt-5 text-center text-[12.5px]" style={{ color: 'var(--text2)' }}>
              Pas encore de compte ?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('register');
                }}
                className="font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                Créer un compte
              </button>
            </p>
          </div>
        )}

        {step === 'register' && (
          <div
            className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 shadow-[var(--sh-lg)] md:p-9"
            style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}
          >
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmationSent(false);
                setStep('login');
              }}
              className="btn-ghost -ml-2 mb-5 gap-1.5 text-[12.5px]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M9 2L4 7l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Retour
            </button>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text)',
              }}
              className="mb-6"
            >
              Créer un compte
            </h2>
            {confirmationSent ? (
              <p
                className="rounded-lg p-4 text-[13px]"
                style={{ background: '#f0fdf4', color: '#16a34a' }}
              >
                Un email de confirmation a été envoyé à <strong>{email}</strong>. Cliquez sur le
                lien qu&apos;il contient pour activer votre compte.
              </p>
            ) : (
              <>
                {error && (
                  <p
                    className="mb-4 rounded-lg p-3 text-[12.5px]"
                    style={{ background: '#fef2f2', color: '#dc2626' }}
                  >
                    {error}
                  </p>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls} style={labelStyle}>
                        Prénom *
                      </label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jean"
                        autoComplete="given-name"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelCls} style={labelStyle}>
                        Nom *
                      </label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Dupont"
                        autoComplete="family-name"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Vous êtes *
                    </label>
                    <select
                      value={profileType}
                      onChange={(e) => setProfileType(e.target.value as ProfileType | '')}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="">Choisir…</option>
                      {PROFILE_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isPro && (
                    <div>
                      <label className={labelCls} style={labelStyle}>
                        Entreprise
                      </label>
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Dupont Carrelage"
                        autoComplete="organization"
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Téléphone <span className="normal-case">(facultatif)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="06 12 34 56 78"
                      autoComplete="tel"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Adresse e-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@exemple.fr"
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8 caractères minimum"
                      autoComplete="new-password"
                      className={inputCls}
                      style={inputStyle}
                      onKeyDown={(e) => e.key === 'Enter' && void handleRegister()}
                    />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>
                      Comment nous avez-vous connus ?{' '}
                      <span className="normal-case">(facultatif)</span>
                    </label>
                    <select
                      value={acquisitionSource}
                      onChange={(e) => setAcquisitionSource(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                    >
                      <option value="">—</option>
                      {ACQUISITION_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label
                    className="flex cursor-pointer items-start gap-2.5 text-[12.5px]"
                    style={{ color: 'var(--text2)' }}
                  >
                    <input
                      type="checkbox"
                      checked={newsletter}
                      onChange={(e) => setNewsletter(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
                    />
                    J&apos;accepte de recevoir les nouveautés et conseils CaléPlan par e-mail
                    (désinscription possible à tout moment dans Paramètres).
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRegister()}
                  disabled={loading}
                  className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50"
                >
                  {loading ? 'Création…' : 'Créer mon compte gratuit'}
                </button>
                <p className="mt-4 text-center text-[11.5px]" style={{ color: 'var(--muted)' }}>
                  Plan gratuit — 1 projet cloud inclus. Aucune carte requise.
                </p>
              </>
            )}
          </div>
        )}

        {step === 'forgot' && (
          <div
            className="w-full max-w-[420px] rounded-[var(--rl)] border p-6 shadow-[var(--sh-lg)] md:p-9"
            style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}
          >
            <button
              type="button"
              onClick={() => {
                setError(null);
                setForgotSent(false);
                setStep('login');
              }}
              className="btn-ghost -ml-2 mb-5 gap-1.5 text-[12.5px]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M9 2L4 7l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Retour
            </button>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text)',
              }}
              className="mb-6"
            >
              Mot de passe oublié
            </h2>
            {forgotSent ? (
              <p
                className="rounded-lg p-4 text-[13px]"
                style={{ background: '#f0fdf4', color: '#16a34a' }}
              >
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
              </p>
            ) : (
              <>
                {error && (
                  <p
                    className="mb-4 rounded-lg p-3 text-[12.5px]"
                    style={{ background: '#fef2f2', color: '#dc2626' }}
                  >
                    {error}
                  </p>
                )}
                <div className="mb-6">
                  <label className={labelCls} style={labelStyle}>
                    Adresse e-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleForgot()}
                  disabled={loading}
                  className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
                >
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
