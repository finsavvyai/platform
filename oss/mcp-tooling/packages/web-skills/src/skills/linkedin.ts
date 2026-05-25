import type { WebSkill } from '../types.js'

export const linkedin: WebSkill = {
  id: 'linkedin',
  site: 'linkedin.com',
  version: '1.0.0',
  description: 'LinkedIn: read public profile, list jobs, read company.',
  baseUrl: 'https://www.linkedin.com',
  auth: { type: 'cookie', description: 'Most pages require an authenticated session.' },
  actions: [
    {
      name: 'read_profile',
      description: 'Read public profile data: headline, location, current role.',
      inputSchema: {
        type: 'object',
        required: ['slug'],
        properties: { slug: { type: 'string', pattern: '^[A-Za-z0-9-]+$' } },
      },
      navigate: 'https://www.linkedin.com/in/{{slug}}/',
      authRequired: true,
      handler: `
        const name = document.querySelector('h1')?.textContent?.trim() ?? '';
        const headline = document.querySelector('.text-body-medium')?.textContent?.trim() ?? '';
        const location = document.querySelector('.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() ?? '';
        const about = document.querySelector('#about')?.closest('section')?.innerText?.trim().slice(0, 2000) ?? '';
        return { name, headline, location, about };
      `,
    },
    {
      name: 'list_jobs',
      description: 'List jobs for a search keyword + location.',
      inputSchema: {
        type: 'object',
        required: ['keywords'],
        properties: {
          keywords: { type: 'string', minLength: 1 },
          location: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
        },
      },
      navigate: 'https://www.linkedin.com/jobs/search/?keywords={{keywords}}&location={{location}}',
      authRequired: true,
      handler: `
        const limit = input.limit ?? 25;
        const jobs = [];
        for (const card of document.querySelectorAll('.base-card, .job-search-card')) {
          const title = card.querySelector('h3, .base-search-card__title')?.textContent?.trim() ?? '';
          const company = card.querySelector('h4, .base-search-card__subtitle')?.textContent?.trim() ?? '';
          const loc = card.querySelector('.job-search-card__location')?.textContent?.trim() ?? '';
          const url = card.querySelector('a')?.getAttribute('href') ?? '';
          if (title) jobs.push({ title, company, location: loc, url });
          if (jobs.length >= limit) break;
        }
        return { keywords: input.keywords, count: jobs.length, jobs };
      `,
    },
  ],
}
