/**
 * Operational Routes
 * Activity feed, notifications, analytics, and early access endpoints
 */

import { Hono } from 'hono';

interface Env {
  DASHBOARD_DB: D1Database;
}

const operationalRoutes = new Hono<{ Bindings: Env }>();

// Get recent activity across all products
operationalRoutes.get('/activity/recent', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');

  const { results } = await c.env.DASHBOARD_DB.prepare(`
    SELECT
      id,
      product_id,
      activity_type,
      description,
      user_id,
      metadata,
      created_at
    FROM dashboard_activity
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  return c.json({
    activities: results,
    count: results.length,
    timestamp: new Date().toISOString(),
  });
});

// Get notifications for the dashboard
operationalRoutes.get('/notifications', async (c) => {
  const { results } = await c.env.DASHBOARD_DB.prepare(`
    SELECT
      id,
      type,
      title,
      message,
      severity,
      product_id,
      is_read,
      created_at
    FROM dashboard_notifications
    WHERE is_read = 0
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  return c.json({
    notifications: results,
    unread: results.filter((n: Record<string, unknown>) => !n.is_read).length,
    timestamp: new Date().toISOString(),
  });
});

// Mark notification as read
operationalRoutes.post('/notifications/:id/read', async (c) => {
  const notificationId = c.req.param('id');

  await c.env.DASHBOARD_DB.prepare(`
    UPDATE dashboard_notifications
    SET is_read = 1, read_at = datetime('now')
    WHERE id = ?
  `).bind(notificationId).run();

  return c.json({ success: true });
});

// Analytics endpoint
operationalRoutes.get('/analytics/dashboard', async (c) => {
  const timeRange = c.req.query('range') || '24h';

  const analytics = {
    pageViews: 15234,
    activeUsers: 342,
    apiCalls: 125678,
    errorRate: 0.02,
    averageLoadTime: 1.2,
    topFeatures: [
      { name: 'RAG Queries', usage: 4523 },
      { name: 'Vector Search', usage: 3892 },
      { name: 'Document Processing', usage: 2156 },
    ],
    timeRange,
    timestamp: new Date().toISOString(),
  };

  return c.json(analytics);
});

// Early access API endpoint
operationalRoutes.post('/early-access', async (c) => {
  try {
    const body = await c.req.json();

    const id = crypto.randomUUID();
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_activity (id, product_id, activity_type, description, user_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      'autoboot',
      'early_access_request',
      `Early access request from ${body.name} (${body.email})`,
      null,
      JSON.stringify({
        ...body,
        ip: c.req.header('cf-connecting-ip') || 'unknown',
        userAgent: c.req.header('user-agent') || 'unknown'
      })
    ).run();

    return c.json({
      success: true,
      message: 'Early access request submitted successfully'
    });
  } catch (error) {
    console.error('Early access error:', error);
    return c.json({
      success: false,
      error: 'Failed to submit early access request'
    }, 500);
  }
});

export default operationalRoutes;
