import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Page du compte : titre d'onglet clair, jamais indexée par les moteurs de recherche
export const metadata: Metadata = {
  title: 'Mon compte',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
