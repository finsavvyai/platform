import { useEffect } from 'react';

/**
 * SEO metadata contract for a `/vs/:slug` comparison page.
 *
 * Qestro does not ship `react-helmet-async`, so we imperatively manage `<head>`
 * entries via `document.head`. This is less ideal for SSR-based crawlers, but
 * Googlebot and AI crawlers (OpenAI, Perplexity, Claude) execute JS and will
 * pick up the injected tags. We also ship JSON-LD structured data for rich
 * results (Product + Review comparison) — Google renders a side-by-side card
 * in SERPs when both entities are declared.
 */
export interface VsSeoConfig {
  title: string;
  description: string;
  canonical: string;
  competitorName: string;
  jsonLd: Record<string, unknown>;
}

const MANAGED_ATTR = 'data-vs-seo';

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(MANAGED_ATTR, 'true');
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
    return;
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
};

const upsertLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute(MANAGED_ATTR, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const upsertJsonLd = (id: string, payload: Record<string, unknown>) => {
  let el = document.head.querySelector<HTMLScriptElement>(`script[data-vs-seo-id="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-vs-seo-id', id);
    el.setAttribute(MANAGED_ATTR, 'true');
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
};

export const useVsSeo = ({ title, description, canonical, jsonLd }: VsSeoConfig) => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertLink('canonical', canonical);

    upsertJsonLd('vs-page', jsonLd);

    return () => {
      document.title = prevTitle;
      // Leave meta tags in place — overwritten on next navigation. Removing
      // on unmount causes SPA flicker in Google's rendering queue.
    };
  }, [title, description, canonical, jsonLd]);
};

export const buildVsJsonLd = (competitorName: string, description: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Qestro',
  description,
  brand: { '@type': 'Brand', name: 'Qestro' },
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  review: {
    '@type': 'Review',
    reviewBody: `Qestro vs ${competitorName} — feature and pricing comparison for AI-native test automation.`,
    author: { '@type': 'Organization', name: 'Qestro' },
    reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
  },
});
