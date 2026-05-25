import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCheckoutUrl } from './lemonsqueezy.js';

describe('buildCheckoutUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when STORE_ID is not set', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = '';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = 'variant_123';

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');
    expect(url).toBeNull();
  });

  it('returns null when variant ID is not set for the plan', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'mystore';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = '';

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');
    expect(url).toBeNull();
  });

  it('builds a valid checkout URL for team plan', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'mystore';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = 'var_100';
    process.env.NEXT_PUBLIC_APP_URL = 'https://opensyber.cloud';

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');

    expect(url).not.toBeNull();
    expect(url).toContain('mystore.lemonsqueezy.com/buy/var_100');
    expect(url).toContain('embed=1');
    expect(url).toContain('checkout%5Bsuccess_url%5D=');
    expect(url).toContain('dashboard%3Fpayment%3Dsuccess');
  });

  it('builds a valid checkout URL for professional plan', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'store';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PROFESSIONAL = 'var_200';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('professional');

    expect(url).not.toBeNull();
    expect(url).toContain('store.lemonsqueezy.com/buy/var_200');
  });

  it('uses default APP_URL when env var not set', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'store';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = 'var_100';
    delete process.env.NEXT_PUBLIC_APP_URL;

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');

    expect(url).not.toBeNull();
    expect(url).toContain('opensyber.cloud');
  });

  it('includes redirect URL with payment=success', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'store';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = 'var_100';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.opensyber.cloud';

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');
    const parsed = new URL(url!);

    const successUrl = parsed.searchParams.get('checkout[success_url]');
    expect(successUrl).toBe('https://app.opensyber.cloud/dashboard?payment=success');
  });

  it('includes discount code when NEXT_PUBLIC_LS_TEST_COUPON is set', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'store';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = 'var_100';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_LS_TEST_COUPON = 'FREE100';

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');
    const parsed = new URL(url!);

    expect(parsed.searchParams.get('checkout[discount_code]')).toBe('FREE100');
  });

  it('omits discount code when NEXT_PUBLIC_LS_TEST_COUPON is not set', async () => {
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID = 'store';
    process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM = 'var_100';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    delete process.env.NEXT_PUBLIC_LS_TEST_COUPON;

    const { buildCheckoutUrl: freshBuild } = await import('./lemonsqueezy.js');
    const url = freshBuild('team');
    const parsed = new URL(url!);

    expect(parsed.searchParams.has('checkout[discount_code]')).toBe(false);
  });
});
