/**
 * Users API Routes
 * User profile and API key management
 */

import { Hono } from 'hono';
import type { Env } from '../middleware/auth';

export const usersRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
    return crypto.randomUUID();
}

// Get current user profile
usersRouter.get('/me', async (c) => {
    const user = c.get('user');

    const profile = await c.env.MCP_DB
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(user.id)
        .first();

    if (!profile) {
        return c.json({ error: 'Not Found', message: 'User profile not found' }, 404);
    }

    // Get connector count
    const connectorCount = await c.env.MCP_DB
        .prepare('SELECT COUNT(*) as count FROM connectors WHERE owner_id = ?')
        .bind(user.id)
        .first<{ count: number }>();

    return c.json({
        user: {
            ...profile,
            connector_count: connectorCount?.count ?? 0,
        },
    });
});

// Update current user profile
usersRouter.patch('/me', async (c) => {
    const user = c.get('user');
    const body = await c.req.json<{
        display_name?: string;
        avatar_url?: string;
        preferences?: object;
    }>();

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (body.display_name !== undefined) {
        if (body.display_name.length > 100) {
            return c.json({ error: 'Bad Request', message: 'Display name too long' }, 400);
        }
        updates.push('display_name = ?');
        params.push(body.display_name);
    }
    if (body.avatar_url !== undefined) {
        updates.push('avatar_url = ?');
        params.push(body.avatar_url);
    }
    if (body.preferences !== undefined) {
        updates.push('preferences = ?');
        params.push(JSON.stringify(body.preferences));
    }

    if (updates.length === 0) {
        return c.json({ error: 'Bad Request', message: 'No fields to update' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    params.push(user.id);

    await c.env.MCP_DB
        .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

    const profile = await c.env.MCP_DB
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(user.id)
        .first();

    return c.json({ user: profile });
});

// List API keys
usersRouter.get('/me/api-keys', async (c) => {
    const user = c.get('user');

    const { results } = await c.env.MCP_DB
        .prepare(`
      SELECT id, name, key_prefix, permissions, last_used_at, expires_at, is_active, created_at
      FROM api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
        .bind(user.id)
        .all();

    return c.json({ api_keys: results });
});

// Create API key
usersRouter.post('/me/api-keys', async (c) => {
    const user = c.get('user');
    const body = await c.req.json<{
        name: string;
        permissions?: object;
        expires_in_days?: number;
    }>();

    if (!body.name) {
        return c.json({ error: 'Bad Request', message: 'Name is required' }, 400);
    }

    // Generate API key: mcp_<random_chars>
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const keyBase64 = btoa(String.fromCharCode(...keyBytes))
        .replace(/[+/=]/g, '')
        .slice(0, 32);
    const apiKey = `mcp_${keyBase64}`;
    const keyPrefix = apiKey.slice(4, 12); // First 8 chars after prefix

    // Hash the key for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const id = generateId();
    const expiresAt = body.expires_in_days
        ? new Date(Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

    await c.env.MCP_DB
        .prepare(`
      INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, permissions, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
            id,
            user.id,
            body.name,
            keyHash,
            keyPrefix,
            JSON.stringify(body.permissions || {}),
            expiresAt
        )
        .run();

    // Return the key only once - never stored in plaintext
    return c.json({
        api_key: {
            id,
            name: body.name,
            key: apiKey, // Only returned on creation
            key_prefix: keyPrefix,
            expires_at: expiresAt,
        },
        warning: 'Save this API key - it will not be shown again',
    }, 201);
});

// Revoke API key
usersRouter.delete('/me/api-keys/:id', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();

    const result = await c.env.MCP_DB
        .prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?')
        .bind(id, user.id)
        .run();

    if (result.meta.changes === 0) {
        return c.json({ error: 'Not Found', message: 'API key not found' }, 404);
    }

    return c.json({ success: true });
});

// Get user dashboard stats
usersRouter.get('/me/stats', async (c) => {
    const user = c.get('user');

    // Get connector stats
    const connectorStats = await c.env.MCP_DB
        .prepare(`
      SELECT 
        COUNT(*) as total_connectors,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_connectors,
        SUM(download_count) as total_downloads
      FROM connectors WHERE owner_id = ?
    `)
        .bind(user.id)
        .first<{ total_connectors: number; active_connectors: number; total_downloads: number }>();

    // Get job stats for last 30 days
    const jobStats = await c.env.MCP_DB
        .prepare(`
      SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs
      FROM jobs j
      JOIN connectors c ON j.connector_id = c.id
      WHERE c.owner_id = ? AND j.created_at >= datetime('now', '-30 days')
    `)
        .bind(user.id)
        .first<{ total_jobs: number; completed_jobs: number; failed_jobs: number }>();

    // Get recent request stats
    const requestStats = await c.env.MCP_DB
        .prepare(`
      SELECT 
        SUM(req_total) as total_requests,
        SUM(req_success) as successful_requests,
        AVG(avg_ms) as avg_latency
      FROM usage_metrics um
      JOIN connectors c ON um.connector_id = c.id
      WHERE c.owner_id = ? AND um.date >= date('now', '-7 days')
    `)
        .bind(user.id)
        .first<{ total_requests: number; successful_requests: number; avg_latency: number }>();

    return c.json({
        stats: {
            connectors: connectorStats,
            jobs: jobStats,
            requests: requestStats,
        },
    });
});
