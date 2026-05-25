/**
 * Auth Routes - API key CRUD operations
 */

import { Hono } from 'hono';
import '../types';
import { requireAuth, type User } from '../auth-secure';
import type { Env } from './types';

const apiKeyRoutes = new Hono<{ Bindings: Env }>();

/** POST /api-keys - Generate new API key */
apiKeyRoutes.post('/api-keys', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { name, permissions, expiresIn } = await c.req.json();

    if (!name) {
      return c.json({
        error: 'Invalid request',
        message: 'Name is required',
      }, 400);
    }

    const apiKey = `dk_${crypto.randomUUID().replace(/-/g, '')}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
    const hashArray = new Uint8Array(hashBuffer);
    const keyHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');

    let expiresAt = null;
    if (expiresIn) {
      const now = new Date();
      now.setDate(now.getDate() + expiresIn);
      expiresAt = now.toISOString();
    }

    const keyId = crypto.randomUUID();

    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_api_keys (
        id, user_id, key_hash, name, permissions, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      keyId,
      user.id,
      keyHash,
      name,
      JSON.stringify(permissions || []),
      expiresAt,
      1
    ).run();

    return c.json({
      success: true,
      apiKey,
      keyId,
      name,
      permissions: permissions || [],
      expiresAt,
    }, 201);
  } catch (error) {
    console.error('API key creation error:', error);
    return c.json({
      error: 'API key creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/** GET /api-keys - List user's API keys */
apiKeyRoutes.get('/api-keys', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    const { results } = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id,
        name,
        permissions,
        last_used_at,
        expires_at,
        is_active,
        created_at
      FROM dashboard_api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();

    return c.json({
      apiKeys: results.map(key => ({
        id: key.id,
        name: key.name,
        permissions: JSON.parse(key.permissions as string || '[]'),
        lastUsedAt: key.last_used_at,
        expiresAt: key.expires_at,
        isActive: key.is_active === 1,
        createdAt: key.created_at,
      })),
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return c.json({
      error: 'Failed to list API keys',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/** DELETE /api-keys/:id - Revoke API key */
apiKeyRoutes.delete('/api-keys/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const keyId = c.req.param('id');

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_api_keys
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(keyId, user.id).run();

    return c.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return c.json({
      error: 'Failed to revoke API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default apiKeyRoutes;
