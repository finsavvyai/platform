import type { WebSkill } from '../types.js'

export const amazon: WebSkill = {
  id: 'amazon',
  site: 'amazon.com',
  version: '1.0.0',
  description: 'Amazon: product search, product detail, review snapshot.',
  baseUrl: 'https://www.amazon.com',
  auth: { type: 'none' },
  actions: [
    {
      name: 'search',
      description: 'Search Amazon for products matching a query.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
      navigate: 'https://www.amazon.com/s?k={{query}}',
      handler: `
        const limit = input.limit ?? 20;
        const out = [];
        for (const card of document.querySelectorAll('[data-component-type="s-search-result"]')) {
          const title = card.querySelector('h2 span')?.textContent?.trim() ?? '';
          const url = card.querySelector('h2 a')?.getAttribute('href') ?? '';
          const price = card.querySelector('.a-price > .a-offscreen')?.textContent?.trim() ?? '';
          const rating = card.querySelector('.a-icon-alt')?.textContent?.trim() ?? '';
          const asin = card.getAttribute('data-asin') ?? '';
          if (title) out.push({ asin, title, price, rating, url: url ? 'https://www.amazon.com' + url : '' });
          if (out.length >= limit) break;
        }
        return { query: input.query, count: out.length, results: out };
      `,
    },
    {
      name: 'product_detail',
      description: 'Read product detail page: title, price, rating, bullets, images.',
      inputSchema: {
        type: 'object',
        required: ['asin'],
        properties: { asin: { type: 'string', pattern: '^[A-Z0-9]{10}$' } },
      },
      navigate: 'https://www.amazon.com/dp/{{asin}}',
      handler: `
        const title = document.querySelector('#productTitle')?.textContent?.trim() ?? '';
        const price = document.querySelector('.a-price .a-offscreen')?.textContent?.trim() ?? '';
        const rating = document.querySelector('#acrPopover')?.getAttribute('title') ?? '';
        const reviewCount = document.querySelector('#acrCustomerReviewText')?.textContent?.trim() ?? '';
        const bullets = [];
        for (const li of document.querySelectorAll('#feature-bullets li')) {
          const t = li.textContent?.trim();
          if (t) bullets.push(t);
        }
        const images = [];
        for (const img of document.querySelectorAll('#altImages img')) {
          const src = img.getAttribute('src');
          if (src) images.push(src);
        }
        return { asin: input.asin, title, price, rating, reviewCount, bullets, images };
      `,
    },
    {
      name: 'top_reviews',
      description: 'Fetch top reviews for a product.',
      inputSchema: {
        type: 'object',
        required: ['asin'],
        properties: {
          asin: { type: 'string', pattern: '^[A-Z0-9]{10}$' },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
        },
      },
      navigate: 'https://www.amazon.com/product-reviews/{{asin}}',
      handler: `
        const limit = input.limit ?? 10;
        const reviews = [];
        for (const r of document.querySelectorAll('[data-hook="review"]')) {
          const stars = r.querySelector('[data-hook="review-star-rating"]')?.textContent?.trim() ?? '';
          const title = r.querySelector('[data-hook="review-title"]')?.textContent?.trim() ?? '';
          const body = r.querySelector('[data-hook="review-body"]')?.textContent?.trim() ?? '';
          reviews.push({ stars, title, body: body.slice(0, 2000) });
          if (reviews.length >= limit) break;
        }
        return { asin: input.asin, count: reviews.length, reviews };
      `,
    },
  ],
}
