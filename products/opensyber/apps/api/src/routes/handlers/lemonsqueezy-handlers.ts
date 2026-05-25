import { eq, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import { users, instances, organizations } from '@opensyber/db';
import { PLAN_INSTANCE_LIMITS, PLAN_CONFIGS } from '@opensyber/shared';
import type { Plan } from '@opensyber/shared';
import type { Env } from '../../types.js';
import { emailService } from '../../services/email.js';

type Db = DrizzleD1Database<typeof schema>;

export interface LsSubscription {
  id: string;
  attributes: {
    store_id: number; customer_id: number; order_id: number;
    product_id: number; variant_id: number; status: string;
    card_brand: string | null; renews_at: string | null;
    ends_at: string | null; cancelled: boolean;
    first_subscription_item?: { price_id: number };
  };
}

export async function handleSubscriptionCreated(
  db: Db, userId: string | undefined, subscription: LsSubscription, variantMap: Record<number, string>,
): Promise<void> {
  if (!userId) { console.error('subscription_created without user_id'); return; }
  const plan = variantMap[subscription.attributes.variant_id] || 'personal';

  await db.update(users).set({
    lemonSqueezyCustomerId: String(subscription.attributes.customer_id),
    lemonSqueezySubscriptionId: subscription.id, plan: plan as typeof users.plan.enumValues[number], updatedAt: new Date().toISOString(),
  }).where(eq(users.id, userId));

  const [subscribedUser] = await db.select().from(users).where(eq(users.id, userId));
  if (subscribedUser?.referredBy) {
    await db.update(users).set({
      referralCredits: sql`${users.referralCredits} + 1`, updatedAt: new Date().toISOString(),
    }).where(eq(users.referralCode, subscribedUser.referredBy));
  }

  await syncOrgPlans(db, userId, plan as Plan);
  console.log(`[LemonSqueezy] User ${userId} subscribed to ${plan} plan`);
}

export async function handleSubscriptionUpdated(
  db: Db, subscription: LsSubscription, variantMap: Record<number, string>,
): Promise<void> {
  const customerId = String(subscription.attributes.customer_id);
  const [user] = await db.select().from(users).where(eq(users.lemonSqueezyCustomerId, customerId));
  if (!user) return;

  const plan = variantMap[subscription.attributes.variant_id] || 'personal';
  await db.update(users).set({
    plan: plan as typeof users.plan.enumValues[number], lemonSqueezySubscriptionId: subscription.id, updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));
  await syncOrgPlans(db, user.id, plan as Plan);
  console.log(`[LemonSqueezy] User ${user.id} plan updated to ${plan}`);
}

export async function handleSubscriptionEnded(db: Db, subscription: LsSubscription): Promise<void> {
  const customerId = String(subscription.attributes.customer_id);
  const [user] = await db.select().from(users).where(eq(users.lemonSqueezyCustomerId, customerId));
  if (!user) return;

  if (user.paymentGraceUntil && new Date(user.paymentGraceUntil) > new Date()) {
    console.log(`[LemonSqueezy] User ${user.id} in grace period, deferring suspension`);
    return;
  }

  await db.update(users).set({
    plan: 'free', lemonSqueezySubscriptionId: null,
    paymentGraceUntil: null, updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));

  const freeLimit = PLAN_INSTANCE_LIMITS['free'] || 1;
  const userInstances = await db.select().from(instances).where(eq(instances.userId, user.id));

  if (userInstances.length > freeLimit) {
    const sorted = [...userInstances].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const toSuspend = sorted.slice(freeLimit);
    for (const inst of toSuspend) {
      await db.update(instances).set({ status: 'suspended' }).where(eq(instances.id, inst.id));
    }
    console.log(`[LemonSqueezy] Suspended ${toSuspend.length} instance(s) for user ${user.id}`);
  }

  await syncOrgPlans(db, user.id, 'free');
  console.log(`[LemonSqueezy] User ${user.id} subscription ended, downgraded to free`);
}

export async function handlePaymentFailed(db: Db, subscription: LsSubscription, env: Env): Promise<void> {
  const customerId = String(subscription.attributes.customer_id);
  const [user] = await db.select().from(users).where(eq(users.lemonSqueezyCustomerId, customerId));
  if (!user) return;

  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + 3);

  await db.update(users).set({
    paymentGraceUntil: graceEnd.toISOString(), updatedAt: new Date().toISOString(),
  }).where(eq(users.id, user.id));

  console.warn(`[LemonSqueezy] Payment failed for user ${user.id}, grace until ${graceEnd.toISOString()}`);

  try {
    await emailService.sendPaymentFailedEmail({ to: user.email, userName: user.name, apiKey: env.RESEND_API_KEY });
  } catch (err) {
    console.error(`[LemonSqueezy] Failed to send payment failed email to ${user.email}:`, err);
  }
}

async function syncOrgPlans(db: Db, userId: string, plan: Plan): Promise<void> {
  const ownedOrgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.ownerId, userId));
  const instanceLimit = PLAN_CONFIGS[plan]?.instanceLimit ?? 1;
  for (const org of ownedOrgs) {
    await db.update(organizations).set({
      plan: plan as 'free' | 'personal' | 'pro' | 'team', maxInstances: instanceLimit, updatedAt: new Date().toISOString(),
    }).where(eq(organizations.id, org.id));
  }
}

export function buildVariantMap(env: Env): Record<number, 'personal' | 'pro' | 'team'> {
  const map: Record<number, 'personal' | 'pro' | 'team'> = {};
  if (env.OPENSYBER_LS_VARIANT_PERSONAL) map[parseInt(env.OPENSYBER_LS_VARIANT_PERSONAL, 10)] = 'personal';
  if (env.OPENSYBER_LS_VARIANT_PRO) map[parseInt(env.OPENSYBER_LS_VARIANT_PRO, 10)] = 'pro';
  if (env.OPENSYBER_LS_VARIANT_TEAM) map[parseInt(env.OPENSYBER_LS_VARIANT_TEAM, 10)] = 'team';
  return map;
}
