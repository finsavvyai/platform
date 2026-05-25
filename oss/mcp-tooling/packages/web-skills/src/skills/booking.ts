import type { WebSkill } from '../types.js'

export const booking: WebSkill = {
  id: 'booking',
  site: 'booking.com',
  version: '1.0.0',
  description: 'Booking.com: search hotels by destination + dates, read property details.',
  baseUrl: 'https://www.booking.com',
  auth: { type: 'none' },
  actions: [
    {
      name: 'search_hotels',
      description: 'Search hotels for a destination and stay range.',
      inputSchema: {
        type: 'object',
        required: ['destination', 'checkin', 'checkout'],
        properties: {
          destination: { type: 'string', minLength: 1 },
          checkin: { type: 'string', format: 'date' },
          checkout: { type: 'string', format: 'date' },
          adults: { type: 'integer', minimum: 1, maximum: 10, default: 2 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
        },
      },
      navigate:
        'https://www.booking.com/searchresults.html?ss={{destination}}&checkin={{checkin}}&checkout={{checkout}}&group_adults={{adults}}',
      handler: `
        const limit = input.limit ?? 25;
        const hotels = [];
        for (const card of document.querySelectorAll('[data-testid="property-card"]')) {
          const name = card.querySelector('[data-testid="title"]')?.textContent?.trim() ?? '';
          const price = card.querySelector('[data-testid="price-and-discounted-price"]')?.textContent?.trim() ?? '';
          const score = card.querySelector('[data-testid="review-score"]')?.textContent?.trim() ?? '';
          const url = card.querySelector('a[data-testid="title-link"]')?.getAttribute('href') ?? '';
          if (name) hotels.push({ name, price, score, url });
          if (hotels.length >= limit) break;
        }
        return { destination: input.destination, checkin: input.checkin, checkout: input.checkout, count: hotels.length, hotels };
      `,
    },
    {
      name: 'property_detail',
      description: 'Read property detail page: name, score, amenities, description.',
      inputSchema: {
        type: 'object',
        required: ['propertyUrl'],
        properties: { propertyUrl: { type: 'string', format: 'uri' } },
      },
      navigate: '{{propertyUrl}}',
      handler: `
        const name = document.querySelector('h2.pp-header__title, h1')?.textContent?.trim() ?? '';
        const score = document.querySelector('[data-testid="review-score-component"]')?.textContent?.trim() ?? '';
        const description = document.querySelector('#property_description_content')?.innerText?.trim().slice(0, 4000) ?? '';
        const amenities = [];
        for (const a of document.querySelectorAll('[data-testid="property-most-popular-facilities-wrapper"] li')) {
          const t = a.textContent?.trim();
          if (t) amenities.push(t);
        }
        return { name, score, description, amenities };
      `,
    },
  ],
}
