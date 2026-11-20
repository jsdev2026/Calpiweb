import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { safeNext } from '@/lib/safeNext';

const auth = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import NewPasswordPage from './page';

beforeEach(() => {
  auth.getUser.mockReset();
  auth.updateUser.mockReset();
  push.mockReset();
});

const fill = (a: string, b: string) => {
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: a } });
  fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: b } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
};

describe('Nouveau mot de passe (lien « mot de passe oublié »)', () => {
  it('lien valide : enregistre le nouveau mot de passe puis ouvre les projets', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    render(<NewPasswordPage />);
    await screen.findByLabelText('Nouveau mot de passe');
    fill('court', 'court');
    expect(screen.getByRole('alert').textContent).toMatch(/au moins 8 caractères/);
    fill('motdepasse1', 'motdepasse2');
    expect(screen.getByRole('alert').textContent).toMatch(/pas identiques/);
    fill('motdepasse1', 'motdepasse1');
    expect(await screen.findByText(/Mot de passe modifié/)).toBeTruthy();
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'motdepasse1' });
    await vi.advanceTimersByTimeAsync(1600);
    expect(push).toHaveBeenCalledWith('/dashboard');
    vi.useRealTimers();
  });

  it('lien expiré (pas de session) : propose d’en redemander un', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    render(<NewPasswordPage />);
    expect(await screen.findByText(/invalide ou a expiré/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Demander un nouveau lien' }).getAttribute('href'),
    ).toBe('/auth');
  });

  it('même mot de passe que l’ancien : message clair', async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    auth.updateUser.mockResolvedValue({
      data: {},
      error: { code: 'same_password', message: 'x', status: 422 },
    });
    render(<NewPasswordPage />);
    await screen.findByLabelText('Nouveau mot de passe');
    fill('motdepasse1', 'motdepasse1');
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/différent de l’ancien/),
    );
  });
});

describe('retour des liens e-mail (?next=)', () => {
  it('n’accepte que des chemins internes', () => {
    expect(safeNext('/auth/nouveau-mot-de-passe')).toBe('/auth/nouveau-mot-de-passe');
    expect(safeNext(null)).toBe('/dashboard');
    expect(safeNext('https://pirate.example')).toBe('/dashboard');
    expect(safeNext('//pirate.example')).toBe('/dashboard');
    expect(safeNext('/\\pirate.example')).toBe('/dashboard');
  });
});
