/**
 * Connectors API Routes
 * CRUD operations for MCP connectors
 */

import { Hono } from 'hono';
import type { Env } from '../middleware/auth';

export const connectorsRouter = new Hono<{ Bindings: Env }>();

// Generate UUID
function generateId(): string {
    return crypto.randomUUID();
}

// List user's connectors
connectorsRouter.get('/', async (c) => {
    const user = c.get('user');
    const { status, runtime, limit = '20', offset = '0' } = c.req.query();

    let query = 'SELECT * FROM connectors WHERE owner_id = ?';
    const params: (string | number)[] = [user.id];

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }
    if (runtime) {
        query += ' AND runtime = ?';
        params.push(runtime);
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await c.env.MCP_DB
        .prepare(query)
        .bind(...params)
        .all();

    // Get total count
    const countResult = await c.env.MCP_DB
        .prepare('SELECT COUNT(*) as total FROM connectors WHERE owner_id = ?')
        .bind(user.id)
        .first<{ total: number }>();

    return c.json({
        connectors: results,
        total: countResult?.total ?? 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
    });
});

// Get single connector
connectorsRouter.get('/:id', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();

    const connector = await c.env.MCP_DB
        .prepare('SELECT * FROM connectors WHERE id = ? AND (owner_id = ? OR is_public = 1)')
        .bind(id, user.id)
        .first();

    if (!connector) {
        return c.json({ error: 'Not Found', message: 'Connector not found' }, 404);
    }

    return c.json({ connector });
});

// Create connector
connectorsRouter.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json<{
        name: string;
        slug: string;
        description?: string;
        runtime: string;
        auth_mode: string;
        spec_url?: string;
        tags?: string[];
        is_public?: boolean;
    }>();

    // Validate required fields
    if (!body.name || !body.slug || !body.runtime || !body.auth_mode) {
        return c.json({ error: 'Bad Request', message: 'Missing required fields' }, 400);
    }

    // Check slug format
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
        return c.json({ error: 'Bad Request', message: 'Slug must contain only lowercase letters, numbers, and hyphens' }, 400);
    }

    // Check for existing slug
    const existing = await c.env.MCP_DB
        .prepare('SELECT id FROM connectors WHERE owner_id = ? AND slug = ?')
        .bind(user.id, body.slug)
        .first();

    if (existing) {
        return c.json({ error: 'Conflict', message: 'A connector with this slug already exists' }, 409);
    }

    const id = generateId();

    await c.env.MCP_DB
        .prepare(`
      INSERT INTO connectors (id, name, slug, description, owner_id, runtime, auth_mode, spec_url, tags, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(
            id,
            body.name,
            body.slug,
            body.description || null,
            user.id,
            body.runtime,
            body.auth_mode,
            body.spec_url || null,
            JSON.stringify(body.tags || []),
            body.is_public ? 1 : 0
        )
        .run();

    const connector = await c.env.MCP_DB
        .prepare('SELECT * FROM connectors WHERE id = ?')
        .bind(id)
        .first();

    return c.json({ connector }, 201);
});

// Update connector
connectorsRouter.patch('/:id', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();
    const body = await c.req.json<Partial<{
        name: string;
        description: string;
        spec_url: string;
        spec_content: object;
        manifest_content: object;
        tags: string[];
        is_public: boolean;
        status: string;
    }>>();

    // Verify ownership
    const existing = await c.env.MCP_DB
        .prepare('SELECT id FROM connectors WHERE id = ? AND owner_id = ?')
        .bind(id, user.id)
        .first();

    if (!existing) {
        return c.json({ error: 'Not Found', message: 'Connector not found' }, 404);
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description); }
    if (body.spec_url !== undefined) { updates.push('spec_url = ?'); params.push(body.spec_url); }
    if (body.spec_content !== undefined) { updates.push('spec_content = ?'); params.push(JSON.stringify(body.spec_content)); }
    if (body.manifest_content !== undefined) { updates.push('manifest_content = ?'); params.push(JSON.stringify(body.manifest_content)); }
    if (body.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(body.tags)); }
    if (body.is_public !== undefined) { updates.push('is_public = ?'); params.push(body.is_public ? 1 : 0); }
    if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }

    if (updates.length === 0) {
        return c.json({ error: 'Bad Request', message: 'No fields to update' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await c.env.MCP_DB
        .prepare(`UPDATE connectors SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

    const connector = await c.env.MCP_DB
        .prepare('SELECT * FROM connectors WHERE id = ?')
        .bind(id)
        .first();

    return c.json({ connector });
});

// Delete connector
connectorsRouter.delete('/:id', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();

    const result = await c.env.MCP_DB
        .prepare('DELETE FROM connectors WHERE id = ? AND owner_id = ?')
        .bind(id, user.id)
        .run();

    if (result.meta.changes === 0) {
        return c.json({ error: 'Not Found', message: 'Connector not found' }, 404);
    }

    return c.json({ success: true }, 200);
});

// Get connector stats
connectorsRouter.get('/:id/stats', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();
    const { days = '7' } = c.req.query();

    // Verify access
    const connector = await c.env.MCP_DB
        .prepare('SELECT id FROM connectors WHERE id = ? AND (owner_id = ? OR is_public = 1)')
        .bind(id, user.id)
        .first();

    if (!connector) {
        return c.json({ error: 'Not Found', message: 'Connector not found' }, 404);
    }

    const { results } = await c.env.MCP_DB
        .prepare(`
      SELECT date, 
             SUM(req_total) as requests,
             SUM(req_success) as successes,
             SUM(req_error) as errors,
             AVG(avg_ms) as avg_latency
      FROM usage_metrics
      WHERE connector_id = ? AND date >= date('now', '-' || ? || ' days')
      GROUP BY date
      ORDER BY date ASC
    `)
        .bind(id, parseInt(days))
        .all();

    return c.json({ stats: results });
});
