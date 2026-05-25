/**
 * Sample: Hono + TokenForge (Cloudflare Workers)
 *
 * Demonstrates:
 * - tokenForgeMiddleware for Hono (cloud API variant)
 * - c.get('tf') context in route handlers
 * - Skip paths and sensitive ops
 * - Visual HTML trust dashboard response
 */
import { Hono } from 'hono';
import { tokenForgeMiddleware } from '../../packages/tokenforge/dist/server/middleware.js';

interface TfCtx {
  bound: boolean;
  trustScore: number;
  deviceId: string | null;
}

type Variables = { tf: TfCtx };

/** Create a sample Hono app with TokenForge middleware. */
export function createApp(apiKey: string, apiBase?: string) {
  const app = new Hono<{ Variables: Variables }>();

  app.use('/api/*', tokenForgeMiddleware({
    apiKey,
    apiBase,
    skipPaths: ['/api/health', '/api/public/*'],
    sensitiveOps: ['DELETE /api/admin/*'],
    allowThreshold: 80,
    stepUpThreshold: 40,
  }));

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.get('/api/profile', (c) => {
    const tf = c.get('tf') as TfCtx | undefined;
    return c.json({
      userId: 'user-001',
      deviceBound: tf?.bound ?? false,
      trustScore: tf?.trustScore ?? 0,
      deviceId: tf?.deviceId ?? null,
    });
  });

  app.get('/api/sessions', (c) => {
    const tf = c.get('tf') as TfCtx | undefined;
    return c.json({
      currentDevice: tf?.deviceId ?? null,
      bound: tf?.bound ?? false,
      sessions: [{ id: tf?.deviceId, active: true }],
    });
  });

  app.delete('/api/admin/user/:id', (c) => {
    const tf = c.get('tf') as TfCtx | undefined;
    if (!tf?.bound || (tf?.trustScore ?? 0) < 90) {
      return c.json({ error: 'elevated_trust_required' }, 403);
    }
    return c.json({ deleted: true, userId: c.req.param('id') });
  });

  /** Visual dashboard endpoint — renders trust status as HTML. */
  app.get('/', (c) => {
    const tf = c.get('tf') as TfCtx | undefined;
    return c.html(renderDashboardHtml(tf));
  });

  return app;
}

/** Render a visual trust dashboard HTML page. */
function renderDashboardHtml(tf?: TfCtx): string {
  const score = tf?.trustScore ?? 0;
  const bound = tf?.bound ?? false;
  const deviceId = tf?.deviceId ?? 'not bound';
  const color = score >= 80 ? '#2ECC7B' : score >= 40 ? '#FFB347' : '#FF4D4D';
  const action = score >= 80 ? 'ALLOW' : score >= 40 ? 'STEP-UP' : 'BLOCK';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{background:#060910;color:#E8F0F8;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;}
  .card{background:#0A0F18;border:1px solid #1C2940;border-radius:16px;padding:40px;max-width:400px;text-align:center;}
  .score{font-size:64px;font-weight:800;color:${color};line-height:1;}
  .badge{display:inline-block;padding:6px 20px;border-radius:24px;font-size:13px;font-weight:600;border:1px solid ${color}40;background:${color}15;color:${color};margin:12px 0;}
  .meta{font-size:13px;color:#7A96B2;margin:4px 0;}
  .mono{font-family:monospace;font-size:12px;color:#3D5470;}
</style></head><body>
<div class="card">
  <p style="font-size:11px;color:#4D9EFF;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;">TokenForge</p>
  <div class="score">${score}</div>
  <p style="color:#3D5470;font-size:14px;">/ 100</p>
  <div class="badge">${action}</div>
  <p class="meta">Device Bound: ${bound ? 'Yes' : 'No'}</p>
  <p class="mono">${deviceId}</p>
</div></body></html>`;
}
