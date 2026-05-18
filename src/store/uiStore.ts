'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro';
}

interface UiState {
  darkMode: boolean;
  user: AuthUser | null;
  init: () => Promise<void>;
  toggleDarkMode: () => void;
  logout: () => Promise<void>;
}

export const useUiStore = create<UiState>((set, get) => ({
  darkMode: false,
  user: null,

  init: async () => {
    if (typeof window === 'undefined') return;

    // Dark mode (localStorage — unchanged)
    const darkMode = localStorage.getItem('caleplan_dark') === 'true';
    if (darkMode) document.documentElement.setAttribute('data-dark', 'true');
    set({ darkMode });

    // Auth: read from Supabase session
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      set({ user: null });
      return;
    }

    // Read plan from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .single();

    set({
      user: {
        id: authUser.id,
        name: authUser.user_metadata?.name ?? authUser.email?.split('@')[0] ?? 'Utilisateur',
        email: authUser.email ?? '',
        plan: (profile?.plan ?? 'free') as 'free' | 'pro',
      },
    });
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

  logout: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
