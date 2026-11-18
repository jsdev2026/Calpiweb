import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import AuthPage from './page';

const fillRegister = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }));
  fireEvent.change(screen.getByPlaceholderText('Jean'), { target: { value: 'Jean' } });
  fireEvent.change(screen.getByPlaceholderText('Dupont'), { target: { value: 'Dupont' } });
  // Premier menu déroulant : « Vous êtes »
  fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: 'artisan' } });
  fireEvent.change(screen.getByPlaceholderText('vous@exemple.fr'), {
    target: { value: 'jean@exemple.fr' },
  });
  fireEvent.change(screen.getByPlaceholderText('8 caractères minimum'), {
    target: { value: 'motdepasse1' },
  });
};
const submitRegister = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte gratuit' }));

beforeEach(() => {
  Object.values(auth).forEach((f) => f.mockReset());
});

describe('inscription', () => {
  it('adresse déjà inscrite : message clair et accès à la connexion', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'x', identities: [] }, session: null },
      error: null,
    });
    render(<AuthPage />);
    fillRegister();
    submitRegister();
    const notice = await screen.findByTestId('existing-account');
    expect(notice.textContent).toMatch(/Un compte existe déjà avec l'adresse jean@exemple\.fr/);
    expect(screen.queryByTestId('confirmation-sent')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeTruthy();
    expect((screen.getByPlaceholderText('vous@exemple.fr') as HTMLInputElement).value).toBe(
      'jean@exemple.fr',
    );
  });

  it('nouveau compte : e-mail envoyé, renvoi proposé après un délai d’attente', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: { id: 'x', identities: [{ provider: 'email' }] }, session: null },
      error: null,
    });
    render(<AuthPage />);
    fillRegister();
    submitRegister();
    const sent = await screen.findByTestId('confirmation-sent');
    expect(sent.textContent).toMatch(/envoyé à jean@exemple\.fr/);
    expect(sent.textContent).toMatch(/courriers indésirables/);
    const resend = screen.getByRole('button', { name: 'Renvoyer l’e-mail (60 s)' });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Renvoyer l’e-mail (59 s)' })).toBeTruthy(),
    );
  });

  it('erreurs Supabase traduites en français', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'over_email_send_rate_limit',
        message: 'email rate limit exceeded',
        status: 429,
      },
    });
    render(<AuthPage />);
    fillRegister();
    submitRegister();
    expect(await screen.findByText(/Trop d’e-mails envoyés/)).toBeTruthy();
  });
});

describe('connexion', () => {
  it('adresse non confirmée : explication et renvoi de l’e-mail', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 },
    });
    auth.resend.mockResolvedValue({ data: {}, error: null });
    render(<AuthPage />);
    fireEvent.change(screen.getByPlaceholderText('vous@exemple.fr'), {
      target: { value: ' jean@exemple.fr ' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText(/pas encore confirmée/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer l’e-mail de confirmation' }));
    await waitFor(() =>
      expect(auth.resend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'signup', email: 'jean@exemple.fr' }),
      ),
    );
  });

  it('identifiants incorrects : message habituel, sans bouton de renvoi', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 },
    });
    render(<AuthPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Renvoyer/ })).toBeNull();
  });
});
