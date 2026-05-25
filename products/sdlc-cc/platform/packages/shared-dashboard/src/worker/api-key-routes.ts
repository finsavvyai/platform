/**
 * API Key Management Routes
 * Create, list, revoke, and manage API keys
 */

import { Hono } from 'hono';
import { requireAuth, type User } from './auth-secure';
import { generateAPIKey, hashAPIKey } from './crypto-utils';
import { type Env } from './types';

const apiKeyRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/api-keys
 * Create a new API key
 */
apiKeyRoutes.post('/', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { name, scopes, rateLimit, expiresIn } = await c.req.json();

    if (!name) {
      return c.json({
        error: 'Invalid request',
        message: 'API key name is required',
      }, 400);
    }

    // Generate API key
    const apiKey = generateAPIKey();
    const keyHash = await hashAPIKey(apiKey);
    const keyPrefix = apiKey.substring(0, 11); // "dk_" + 8 chars
    const keyId = crypto.randomUUID();

    // Calculate expiration if provided
    let expiresAt = null;
    if (expiresIn) {
      // expiresIn is in days
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiresIn);
      expiresAt = expiryDate.toISOString();
    }

    // Store API key
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_api_keys (
        id, user_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      keyId,
      user.id,
      name,
      keyHash,
      keyPrefix,
      JSON.stringify(scopes || []),
      rateLimit || 1000,
      expiresAt,
      1
    ).run();

    // Log API key creation in audit log
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_audit_logs (
        id, user_id, organization_id, action, resource_type, resource_id, status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      user.organizationId || null,
      'api_key.created',
      'api_key',
      keyId,
      'success',
      JSON.stringify({ name, keyPrefix })
    ).run();

    return c.json({
      success: true,
      apiKey, // Only returned once - user must save it
      keyId,
      keyPrefix,
      name,
      scopes: scopes || [],
      rateLimit: rateLimit || 1000,
      expiresAt,
      message: 'API key created successfully. Save it now - you won\'t be able to see it again.',
    }, 201);
  } catch (error) {
    console.error('API key creation error:', error);
    return c.json({
      error: 'Failed to create API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/api-keys
 * List all API keys for current user
 */
apiKeyRoutes.get('/', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id, name, key_prefix, scopes, rate_limit, is_active,
        last_used_at, expires_at, created_at, updated_at
      FROM dashboard_api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();

    const apiKeys = result.results?.map((key: Record<string, unknown>) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.key_prefix,
      scopes: JSON.parse((key.scopes as string) || '[]'),
      rateLimit: key.rate_limit,
      isActive: key.is_active === 1,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      createdAt: key.created_at,
      updatedAt: key.updated_at,
    })) || [];

    return c.json({
      apiKeys,
      total: apiKeys.length,
    });
  } catch (error) {
    console.error('API key list error:', error);
    return c.json({
      error: 'Failed to list API keys',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/api-keys/:id
 * Get details of a specific API key
 */
apiKeyRoutes.get('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const keyId = c.req.param('id');

    const apiKey = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id, name, key_prefix, scopes, rate_limit, is_active,
        last_used_at, expires_at, created_at, updated_at
      FROM dashboard_api_keys
      WHERE id = ? AND user_id = ?
    `).bind(keyId, user.id).first();

    if (!apiKey) {
      return c.json({
        error: 'Not found',
        message: 'API key not found',
      }, 404);
    }

    return c.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.key_prefix,
        scopes: JSON.parse(apiKey.scopes as string || '[]'),
        rateLimit: apiKey.rate_limit,
        isActive: apiKey.is_active === 1,
        lastUsedAt: apiKey.last_used_at,
        expiresAt: apiKey.expires_at,
        createdAt: apiKey.created_at,
        updatedAt: apiKey.updated_at,
      },
    });
  } catch (error) {
    console.error('API key get error:', error);
    return c.json({
      error: 'Failed to get API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * PATCH /api/v1/api-keys/:id
 * Update API key (name, scopes, rate limit)
 */
apiKeyRoutes.patch('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const keyId = c.req.param('id');
    const { name, scopes, rateLimit } = await c.req.json();

    // Verify ownership
    const existingKey = await c.env.DASHBOARD_DB.prepare(`
      SELECT id FROM dashboard_api_keys WHERE id = ? AND user_id = ?
    `).bind(keyId, user.id).first();

    if (!existingKey) {
      return c.json({
        error: 'Not found',
        message: 'API key not found',
      }, 404);
    }

    // Build update query
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (scopes !== undefined) {
      updates.push('scopes = ?');
      values.push(JSON.stringify(scopes));
    }
    if (rateLimit !== undefined) {
      updates.push('rate_limit = ?');
      values.push(rateLimit);
    }

    if (updates.length === 0) {
      return c.json({
        error: 'Invalid request',
        message: 'No fields to update',
      }, 400);
    }

    values.push(keyId);

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_api_keys
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    // Log update in audit log
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_audit_logs (
        id, user_id, organization_id, action, resource_type, resource_id, status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      user.organizationId || null,
      'api_key.updated',
      'api_key',
      keyId,
      'success',
      JSON.stringify({ name, scopes, rateLimit })
    ).run();

    return c.json({
      success: true,
      message: 'API key updated successfully',
    });
  } catch (error) {
    console.error('API key update error:', error);
    return c.json({
      error: 'Failed to update API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /api/v1/api-keys/:id
 * Revoke (deactivate) an API key
 */
apiKeyRoutes.delete('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const keyId = c.req.param('id');

    // Verify ownership
    const existingKey = await c.env.DASHBOARD_DB.prepare(`
      SELECT id, name FROM dashboard_api_keys WHERE id = ? AND user_id = ?
    `).bind(keyId, user.id).first();

    if (!existingKey) {
      return c.json({
        error: 'Not found',
        message: 'API key not found',
      }, 404);
    }

    // Deactivate the key (don't delete for audit purposes)
    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_api_keys
      SET is_active = 0
      WHERE id = ?
    `).bind(keyId).run();

    // Log revocation in audit log
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_audit_logs (
        id, user_id, organization_id, action, resource_type, resource_id, status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      user.organizationId || null,
      'api_key.revoked',
      'api_key',
      keyId,
      'success',
      JSON.stringify({ name: existingKey.name })
    ).run();

    return c.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('API key revocation error:', error);
    return c.json({
      error: 'Failed to revoke API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/api-keys/:id/rotate
 * Rotate an API key (generate new key, keep same ID)
 */
apiKeyRoutes.post('/:id/rotate', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const keyId = c.req.param('id');

    // Verify ownership and active status
    const existingKey = await c.env.DASHBOARD_DB.prepare(`
      SELECT id, name, is_active FROM dashboard_api_keys
      WHERE id = ? AND user_id = ?
    `).bind(keyId, user.id).first();

    if (!existingKey) {
      return c.json({
        error: 'Not found',
        message: 'API key not found',
      }, 404);
    }

    if (existingKey.is_active !== 1) {
      return c.json({
        error: 'Invalid operation',
        message: 'Cannot rotate an inactive API key',
      }, 400);
    }

    // Generate new API key
    const newApiKey = generateAPIKey();
    const newKeyHash = await hashAPIKey(newApiKey);
    const newKeyPrefix = newApiKey.substring(0, 11);

    // Update the key
    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_api_keys
      SET key_hash = ?, key_prefix = ?
      WHERE id = ?
    `).bind(newKeyHash, newKeyPrefix, keyId).run();

    // Log rotation in audit log
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_audit_logs (
        id, user_id, organization_id, action, resource_type, resource_id, status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      user.organizationId || null,
      'api_key.rotated',
      'api_key',
      keyId,
      'success',
      JSON.stringify({ name: existingKey.name, newKeyPrefix })
    ).run();

    return c.json({
      success: true,
      apiKey: newApiKey, // Only returned once
      keyPrefix: newKeyPrefix,
      message: 'API key rotated successfully. Save the new key now - you won\'t be able to see it again.',
    });
  } catch (error) {
    console.error('API key rotation error:', error);
    return c.json({
      error: 'Failed to rotate API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default apiKeyRoutes;
