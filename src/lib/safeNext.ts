/**
 * Chemin de retour après un lien reçu par e-mail (`?next=`) : seulement un chemin interne
 * (« /… »), jamais une autre adresse (« //site », « https://… », « /\\site »).
 */
export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}
