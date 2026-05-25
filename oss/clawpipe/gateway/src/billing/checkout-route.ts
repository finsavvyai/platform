/**
 * POST /v1/billing/checkout
 *
 * Body: { variant: 'dev' | 'growth' | 'scale', email?: string, redirectUrl?: string }
 *
 * Auth is enforced by the surrounding router; `projectId` is trusted.
 * Resolves the LS variant numeric ID from env, then creates a hosted
 * checkout URL and returns it to the dashboard.
 */

import type { Env } from '../types';
import { createCheckoutUrl } from './lemonsqueezy-client';

type Variant = 'dev' | 'growth' | 'scale';

const VARIANT_ENV_KEYS: Record<Variant, string> = {
  dev: 'LEMONSQUEEZY_VARIANT_DEV',
  growth: 'LEMONSQUEEZY_VARIANT_GROWTH',
  scale: 'LEMONSQUEEZY_VARIANT_SCALE',
};

interface CheckoutBody {
  variant?: string;
  email?: string;
  redirectUrl?: string;
}

function isVariant(v: unknown): v is Variant {
  return v === 'dev' || v === 'growth' || v === 'scale';
}

function variantIdFromEnv(env: Env, variant: Variant): string | undefined {
  const key = VARIANT_ENV_KEYS[variant];
  const value = (env as unknown as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : undefined;
}

export async function handleCheckout(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return Response.json(
      { error: 'invalid_json' },
      { status: 400 },
    );
  }

  const variant = body.variant;
  if (!isVariant(variant)) {
    return Response.json(
      { error: 'invalid_variant', allowed: ['dev', 'growth', 'scale'] },
      { status: 400 },
    );
  }

  const variantId = variantIdFromEnv(env, variant);
  if (!variantId) {
    return Response.json(
      { error: 'billing_not_configured', variant },
      { status: 503 },
    );
  }

  try {
    const result = await createCheckoutUrl(env, variantId, projectId, body.email);
    return Response.json(
      { url: result.url, expiresAt: result.expires_at },
      { status: 200 },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'lemonsqueezy_unavailable', detail },
      { status: 502 },
    );
  }
}
