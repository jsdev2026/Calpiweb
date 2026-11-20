import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/site';

/** /sitemap.xml : pages publiques à faire connaître à Google (à compléter avec les futures pages). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
