/**
 * Pure D1 mutations for LemonSqueezy webhook event handlers.
 * Each handler maps an LS event to a projects-table state change.
 */

import type { Env } from '../types';
import type { LSWebhookEvent, Tier, VariantToTierMap } from './types';

interface LSBillingEnv {
  LEMONSQUEEZY_VARIANT_DEV?: string;
  LEMONSQUEEZY_VARIANT_GROWTH?: string;
  LEMONSQUEEZY_VARIANT_SCALE?: string;
}

/**
 * Build variant->tier map from env vars. Empty map if unset (test env).
 * Production must set LEMONSQUEEZY_VARIANT_DEV / _GROWTH / _SCALE.
 */
export function buildVariantMap(env: Env): VariantToTierMap {
  const e = env as unknown as LSBillingEnv;
  const map: VariantToTierMap = {};
  if (e.LEMONSQUEEZY_VARIANT_DEV)    map[e.LEMONSQUEEZY_VARIANT_DEV]    = 'dev';
  if (e.LEMONSQUEEZY_VARIANT_GROWTH) map[e.LEMONSQUEEZY_VARIANT_GROWTH] = 'growth';
  if (e.LEMONSQUEEZY_VARIANT_SCALE)  map[e.LEMONSQUEEZY_VARIANT_SCALE]  = 'scale';
  return map;
}

function projectIdOf(evt: LSWebhookEvent): string | null {
  return evt.meta.custom_data?.project_id ?? null;
}

function attr<T = unknown>(evt: LSWebhookEvent, key: string): T | undefined {
  return evt.data.attributes[key] as T | undefined;
}

/** Resolve LS variant_id -> Tier; falls back to 'free' if unknown. */
function resolveTier(evt: LSWebhookEvent, map: VariantToTierMap): Tier {
  const variantId = attr<number | string>(evt, 'variant_id');
  if (variantId === undefined || variantId === null) return 'free';
  return map[String(variantId)] ?? 'free';
}

function renewalAt(evt: LSWebhookEvent): number | null {
  const raw = attr<string>(evt, 'renews_at');
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

async function setProjectFields(
  env: Env,
  projectId: string,
  fields: Record<string, string | number | null>,
): Promise<void> {
  const cols = Object.keys(fields);
  if (!cols.length) return;
  const sql = `UPDATE projects SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`;
  await env.DB.prepare(sql).bind(...cols.map((c) => fields[c]), projectId).run();
}

export async function onSubscriptionCreated(
  env: Env, evt: LSWebhookEvent, map: VariantToTierMap,
): Promise<void> { await onSubscriptionUpserted(env, evt, map); }

export async function onSubscriptionUpdated(
  env: Env, evt: LSWebhookEvent, map: VariantToTierMap,
): Promise<void> { await onSubscriptionUpserted(env, evt, map); }

async function onSubscriptionUpserted(
  env: Env, evt: LSWebhookEvent, map: VariantToTierMap,
): Promise<void> {
  const projectId = projectIdOf(evt);
  if (!projectId) return;
  await setProjectFields(env, projectId, {
    tier: resolveTier(evt, map),
    ls_subscription_id: evt.data.id,
    ls_customer_id: String(attr<number | string>(evt, 'customer_id') ?? ''),
    tier_status: 'active',
    renewal_at: renewalAt(evt),
  });
}

export async function onSubscriptionCancelled(
  env: Env, evt: LSWebhookEvent,
): Promise<void> {
  const projectId = projectIdOf(evt);
  if (!projectId) return;
  await setProjectFields(env, projectId, { tier_status: 'cancel_at_period_end' });
}

export async function onSubscriptionExpired(
  env: Env, evt: LSWebhookEvent,
): Promise<void> {
  const projectId = projectIdOf(evt);
  if (!projectId) return;
  await setProjectFields(env, projectId, { tier: 'free', tier_status: 'expired' });
}

export async function onPaymentFailed(
  env: Env, evt: LSWebhookEvent,
): Promise<void> {
  const projectId = projectIdOf(evt);
  if (!projectId) return;
  await setProjectFields(env, projectId, { tier_status: 'past_due' });
}

export async function onPaymentRecovered(
  env: Env, evt: LSWebhookEvent,
): Promise<void> {
  const projectId = projectIdOf(evt);
  if (!projectId) return;
  await setProjectFields(env, projectId, { tier_status: 'active' });
}

/** Dispatch table for LS event_name -> handler. */
export async function applyEvent(
  env: Env, evt: LSWebhookEvent, map: VariantToTierMap,
): Promise<{ applied: boolean; reason?: string }> {
  switch (evt.meta.event_name) {
    case 'subscription_created':
      await onSubscriptionCreated(env, evt, map); return { applied: true };
    case 'subscription_updated':
      await onSubscriptionUpdated(env, evt, map); return { applied: true };
    case 'subscription_cancelled':
      await onSubscriptionCancelled(env, evt); return { applied: true };
    case 'subscription_expired':
      await onSubscriptionExpired(env, evt); return { applied: true };
    case 'subscription_payment_failed':
      await onPaymentFailed(env, evt); return { applied: true };
    case 'subscription_payment_recovered':
      await onPaymentRecovered(env, evt); return { applied: true };
    case 'order_created':
      return { applied: false, reason: 'order_created ignored (subscription events authoritative)' };
    default:
      return { applied: false, reason: 'unknown_event' };
  }
}
