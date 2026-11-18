'use client';

import { create } from 'zustand';

/**
 * État du panneau latéral, partagé par les modes Plan 2D, Calepinage et Quantitatif :
 * changer d'onglet ne change jamais la mise en page.
 * - `collapsed` (ordinateur) : panneau replié en barre d'icônes — mémorisé d'une visite à l'autre ;
 * - `mobileOpen` (smartphone) : panneau du bas déplié — remis à zéro à chaque visite.
 */
const STORAGE_KEY = 'caleplan_panel_collapsed';
/** Étapes (Plan 2D, Calepinage, Quantitatif) dont le bouton « suivant » a déjà servi */
const NAV_LEARNED_KEY = 'caleplan_nav_learned_steps';

function readCollapsed(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readNavLearned(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const v: unknown = JSON.parse(window.localStorage.getItem(NAV_LEARNED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface PanelState {
  collapsed: boolean;
  mobileOpen: boolean;
  /** Étapes dont le bouton « suivant » a déjà été utilisé : il arrête de pulser sur cette étape */
  navLearned: string[];
  markNavLearned: (step: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  collapsed: readCollapsed(),
  mobileOpen: false,
  navLearned: readNavLearned(),
  markNavLearned: (step) =>
    set((s) => {
      if (s.navLearned.includes(step)) return s;
      const navLearned = [...s.navLearned, step];
      try {
        window.localStorage.setItem(NAV_LEARNED_KEY, JSON.stringify(navLearned));
      } catch {
        // stockage indisponible : la pulsation s'arrête pour la session
      }
      return { navLearned };
    }),
  setCollapsed: (collapsed) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // stockage indisponible (navigation privée) : l'état reste valable pour la session
    }
    set({ collapsed });
  },
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
}));

export const PANEL_STORAGE_KEY = STORAGE_KEY;
export const NAV_LEARNED_STORAGE_KEY = NAV_LEARNED_KEY;
