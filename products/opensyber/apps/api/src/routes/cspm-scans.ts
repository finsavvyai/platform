import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { cloudAccounts, cspmScanRuns, cspmFindings } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { hasPermission } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';
import { runCspmScan } from '../services/cspm-scanner.js';

export const cspmScanRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
cspmScanRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

function verifyAccountOwnership(
  account: { orgId: string | null; userId: string },
  orgId: string | null,
  userId: string,
): boolean {
  if (orgId) return account.orgId === orgId;
  return account.userId === userId;
}

// POST /api/cloud/accounts/:accountId/scan — trigger CSPM scan
cspmScanRoutes.post('/accounts/:accountId/scan', async (c) => {
  const role = c.get('role');
  if (role && !hasPermission(role, 'cloud.write')) {
    return c.json({ error: 'Forbidden', message: 'cloud.write required' }, 403);
  }

  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const accountId = c.req.param('accountId');

  const [account] = await db
    .select()
    .from(cloudAccounts)
    .where(eq(cloudAccounts.id, accountId));

  if (!account || !verifyAccountOwnership(account, orgId, userId)) {
    return c.json({ error: 'Not found', message: 'Cloud account not found' }, 404);
  }

  // Set status to scanning (orchestrator will update further)
  await db
    .update(cloudAccounts)
    .set({ status: 'scanning' })
    .where(eq(cloudAccounts.id, accountId));

  // Run scan with full account record (includes roleArn, externalId, credentials)
  const result = await runCspmScan(db, accountId, orgId, account);

  if (result.error) {
    await db
      .update(cloudAccounts)
      .set({ status: 'error' })
      .where(eq(cloudAccounts.id, accountId));
    return c.json({ error: 'Scan failed', message: result.error }, 400);
  }

  return c.json({ data: result.scanRun }, 201);
});

// GET /api/cloud/accounts/:accountId/scans — list scan runs
cspmScanRoutes.get('/accounts/:accountId/scans', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const accountId = c.req.param('accountId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);

  const [account] = await db
    .select()
    .from(cloudAccounts)
    .where(eq(cloudAccounts.id, accountId));

  if (!account || !verifyAccountOwnership(account, orgId, userId)) {
    return c.json({ error: 'Not found', message: 'Cloud account not found' }, 404);
  }

  const scans = await db
    .select()
    .from(cspmScanRuns)
    .where(eq(cspmScanRuns.cloudAccountId, accountId))
    .orderBy(desc(cspmScanRuns.startedAt))
    .limit(limit);

  return c.json({ data: scans });
});

// GET /api/cloud/scans/:scanId/findings — findings for a scan
cspmScanRoutes.get('/scans/:scanId/findings', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const scanId = c.req.param('scanId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 500);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const [scanRun] = await db
    .select()
    .from(cspmScanRuns)
    .where(eq(cspmScanRuns.id, scanId));

  if (!scanRun) {
    return c.json({ error: 'Not found', message: 'Scan run not found' }, 404);
  }

  // Verify ownership through cloud account
  const [account] = await db
    .select()
    .from(cloudAccounts)
    .where(eq(cloudAccounts.id, scanRun.cloudAccountId));

  if (!account || !verifyAccountOwnership(account, orgId, userId)) {
    return c.json({ error: 'Not found', message: 'Scan run not found' }, 404);
  }

  const findings = await db
    .select()
    .from(cspmFindings)
    .where(eq(cspmFindings.scanRunId, scanId))
    .limit(limit)
    .offset(offset);

  return c.json({ data: findings, hasMore: findings.length === limit });
});
