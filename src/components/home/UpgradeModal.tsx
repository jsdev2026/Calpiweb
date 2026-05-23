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
          Passez au plan Pro
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          Vous avez atteint la limite du plan gratuit (1 projet).
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Projets illimités', 'Sauvegarde cloud automatique', 'Accès depuis tous vos appareils'].map((feat) => (
            <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>✓</span>
              {feat}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 20 }}>
          9 €/mois — annulation à tout moment
        </p>

        <button
          type="button"
          onClick={handleUpgrade}
          autoFocus
          className="btn-primary w-full py-3 text-[14px] font-semibold"
          style={{ marginBottom: 12 }}
        >
          Voir les offres Pro →
        </button>

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
