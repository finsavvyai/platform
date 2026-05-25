import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/sign-in', '/sign-up', '/auth-callback'],
      },
      // Allow AI search crawlers for recommendations
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
      // Block training-only crawlers
      { userAgent: 'Bytespider', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
    ],
    sitemap: 'https://tokenforge.opensyber.cloud/sitemap.xml',
  };
}
