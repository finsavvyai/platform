/**
 * Zero Trust Assessment Routes — full assessment and improvement roadmap.
 * Evaluates tenant security across 6 Zero Trust pillars.
 */

import { Hono } from 'hono';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import { createGraphClient } from '../lib/graph-client';
import { getConditionalAccessPolicies, getMfaRegistrationDetails, getRiskyUsers } from '../lib/graph-client-extended';
import { getDb } from '../lib/db';
import { getTenantById } from '@tenantiq/db';
import { evaluateZeroTrust, generateRoadmap } from '../lib/security/zero-trust-engine';
import type { TenantSecurityData } from '../lib/compliance/types';
import type { AppEnv } from '../app/types';

const zeroTrust = new Hono<AppEnv>();

zeroTrust.use('*', authMiddleware);
zeroTrust.use('*', standardRateLimit);

const KV_PREFIX = 'zero-trust:';
const CACHE_TTL = 86400; // 24 hours

/** GET /zero-trust/assessment — Run full Zero Trust assessment */
zeroTrust.get('/assessment', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		// Check KV cache first
		const cacheKey = `${KV_PREFIX}${tenantId}`;
		const cached = await c.env.KV.get(cacheKey, 'json');
		if (cached) return c.json(cached);

		const tenant = await getTenantById(db as any, tenantId);
		if (!tenant?.azureTenantId) {
			return c.json({ error: 'Tenant not configured' }, 400);
		}

		const graph = createGraphClient(c.env as any, tenant.azureTenantId);
		const securityData = await gatherSecurityData(graph);
		const result = evaluateZeroTrust(securityData);

		const response = { ...result, tenantId, timestamp: new Date().toISOString() };

		// Cache result for 24h
		await c.env.KV.put(cacheKey, JSON.stringify(response), {
			expirationTtl: CACHE_TTL,
		});

		return c.json(response);
	} catch (error) {
		console.error('Zero Trust assessment failed:', error);
		return c.json({
			error: 'Failed to run Zero Trust assessment',
		}, 500);
	}
});

/** GET /zero-trust/roadmap — Step-by-step improvement plan */
zeroTrust.get('/roadmap', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		// Try cached assessment first
		const cacheKey = `${KV_PREFIX}${tenantId}`;
		let assessment = await c.env.KV.get(cacheKey, 'json') as any;

		if (!assessment) {
			const tenant = await getTenantById(db as any, tenantId);
			if (!tenant?.azureTenantId) {
				return c.json({ error: 'Tenant not configured' }, 400);
			}

			const graph = createGraphClient(c.env as any, tenant.azureTenantId);
			const securityData = await gatherSecurityData(graph);
			assessment = evaluateZeroTrust(securityData);
		}

		const roadmap = generateRoadmap(assessment);

		return c.json({
			currentScore: assessment.overallScore,
			maturityLevel: assessment.maturityLevel,
			roadmap,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Zero Trust roadmap failed:', error);
		return c.json({
			error: 'Failed to generate roadmap',
		}, 500);
	}
});

/** Gather security data from Graph API for assessment */
async function gatherSecurityData(graph: any): Promise<TenantSecurityData> {
	const [caPolicies, mfaDetails, riskyUsers, secureScoreRaw] =
		await Promise.all([
			getConditionalAccessPolicies(graph),
			getMfaRegistrationDetails(graph),
			getRiskyUsers(graph),
			graph.fetch('/security/secureScores?$top=1').catch(() => ({ value: [] })),
		]);

	const mfaEnabled = mfaDetails.filter(
		(u: any) => u.isMfaRegistered || u.isMfaCapable,
	).length;
	const mfaRate = mfaDetails.length > 0 ? mfaEnabled / mfaDetails.length : 0;
	const caEnabled = caPolicies.filter((p: any) => p.state === 'enabled').length;
	const secureScore = secureScoreRaw?.value?.[0];
	const scorePercent = secureScore
		? Math.round((secureScore.currentScore / secureScore.maxScore) * 100)
		: 0;

	return {
		mfaRate,
		caEnabled,
		caTotal: caPolicies.length,
		auditEnabled: true,
		dlpPolicies: 0,
		sensitivityLabels: 0,
		secureScore: scorePercent,
		riskyUsers: riskyUsers.length,
		backupConfigured: false,
		encryptionEnabled: false,
	};
}

export default zeroTrust;
