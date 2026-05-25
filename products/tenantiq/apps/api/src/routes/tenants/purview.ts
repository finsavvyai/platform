/**
 * Purview Compliance Scan Route
 * GET /api/tenants/:tenantId/purview
 *
 * Returns Microsoft Purview feature scan with real Graph API data.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';
import { authMiddleware } from '../../middleware/auth';
import { tenantMiddleware } from '../../middleware/tenant';
import { GraphClient } from '../../lib/graph-client';
import {
	getPurviewFeatures,
	getDlpPolicies,
	getSensitivityLabels,
} from './purview-data';

const app = new Hono<AppEnv>();

app.use('*', authMiddleware);
app.use('*', tenantMiddleware);

/**
 * GET / - Comprehensive Purview compliance scan using real Graph data
 */
app.get('/', async (c) => {
	const tenantId = c.get('tenantId');

	// Create Graph client if Azure tenant is available
	let graph: GraphClient | null = null;
	try {
		const tenant = await c.env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ?')
			.bind(tenantId).first<{ azure_tenant_id: string }>();
		if (tenant?.azure_tenant_id) {
			graph = new GraphClient(c.env as any, tenant.azure_tenant_id);
		}
	} catch { /* proceed without graph */ }

	const [features, dlpPolicies, sensitivityLabels] = await Promise.all([
		getPurviewFeatures(graph),
		getDlpPolicies(graph),
		getSensitivityLabels(graph),
	]);

	const configured = features.filter(f => f.status === 'configured').length;
	const partial = features.filter(f => f.status === 'partial').length;
	const notConfigured = features.filter(f => f.status === 'not_configured').length;
	const criticalGaps = features.filter(
		f => f.severity === 'critical' && f.status !== 'configured',
	).length;
	const totalFeatures = features.length;

	const maxScore = totalFeatures * 10 || 1;
	const earned = features.reduce((sum, f) => {
		if (f.status === 'configured') return sum + 10;
		if (f.status === 'partial') return sum + 5;
		return sum;
	}, 0);
	const overallScore = Math.round((earned / maxScore) * 100);

	return c.json({
		tenantId,
		overallScore,
		features,
		dlpPolicies,
		sensitivityLabels,
		summary: { totalFeatures, configured, partial, notConfigured, criticalGaps },
	});
});

export default app;
