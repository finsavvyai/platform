/**
 * Real-Time Routes
 * WebSocket, broadcast, metrics streaming, and alert routes
 */

import { Hono } from 'hono';
import { requireAuth } from './auth-secure';

interface Env {
  DASHBOARD_DB: D1Database;
  DASHBOARD_REALTIME: DurableObjectNamespace;
}

const realtimeRoutes = new Hono<{ Bindings: Env }>();

// WebSocket endpoint for real-time updates
realtimeRoutes.get('/ws', async (c) => {
  const id = c.env.DASHBOARD_REALTIME.idFromName('global');
  const stub = c.env.DASHBOARD_REALTIME.get(id);
  return stub.fetch(c.req.raw);
});

// Broadcast update to all connected clients
realtimeRoutes.post('/broadcast', requireAuth, async (c) => {
  try {
    const data = await c.req.json();
    const id = c.env.DASHBOARD_REALTIME.idFromName('global');
    const stub = c.env.DASHBOARD_REALTIME.get(id);

    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }));

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: 'Broadcast failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Broadcast metrics update
realtimeRoutes.post('/metrics', async (c) => {
  try {
    const metrics = await c.req.json();
    const id = c.env.DASHBOARD_REALTIME.idFromName('global');
    const stub = c.env.DASHBOARD_REALTIME.get(id);

    await stub.fetch(new Request('https://internal/metrics/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
    }));

    // Store in D1 for historical data
    const snapshotId = crypto.randomUUID();
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_metrics_snapshots (
        id, product_id, total_requests, total_users, total_revenue,
        response_time, uptime, error_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshotId,
      metrics.productId || null,
      metrics.totalRequests || 0,
      metrics.totalUsers || 0,
      metrics.totalRevenue || 0,
      metrics.responseTime || 0,
      metrics.uptime || 0,
      metrics.errorRate || 0
    ).run();

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: 'Metrics update failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Broadcast alert
realtimeRoutes.post('/alert', requireAuth, async (c) => {
  try {
    const alert = await c.req.json();

    const alertId = crypto.randomUUID();
    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_alerts (
        id, product_id, alert_type, severity, title, description, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      alertId,
      alert.productId,
      alert.alertType,
      alert.severity,
      alert.title,
      alert.description || '',
      JSON.stringify(alert.metadata || {})
    ).run();

    const id = c.env.DASHBOARD_REALTIME.idFromName('global');
    const stub = c.env.DASHBOARD_REALTIME.get(id);

    await stub.fetch(new Request('https://internal/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...alert, id: alertId }),
    }));

    return c.json({ success: true, alertId });
  } catch (error) {
    return c.json({
      error: 'Alert broadcast failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default realtimeRoutes;
