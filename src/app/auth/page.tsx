'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'login' | 'register' | 'forgot';

// ─── Brand panel ─────────────────────────────────────────────────────────────
const BrandPanel = () => (
  <div
    className="relative hidden w-[420px] shrink-0 flex-col overflow-hidden lg:flex"
    style={{ background: 'linear-gradient(145deg, #1a2332, #0f1520, #1C2A1A)' }}
  >
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="tiles" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect x="1" y="1" width="26" height="26" fill="#E8671A" rx="2"/>
          <rect x="33" y="1" width="26" height="26" fill="#E8671A" rx="2"/>
          <rect x="1" y="33" width="26" height="26" fill="#E8671A" rx="2"/>
          <rect x="33" y="33" width="26" height="26" fill="#E8671A" rx="2"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tiles)"/>
    </svg>
    <div className="relative flex flex-1 flex-col p-10">
      <div className="mb-12 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#E8671A' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="white"/>
            <rect x="11" y="2" width="7" height="7" rx="1.5" fill="white" fillOpacity=".7"/>
            <rect x="2" y="11" width="7" height="7" rx="1.5" fill="white" fillOpacity=".7"/>
            <rect x="11" y="11" width="7" height="7" rx="1.5" fill="white"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>CaléPlan</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.15 }} className="mb-4">
        Calepinage de carrelage
      </h1>
      <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 14.5 }} className="mb-10 leading-relaxed">
        Concevez vos plans 2D, simulez la pose et générez des quantitatifs précis en quelques minutes.
      </p>
      <ul className="mb-auto space-y-4">
        {['Tracé de plans 2D libre', 'Simulation de 3 types de pose', 'Quantitatif optimisé avec réutilisation des chutes', 'Sauvegarde cloud automatique'].map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(232,103,26,.25)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#E8671A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const inputCls = 'w-full rounded-[var(--rs)] border px-[11px] py-2 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]';
  const inputStyle = { borderColor: 'var(--bdr2)', background: 'var(--surf)', color: 'var(--text)' };
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

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() || email.split('@')[0] } },
    });
    if (error) {
      setError(error.message);
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
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">

        {step === 'login' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-1">Connexion</h2>
            <p className="mb-7 text-[13px]" style={{ color: 'var(--text2)' }}>Bienvenue sur CaléPlan</p>
            {error && <p className="mb-4 rounded-lg p-3 text-[12.5px]" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>}
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={labelCls} style={labelStyle}>Mot de passe</label>
                  <button type="button" onClick={() => setStep('forgot')} className="text-[11.5px]" style={{ color: 'var(--accent)' }}>Mot de passe oublié ?</button>
                </div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && void handleLogin()} />
              </div>
            </div>
            <button type="button" onClick={() => void handleLogin()} disabled={loading} className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50">
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="mt-5 text-center text-[12.5px]" style={{ color: 'var(--text2)' }}>
              Pas encore de compte ?{' '}
              <button type="button" onClick={() => { setError(null); setStep('register'); }} className="font-semibold" style={{ color: 'var(--accent)' }}>Créer un compte</button>
            </p>
          </div>
        )}

        {step === 'register' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <button type="button" onClick={() => { setError(null); setStep('login'); }} className="btn-ghost mb-5 -ml-2 gap-1.5 text-[12.5px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-6">Créer un compte</h2>
            {error && <p className="mb-4 rounded-lg p-3 text-[12.5px]" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>}
            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Prénom et nom</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Mot de passe</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" className={inputCls} style={inputStyle}
                  onKeyDown={(e) => e.key === 'Enter' && void handleRegister()} />
              </div>
            </div>
            <button type="button" onClick={() => void handleRegister()} disabled={loading} className="btn-primary mt-6 w-full justify-center py-2.5 disabled:opacity-50">
              {loading ? 'Création…' : 'Créer mon compte gratuit'}
            </button>
            <p className="mt-4 text-center text-[11.5px]" style={{ color: 'var(--muted)' }}>
              Plan gratuit — 1 projet cloud inclus. Aucune carte requise.
            </p>
          </div>
        )}

        {step === 'forgot' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <button type="button" onClick={() => { setError(null); setForgotSent(false); setStep('login'); }} className="btn-ghost mb-5 -ml-2 gap-1.5 text-[12.5px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-6">Mot de passe oublié</h2>
            {forgotSent ? (
              <p className="rounded-lg p-4 text-[13px]" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
              </p>
            ) : (
              <>
                {error && <p className="mb-4 rounded-lg p-3 text-[12.5px]" style={{ background: '#fef2f2', color: '#dc2626' }}>{error}</p>}
                <div className="mb-6">
                  <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
                </div>
                <button type="button" onClick={() => void handleForgot()} disabled={loading} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
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
