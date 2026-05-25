import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware, requireRole } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { getDb, schema } from '../lib/db';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../app/types';

/**
 * Intelligence Engine Routes
 *
 * Endpoints for accessing intelligence scan results, user activity,
 * and automated analysis findings.
 */

const intelligence = new Hono<AppEnv>();

// Apply authentication and rate limiting to all routes
intelligence.use('*', authMiddleware);
intelligence.use('*', standardRateLimit);

/**
 * GET /intelligence/scans
 * Get intelligence scan history for a tenant
 */
intelligence.get('/scans', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	const scans = await db
		.select()
		.from(schema.intelligenceScans)
		.where(eq(schema.intelligenceScans.tenantId, tenantId))
		.orderBy(desc(schema.intelligenceScans.startedAt))
		.limit(50);

	return c.json({ scans });
});

/**
 * GET /intelligence/scans/:scanId
 * Get detailed results for a specific scan
 */
intelligence.get('/scans/:scanId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const scanId = c.req.param('scanId');
	if (!scanId) return c.json({ error: 'Missing scanId' }, 400);
	const db = getDb(c.env);

	const scan = await db
		.select()
		.from(schema.intelligenceScans)
		.where(
			and(eq(schema.intelligenceScans.id, scanId), eq(schema.intelligenceScans.tenantId, tenantId))
		)
		.limit(1);

	if (scan.length === 0) {
		return c.json({ error: 'Not Found', message: 'Scan not found' }, 404);
	}

	return c.json({ scan: scan[0] });
});

/**
 * GET /intelligence/user-activity
 * Get user activity snapshots for analysis
 */
intelligence.get('/user-activity', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	// Get most recent snapshot for each user
	const snapshots = await db
		.select()
		.from(schema.userActivitySnapshots)
		.where(eq(schema.userActivitySnapshots.tenantId, tenantId))
		.orderBy(desc(schema.userActivitySnapshots.snapshotDate))
		.limit(100);

	return c.json({ snapshots });
});

/**
 * GET /intelligence/user-activity/:userId
 * Get activity history for a specific user
 */
intelligence.get('/user-activity/:userId', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const userId = c.req.param('userId');
	if (!userId) return c.json({ error: 'Missing userId' }, 400);
	const db = getDb(c.env);

	const snapshots = await db
		.select()
		.from(schema.userActivitySnapshots)
		.where(
			and(
				eq(schema.userActivitySnapshots.tenantId, tenantId),
				eq(schema.userActivitySnapshots.userId, userId)
			)
		)
		.orderBy(desc(schema.userActivitySnapshots.snapshotDate))
		.limit(30);

	return c.json({ userId, snapshots });
});

/**
 * POST /intelligence/trigger-scan
 * Manually trigger an intelligence scan (admin only)
 */
intelligence.post('/trigger-scan', requireRole('admin', 'super_admin'), async (c) => {
	const tenantId = c.get('tenantId');
	const { scanType } = await c.req.json();

	if (!['inactive_users', 'license_waste', 'security', 'compliance', 'backup'].includes(scanType)) {
		return c.json({ error: 'Bad Request', message: 'Invalid scan type' }, 400);
	}

	// Execute implemented scan types
	if (scanType === 'inactive_users') {
		try {
			const { createIntelligenceEngine } = await import('../services/intelligence-engine');
			const engine = createIntelligenceEngine(c.env, tenantId);
			const results = await engine.analyzeInactiveUsers();

			return c.json({
				message: 'Inactive users scan completed',
				scanType,
				tenantId,
				status: 'completed',
				results: {
					inactiveUsersFound: results.length,
					totalMonthlyCostAtRisk: results.reduce((sum, u) => sum + u.estimatedMonthlyCost, 0),
				},
			});
		} catch (error) {
			console.error('Scan failed:', error);
			return c.json(
				{
					error: 'Internal Server Error',
				},
				500
			);
		}
	}

	if (scanType === 'license_waste') {
		try {
			const { createIntelligenceEngine } = await import('../services/intelligence-engine');
			const engine = createIntelligenceEngine(c.env, tenantId);
			const results = await engine.analyzeLicenseWaste();

			return c.json({
				message: 'License waste scan completed',
				scanType,
				tenantId,
				status: 'completed',
				results,
			});
		} catch (error) {
			console.error('Scan failed:', error);
			return c.json(
				{
					error: 'Internal Server Error',
				},
				500
			);
		}
	}

	// Other scan types will be implemented in future tasks
	return c.json({
		message: 'Scan queued',
		scanType,
		tenantId,
		status: 'queued',
		note: 'This scan type will be implemented in a future task',
	});
});

export default intelligence;
