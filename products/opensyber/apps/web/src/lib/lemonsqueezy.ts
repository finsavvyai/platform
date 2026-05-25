type CheckoutPlan = 'team' | 'professional';

const VARIANT_MAP: Record<CheckoutPlan, string | undefined> = {
  team: process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM,
  professional: process.env.NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PROFESSIONAL,
};

const STORE_ID = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID;
const TEST_COUPON = process.env.NEXT_PUBLIC_LS_TEST_COUPON;

/**
 * Build a LemonSqueezy hosted checkout URL for a given plan.
 * Returns null if env vars are not set (dev mode).
 */
export function buildCheckoutUrl(plan: CheckoutPlan): string | null {
  const variantId = VARIANT_MAP[plan];
  if (!variantId || !STORE_ID) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opensyber.cloud';

  const url = new URL(`https://${STORE_ID}.lemonsqueezy.com/buy/${variantId}`);
  url.searchParams.set('embed', '1');
  url.searchParams.set('media', '0');
  url.searchParams.set('checkout[success_url]', `${appUrl}/dashboard?payment=success`);
  if (TEST_COUPON) {
    url.searchParams.set('checkout[discount_code]', TEST_COUPON);
  }

  return url.toString();
}
