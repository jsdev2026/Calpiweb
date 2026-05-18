'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/store/uiStore';

type Step = 'login' | 'register' | 'plans' | 'payment';
type Plan = 'free' | 'pro' | 'team';

const PLANS = [
  {
    id: 'free' as Plan,
    name: 'Gratuit',
    price: '0',
    period: '',
    features: ['1 projet actif', 'Export PDF basique', 'Calepinage standard'],
  },
  {
    id: 'pro' as Plan,
    name: 'Pro',
    price: '29',
    period: '/mois',
    popular: true,
    features: ['Projets illimités', 'Export PDF coté', 'Tous les types de pose', 'Quantitatif avancé', 'Support prioritaire'],
  },
  {
    id: 'team' as Plan,
    name: 'Équipe',
    price: '79',
    period: '/mois',
    features: ['Tout Pro', 'Jusqu\'à 10 utilisateurs', 'Partage de projets', 'Historique illimité', 'Formation incluse'],
  },
];

// ─── Brand panel ──────────────────────────────────────────────────────────────

const BrandPanel = () => (
  <div
    className="relative hidden w-[420px] shrink-0 flex-col overflow-hidden lg:flex"
    style={{ background: 'linear-gradient(145deg, #1a2332, #0f1520, #1C2A1A)' }}
  >
    {/* Tile pattern */}
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
      {/* Logo */}
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

      {/* Headline */}
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#fff', lineHeight: 1.15 }} className="mb-4">
        Calepinage de carrelage
      </h1>
      <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 14.5 }} className="mb-10 leading-relaxed">
        Concevez vos plans 2D, simulez la pose et générez des quantitatifs précis en quelques minutes.
      </p>

      {/* Features */}
      <ul className="mb-auto space-y-4">
        {['Tracé de plans 2D libre', 'Simulation de 6 types de pose', 'Quantitatif optimisé avec réutilisation des chutes', 'Export PDF coté pour le chantier'].map((f) => (
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

      {/* Stats */}
      <div className="mt-10 flex gap-8 border-t pt-8" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
        {[['2 400+', 'Carreleurs'], ['18 M m²', 'Calculés'], ['98%', 'Satisfaction']].map(([v, l]) => (
          <div key={l}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff' }}>{v}</div>
            <div style={{ color: 'rgba(255,255,255,.45)', fontSize: 11.5 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Auth page ────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const router = useRouter();
  // @ts-expect-error — setUser removed in Task 7; this file will be rewritten in Task 8
  const setUser = useUiStore((s) => s.setUser);

  const [step, setStep] = useState<Step>('login');
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro');
  const [form, setForm] = useState({
    email: '', password: '', firstName: '', lastName: '', company: '',
    cardHolder: '', cardNumber: '', expiry: '', cvv: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const complete = () => {
    setUser({ name: `${form.firstName || 'Utilisateur'} ${form.lastName || ''}`.trim(), email: form.email || 'demo@caleplan.fr', plan: selectedPlan });
    router.push('/');
  };

  const inputCls = 'w-full rounded-[var(--rs)] border px-[11px] py-2 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]';
  const inputStyle = { borderColor: 'var(--bdr2)', background: 'var(--surf)', color: 'var(--text)' };
  const labelCls = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px]';
  const labelStyle = { color: 'var(--text2)' };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">

        {/* ── Step: Login ── */}
        {step === 'login' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-1">Connexion</h2>
            <p className="mb-7 text-[13px]" style={{ color: 'var(--text2)' }}>Bienvenue sur CaléPlan</p>

            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className={labelCls} style={labelStyle}>Mot de passe</label>
                  <button type="button" className="text-[11.5px]" style={{ color: 'var(--accent)' }}>Mot de passe oublié ?</button>
                </div>
                <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className={inputCls} style={inputStyle} />
              </div>
            </div>

            <button type="button" onClick={complete} className="btn-primary mt-6 w-full justify-center py-2.5">Se connecter</button>

            <p className="mt-5 text-center text-[12.5px]" style={{ color: 'var(--text2)' }}>
              Pas encore de compte ?{' '}
              <button type="button" onClick={() => setStep('register')} className="font-semibold" style={{ color: 'var(--accent)' }}>Créer un compte</button>
            </p>

            <div className="mt-5 rounded-[var(--rs)] p-3 text-center text-[11.5px]" style={{ background: 'var(--surf2)', color: 'var(--muted)' }}>
              Démo : utilisez n&apos;importe quelle adresse e-mail
            </div>
          </div>
        )}

        {/* ── Step: Register ── */}
        {step === 'register' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <button type="button" onClick={() => setStep('login')} className="btn-ghost mb-5 -ml-2 gap-1.5 text-[12.5px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)' }} className="mb-6">Créer un compte</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Prénom</label>
                  <input value={form.firstName} onChange={set('firstName')} placeholder="Jean" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Nom</label>
                  <input value={form.lastName} onChange={set('lastName')} placeholder="Dupont" className={inputCls} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Entreprise</label>
                <input value={form.company} onChange={set('company')} placeholder="Carrelage Dupont SARL" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Adresse e-mail</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.fr" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Mot de passe</label>
                <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className={inputCls} style={inputStyle} />
              </div>
            </div>

            <button type="button" onClick={() => setStep('plans')} className="btn-primary mt-6 w-full justify-center py-2.5">
              Continuer vers le choix du plan →
            </button>
          </div>
        )}

        {/* ── Step: Plans ── */}
        {step === 'plans' && (
          <div className="w-full max-w-[860px]">
            <div className="mb-8 text-center">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text)' }} className="mb-2">Choisissez votre plan</h2>
              <p className="text-[13px]" style={{ color: 'var(--text2)' }}>Sans engagement — changez de plan à tout moment</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  className="relative cursor-pointer rounded-[var(--r)] border p-7 transition-all"
                  style={{
                    background: 'var(--surf)',
                    borderColor: selectedPlan === p.id ? 'var(--accent)' : 'var(--bdr)',
                    borderWidth: selectedPlan === p.id ? 2 : 1,
                    boxShadow: selectedPlan === p.id ? '0 0 0 3px rgba(232,103,26,.1)' : 'var(--sh)',
                  }}
                >
                  {p.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white" style={{ background: 'var(--accent)' }}>
                      Le plus populaire
                    </span>
                  )}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }} className="mb-3">{p.name}</div>
                  <div className="mb-5 flex items-baseline gap-1">
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: p.popular ? 'var(--accent)' : 'var(--text)' }}>{p.price}€</span>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>{p.period}</span>
                  </div>
                  <ul className="space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--text2)' }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-px shrink-0"><path d="M2.5 7l3 3 6-6" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-7 flex justify-center gap-3">
              {selectedPlan === 'free' ? (
                <button type="button" onClick={complete} className="btn-primary px-8 py-2.5">Commencer gratuitement</button>
              ) : (
                <button type="button" onClick={() => setStep('payment')} className="btn-primary px-8 py-2.5">Continuer vers le paiement →</button>
              )}
            </div>
          </div>
        )}

        {/* ── Step: Payment ── */}
        {step === 'payment' && (
          <div className="w-full max-w-[420px] rounded-[var(--rl)] border p-9 shadow-[var(--sh-lg)]" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
            <button type="button" onClick={() => setStep('plans')} className="btn-ghost mb-5 -ml-2 gap-1.5 text-[12.5px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour
            </button>

            {/* Plan recap */}
            <div className="mb-6 flex items-center gap-3 rounded-[var(--rs)] p-3" style={{ background: 'var(--accent-l)' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1l2.4 5.2L17 7.3l-4 3.9 1 5.4L9 14l-5 2.6 1-5.4L1 7.3l5.6-1.1L9 1z" fill="var(--accent)"/></svg>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                  Plan {PLANS.find(p => p.id === selectedPlan)?.name} — {PLANS.find(p => p.id === selectedPlan)?.price}€{PLANS.find(p => p.id === selectedPlan)?.period}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--accent)' }}>Facturé mensuellement — annulation à tout moment</div>
              </div>
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }} className="mb-5">Informations de paiement</h2>

            <div className="space-y-4">
              <div>
                <label className={labelCls} style={labelStyle}>Titulaire de la carte</label>
                <input value={form.cardHolder} onChange={set('cardHolder')} placeholder="Jean Dupont" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Numéro de carte</label>
                <input value={form.cardNumber} onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                  setForm(f => ({ ...f, cardNumber: v.replace(/(.{4})/g, '$1 ').trim() }));
                }} placeholder="1234 5678 9012 3456" className={inputCls} style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Expiration</label>
                  <input value={form.expiry} onChange={set('expiry')} placeholder="MM/AA" maxLength={5} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>CVV</label>
                  <input value={form.cvv} onChange={set('cvv')} placeholder="•••" maxLength={4} className={inputCls} style={inputStyle} />
                </div>
              </div>
            </div>

            <button type="button" onClick={complete} className="btn-primary mt-6 w-full justify-center py-2.5">
              Confirmer et accéder à CaléPlan
            </button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px]" style={{ color: 'var(--muted)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5V3.5a2 2 0 114 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Paiement sécurisé SSL — vos données sont chiffrées
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
