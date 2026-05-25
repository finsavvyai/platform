import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { organizations } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { loadPlanConfig, requirePlanFeature } from '../middleware/plan-enforcement.js';
import { generateAgentReport } from '../services/agent-report-export.js';

export const agentReportRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
agentReportRoutes.use('*', dbMiddleware, authMiddleware, requirePermission('agent.policy.read'));

// POST /api/agents/reports/generate — generate a security report
agentReportRoutes.post('/reports/generate', loadPlanConfig, requirePlanFeature('pdfReports'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required for reports' }, 400);
  }

  // Get org name
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const orgName = org?.name ?? 'Unknown Organization';

  const result = await generateAgentReport(db, c.env, orgId, orgName);
  return c.json({ data: result }, 201);
});

// GET /api/agents/reports — list reports from R2
agentReportRoutes.get('/reports', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required' }, 400);
  }

  const prefix = `reports/${orgId}/`;
  const listed = await c.env.STORAGE.list({ prefix, limit: 50 });

  const reports = listed.objects.map((obj) => {
    const id = obj.key.replace(prefix, '').replace('.html', '');
    return {
      id,
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      downloadUrl: `/api/agents/reports/${id}/download`,
    };
  });

  return c.json({ data: reports });
});

// GET /api/agents/reports/:id/download — download report HTML or PDF
agentReportRoutes.get('/reports/:id/download', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Org context required' }, 400);
  }

  const reportId = c.req.param('id');
  const format = c.req.query('format'); // 'html' or 'pdf'

  // Determine file extension and content type based on format
  const isPdf = format === 'pdf';
  const extension = isPdf ? 'pdf' : 'html';
  const contentType = isPdf ? 'application/pdf' : 'text/html';
  const disposition = isPdf ? 'attachment' : 'inline';

  const key = `reports/${orgId}/${reportId}.${extension}`;
  const object = await c.env.STORAGE.get(key);

  if (!object) {
    return c.json({ error: 'Not found', message: 'Report not found' }, 404);
  }

  const content = await object.arrayBuffer();
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="report-${reportId}.${extension}"`,
    },
  });
});
