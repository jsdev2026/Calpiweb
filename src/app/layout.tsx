import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'CaléPlan — Calepinage professionnel',
  description: 'Application de calepinage carrelage pour professionnels du bâtiment',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${dmSerifDisplay.variable} ${dmSans.variable}`}>
      <head>
        {/* Prevent dark-mode flash before React hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('caleplan_dark')==='true')document.documentElement.setAttribute('data-dark','true');}catch(e){}})();` }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
