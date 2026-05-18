'use client';

import { useRouter } from 'next/navigation';
import { useUiStore } from '@/store/uiStore';

export default function AccountPage() {
  const router = useRouter();
  const user = useUiStore((s) => s.user);
  const logout = useUiStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    router.push('/auth');
  };

  const planLabel = user?.plan === 'pro' ? 'Pro' : 'Gratuit';
  const planDesc = user?.plan === 'pro'
    ? 'Projets illimités, sauvegarde cloud automatique.'
    : '1 projet cloud inclus. Passez Pro pour des projets illimités.';

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--bg)' }}>
      <header className="shell-topbar px-6">
        <button type="button" onClick={() => router.push('/dashboard')} className="btn-ghost gap-1.5 text-[13px]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Mes projets
        </button>
      </header>

      <main className="mx-auto w-full max-w-lg px-6 py-12">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text)' }} className="mb-8">Mon compte</h1>

        {/* Profile card */}
        <div className="mb-6 rounded-2xl border p-6" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold text-white" style={{ background: 'var(--accent)' }}>
              {user?.name?.slice(0, 1).toUpperCase() ?? 'U'}
            </div>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{user?.name ?? '—'}</p>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Plan card */}
        <div className="mb-6 rounded-2xl border p-6" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Plan actuel</h2>
            <span className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={user?.plan === 'pro'
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surf2)', color: 'var(--text2)', border: '1px solid var(--bdr)' }}>
              {planLabel}
            </span>
          </div>
          <p className="mb-5 text-[13px]" style={{ color: 'var(--text2)' }}>{planDesc}</p>
          {user?.plan !== 'pro' && (
            <div className="rounded-xl border p-4" style={{ background: 'var(--accent-l)', borderColor: 'var(--accent)' }}>
              <p className="mb-3 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
                Passez Pro — 9 €/mois
              </p>
              <p className="mb-4 text-[12.5px]" style={{ color: 'var(--accent)' }}>
                Projets illimités + sauvegarde cloud. Annulation à tout moment.
              </p>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
                Paiement disponible prochainement. Contactez-nous pour un accès anticipé.
              </p>
            </div>
          )}
        </div>

        {/* Session */}
        <div className="rounded-2xl border p-6" style={{ background: 'var(--surf)', borderColor: 'var(--bdr)' }}>
          <h2 className="mb-4 text-[14px] font-semibold" style={{ color: 'var(--text)' }}>Session</h2>
          <button type="button" onClick={() => void handleLogout()}
            className="rounded-xl border px-5 py-2.5 text-[13.5px] font-medium transition-colors"
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            Se déconnecter
          </button>
        </div>
      </main>
    </div>
  );
}
