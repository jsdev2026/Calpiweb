import type { MetadataRoute } from 'next';
import { PRIVATE_PATHS, SITE_URL } from '@/constants/site';

/** /robots.txt : tout le site public est indexable, les pages du compte ne le sont pas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
