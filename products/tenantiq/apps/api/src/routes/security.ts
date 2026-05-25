import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { createGraphClient } from '../lib/graph-client';
import { getRiskyUsers, getConditionalAccessPolicies, getMfaRegistrationDetails } from '../lib/graph-client-extended';
import { analyzeSecurityPosture } from '../lib/security-helpers';
import { getDb } from '../lib/db';
import { getTenantById } from '@tenantiq/db';
import { kvCache } from '../middleware/cache';
import type { AppEnv } from '../app/types';

const security = new Hono<AppEnv>();

security.use('*', authMiddleware);
security.use('*', standardRateLimit);

/**
 * GET /security/dashboard
 * Unified security dashboard aggregating score, alerts, risks, and posture
 */
security.get('/dashboard', tenantScopingMiddleware, kvCache({ ttl: 300, prefix: 'security-dashboard' }), async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) {
			return c.json({ error: 'Tenant not configured' }, 400);
		}

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);

		const [secureScoreRaw, riskyUsers, caPolicies, mfaDetails, alerts] =
			await Promise.all([
				graph.fetch('/security/secureScores?$top=1').catch(() => ({ value: [] })),
				getRiskyUsers(graph),
				getConditionalAccessPolicies(graph),
				getMfaRegistrationDetails(graph),
				graph.getSecurityAlerts(),
			]);

		const secureScore = secureScoreRaw?.value?.[0];
		const scorePercent = secureScore
			? Math.round((secureScore.currentScore / secureScore.maxScore) * 100)
			: null;

		const mfaEnabled = mfaDetails.filter((u: any) => u.isMfaRegistered || u.isMfaCapable).length;
		const totalMfaUsers = mfaDetails.length;
		const enabledPolicies = caPolicies.filter((p: any) => p.state === 'enabled');
		const criticalAlerts = alerts.filter((a) => a.severity === 'high').length;
		const highRiskUsers = riskyUsers.filter((u: any) => u.riskLevel === 'high').length;

		const riskLevel =
			criticalAlerts > 5 || highRiskUsers > 3 ? 'critical'
				: criticalAlerts > 0 || highRiskUsers > 0 ? 'high'
					: scorePercent !== null && scorePercent < 50 ? 'medium'
						: 'low';

		return c.json({
			securityScore: scorePercent,
			riskLevel,
			mfa: { enabled: mfaEnabled, total: totalMfaUsers, rate: totalMfaUsers > 0 ? Math.round((mfaEnabled / totalMfaUsers) * 100) : 0 },
			conditionalAccess: { total: caPolicies.length, enabled: enabledPolicies.length },
			alerts: { total: alerts.length, critical: criticalAlerts, active: alerts.filter((a) => a.status === 'new').length },
			riskyUsers: { total: riskyUsers.length, high: highRiskUsers },
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Security dashboard failed:', error);
		return c.json({ error: 'Failed to load security dashboard' }, 500);
	}
});

/**
 * GET /security/posture
 * MFA, password policy, and conditional access analysis
 */
security.get('/posture', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) {
			return c.json({ error: 'Tenant not configured' }, 400);
		}

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const posture = await analyzeSecurityPosture(graph);

		return c.json({ ...posture, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Security posture failed:', error);
		return c.json({ error: 'Failed to analyze security posture' }, 500);
	}
});

export default security;
