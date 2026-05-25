import type { WebSkill, WebAction } from '../types.js'

export interface SiteSample {
  url: string
  title?: string
  html?: string
  jsonLd?: unknown[]
  forms?: Array<{ action: string; method: string; inputs: string[] }>
}

export interface SiteGeneratorInput {
  url: string
  sample?: SiteSample
  siteId?: string
}

export function generateSkillFromSite(input: SiteGeneratorInput): WebSkill {
  const u = new URL(input.url)
  const host = u.hostname.replace(/^www\./, '')
  const id = (input.siteId ?? host.split('.')[0]).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const actions: WebAction[] = []

  actions.push(buildReadableAction(input.url))

  const searchForm = input.sample?.forms?.find(
    f => /search|q|query/i.test(f.action) || f.inputs.some(i => /q|search/i.test(i))
  )
  if (searchForm) {
    actions.push(buildSearchAction(u.origin, searchForm))
  }

  if (input.sample?.jsonLd && input.sample.jsonLd.length > 0) {
    actions.push(buildJsonLdAction(input.url))
  }

  return {
    id: `${id}-generated`,
    site: host,
    version: '0.1.0',
    description: `Auto-generated browse skill for ${host}. Review actions before signing.`,
    baseUrl: u.origin,
    auth: { type: 'none' },
    actions,
  }
}

function buildReadableAction(url: string): WebAction {
  return {
    name: 'read_page',
    description: `Fetch and extract readable content from a page on ${new URL(url).hostname}.`,
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: { type: 'string', description: 'Path on the site, e.g. /about' },
        maxChars: { type: 'integer', minimum: 200, maximum: 50000, default: 8000 },
      },
    },
    navigate: `${new URL(url).origin}{{path}}`,
    handler: `
      const max = input.maxChars ?? 8000;
      const title = document.title;
      const text = (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, max);
      return { title, text, url: location.href };
    `,
  }
}

function buildSearchAction(
  origin: string,
  form: { action: string; method: string; inputs: string[] }
): WebAction {
  const qParam = form.inputs.find(i => /^(q|query|search|s)$/i.test(i)) ?? 'q'
  const actionUrl = form.action.startsWith('http')
    ? form.action
    : `${origin}${form.action.startsWith('/') ? form.action : '/' + form.action}`
  return {
    name: 'search',
    description:
      'Search the site for a query. Selectors inferred from HTML sample — review before trusting.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
    },
    navigate: `${actionUrl}?${qParam}={{query}}`,
    handler: `
      const limit = input.limit ?? 20;
      const out = [];
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.href;
        const text = (a.textContent || '').trim();
        if (!text || text.length < 4) continue;
        out.push({ text: text.slice(0, 200), url: href });
        if (out.length >= limit) break;
      }
      return { query: input.query, count: out.length, results: out };
    `,
  }
}

function buildJsonLdAction(url: string): WebAction {
  return {
    name: 'structured_data',
    description: 'Return JSON-LD structured data blocks. Useful for products, articles, events.',
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: { path: { type: 'string' } },
    },
    navigate: `${new URL(url).origin}{{path}}`,
    handler: `
      const blocks = [];
      for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { blocks.push(JSON.parse(el.textContent || 'null')); } catch {}
      }
      return { count: blocks.length, blocks };
    `,
  }
}
