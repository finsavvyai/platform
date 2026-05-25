import { eq, and, sql } from 'drizzle-orm';
import { tfTenants, tfUsage } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';
import { PLAN_LIMITS } from '../types.js';

type DB = DrizzleD1Database<typeof schema>;

const WARNING_THRESHOLD = 0.8;

interface UsageCronResult {
  tenantsChecked: number;
  warningsSent: number;
}

/**
 * Hourly cron: check usage levels and send warnings at 80% threshold.
 */
export async function runUsageCron(
  db: DB,
  resendApiKey: string,
  cache: KVNamespace,
): Promise<UsageCronResult> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const monthStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextMonth = new Date(Date.UTC(y, m + 1, 1));
  const monthEnd = nextMonth.toISOString().split('T')[0]!;

  const tenants = await db
    .select({
      id: tfTenants.id,
      name: tfTenants.name,
      plan: tfTenants.plan,
    })
    .from(tfTenants);

  let warningsSent = 0;

  for (const tenant of tenants) {
    const limit = PLAN_LIMITS[tenant.plan] ?? PLAN_LIMITS['free']!;
    if (limit === Infinity) continue;

    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${tfUsage.verificationCount}) + SUM(${tfUsage.bindCount}), 0)`,
      })
      .from(tfUsage)
      .where(
        and(
          eq(tfUsage.tenantId, tenant.id),
          sql`${tfUsage.date} >= ${monthStart}`,
          sql`${tfUsage.date} < ${monthEnd}`,
        ),
      );

    const totalUsage = row?.total ?? 0;
    const usagePercent = totalUsage / limit;

    if (usagePercent >= WARNING_THRESHOLD) {
      const warningKey = `usage-warning:${tenant.id}:${monthStart}`;
      const alreadySent = await cache.get(warningKey);

      if (!alreadySent) {
        await sendUsageWarningEmail(resendApiKey, tenant.name, totalUsage, limit);
        await cache.put(warningKey, '1', { expirationTtl: 30 * 86400 });
        warningsSent++;
      }
    }
  }

  return { tenantsChecked: tenants.length, warningsSent };
}

async function sendUsageWarningEmail(
  apiKey: string,
  tenantName: string,
  currentUsage: number,
  limit: number,
): Promise<void> {
  if (!apiKey) {
    console.warn('[Cron] RESEND_API_KEY not configured, skipping email');
    return;
  }

  const percent = Math.round((currentUsage / limit) * 100);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TokenForge <alerts@tokenforge.opensyber.cloud>',
      to: 'alerts@tokenforge.opensyber.cloud',
      subject: `Usage warning: ${tenantName} at ${percent}%`,
      text: [
        `Tenant "${tenantName}" has reached ${percent}% of monthly usage.`,
        `Current: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()} verifications.`,
        `Consider upgrading your plan at https://tokenforge.opensyber.cloud/dashboard/settings`,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    console.error(`[Cron] Failed to send usage warning email: ${res.status} ${res.statusText}`);
  }
}
