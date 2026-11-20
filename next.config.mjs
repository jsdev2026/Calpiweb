/** Adresse officielle du site (domaine principal choisi dans Vercel) */
export const SITE_URL = 'https://www.caleplan.com';
/** Ancienne adresse de production, redirigée pour que Google ne connaisse qu'une adresse */
export const LEGACY_HOSTS = ['calpiweb.vercel.app'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Seulement l'ancienne adresse exacte : les prévisualisations des PR (autres sous-domaines
    // vercel.app) et le développement local ne sont pas redirigés.
    return LEGACY_HOSTS.map((host) => ({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: `${SITE_URL}/:path*`,
      permanent: true,
    }));
  },
};

export default nextConfig;
