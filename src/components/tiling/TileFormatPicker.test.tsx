import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const { update, get } = vi.hoisted(() => ({
  update: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/supabase/profile', () => ({ profileDb: { update, get } }));

// Stockage en mémoire : indépendant de la version de Node
const memory = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
  },
});

import { DEFAULT_TILE_FORMATS } from '@/constants/tileDefaults';
import {
  TILE_FORMATS_STORAGE_KEY,
  sanitizeFormats,
  useTileFormatsStore,
} from '@/store/tileFormatsStore';
import { TileFormatPicker } from './TileFormatPicker';

beforeEach(() => {
  memory.clear();
  update.mockClear();
  act(() =>
    useTileFormatsStore.setState({ formats: DEFAULT_TILE_FORMATS, custom: false, loaded: true }),
  );
});

describe('sanitizeFormats', () => {
  it('garde les couples valides, sans doublon dans un sens ou dans l’autre', () => {
    expect(sanitizeFormats([[300, 600], [600, 300], [5, 10], 'x', [250.4, 400]])).toEqual([
      [300, 600],
      [250, 400],
    ]);
    expect(sanitizeFormats(null)).toBeNull();
  });
});

describe('TileFormatPicker', () => {
  it('enregistre le format saisi (+), dans le compte et sur l’appareil', () => {
    const onChange = vi.fn();
    render(<TileFormatPicker width={250} height={400} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le format 25 par 40 cm' }));
    expect(useTileFormatsStore.getState().formats).toContainEqual([250, 400]);
    expect(JSON.parse(memory.get(TILE_FORMATS_STORAGE_KEY)!)).toContainEqual([250, 400]);
    expect(update).toHaveBeenCalledWith({
      tileFormats: expect.arrayContaining([[250, 400]]),
    });
  });

  it('pas de bouton + pour un format déjà enregistré (même inversé)', () => {
    render(<TileFormatPicker width={600} height={300} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /Enregistrer le format/ })).toBeNull();
  });

  it('mode Modifier : supprimer un format puis revenir aux formats par défaut', () => {
    render(<TileFormatPicker width={300} height={600} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le format 80 par 80 cm' }));
    expect(useTileFormatsStore.getState().formats).not.toContainEqual([800, 800]);
    expect(useTileFormatsStore.getState().custom).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Formats par défaut' }));
    expect(useTileFormatsStore.getState().formats).toEqual(DEFAULT_TILE_FORMATS);
    expect(memory.has(TILE_FORMATS_STORAGE_KEY)).toBe(false);
    expect(update).toHaveBeenLastCalledWith({ tileFormats: null });
  });

  it('choisir un format applique ses dimensions', () => {
    const onChange = vi.fn();
    render(<TileFormatPicker width={300} height={600} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Format 60 par 120 cm' }));
    expect(onChange).toHaveBeenCalledWith([600, 1200]);
  });

  it('lecture seule : ni +, ni Modifier', () => {
    render(<TileFormatPicker width={250} height={400} onChange={() => {}} readOnly />);
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Enregistrer le format/ })).toBeNull();
  });
});
