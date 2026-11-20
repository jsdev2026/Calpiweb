import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safeNext';

/**
 * Retour des liens reçus par e-mail (confirmation d'inscription, mot de passe oublié,
 * changement d'adresse) : le code est échangé contre une session, puis redirection vers
 * `next` (chemin interne uniquement) ou le tableau de bord.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Lien de réinitialisation invalide ou expiré : on propose d'en redemander un
  if (next.startsWith('/auth/nouveau-mot-de-passe')) {
    return NextResponse.redirect(`${origin}/auth?error=reset_failed`);
  }
  return NextResponse.redirect(`${origin}/auth?error=confirmation_failed`);
}
