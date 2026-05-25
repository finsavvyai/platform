import { eq } from 'drizzle-orm';
import { tfTenants } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import type { WebhookPayload } from '../lib/webhook-schemas.js';
import type { TfPlan } from '../types.js';
type DB = DrizzleD1Database<typeof schema>;

export async function handleSubscriptionCreated(
  db: DB,
  payload: WebhookPayload,
  variantMap: Record<number, TfPlan>,
): Promise<void> {
  const tenantId = payload.meta.custom_data?.tenant_id;
  if (!tenantId) {
    console.error('[TF Webhook] subscription_created: missing tenant_id');
    return;
  }

  const variantId = payload.data.attributes.variant_id;
  const plan = (variantId != null ? variantMap[variantId] : undefined) ?? 'pro';
  const customerId = String(payload.data.attributes.customer_id);
  const email = payload.data.attributes.user_email ?? '';
  const name = payload.data.attributes.user_name ?? email.split('@')[0] ?? 'User';
  const now = new Date().toISOString();

  // Upsert: create tenant if not exists, otherwise update
  const [existing] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.id, tenantId));

  if (existing) {
    await db
      .update(tfTenants)
      .set({
        plan,
        lemonSqueezyCustomerId: customerId,
        lemonSqueezySubscriptionId: payload.data.id,
        updatedAt: now,
      })
      .where(eq(tfTenants.id, tenantId));
  } else {
    await db.insert(tfTenants).values({
      id: tenantId,
      name,
      slug: tenantId,
      ownerUserId: tenantId,
      plan,
      lemonSqueezyCustomerId: customerId,
      lemonSqueezySubscriptionId: payload.data.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  console.log(`[TF Webhook] Tenant ${tenantId} subscribed to ${plan}`);
}
export async function handleSubscriptionUpdated(
  db: DB,
  payload: WebhookPayload,
  variantMap: Record<number, TfPlan>,
): Promise<void> {
  const customerId = String(payload.data.attributes.customer_id);
  const [tenant] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.lemonSqueezyCustomerId, customerId));

  if (!tenant) {
    console.error(`[TF Webhook] subscription_updated: tenant not found for customer ${customerId}`);
    return;
  }

  const variantId = payload.data.attributes.variant_id;
  const plan = (variantId != null ? variantMap[variantId] : undefined) ?? 'pro';

  await db
    .update(tfTenants)
    .set({
      plan,
      lemonSqueezySubscriptionId: payload.data.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tfTenants.id, tenant.id));

  console.log(`[TF Webhook] Tenant ${tenant.id} plan updated to ${plan}`);
}

export async function handleSubscriptionCancelled(
  db: DB,
  payload: WebhookPayload,
): Promise<void> {
  const customerId = String(payload.data.attributes.customer_id);
  const [tenant] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.lemonSqueezyCustomerId, customerId));

  if (!tenant) {
    console.error(`[TF Webhook] subscription_cancelled: tenant not found for customer ${customerId}`);
    return;
  }

  // Downgrade at period end: use ends_at or renews_at
  const endsAt = payload.data.attributes.ends_at
    ?? payload.data.attributes.renews_at
    ?? new Date().toISOString();

  console.log(`[TF Webhook] Tenant ${tenant.id} cancelled, downgrades at ${endsAt}`);

  // If the subscription has already ended, downgrade immediately
  if (new Date(endsAt) <= new Date()) {
    await db
      .update(tfTenants)
      .set({
        plan: 'free',
        lemonSqueezySubscriptionId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tfTenants.id, tenant.id));
    return;
  }

  // Otherwise, schedule downgrade — store ends_at in KV or just log
  // The cron job will handle the actual downgrade at period end
  console.log(`[TF Webhook] Tenant ${tenant.id} scheduled for downgrade at ${endsAt}`);
}

export async function handleSubscriptionExpired(
  db: DB,
  payload: WebhookPayload,
): Promise<void> {
  const customerId = String(payload.data.attributes.customer_id);
  const [tenant] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.lemonSqueezyCustomerId, customerId));

  if (!tenant) {
    console.error(`[TF Webhook] subscription_expired: tenant not found for customer ${customerId}`);
    return;
  }

  await db
    .update(tfTenants)
    .set({
      plan: 'free',
      lemonSqueezySubscriptionId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tfTenants.id, tenant.id));

  console.log(`[TF Webhook] Tenant ${tenant.id} subscription expired, downgraded to free`);
}

export { handlePaymentSuccess, handlePaymentFailed } from './webhook-payment-handlers.js';
