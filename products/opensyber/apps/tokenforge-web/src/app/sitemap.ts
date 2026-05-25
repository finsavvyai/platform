import type { MetadataRoute } from 'next';

const BASE = 'https://tokenforge.opensyber.cloud';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const staticPages = [
    { url: `${BASE}/`, changeFrequency: 'weekly' as const, priority: 1.0 },
    { url: `${BASE}/pricing`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${BASE}/docs`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${BASE}/docs/integrations`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/docs/integrations/native`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE}/docs/siem`, changeFrequency: 'monthly' as const, priority: 0.6 },
    { url: `${BASE}/blog/session-hijacking-after-mfa`, changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: `${BASE}/blog/microsoft-365-session-security`, changeFrequency: 'monthly' as const, priority: 0.7 },
    // AI agent discovery files
    { url: `${BASE}/llms.txt`, changeFrequency: 'monthly' as const, priority: 0.5 },
  ];

  return staticPages.map((page) => ({ ...page, lastModified: now }));
}
