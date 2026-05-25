/**
 * URL constants for all LunaOS products.
 * Reads from environment or falls back to production URLs.
 */

export const URLS = {
  marketing: {
    base: process.env.MARKETING_URL || 'https://lunaos.ai',
    home: '/',
    pricing: '/#pricing',
    demo: '/demo.html',
    docs: '/docs.html',
    investors: '/investors.html',
    contact: '/contact.html',
    blog: '/blog.html',
    sdk: '/sdk.html',
  },

  dashboard: {
    base: process.env.DASHBOARD_URL || 'https://agents.lunaos.ai',
    home: '/',
    login: '/login',
    signup: '/signup',
    agents: '/agents',
    settings: '/settings',
    apiKeys: '/api-keys',
    billing: '/billing',
    analytics: '/analytics',
    onboarding: '/onboarding',
  },

  studio: {
    base: process.env.STUDIO_URL || 'https://studio.lunaos.ai',
    home: '/',
    editor: '/editor',
    workflows: '/workflows',
    templates: '/templates',
  },

  docs: {
    base: process.env.DOCS_URL || 'https://docs.lunaos.ai',
    home: '/',
    quickstart: '/quickstart',
    apiReference: '/api',
    guides: '/guides',
    agents: '/agents',
  },

  api: {
    base: process.env.API_URL || 'https://api.lunaos.ai',
    health: '/health',
    version: '/version',
    auth: '/auth',
    agents: '/agents',
    keys: '/api-keys',
  },
} as const;

export type ProductName = keyof typeof URLS;
