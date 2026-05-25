import type { WebSkill } from '../types.js'

export const airbnb: WebSkill = {
  id: 'airbnb',
  site: 'airbnb.com',
  version: '1.0.0',
  description: 'Airbnb: search listings, read listing detail.',
  baseUrl: 'https://www.airbnb.com',
  auth: { type: 'none' },
  actions: [
    {
      name: 'search_listings',
      description: 'Search Airbnb listings for a location and dates.',
      inputSchema: {
        type: 'object',
        required: ['location'],
        properties: {
          location: { type: 'string', minLength: 1 },
          checkin: { type: 'string', format: 'date' },
          checkout: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 10, default: 2 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
      navigate:
        'https://www.airbnb.com/s/{{location}}/homes?checkin={{checkin}}&checkout={{checkout}}&adults={{adults}}',
      handler: `
        const limit = input.limit ?? 20;
        const listings = [];
        for (const card of document.querySelectorAll('[itemprop="itemListElement"], [data-testid="card-container"]')) {
          const title = card.querySelector('meta[itemprop="name"]')?.getAttribute('content')
            ?? card.querySelector('[data-testid="listing-card-title"]')?.textContent?.trim() ?? '';
          const url = card.querySelector('meta[itemprop="url"]')?.getAttribute('content')
            ?? card.querySelector('a')?.getAttribute('href') ?? '';
          const price = card.querySelector('._tt122m, ._1jo4hgw')?.textContent?.trim() ?? '';
          if (title) listings.push({ title, price, url: url.startsWith('http') ? url : 'https://www.airbnb.com' + url });
          if (listings.length >= limit) break;
        }
        return { location: input.location, count: listings.length, listings };
      `,
    },
    {
      name: 'listing_detail',
      description: 'Read listing detail: title, host, amenities, description.',
      inputSchema: {
        type: 'object',
        required: ['listingUrl'],
        properties: { listingUrl: { type: 'string', format: 'uri' } },
      },
      navigate: '{{listingUrl}}',
      handler: `
        const title = document.querySelector('h1')?.textContent?.trim() ?? '';
        const host = document.querySelector('[data-section-id="HOST_OVERVIEW_DEFAULT"] h2')?.textContent?.trim() ?? '';
        const description = document.querySelector('[data-section-id="DESCRIPTION_DEFAULT"]')?.innerText?.trim().slice(0, 4000) ?? '';
        const amenities = [];
        for (const li of document.querySelectorAll('[data-section-id="AMENITIES_DEFAULT"] li')) {
          const t = li.textContent?.trim();
          if (t) amenities.push(t);
        }
        return { title, host, description, amenities };
      `,
    },
  ],
}
