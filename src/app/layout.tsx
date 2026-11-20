import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { ThemeProvider } from '@/components/ThemeProvider';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from '@/constants/site';
import './globals.css';

// Polices auto-hébergées (Fontsource) : le build ne dépend plus de Google Fonts,
// dont le chargeur next/font/google échoue sur Vercel sans cache.
const dmSerifDisplay = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = localFont({
  src: '../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
  weight: '300 600',
  style: 'normal',
  variable: '--font-body',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${HOME_TITLE} | ${SITE_NAME}`,
    // Pages internes : « Mes projets | CaléPlan »
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
    url: '/',
    title: `${HOME_TITLE} | ${SITE_NAME}`,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${HOME_TITLE} | ${SITE_NAME}`,
    description: HOME_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${dmSerifDisplay.variable} ${dmSans.variable}`}
    >
      <head>
        {/* Prevent dark-mode flash before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('caleplan_dark')==='true')document.documentElement.setAttribute('data-dark','true');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
