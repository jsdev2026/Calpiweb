'use client';

import { create } from 'zustand';

export interface AuthUser {
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'team';
}

interface UiState {
  darkMode: boolean;
  user: AuthUser | null;
  init: () => void;
  toggleDarkMode: () => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  darkMode: false,
  user: null,

  init: () => {
    if (typeof window === 'undefined') return;
    const darkMode = localStorage.getItem('caleplan_dark') === 'true';
    const raw = localStorage.getItem('caleplan_user');
    const user: AuthUser | null = raw ? (JSON.parse(raw) as AuthUser) : null;
    if (darkMode) document.documentElement.setAttribute('data-dark', 'true');
    set({ darkMode, user });
  },

  toggleDarkMode: () => {
    const next = !get().darkMode;
    localStorage.setItem('caleplan_dark', String(next));
    if (next) {
      document.documentElement.setAttribute('data-dark', 'true');
    } else {
      document.documentElement.removeAttribute('data-dark');
    }
    set({ darkMode: next });
  },

  setUser: (user) => {
    localStorage.setItem('caleplan_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('caleplan_user');
    set({ user: null });
  },
}));
