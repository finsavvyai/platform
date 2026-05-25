/**
 * Shared fixtures for LemonSqueezy webhook tests.
 *
 * Pulled out of `routes/webhooks.test.ts` so the test file stays under
 * the 200-line cap. Pure helpers — no vitest mocks live here (mocks
 * must be hoisted in the test file itself).
 */

import { vi } from 'vitest';
import worker from '../index.js';
import type { Env } from '../types.js';

export async function tfRequest(
  path: string,
  init: RequestInit,
  env: Env,
): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

export async function hmacSign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function lsBody(event: string, productId = 999): string {
  return JSON.stringify({
    meta: { event_name: event, custom_data: { tenant_id: 'tenant-1' } },
    data: {
      id: 'sub_123',
      attributes: {
        store_id: 1, customer_id: 42, order_id: 10, product_id: productId,
        variant_id: 100, status: 'active', card_brand: 'visa',
        renews_at: '2026-03-01T00:00:00Z', ends_at: null, cancelled: false,
      },
    },
  });
}

export function lsBodyWithVariant(event: string, variantId: number): string {
  return JSON.stringify({
    meta: { event_name: event, custom_data: { tenant_id: 'tenant-1' } },
    data: {
      id: 'sub_123',
      attributes: {
        store_id: 1, customer_id: 42, order_id: 10, product_id: 999,
        variant_id: variantId, status: 'active', card_brand: 'visa',
        renews_at: '2026-03-01T00:00:00Z', ends_at: null, cancelled: false,
      },
    },
  });
}

/** Sign + post a LemonSqueezy webhook payload in one call. */
export async function postLsWebhook(raw: string, env: Env): Promise<Response> {
  const sig = await hmacSign(raw, env.LEMONSQUEEZY_WEBHOOK_SECRET);
  return tfRequest(
    '/webhooks/lemonsqueezy',
    { method: 'POST', body: raw, headers: { 'X-Signature': sig } },
    env,
  );
}
