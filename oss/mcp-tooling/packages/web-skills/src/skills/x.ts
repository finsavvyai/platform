import type { WebSkill } from '../types.js'

export const x: WebSkill = {
  id: 'x',
  site: 'x.com',
  version: '1.0.0',
  description:
    'X (Twitter): read profile, search tweets, read single tweet. Logged-out scope only.',
  baseUrl: 'https://x.com',
  auth: { type: 'cookie', description: 'Some endpoints need authenticated session cookies.' },
  actions: [
    {
      name: 'read_profile',
      description: 'Fetch a user profile: bio, followers, recent tweet titles.',
      inputSchema: {
        type: 'object',
        required: ['handle'],
        properties: {
          handle: { type: 'string', pattern: '^[A-Za-z0-9_]+$' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
        },
      },
      navigate: 'https://x.com/{{handle}}',
      authRequired: true,
      handler: `
        const limit = input.limit ?? 10;
        const bio = document.querySelector('[data-testid="UserDescription"]')?.textContent?.trim() ?? '';
        const tweets = [];
        for (const t of document.querySelectorAll('article[data-testid="tweet"]')) {
          const text = t.querySelector('[data-testid="tweetText"]')?.innerText?.trim() ?? '';
          const link = t.querySelector('a[href*="/status/"]')?.getAttribute('href') ?? '';
          tweets.push({ text, url: link ? 'https://x.com' + link : '' });
          if (tweets.length >= limit) break;
        }
        return { handle: input.handle, bio, tweetCount: tweets.length, tweets };
      `,
    },
    {
      name: 'search',
      description: 'Search recent tweets for a query.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
      navigate: 'https://x.com/search?q={{query}}&src=typed_query&f=live',
      authRequired: true,
      handler: `
        const limit = input.limit ?? 20;
        const out = [];
        for (const t of document.querySelectorAll('article[data-testid="tweet"]')) {
          const text = t.querySelector('[data-testid="tweetText"]')?.innerText?.trim() ?? '';
          const user = t.querySelector('[data-testid="User-Name"] a')?.textContent?.trim() ?? '';
          const link = t.querySelector('a[href*="/status/"]')?.getAttribute('href') ?? '';
          out.push({ user, text, url: link ? 'https://x.com' + link : '' });
          if (out.length >= limit) break;
        }
        return { query: input.query, count: out.length, tweets: out };
      `,
    },
  ],
}
