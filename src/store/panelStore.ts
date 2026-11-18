'use client';

import { create } from 'zustand';

/**
 * État du panneau latéral, partagé par les modes Plan 2D, Calepinage et Quantitatif :
 * changer d'onglet ne change jamais la mise en page.
 * - `collapsed` (ordinateur) : panneau replié en barre d'icônes — mémorisé d'une visite à l'autre ;
 * - `mobileOpen` (smartphone) : panneau du bas déplié — remis à zéro à chaque visite.
 */
const STORAGE_KEY = 'caleplan_panel_collapsed';

function readCollapsed(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

interface PanelState {
  collapsed: boolean;
  mobileOpen: boolean;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  collapsed: readCollapsed(),
  mobileOpen: false,
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
