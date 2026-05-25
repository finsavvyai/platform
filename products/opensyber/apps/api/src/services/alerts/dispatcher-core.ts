/**
 * Core alert dispatcher
 *
 * Handles finding active channels, parsing configs, rate limiting,
 * and dispatching alerts in parallel.
 */

import { eq, and } from 'drizzle-orm';
import { alertChannels } from '@opensyber/db';
import type {
  ChannelConfig,
  AlertResult,
  AlertChannelType,
  AlertSeverity,
} from './types.js';
import { sendToChannel } from './index.js';
import { meetsMinSeverity } from './types.js';
import { checkRateLimit } from './rate-limiter.js';
import type {
  Db,
  Kv,
  AlertChannelRecord,
  AlertFinding,
  DispatchResult,
} from './dispatcher-types.js';
import { buildAlertMessage } from './dispatcher-types.js';

/**
 * Parse channel config from database JSON
 * Handles both encrypted and plain configs for backward compatibility
 */
export async function parseChannelConfig(
  channel: AlertChannelRecord,
  decryptFn?: (encrypted: string) => Promise<string>,
): Promise<ChannelConfig> {
  let configStr: string;

  const isEncrypted =
    !channel.config.startsWith('{') && channel.config.length > 50;

  if (isEncrypted && decryptFn) {
    configStr = await decryptFn(channel.config);
  } else {
    configStr = channel.config;
  }

  const config = JSON.parse(configStr) as Record<string, unknown>;

  return {
    type: channel.channelType as AlertChannelType,
    minSeverity: channel.minSeverity as AlertSeverity,
    isActive: channel.isActive,
    ...config,
  } as ChannelConfig;
}

/**
 * Find active alert channels for an organization
 */
async function findActiveChannels(
  db: Db,
  orgId: string | null,
): Promise<AlertChannelRecord[]> {
  if (!orgId) {
    return [];
  }

  const records = await db
    .select()
    .from(alertChannels)
    .where(
      and(eq(alertChannels.orgId, orgId), eq(alertChannels.isActive, true)),
    );

  return records as AlertChannelRecord[];
}

/**
 * Dispatch alerts to all active channels for an organization
 *
 * Finds active channels, filters by severity, checks rate limits,
 * and sends in parallel. Partial failures don't break dispatch.
 */
export async function dispatchAlerts(
  db: Db,
  kv: Kv | undefined,
  params: {
    orgId: string | null;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    findings: AlertFinding[];
    organization?: string;
    account?: string;
    dashboardUrl?: string;
    decryptFn?: (encrypted: string) => Promise<string>;
  },
): Promise<DispatchResult> {
  const {
    orgId,
    severity,
    title,
    description,
    findings,
    organization,
    account,
    dashboardUrl,
  } = params;

  const channels = await findActiveChannels(db, orgId);
  const matchingChannels = channels.filter((ch) =>
    meetsMinSeverity(severity, ch.minSeverity as AlertSeverity),
  );

  if (matchingChannels.length === 0) {
    return {
      totalChannels: channels.length,
      successful: 0,
      failed: 0,
      skipped: channels.length,
      results: new Map(),
    };
  }

  const message = buildAlertMessage({
    id: `alert-${crypto.randomUUID()}`,
    severity,
    title,
    description,
    findings,
    organization,
    account,
    dashboardUrl,
  });

  const results = new Map<string, AlertResult>();

  await Promise.all(
    matchingChannels.map(async (channel) => {
      try {
        const rateLimit = await checkRateLimit(kv, channel.id);
        if (!rateLimit.allowed) {
          results.set(channel.id, {
            success: false,
            error: `Rate limit exceeded. Try again after ${new Date(rateLimit.resetAt).toISOString()}`,
          });
          return;
        }
        const config = await parseChannelConfig(channel, params.decryptFn);
        const result = await sendToChannel(message, config);
        results.set(channel.id, result);
      } catch (error) {
        results.set(channel.id, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }),
  );

  let successful = 0;
  let failed = 0;
  for (const result of results.values()) {
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    totalChannels: channels.length,
    successful,
    failed,
    skipped: channels.length - matchingChannels.length,
    results,
  };
}
