'use client';

import { create } from 'zustand';

/** Tutoriel déjà vu (ou passé) sur cet appareil : il ne s'ouvre plus tout seul */
export const TUTORIAL_SEEN_KEY = 'caleplan_tutorial_seen';

export function tutorialSeen(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
  } catch {
    // stockage indisponible : on ne force pas le tutoriel à chaque visite
    return true;
  }
}

interface TutorialState {
  open: boolean;
  step: number;
  /** Ouvre le tutoriel (menu « Tutoriel », ou première visite) */
  show: (step?: number) => void;
  setStep: (step: number) => void;
  /** Ferme et mémorise que le tutoriel a été vu */
  close: () => void;
}

export const useTutorialStore = create<TutorialState>((set) => ({
  open: false,
  step: 0,
  show: (step = 0) => set({ open: true, step }),
  setStep: (step) => set({ step }),
  close: () => {
    try {
      window.localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    } catch {
      // stockage indisponible : le tutoriel reste fermé pour la session
    }
    set({ open: false });
  },
}));
