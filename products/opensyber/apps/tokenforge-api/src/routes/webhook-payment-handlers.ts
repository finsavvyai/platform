import { eq } from 'drizzle-orm';
import { tfTenants } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import type { WebhookPayload } from '../lib/webhook-schemas.js';
import { sendPaymentFailedEmail } from '../services/email.js';

type DB = DrizzleD1Database<typeof schema>;
const GRACE_PERIOD_DAYS = 7;

export async function handlePaymentSuccess(
  payload: WebhookPayload,
): Promise<void> {
  console.log(
    `[TF Webhook] Payment success for subscription ${payload.data.id}`,
  );
}

export async function handlePaymentFailed(
  db: DB,
  payload: WebhookPayload,
  resendApiKey: string,
): Promise<void> {
  const customerId = String(payload.data.attributes.customer_id);
  const [tenant] = await db
    .select()
    .from(tfTenants)
    .where(eq(tfTenants.lemonSqueezyCustomerId, customerId));

  if (!tenant) {
    console.error(`[TF Webhook] payment_failed: tenant not found for customer ${customerId}`);
    return;
  }

  const graceEnd = new Date();
  graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS);

  await db
    .update(tfTenants)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(tfTenants.id, tenant.id));

  console.warn(
    `[TF Webhook] Payment failed for tenant ${tenant.id}, grace until ${graceEnd.toISOString()}`,
  );

  try {
    await sendPaymentFailedEmail(resendApiKey, tenant.name);
  } catch (err) {
    console.error(`[TF Webhook] Failed to send payment failed email:`, err);
  }
}
