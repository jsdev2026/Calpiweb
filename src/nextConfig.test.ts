import { describe, expect, it } from 'vitest';
import nextConfig, { SITE_URL } from '../next.config.mjs';

describe('domaine caleplan.com', () => {
  it('l’ancienne adresse calpiweb.vercel.app redirige définitivement vers www.caleplan.com', async () => {
    expect(SITE_URL).toBe('https://www.caleplan.com');
    const redirects = await nextConfig.redirects!();
    expect(redirects).toEqual([
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'calpiweb.vercel.app' }],
        destination: 'https://www.caleplan.com/:path*',
        permanent: true,
      },
    ]);
  });
});
