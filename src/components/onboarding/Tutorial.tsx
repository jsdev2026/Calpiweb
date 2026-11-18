'use client';
// Tutoriel de prise en main : la démonstration animée de la page d'accueil, découpée en
// étapes commentées. S'ouvre à la première visite et depuis le menu en haut à droite.
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { HeroDemoFrame, useDemoClock } from '@/components/landing/HeroDemo';
import { tutorialSeen, useTutorialStore } from '@/store/tutorialStore';

export interface TutorialStep {
  kicker: string;
  title: string;
  intro?: string;
  points: string[];
  /** Extrait de l'animation joué en boucle (secondes du scénario de la page d'accueil) */
  range: readonly [number, number];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    kicker: 'Bienvenue',
    title: 'Votre premier calepinage en 3 étapes',
    intro:
      'Tracez la pièce, choisissez le carrelage, obtenez la liste de commande. Voici comment faire, en une minute.',
    points: [
      'Plan 2D : tracez la pièce',
      'Calepinage : choisissez le carrelage et la pose',
      'Quantitatif : commandez et exportez le PDF',
    ],
    range: [0, 16],
  },
  {
    kicker: 'Étape 1 · Plan 2D',
    title: 'Tracez votre pièce',
    points: [
      'Avec l’outil « Tracer des murs », cliquez pour poser chaque angle.',
      'Revenez au premier point pour fermer la pièce.',
      'Cliquez sur une cote pour saisir la longueur exacte.',
      'Ajoutez les portes et les zones non carrelées depuis le panneau.',
    ],
    range: [0.2, 4.5],
  },
  {
    kicker: 'Étape 2 · Calepinage',
    title: 'Choisissez le carrelage',
    points: [
      'Choisissez un format, ou enregistrez le vôtre.',
      'Réglez le joint et le type de pose : droit, décalé, chevron, bâton rompu.',
      'Placez le carreau de départ : ses cotes servent de repère sur le chantier.',
    ],
    range: [4.6, 9.9],
  },
  {
    kicker: 'Étape 3 · Quantitatif',
    title: 'Commandez juste ce qu’il faut',
    points: [
      'Le nombre de carreaux à commander, marge de sécurité incluse.',
      'La colle, le joint et les croisillons, calculés automatiquement.',
      'Le bon de commande en PDF, aux couleurs de votre entreprise.',
    ],
    range: [10, 15.3],
  },
  {
    kicker: 'Astuce',
    title: 'Passez d’une étape à l’autre',
    points: [
      'Les boutons ← et → en haut du panneau mènent à l’étape précédente ou suivante.',
      'Le bouton de l’étape suivante clignote à votre arrivée sur la page.',
      'Retrouvez ce tutoriel à tout moment dans le menu en haut à droite.',
    ],
    range: [3.75, 5.2],
  },
];

const ACCENT = '#E8671A';

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="7" stroke="rgba(232,103,26,0.45)" strokeWidth="1" />
    <path
      d="M5 8l2 2 4-4"
      stroke={ACCENT}
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Démonstration d'une étape : son extrait de l'animation, joué en boucle */
const StepDemo = ({ range }: { range: readonly [number, number] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const t = useDemoClock(ref, range);
  return <HeroDemoFrame t={t} frameRef={ref} />;
};

export const Tutorial = ({ autoOpen = false }: { autoOpen?: boolean }) => {
  const open = useTutorialStore((s) => s.open);
  const step = useTutorialStore((s) => s.step);
  const show = useTutorialStore((s) => s.show);
  const setStep = useTutorialStore((s) => s.setStep);
  const close = useTutorialStore((s) => s.close);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Première visite sur cet appareil : le tutoriel s'ouvre tout seul
  useEffect(() => {
    if (autoOpen && !tutorialSeen()) show(0);
  }, [autoOpen, show]);

  const last = TUTORIAL_STEPS.length - 1;
  const current = TUTORIAL_STEPS[Math.min(step, last)]!;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' && step < last) setStep(step + 1);
      else if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, step, last, close, setStep]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-6"
      style={{ background: 'rgba(8,9,12,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        data-testid="tutorial"
        className="relative flex max-h-[100svh] w-full max-w-[1040px] flex-col overflow-y-auto rounded-t-2xl sm:max-h-[92vh] sm:rounded-2xl"
        style={{
          background: '#08090C',
          backgroundImage: `
            linear-gradient(rgba(232,103,26,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,103,26,0.06) 1px, transparent 1px)`,
          backgroundSize: '52px 52px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
          color: '#E6EDF3',
        }}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer le tutoriel"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <X size={18} />
        </button>

        <div className="grid gap-6 p-5 pt-12 sm:p-8 md:grid-cols-[1.35fr_1fr] md:items-center md:gap-10 md:p-10">
          {/* Animation de l'étape (remise à zéro à chaque changement d'étape) */}
          <div className="min-w-0">
            <StepDemo key={step} range={current.range} />
          </div>

          {/* Explications */}
          <div className="flex min-w-0 flex-col">
            <p
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: ACCENT }}
            >
              {current.kicker}
            </p>
            <h2
              id="tutorial-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(24px, 3vw, 32px)',
                fontWeight: 400,
                lineHeight: 1.15,
                color: '#E6EDF3',
              }}
            >
              {current.title}
            </h2>
            {current.intro && (
              <p
                className="mt-3 text-[14.5px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                {current.intro}
              </p>
            )}
            <ul className="mt-5 space-y-3">
              {current.points.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-3 text-[14px] leading-snug"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  <span className="mt-0.5">
                    <Check />
                  </span>
                  {p}
                </li>
              ))}
            </ul>

            {/* Progression */}
            <div
              className="mt-7 flex items-center gap-2"
              role="tablist"
              aria-label="Étapes du tutoriel"
            >
              {TUTORIAL_STEPS.map((s, i) => (
                <button
                  key={s.title}
                  type="button"
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`Étape ${i + 1} : ${s.title}`}
                  onClick={() => setStep(i)}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: i === step ? 22 : 8,
                    background: i === step ? ACCENT : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
              <span className="ml-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {step + 1} / {TUTORIAL_STEPS.length}
              </span>
            </div>

            <div className="mt-6 flex items-center gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex h-11 items-center gap-1.5 rounded-[10px] px-4 text-[14px] font-semibold transition-colors hover:bg-white/5"
                  style={{
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.75)',
                  }}
                >
                  <ArrowLeft size={16} aria-hidden />
                  Précédent
                </button>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className="h-11 px-2 text-[13.5px] transition-colors hover:text-white"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  Passer le tutoriel
                </button>
              )}
              <button
                ref={nextRef}
                type="button"
                onClick={() => (step < last ? setStep(step + 1) : close())}
                className="ml-auto flex h-11 items-center gap-1.5 rounded-[10px] px-5 text-[14px] font-bold text-white transition-transform active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #E8671A 0%, #C45510 100%)',
                  boxShadow: '0 4px 20px rgba(232,103,26,0.4)',
                }}
              >
                {step < last ? (step === 0 ? 'Commencer' : 'Suivant') : 'C’est parti'}
                <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
