import { eq, and, gte, desc } from 'drizzle-orm';
import { uptimeRecords, slaConfigs, alerts, alertRules } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type Db = DrizzleD1Database<Record<string, unknown>>;
type UptimeStatus = 'up' | 'down' | 'degraded';
type CheckType = 'health' | 'ping' | 'agent';
type Period = '24h' | '7d' | '30d' | '90d';

const PERIOD_MS: Record<Period, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

export async function recordCheck(
  db: Db,
  instanceId: string,
  status: UptimeStatus,
  responseTimeMs: number | null,
  checkType: CheckType,
): Promise<void> {
  await db.insert(uptimeRecords).values({
    id: generateId(),
    instanceId,
    checkedAt: new Date().toISOString(),
    status,
    responseTimeMs,
    checkType,
  });
}

export async function getUptime(
  db: Db,
  instanceId: string,
  period: Period,
): Promise<{ percentage: number; totalChecks: number; downChecks: number }> {
  const cutoff = new Date(Date.now() - PERIOD_MS[period]).toISOString();

  const records = await db
    .select({ status: uptimeRecords.status })
    .from(uptimeRecords)
    .where(and(eq(uptimeRecords.instanceId, instanceId), gte(uptimeRecords.checkedAt, cutoff)));

  const totalChecks = records.length;
  if (totalChecks === 0) {
    return { percentage: 100, totalChecks: 0, downChecks: 0 };
  }

  const downChecks = records.filter((r) => r.status === 'down').length;
  const percentage = Number((((totalChecks - downChecks) / totalChecks) * 100).toFixed(3));

  return { percentage, totalChecks, downChecks };
}

export async function getDowntimeEvents(
  db: Db,
  instanceId: string,
  period: Period,
): Promise<Array<{ checkedAt: string; status: string; responseTimeMs: number | null }>> {
  const cutoff = new Date(Date.now() - PERIOD_MS[period]).toISOString();

  const events = await db
    .select({
      checkedAt: uptimeRecords.checkedAt,
      status: uptimeRecords.status,
      responseTimeMs: uptimeRecords.responseTimeMs,
    })
    .from(uptimeRecords)
    .where(
      and(
        eq(uptimeRecords.instanceId, instanceId),
        gte(uptimeRecords.checkedAt, cutoff),
        eq(uptimeRecords.status, 'down'),
      ),
    )
    .orderBy(desc(uptimeRecords.checkedAt))
    .limit(100);

  return events;
}

export async function checkSlaBreaches(
  db: Db,
  orgId: string,
): Promise<Array<{ instanceId: string; uptime: number; target: number }>> {
  const [config] = await db
    .select()
    .from(slaConfigs)
    .where(eq(slaConfigs.orgId, orgId));

  if (!config) return [];

  const breaches: Array<{ instanceId: string; uptime: number; target: number }> = [];

  // Get all org instances by checking uptimeRecords
  // (the instances table is in another schema import, keep this simple)
  const recentRecords = await db
    .select({ instanceId: uptimeRecords.instanceId })
    .from(uptimeRecords)
    .where(gte(uptimeRecords.checkedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()))
    .limit(1000);

  const instanceIds = [...new Set(recentRecords.map((r) => r.instanceId))];

  for (const instanceId of instanceIds) {
    const { percentage } = await getUptime(db, instanceId, '30d');
    if (percentage < config.targetUptime) {
      breaches.push({ instanceId, uptime: percentage, target: config.targetUptime });
    }
  }

  return breaches;
}
