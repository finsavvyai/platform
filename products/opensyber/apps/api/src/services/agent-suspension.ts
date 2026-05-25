/**
 * Agent Suspension Service
 *
 * Manages agent lifecycle: suspend (Hetzner poweroff),
 * resume (restart), quarantine (poweroff + revoke token).
 */

import { eq } from 'drizzle-orm';
import { instances } from '@opensyber/db';
import { hetznerService } from './hetzner.js';
import { logger } from '../lib/logger.js';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Env } from '../types.js';

export type SuspensionAction = 'suspend' | 'resume' | 'quarantine';

export interface SuspensionResult {
  agentId: string;
  action: SuspensionAction;
  success: boolean;
  previousStatus: string;
  newStatus: string;
  reason?: string;
}

const STATUS_MAP: Record<SuspensionAction, 'suspended' | 'running' | 'quarantined'> = {
  suspend: 'suspended',
  resume: 'running',
  quarantine: 'quarantined',
};

export function validateSuspensionAction(
  currentStatus: string, action: SuspensionAction,
): { valid: boolean; error?: string } {
  if (action === 'suspend' && currentStatus === 'suspended') {
    return { valid: false, error: 'Agent is already suspended' };
  }
  if (action === 'resume' && currentStatus === 'running') {
    return { valid: false, error: 'Agent is already running' };
  }
  if (action === 'quarantine' && currentStatus === 'quarantined') {
    return { valid: false, error: 'Agent is already quarantined' };
  }
  return { valid: true };
}

export async function executeSuspensionAction(
  instanceId: string, action: SuspensionAction,
  db: DrizzleD1Database<Record<string, unknown>>, env: Env,
  reason?: string,
): Promise<SuspensionResult> {
  const [instance] = await db.select().from(instances)
    .where(eq(instances.id, instanceId));

  if (!instance) {
    return { agentId: instanceId, action, success: false,
      previousStatus: 'unknown', newStatus: 'unknown',
      reason: 'Instance not found' };
  }

  if (!instance.containerId) {
    return { agentId: instanceId, action, success: false,
      previousStatus: instance.status ?? 'unknown',
      newStatus: instance.status ?? 'unknown',
      reason: 'No Hetzner server attached' };
  }

  const previousStatus = instance.status ?? 'unknown';

  try {
    if (action === 'suspend' || action === 'quarantine') {
      await hetznerService.powerOffServer({
        hetznerServerId: Number(instance.containerId),
        apiToken: (env as unknown as Record<string, string>).HETZNER_API_TOKEN ?? '',
      });
      if (action === 'quarantine') {
        await env.CREDENTIAL_VAULT.delete(`gateway:${instanceId}`);
      }
    } else {
      await hetznerService.restartServer({
        hetznerServerId: Number(instance.containerId),
        apiToken: (env as unknown as Record<string, string>).HETZNER_API_TOKEN ?? '',
      });
    }

    const newStatus = STATUS_MAP[action];
    await db.update(instances).set({ status: newStatus })
      .where(eq(instances.id, instanceId));

    logger.info('Agent action completed', { instanceId, action, newStatus });

    return { agentId: instanceId, action, success: true,
      previousStatus, newStatus, reason };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Agent action failed', { instanceId, action, error: msg });
    return { agentId: instanceId, action, success: false,
      previousStatus, newStatus: previousStatus, reason: msg };
  }
}
