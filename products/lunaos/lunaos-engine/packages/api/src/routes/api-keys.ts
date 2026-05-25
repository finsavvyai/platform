/**
 * API Key Routes — generate, list, and revoke API keys
 *
 * POST   /api-keys           → generate a new API key
 * GET    /api-keys           → list user's API keys (prefix only)
 * DELETE /api-keys/:id       → revoke an API key
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import { generateApiKey } from '../services/key-manager';
import { validateJson } from '../middleware/validation';
import { createApiKeySchema } from '../schemas';

export const apiKeyRoutes = new Hono<{ Bindings: Env }>();

// ─── POST /api-keys — generate a new key ────────────────────────────────────

apiKeyRoutes.post('/', requireAuth, validateJson(createApiKeySchema), async (c) => {
    const { name } = c.req.valid('json');
    const userId = c.get('userId');

    // Max 5 active keys per user
    const existing = await c.env.DB.prepare(
        'SELECT COUNT(*) as c FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
    ).bind(userId).first<{ c: number }>();

    if ((existing?.c || 0) >= 5) {
        return c.json({
            error: 'Maximum 5 active API keys. Revoke an existing key first.',
        }, 400);
    }

    const { rawKey, keyHash, keyPrefix } = await generateApiKey();
    const keyId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
    INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(keyId, userId, keyHash, keyPrefix, name || 'Default', now).run();

    // Return the raw key **once** — it can never be retrieved again
    return c.json({
        id: keyId,
        key: rawKey,
        prefix: keyPrefix,
        name: name || 'Default',
        createdAt: now,
        warning: '⚠️ Save this key now. It will not be shown again.',
    }, 201);
});

// ─── GET /api-keys — list user's keys ────────────────────────────────────────

apiKeyRoutes.get('/', requireAuth, async (c) => {
    const userId = c.get('userId');

    const results = await c.env.DB.prepare(`
    SELECT id, key_prefix, name, created_at, last_used_at, revoked_at
    FROM api_keys
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(userId).all();

    return c.json({
        keys: (results.results || []).map((k: any) => ({
            id: k.id,
            prefix: k.key_prefix,
            name: k.name,
            createdAt: k.created_at,
            lastUsedAt: k.last_used_at,
            isActive: !k.revoked_at,
            revokedAt: k.revoked_at,
        })),
        total: results.results?.length || 0,
    });
});

// ─── DELETE /api-keys/:id — revoke a key ─────────────────────────────────────

apiKeyRoutes.delete('/:id', requireAuth, async (c) => {
    const keyId = c.req.param('id');
    const userId = c.get('userId');

    const key = await c.env.DB.prepare(
        'SELECT id FROM api_keys WHERE id = ? AND user_id = ? AND revoked_at IS NULL'
    ).bind(keyId, userId).first();

    if (!key) {
        return c.json({ error: 'API key not found or already revoked' }, 404);
    }

    await c.env.DB.prepare(
        'UPDATE api_keys SET revoked_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), keyId).run();

    return c.json({ message: 'API key revoked', id: keyId });
});
