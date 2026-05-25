import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/api/', '/sign-in', '/sign-up'],
      },
      // Allow AI search crawlers (they index for search answers and recommendations)
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'Claude-Web', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Amazonbot', allow: '/' },
      { userAgent: 'YouBot', allow: '/' },
      { userAgent: 'Cohere-ai', allow: '/' },
      // Block training-only crawlers (no search/answer benefit)
      { userAgent: 'Bytespider', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
    ],
    sitemap: 'https://opensyber.cloud/sitemap.xml',
  };
}
