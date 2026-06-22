'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleUpgrade = () => {
    router.push('/account');
    onClose();
  };

  return (
    <div
      data-testid="upgrade-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="relative w-full max-w-sm rounded-2xl border p-7 shadow-2xl"
        style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', margin: '0 16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[18px]"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          ×
        </button>

        <h2 id="upgrade-modal-title" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Limite atteinte
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          Vous avez utilisé votre projet inclus. Comment continuer ?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>+1 projet</span>
            <span style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4 }}>Un crédit projet, sans engagement.</span>
            <button
              type="button"
              onClick={handleUpgrade}
              style={{ marginTop: 'auto', padding: '7px 10px', background: 'transparent', border: '1px solid var(--bdr)', borderRadius: 7, color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Acheter →
            </button>
          </div>

          <div style={{ background: 'var(--surf2)', border: '1.5px solid var(--accent)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -1, right: 8, background: 'var(--accent)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: '0 0 4px 4px', letterSpacing: '0.5px' }}>
              RECOMMANDÉ
            </span>
            <span style={{ fontSize: 22 }}>♾️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Illimité</span>
            <span style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4 }}>Abonnement — projets, cloud, tous appareils.</span>
            <button
              type="button"
              onClick={handleUpgrade}
              className="btn-primary"
              style={{ marginTop: 'auto', padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              S&apos;abonner →
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-[13px]"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Continuer avec le plan gratuit
        </button>
      </div>
    </div>
  );
}
