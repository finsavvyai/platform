import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { createGraphClient } from '../lib/graph-client';
import { getConditionalAccessPolicies, getMfaRegistrationDetails } from '../lib/graph-client-extended';
import { buildGdprFramework, buildHipaaFramework, buildSoc2Framework } from '../lib/compliance-frameworks';
import { getDb } from '../lib/db';
import { getTenantById } from '@tenantiq/db';
import type { AppEnv } from '../app/types';

/**
 * Compliance framework checking + risk assessment routes.
 * Split from security.ts to stay under 200-line limit.
 */

const securityCompliance = new Hono<AppEnv>();

securityCompliance.use('*', authMiddleware);
securityCompliance.use('*', standardRateLimit);

/** GET /security/compliance — Evaluate tenant against GDPR, HIPAA, SOC2 */
securityCompliance.get('/compliance', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) return c.json({ error: 'Tenant not configured' }, 400);

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const [caPolicies, mfaDetails] = await Promise.all([
			getConditionalAccessPolicies(graph),
			getMfaRegistrationDetails(graph),
		]);

		const mfaRate = mfaDetails.length > 0
			? mfaDetails.filter((u: any) => u.isMfaRegistered).length / mfaDetails.length
			: 0;
		const caEnabled = caPolicies.filter((p: any) => p.state === 'enabled').length;

		const frameworks = [
			buildGdprFramework(mfaRate, caEnabled),
			buildHipaaFramework(mfaRate, caEnabled),
			buildSoc2Framework(mfaRate, caEnabled),
		];

		return c.json({ frameworks, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Compliance check failed:', error);
		return c.json({ error: 'Failed to check compliance' }, 500);
	}
});

/** GET /security/risks — Aggregate current risks from Graph data */
securityCompliance.get('/risks', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) return c.json({ error: 'Tenant not configured' }, 400);

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const { getRiskyUsers, getRiskDetections, getAppRegistrations } = await import('../lib/graph-client-extended');

		const [riskyUsers, riskDetections, appRegistrations] = await Promise.all([
			getRiskyUsers(graph),
			getRiskDetections(graph),
			getAppRegistrations(graph),
		]);

		const now = new Date();
		const risks: Array<{ category: string; severity: string; title: string; description: string; affectedCount: number; recommendation: string }> = [];

		if (riskyUsers.length > 0) {
			risks.push({
				category: 'identity', severity: riskyUsers.some((u: any) => u.riskLevel === 'high') ? 'critical' : 'high',
				title: `${riskyUsers.length} risky user(s) detected`,
				description: 'Azure AD Identity Protection flagged users with elevated risk.',
				affectedCount: riskyUsers.length,
				recommendation: 'Review risky users and enforce MFA or block sign-in.',
			});
		}

		const recentDetections = riskDetections.filter((d: any) => {
			return now.getTime() - new Date(d.detectedDateTime).getTime() < 7 * 24 * 60 * 60 * 1000;
		});
		if (recentDetections.length > 0) {
			risks.push({
				category: 'sign_in', severity: recentDetections.length > 10 ? 'high' : 'medium',
				title: `${recentDetections.length} risk detection(s) in last 7 days`,
				description: 'Sign-in anomalies or known threat patterns detected.',
				affectedCount: recentDetections.length,
				recommendation: 'Investigate detections and remediate compromised accounts.',
			});
		}

		const expiringApps = appRegistrations.filter((app: any) => {
			const creds = [...(app.passwordCredentials || []), ...(app.keyCredentials || [])];
			return creds.some((cred: any) => {
				const daysLeft = (new Date(cred.endDateTime).getTime() - now.getTime()) / 86400000;
				return daysLeft < 30 && daysLeft > 0;
			});
		});
		if (expiringApps.length > 0) {
			risks.push({
				category: 'credential', severity: 'medium',
				title: `${expiringApps.length} app(s) with expiring credentials`,
				description: 'Application credentials expiring within 30 days.',
				affectedCount: expiringApps.length,
				recommendation: 'Rotate credentials before they expire to prevent outages.',
			});
		}

		return c.json({
			risks,
			summary: {
				total: risks.length,
				critical: risks.filter((r) => r.severity === 'critical').length,
				high: risks.filter((r) => r.severity === 'high').length,
				medium: risks.filter((r) => r.severity === 'medium').length,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Risk assessment failed:', error);
		return c.json({ error: 'Failed to assess risks' }, 500);
	}
});

export default securityCompliance;
