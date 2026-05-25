import type { WebSkill } from '../types.js'

export const reddit: WebSkill = {
  id: 'reddit',
  site: 'reddit.com',
  version: '1.0.0',
  description: 'Reddit: search posts, list subreddit, read post + top comments.',
  baseUrl: 'https://www.reddit.com',
  auth: {
    type: 'none',
    description: 'Public read-only via old.reddit.com JSON endpoints not used; uses DOM parsing.',
  },
  actions: [
    {
      name: 'list_subreddit',
      description: 'List the top posts of a subreddit by current sort.',
      inputSchema: {
        type: 'object',
        required: ['subreddit'],
        properties: {
          subreddit: { type: 'string', pattern: '^[A-Za-z0-9_]+$' },
          sort: { type: 'string', enum: ['hot', 'new', 'top', 'rising'], default: 'hot' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
        },
      },
      navigate: 'https://www.reddit.com/r/{{subreddit}}/{{sort}}/',
      handler: `
        const limit = input.limit ?? 25;
        const posts = [];
        for (const el of document.querySelectorAll('shreddit-post, [data-testid="post-container"]')) {
          const title = el.querySelector('a[slot="title"], h3')?.textContent?.trim() ?? '';
          const href = el.querySelector('a[slot="title"], a[data-click-id="body"]')?.getAttribute('href') ?? '';
          const score = el.getAttribute('score') ?? el.querySelector('[data-testid="upvote-count"]')?.textContent ?? '';
          posts.push({ title, url: href.startsWith('http') ? href : 'https://www.reddit.com' + href, score });
          if (posts.length >= limit) break;
        }
        return { subreddit: input.subreddit, sort: input.sort ?? 'hot', count: posts.length, posts };
      `,
    },
    {
      name: 'read_post',
      description: 'Fetch a post body and top-level comments.',
      inputSchema: {
        type: 'object',
        required: ['postUrl'],
        properties: {
          postUrl: { type: 'string', format: 'uri' },
          maxComments: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      navigate: '{{postUrl}}',
      handler: `
        const max = input.maxComments ?? 20;
        const title = document.querySelector('h1')?.textContent?.trim() ?? '';
        const body = document.querySelector('[slot="post-body"], [data-test-id="post-content"]')?.innerText?.trim() ?? '';
        const comments = [];
        for (const c of document.querySelectorAll('shreddit-comment, [data-testid="comment"]')) {
          const author = c.getAttribute('author') ?? c.querySelector('a[href^="/user/"]')?.textContent ?? '';
          const text = c.querySelector('[slot="comment"], .Comment')?.innerText?.trim() ?? '';
          comments.push({ author, text: text.slice(0, 2000) });
          if (comments.length >= max) break;
        }
        return { title, body: body.slice(0, 8000), commentCount: comments.length, comments };
      `,
    },
    {
      name: 'search',
      description: 'Search Reddit for posts matching a query.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
        },
      },
      navigate: 'https://www.reddit.com/search/?q={{query}}',
      handler: `
        const limit = input.limit ?? 25;
        const results = [];
        for (const el of document.querySelectorAll('a[data-testid="post-title"], h3 a')) {
          const title = el.textContent?.trim() ?? '';
          const url = el.getAttribute('href') ?? '';
          if (!title || !url) continue;
          results.push({ title, url: url.startsWith('http') ? url : 'https://www.reddit.com' + url });
          if (results.length >= limit) break;
        }
        return { query: input.query, count: results.length, results };
      `,
    },
  ],
}
