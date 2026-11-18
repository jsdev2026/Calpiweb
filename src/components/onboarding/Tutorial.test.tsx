import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TUTORIAL_SEEN_KEY, useTutorialStore } from '@/store/tutorialStore';
import { TUTORIAL_STEPS, Tutorial } from './Tutorial';

// Stockage en mémoire : indépendant de la version de Node (Node 26 masque celui de jsdom)
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

beforeEach(() => {
  memory.clear();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
  act(() => useTutorialStore.setState({ open: false, step: 0 }));
});

const scene = () => screen.getByTestId('hero-demo').getAttribute('data-scene');

describe('Tutoriel', () => {
  it('s’ouvre tout seul à la première visite, plus ensuite', () => {
    const { unmount } = render(<Tutorial autoOpen />);
    expect(
      screen.getByRole('dialog', { name: 'Votre premier calepinage en 3 étapes' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Passer le tutoriel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(memory.get(TUTORIAL_SEEN_KEY)).toBe('true');
    unmount();
    render(<Tutorial autoOpen />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sans ouverture automatique : seulement à la demande (menu)', () => {
    render(<Tutorial />);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => useTutorialStore.getState().show());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('chaque étape montre l’écran correspondant de l’animation', () => {
    render(<Tutorial />);
    act(() => useTutorialStore.getState().show());
    const dialog = screen.getByRole('dialog');
    expect(scene()).toBe('PLAN');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Commencer' }));
    expect(within(dialog).getByRole('heading', { name: 'Tracez votre pièce' })).toBeTruthy();
    expect(scene()).toBe('PLAN');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suivant' }));
    expect(within(dialog).getByRole('heading', { name: 'Choisissez le carrelage' })).toBeTruthy();
    expect(scene()).toBe('TILING');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suivant' }));
    expect(scene()).toBe('QUANTITIES');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Précédent' }));
    expect(scene()).toBe('TILING');
  });

  it('dernière étape : rappelle le menu et ferme le tutoriel', () => {
    render(<Tutorial />);
    act(() => useTutorialStore.getState().show(TUTORIAL_STEPS.length - 1));
    expect(screen.getByText(/menu en haut à droite/)).toBeTruthy();
    expect(screen.getByText(`${TUTORIAL_STEPS.length} / ${TUTORIAL_STEPS.length}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'C’est parti' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(memory.get(TUTORIAL_SEEN_KEY)).toBe('true');
  });

  it('clavier : flèches pour naviguer, Échap pour fermer', () => {
    render(<Tutorial />);
    act(() => useTutorialStore.getState().show());
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(useTutorialStore.getState().step).toBe(1);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(useTutorialStore.getState().step).toBe(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('points de progression cliquables', () => {
    render(<Tutorial />);
    act(() => useTutorialStore.getState().show());
    fireEvent.click(screen.getByRole('tab', { name: /Étape 4 :/ }));
    expect(screen.getByRole('heading', { name: 'Commandez juste ce qu’il faut' })).toBeTruthy();
  });

  it('l’extrait de chaque étape reste dans sa fenêtre en boucle', () => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    render(<Tutorial />);
    act(() => useTutorialStore.getState().show(2)); // Calepinage : 4,6 → 9,9 s
    act(() => {
      for (let i = 0; i <= 40; i++) frames.shift()?.(i * 500); // 20 s simulées
    });
    expect(scene()).toBe('TILING');
    raf.mockRestore();
  });
});
