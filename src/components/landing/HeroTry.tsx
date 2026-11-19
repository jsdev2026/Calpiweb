'use client';
// Zone de démonstration de la page d'accueil : l'animation, et au clic sur « Cliquer pour
// tester » l'essai s'ouvre en grand par-dessus la page (l'éditeur n'est chargé qu'à ce moment).
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { MousePointerClick } from 'lucide-react';
import { HeroDemo } from './HeroDemo';

const TryIt = dynamic(() => import('./TryIt').then((m) => m.TryIt), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-64 items-center justify-center rounded-2xl text-[13px]"
      style={{ background: '#0D1117', color: 'rgba(255,255,255,0.5)' }}
    >
      Chargement de l’essai…
    </div>
  ),
});

export const HeroTry = () => {
  const [trying, setTrying] = useState(false);

  useEffect(() => {
    if (!trying) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTrying(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [trying]);

  return (
    <div className="relative">
      <HeroDemo />
      <button
        type="button"
        onClick={() => setTrying(true)}
        className="try-cta absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-[14px] font-bold text-white transition-transform hover:scale-[1.03]"
        style={{
          background: 'linear-gradient(135deg, #E8671A 0%, #C45510 100%)',
          boxShadow: '0 6px 24px rgba(232,103,26,0.5)',
        }}
      >
        <MousePointerClick size={17} aria-hidden />
        Cliquer pour tester
      </button>

      {trying && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Essai gratuit de CaléPlan"
          className="fixed inset-0 z-[200] flex items-stretch justify-center overflow-y-auto sm:items-center sm:p-6"
          style={{ background: 'rgba(8,9,12,0.8)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => e.target === e.currentTarget && setTrying(false)}
        >
          <div className="w-full max-w-[1100px]">
            <TryIt onClose={() => setTrying(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
