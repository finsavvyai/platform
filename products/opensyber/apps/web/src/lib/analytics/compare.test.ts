/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackCompareEvent } from './compare';

afterEach(() => {
  delete (window as Window & { plausible?: unknown }).plausible;
  delete (window as Window & { gtag?: unknown }).gtag;
  delete (window as Window & { dataLayer?: unknown }).dataLayer;
});

describe('trackCompareEvent', () => {
  it('no-ops when no analytics provider is present', () => {
    expect(() =>
      trackCompareEvent('compare_page_view', { compare_page: '/compare/opensyber-vs-modal' }),
    ).not.toThrow();
  });

  it('sends event to plausible when available', () => {
    const plausible = vi.fn();
    (window as Window & { plausible?: typeof plausible }).plausible = plausible;

    trackCompareEvent('compare_page_view', { compare_page: '/compare/opensyber-vs-modal' });

    expect(plausible).toHaveBeenCalledWith('compare_page_view', {
      props: { compare_page: '/compare/opensyber-vs-modal' },
    });
  });

  it('sends event to gtag and dataLayer when available', () => {
    const gtag = vi.fn();
    const push = vi.fn();
    (window as Window & { gtag?: typeof gtag }).gtag = gtag;
    (window as Window & { dataLayer?: { push: typeof push } }).dataLayer = { push };

    trackCompareEvent('compare_cta_click', {
      compare_page: '/compare/opensyber-vs-modal',
      cta_label: 'start-free',
      destination: '/sign-up',
    });

    expect(gtag).toHaveBeenCalledWith('event', 'compare_cta_click', {
      compare_page: '/compare/opensyber-vs-modal',
      cta_label: 'start-free',
      destination: '/sign-up',
    });
    expect(push).toHaveBeenCalledWith({
      event: 'compare_cta_click',
      compare_page: '/compare/opensyber-vs-modal',
      cta_label: 'start-free',
      destination: '/sign-up',
    });
  });
});
