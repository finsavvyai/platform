import type { WebSkill } from '../types.js'

export const genericWebPage: WebSkill = {
  id: 'generic-web-page',
  site: 'any',
  version: '1.0.0',
  description:
    'Read any URL: extract readable content, links, structured data. Works on any public page.',
  baseUrl: 'https://example.com',
  auth: { type: 'none' },
  actions: [
    {
      name: 'fetch_readable',
      description: 'Fetch a URL and return readable text content plus title and meta description.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
          maxChars: { type: 'integer', minimum: 200, maximum: 50000, default: 8000 },
        },
      },
      navigate: '{{url}}',
      handler: `
        const max = (input.maxChars ?? 8000);
        const title = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '';
        const article = document.querySelector('article, main, [role="main"]') || document.body;
        const text = (article.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, max);
        return { title, metaDesc, text, url: location.href };
      `,
    },
    {
      name: 'extract_links',
      description: 'Return all unique outbound links on a page with anchor text.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
          sameOriginOnly: { type: 'boolean', default: false },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        },
      },
      navigate: '{{url}}',
      handler: `
        const limit = input.limit ?? 100;
        const sameOrigin = !!input.sameOriginOnly;
        const origin = location.origin;
        const out = [];
        const seen = new Set();
        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.href;
          if (!href || seen.has(href)) continue;
          if (sameOrigin && !href.startsWith(origin)) continue;
          seen.add(href);
          out.push({ href, text: (a.textContent || '').trim().slice(0, 200) });
          if (out.length >= limit) break;
        }
        return { count: out.length, links: out };
      `,
    },
    {
      name: 'extract_jsonld',
      description: 'Return all JSON-LD structured data blocks on the page.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string', format: 'uri' } },
      },
      navigate: '{{url}}',
      handler: `
        const blocks = [];
        for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
          try { blocks.push(JSON.parse(el.textContent || 'null')); } catch {}
        }
        return { count: blocks.length, blocks };
      `,
    },
  ],
}
