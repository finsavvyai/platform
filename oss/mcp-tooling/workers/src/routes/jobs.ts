/**
 * Jobs API Routes
 * Manage connector build and deploy jobs
 */

import { Hono } from 'hono';
import type { Env } from '../middleware/auth';

export const jobsRouter = new Hono<{ Bindings: Env }>();

function generateId(): string {
    return crypto.randomUUID();
}

// List jobs for user's connectors
jobsRouter.get('/', async (c) => {
    const user = c.get('user');
    const { connector_id, status, type, limit = '20', offset = '0' } = c.req.query();

    let query = `
    SELECT j.*, c.name as connector_name, c.slug as connector_slug
    FROM jobs j
    JOIN connectors c ON j.connector_id = c.id
    WHERE c.owner_id = ?
  `;
    const params: (string | number)[] = [user.id];

    if (connector_id) {
        query += ' AND j.connector_id = ?';
        params.push(connector_id);
    }
    if (status) {
        query += ' AND j.status = ?';
        params.push(status);
    }
    if (type) {
        query += ' AND j.type = ?';
        params.push(type);
    }

    query += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const { results } = await c.env.MCP_DB
        .prepare(query)
        .bind(...params)
        .all();

    return c.json({ jobs: results });
});

// Get single job
jobsRouter.get('/:id', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();

    const job = await c.env.MCP_DB
        .prepare(`
      SELECT j.*, c.name as connector_name
      FROM jobs j
      JOIN connectors c ON j.connector_id = c.id
      WHERE j.id = ? AND c.owner_id = ?
    `)
        .bind(id, user.id)
        .first();

    if (!job) {
        return c.json({ error: 'Not Found', message: 'Job not found' }, 404);
    }

    return c.json({ job });
});

// Create job
jobsRouter.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json<{
        connector_id: string;
        type: 'generate' | 'deploy' | 'test';
        priority?: 'low' | 'normal' | 'high' | 'critical';
        config?: object;
    }>();

    if (!body.connector_id || !body.type) {
        return c.json({ error: 'Bad Request', message: 'Missing required fields' }, 400);
    }

    // Verify connector ownership
    const connector = await c.env.MCP_DB
        .prepare('SELECT id, name FROM connectors WHERE id = ? AND owner_id = ?')
        .bind(body.connector_id, user.id)
        .first<{ id: string; name: string }>();

    if (!connector) {
        return c.json({ error: 'Not Found', message: 'Connector not found' }, 404);
    }

    const id = generateId();

    await c.env.MCP_DB
        .prepare(`
      INSERT INTO jobs (id, connector_id, type, priority, config)
      VALUES (?, ?, ?, ?, ?)
    `)
        .bind(
            id,
            body.connector_id,
            body.type,
            body.priority || 'normal',
            JSON.stringify(body.config || {})
        )
        .run();

    // Queue the job for processing
    await c.env.MCP_QUEUE.send({
        type: 'job',
        jobId: id,
        jobType: body.type,
        connectorId: body.connector_id,
    });

    const job = await c.env.MCP_DB
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .bind(id)
        .first();

    return c.json({ job }, 201);
});

// Cancel job
jobsRouter.post('/:id/cancel', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();

    const result = await c.env.MCP_DB
        .prepare(`
      UPDATE jobs SET status = 'failed', error_message = 'Cancelled by user', finished_at = datetime('now')
      FROM connectors c
      WHERE jobs.id = ? AND jobs.connector_id = c.id AND c.owner_id = ? AND jobs.status IN ('pending', 'running')
    `)
        .bind(id, user.id)
        .run();

    if (result.meta.changes === 0) {
        return c.json({ error: 'Not Found', message: 'Job not found or already completed' }, 404);
    }

    return c.json({ success: true });
});

// Get job logs
jobsRouter.get('/:id/logs', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();
    const { level, limit = '100' } = c.req.query();

    // Verify access
    const job = await c.env.MCP_DB
        .prepare(`
      SELECT j.id FROM jobs j
      JOIN connectors c ON j.connector_id = c.id
      WHERE j.id = ? AND c.owner_id = ?
    `)
        .bind(id, user.id)
        .first();

    if (!job) {
        return c.json({ error: 'Not Found', message: 'Job not found' }, 404);
    }

    let query = 'SELECT * FROM job_logs WHERE job_id = ?';
    const params: (string | number)[] = [id];

    if (level) {
        query += ' AND level = ?';
        params.push(level);
    }

    query += ' ORDER BY timestamp ASC LIMIT ?';
    params.push(parseInt(limit));

    const { results } = await c.env.MCP_DB
        .prepare(query)
        .bind(...params)
        .all();

    return c.json({ logs: results });
});

// Retry failed job
jobsRouter.post('/:id/retry', async (c) => {
    const user = c.get('user');
    const { id } = c.req.param();

    // Get original job
    const originalJob = await c.env.MCP_DB
        .prepare(`
      SELECT j.* FROM jobs j
      JOIN connectors c ON j.connector_id = c.id
      WHERE j.id = ? AND c.owner_id = ? AND j.status = 'failed'
    `)
        .bind(id, user.id)
        .first<{ connector_id: string; type: string; config: string }>();

    if (!originalJob) {
        return c.json({ error: 'Not Found', message: 'Failed job not found' }, 404);
    }

    // Create new job
    const newId = generateId();

    await c.env.MCP_DB
        .prepare(`
      INSERT INTO jobs (id, connector_id, type, priority, config)
      VALUES (?, ?, ?, 'normal', ?)
    `)
        .bind(newId, originalJob.connector_id, originalJob.type, originalJob.config)
        .run();

    // Queue for processing
    await c.env.MCP_QUEUE.send({
        type: 'job',
        jobId: newId,
        jobType: originalJob.type,
        connectorId: originalJob.connector_id,
    });

    const job = await c.env.MCP_DB
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .bind(newId)
        .first();

    return c.json({ job }, 201);
});
