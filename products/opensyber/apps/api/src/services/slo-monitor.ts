import { eq } from 'drizzle-orm';
import { integrationConnections, integrationEvents } from '@opensyber/db';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export type SloTier = 'cloud-security' | 'identity' | 'ide-agents' | 'siem-forwarding';

interface SloDefinition {
  maxLatencyMs: number;
  minAvailability: number; // 0-1
  breachAlertThreshold: number; // 0-1
}

const SLO_DEFINITIONS: Record<SloTier, SloDefinition> = {
  'cloud-security': {
    maxLatencyMs: 600_000, // 10 min
    minAvailability: 0.995, // 99.5%
    breachAlertThreshold: 0.05, // > 5%
  },
  'identity': {
    maxLatencyMs: 600_000, // 10 min
    minAvailability: 0.995, // 99.5%
    breachAlertThreshold: 0.05, // > 5%
  },
  'ide-agents': {
    maxLatencyMs: 360_000, // 6 min
    minAvailability: 0.99, // 99%
    breachAlertThreshold: 0.1, // > 10%
  },
  'siem-forwarding': {
    maxLatencyMs: 30_000, // 30 sec
    minAvailability: 0.999, // 99.9%
    breachAlertThreshold: 0.01, // > 1%
  },
};

const TIER_SLUGS: Record<string, SloTier> = {
  'guardduty': 'cloud-security',
  'security-hub': 'cloud-security',
  'scc': 'cloud-security',
  'entra-id': 'identity',
  'okta': 'identity',
  'vscode-agent': 'ide-agents',
  'jetbrains-agent': 'ide-agents',
  'datadog': 'siem-forwarding',
  'splunk': 'siem-forwarding',
  'loki': 'siem-forwarding',
};

export function getSloTier(slug: string): SloTier | null {
  return TIER_SLUGS[slug] ?? null;
}

export interface SloStatus {
  tier: SloTier;
  latencyOk: boolean;
  availabilityOk: boolean;
  breachAlertOk: boolean;
  compliance: number; // 0-100
  breached: boolean;
}

export function computeSloStatus(
  conn: {
    integrationSlug: string;
    avgLatencyMs: number;
    eventsReceived: number;
    errorCount: number;
  },
): SloStatus | null {
  const tier = getSloTier(conn.integrationSlug);
  if (!tier) {
    return null;
  }

  const slo = SLO_DEFINITIONS[tier];

  const latencyOk = conn.avgLatencyMs <= slo.maxLatencyMs;
  const availability = conn.eventsReceived > 0
    ? 1 - conn.errorCount / conn.eventsReceived
    : 1;
  const availabilityOk = availability >= slo.minAvailability;
  const errorRate = conn.eventsReceived > 0 ? conn.errorCount / conn.eventsReceived : 0;
  const breachAlertOk = errorRate <= slo.breachAlertThreshold;

  const compliance = (
    (latencyOk ? 100 : 50) * 0.33 +
    (availabilityOk ? 100 : 50) * 0.33 +
    (breachAlertOk ? 100 : 50) * 0.33
  );

  return {
    tier,
    latencyOk,
    availabilityOk,
    breachAlertOk,
    compliance: Math.round(compliance),
    breached: !latencyOk || !availabilityOk || !breachAlertOk,
  };
}

export async function checkSloBreaches(
  db: DrizzleD1Database<any>,
  userId: string,
): Promise<Array<{ connectionId: string; slug: string; status: SloStatus }>> {
  const connections = await db
    .select({
      id: integrationConnections.id,
      integrationSlug: integrationConnections.integrationSlug,
      avgLatencyMs: integrationConnections.avgLatencyMs,
      eventsReceived: integrationConnections.eventsReceived,
      errorCount: integrationConnections.errorCount,
    })
    .from(integrationConnections)
    .where(eq(integrationConnections.userId, userId));

  const breaches = [];
  for (const conn of connections) {
    const status = computeSloStatus(conn);
    if (status && status.breached) {
      breaches.push({
        connectionId: conn.id,
        slug: conn.integrationSlug,
        status,
      });
    }
  }

  return breaches;
}
