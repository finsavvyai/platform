/**
 * Alert Channels CRUD Routes
 *
 * Manages alert channel configuration for organizations.
 * Supports email, Slack, PagerDuty, OpsGenie, Teams, and Discord.
 */

import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { alertChannels } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { resolveOrgContextAutoDetect, requirePermission } from '../../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../../middleware/plan-enforcement.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { sendTestAlert } from '../../services/alerts/dispatcher.js';
import {
  type AlertChannelType,
  type AlertSeverity,
  VALID_CHANNEL_TYPES,
  VALID_SEVERITIES,
  validateChannelConfig,
  createChannelSchema,
  updateChannelSchema,
} from './validation.js';

export { type AlertChannelType, type AlertSeverity } from './validation.js';

export const alertChannelRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
alertChannelRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect, loadPlanConfig);

const alertRead = requirePermission('alert.view');
const alertCreate = requirePermission('alert.create');
const alertUpdate = requirePermission('alert.update');
const alertDelete = requirePermission('alert.delete');
const planGate = requirePlanFeature('policyEngine');

/** Find a channel by id scoped to orgId, returns the row or null */
async function findChannel(db: Variables['db'], id: string, orgId: string) {
  const [row] = await db
    .select().from(alertChannels)
    .where(and(eq(alertChannels.id, id), eq(alertChannels.orgId, orgId)));
  return row ?? null;
}

/** GET /api/alert-channels -- List all channels for org */
alertChannelRoutes.get('/', alertRead, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ data: [] });

  const channels = await db.select().from(alertChannels)
    .where(eq(alertChannels.orgId, orgId))
    .orderBy(alertChannels.createdAt);

  return c.json({ data: channels.map(({ config: _, ...rest }) => rest) });
});

/** GET /api/alert-channels/:id -- Get channel details */
alertChannelRoutes.get('/:id', alertRead, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Not found', message: 'Alert channel not found' }, 404);

  const channel = await findChannel(db, c.req.param('id'), orgId);
  if (!channel) return c.json({ error: 'Not found', message: 'Alert channel not found' }, 404);

  let decryptedConfig: unknown = null;
  try {
    decryptedConfig = JSON.parse(await decrypt(channel.config, c.env.ENCRYPTION_KEY));
  } catch { /* config unreadable — return null */ }

  const { config: _, ...rest } = channel;
  return c.json({ data: { ...rest, config: decryptedConfig } });
});

/** POST /api/alert-channels -- Create new channel */
alertChannelRoutes.post('/', alertCreate, planGate, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Bad Request', message: 'Organization context required' }, 400);

  const body = await c.req.json();
  const parsed = createChannelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid request body' }, 400);
  }
  const { channelType, name, config, minSeverity, isActive } = parsed.data;

  const channelConfig = config[channelType];
  if (!channelConfig) {
    return c.json({ error: 'Validation failed', message: `config.${channelType} is required` }, 400);
  }
  if (!validateChannelConfig(channelType, channelConfig)) {
    return c.json({ error: 'Validation failed', message: `Invalid config for ${channelType} channel` }, 400);
  }

  const id = `ac-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const encryptedConfig = await encrypt(JSON.stringify(channelConfig), c.env.ENCRYPTION_KEY);

  try {
    await db.insert(alertChannels).values({ id, orgId, channelType, name, config: encryptedConfig, minSeverity, isActive, createdAt: now, updatedAt: now });
    return c.json({ data: { id, channelType, name, minSeverity, isActive } }, 201);
  } catch (error) {
    console.error('Failed to create alert channel:', error);
    return c.json({ error: 'Failed to create channel', message: 'Operation failed' }, 500);
  }
});

/** PUT /api/alert-channels/:id -- Update channel */
alertChannelRoutes.put('/:id', alertUpdate, planGate, async (c) => {
  const db = c.get('db');
  const channelId = c.req.param('id');
  const existing = await findChannel(db, channelId, c.get('orgId') ?? '');
  if (!existing) return c.json({ error: 'Not found', message: 'Alert channel not found' }, 404);

  const body = await c.req.json();
  const parsed = updateChannelSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid request body' }, 400);
  }
  const { name, minSeverity, isActive, config } = parsed.data;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (name !== undefined) updates.name = name;
  if (minSeverity !== undefined) updates.minSeverity = minSeverity;
  if (isActive !== undefined) updates.isActive = isActive;

  if (config !== undefined) {
    const configKeys = Object.keys(config);
    if (configKeys.length !== 1) {
      return c.json({ error: 'Validation failed', message: 'config must have exactly one channel type key' }, 400);
    }
    const ct = configKeys[0] as AlertChannelType;
    if (!VALID_CHANNEL_TYPES.includes(ct)) {
      return c.json({ error: 'Validation failed', message: `Invalid channel type: ${ct}` }, 400);
    }
    if (!validateChannelConfig(ct, config[ct])) {
      return c.json({ error: 'Validation failed', message: `Invalid config for ${ct} channel` }, 400);
    }
    updates.config = await encrypt(JSON.stringify(config[ct]), c.env.ENCRYPTION_KEY);
  }

  try {
    await db.update(alertChannels).set(updates).where(eq(alertChannels.id, channelId));
    return c.json({ data: { id: channelId, ...updates } });
  } catch (error) {
    console.error('Failed to update alert channel:', error);
    return c.json({ error: 'Failed to update channel', message: 'Operation failed' }, 500);
  }
});

/** DELETE /api/alert-channels/:id -- Delete channel */
alertChannelRoutes.delete('/:id', alertDelete, planGate, async (c) => {
  const db = c.get('db');
  const channelId = c.req.param('id');
  const existing = await findChannel(db, channelId, c.get('orgId') ?? '');
  if (!existing) return c.json({ error: 'Not found', message: 'Alert channel not found' }, 404);

  try {
    await db.delete(alertChannels).where(eq(alertChannels.id, channelId));
    return c.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Failed to delete alert channel:', error);
    return c.json({ error: 'Failed to delete channel', message: 'Operation failed' }, 500);
  }
});

/** POST /api/alert-channels/:id/test -- Send test alert */
alertChannelRoutes.post('/:id/test', alertUpdate, planGate, async (c) => {
  const db = c.get('db');
  const channelId = c.req.param('id');
  const existing = await findChannel(db, channelId, c.get('orgId') ?? '');
  if (!existing) return c.json({ error: 'Not found', message: 'Alert channel not found' }, 404);

  const decryptFn = async (encrypted: string) => decrypt(encrypted, c.env.ENCRYPTION_KEY);
  const result = await sendTestAlert(db, channelId, decryptFn);

  if (result.success) return c.json({ data: { sent: true, externalId: result.externalId } });
  return c.json({ error: 'Failed to send test alert', message: result.error }, 500);
});
