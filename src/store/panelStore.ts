'use client';

import { create } from 'zustand';

/**
 * État du panneau latéral, partagé par les modes Plan 2D, Calepinage et Quantitatif :
 * changer d'onglet ne change jamais la mise en page.
 * - `collapsed` (ordinateur) : panneau replié en barre d'icônes — mémorisé d'une visite à l'autre ;
 * - `mobileOpen` (smartphone) : panneau du bas déplié — remis à zéro à chaque visite.
 */
const STORAGE_KEY = 'caleplan_panel_collapsed';
const NAV_LEARNED_KEY = 'caleplan_nav_learned';

function readCollapsed(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readNavLearned(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(NAV_LEARNED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface PanelState {
  collapsed: boolean;
  mobileOpen: boolean;
  /** Liens « précédent / suivant » déjà utilisés : on arrête de les faire pulser */
  navLearned: boolean;
  markNavLearned: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  collapsed: readCollapsed(),
  mobileOpen: false,
  navLearned: readNavLearned(),
  markNavLearned: () => {
    try {
      window.localStorage.setItem(NAV_LEARNED_KEY, 'true');
    } catch {
      // stockage indisponible : la pulsation s'arrête pour la session
    }
    set({ navLearned: true });
  },
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
