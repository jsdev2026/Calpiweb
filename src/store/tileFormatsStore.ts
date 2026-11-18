'use client';

import { create } from 'zustand';
import { DEFAULT_TILE_FORMATS, type TileFormat } from '@/constants/tileDefaults';
import { profileDb } from '@/lib/supabase/profile';

/**
 * Formats de carreaux proposés dans le Calepinage, propres à l'utilisateur :
 * ajout du format saisi, suppression, retour aux formats par défaut.
 * Enregistrés dans le profil (synchronisés entre appareils, migration 005)
 * et copiés sur l'appareil pour un affichage immédiat / hors migration.
 */

export const TILE_FORMATS_STORAGE_KEY = 'caleplan_tile_formats';
export const MAX_TILE_FORMATS = 24;

/** Même format, quel que soit le sens (30 × 60 = 60 × 30). */
export const sameFormat = (a: TileFormat, b: TileFormat) =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

/** Garde uniquement des couples de dimensions valides (mm), sans doublon. */
export function sanitizeFormats(raw: unknown): TileFormat[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TileFormat[] = [];
  for (const f of raw) {
    if (!Array.isArray(f) || f.length !== 2) continue;
    const [w, h] = f.map(Number);
    if (!(w! >= 10 && w! <= 4000 && h! >= 10 && h! <= 4000)) continue;
    const fmt: TileFormat = [Math.round(w!), Math.round(h!)];
    if (!out.some((o) => sameFormat(o, fmt))) out.push(fmt);
  }
  return out.slice(0, MAX_TILE_FORMATS);
}

function readLocal(): TileFormat[] | null {
  try {
    const raw = window.localStorage.getItem(TILE_FORMATS_STORAGE_KEY);
    return raw ? sanitizeFormats(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(formats: TileFormat[] | null) {
  try {
    if (formats) window.localStorage.setItem(TILE_FORMATS_STORAGE_KEY, JSON.stringify(formats));
    else window.localStorage.removeItem(TILE_FORMATS_STORAGE_KEY);
  } catch {
    // stockage indisponible : la liste reste valable pour la session
  }
}

interface TileFormatsState {
  formats: TileFormat[];
  /** Liste personnalisée (sinon formats par défaut) */
  custom: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  add: (format: TileFormat) => void;
  remove: (format: TileFormat) => void;
  reset: () => void;
}

export const useTileFormatsStore = create<TileFormatsState>((set, get) => {
  const save = (formats: TileFormat[] | null) => {
    writeLocal(formats);
    set({ formats: formats ?? DEFAULT_TILE_FORMATS, custom: formats !== null });
    // Synchronisation du compte : sans effet tant que la migration 005 n'est pas passée
    profileDb.update({ tileFormats: formats }).catch(() => {});
  };

  return {
    formats: DEFAULT_TILE_FORMATS,
    custom: false,
    loaded: false,

    load: async () => {
      if (get().loaded) return;
      const local = readLocal();
      set({ loaded: true, ...(local ? { formats: local, custom: true } : {}) });
      try {
        const profile = await profileDb.get();
        const remote = sanitizeFormats(profile?.tileFormats);
        if (remote) {
          writeLocal(remote);
          set({ formats: remote, custom: true });
        }
      } catch {
        // hors ligne / non connecté : on garde la copie de l'appareil
      }
    },

    add: (format) => {
      const { formats } = get();
      if (formats.some((f) => sameFormat(f, format)) || formats.length >= MAX_TILE_FORMATS) return;
      save([...formats, format]);
    },

    remove: (format) => save(get().formats.filter((f) => !sameFormat(f, format))),

    reset: () => save(null),
  };
});
