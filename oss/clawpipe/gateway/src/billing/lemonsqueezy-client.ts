/**
 * LemonSqueezy REST API client (minimal).
 * Only the endpoints we need: checkout creation + customer portal link.
 *
 * Auth: Bearer token via env.LEMONSQUEEZY_API_KEY.
 * Store ID: env.LEMONSQUEEZY_STORE_ID (required for /checkouts).
 */

import type { Env } from '../types';

const LS_BASE = 'https://api.lemonsqueezy.com/v1';

interface LSEnv {
  LEMONSQUEEZY_API_KEY?: string;
  LEMONSQUEEZY_STORE_ID?: string;
}

function lsEnv(env: Env): LSEnv {
  return env as unknown as LSEnv;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    'Accept': 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

export interface CheckoutResult {
  url: string;
  expires_at: string;
}

/**
 * Create a hosted checkout URL for a given variant.
 * Embeds project_id in custom_data so the webhook can resolve back to a project.
 */
export async function createCheckoutUrl(
  env: Env,
  variantId: string,
  projectId: string,
  customerEmail?: string,
): Promise<CheckoutResult> {
  const e = lsEnv(env);
  const apiKey = e.LEMONSQUEEZY_API_KEY;
  const storeId = e.LEMONSQUEEZY_STORE_ID;
  if (!apiKey) throw new Error('LEMONSQUEEZY_API_KEY not configured');
  if (!storeId) throw new Error('LEMONSQUEEZY_STORE_ID not configured');

  const checkoutData: Record<string, unknown> = {
    custom: { project_id: projectId },
  };
  if (customerEmail) checkoutData.email = customerEmail;

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: checkoutData,
      },
      relationships: {
        store:   { data: { type: 'stores',   id: String(storeId)   } },
        variant: { data: { type: 'variants', id: String(variantId) } },
      },
    },
  };

  const res = await fetch(`${LS_BASE}/checkouts`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`LemonSqueezy checkout failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json() as {
    data?: { attributes?: { url?: string; expires_at?: string } };
  };
  const url = json.data?.attributes?.url;
  const expires_at = json.data?.attributes?.expires_at ?? '';
  if (!url) throw new Error('LemonSqueezy did not return a checkout URL');
  return { url, expires_at };
}

/**
 * Get the LS-hosted customer billing portal signed link.
 * Customers manage payment methods, cancel, view invoices there.
 */
export async function getCustomerPortalUrl(
  env: Env,
  customerId: string,
): Promise<string> {
  const e = lsEnv(env);
  const apiKey = e.LEMONSQUEEZY_API_KEY;
  if (!apiKey) throw new Error('LEMONSQUEEZY_API_KEY not configured');

  const res = await fetch(`${LS_BASE}/customers/${encodeURIComponent(customerId)}`, {
    method: 'GET',
    headers: authHeaders(apiKey),
  });

  if (!res.ok) {
    throw new Error(`LemonSqueezy portal lookup failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json() as {
    data?: { attributes?: { urls?: { customer_portal?: string } } };
  };
  const url = json.data?.attributes?.urls?.customer_portal;
  if (!url) throw new Error('LemonSqueezy did not return a customer portal URL');
  return url;
}
