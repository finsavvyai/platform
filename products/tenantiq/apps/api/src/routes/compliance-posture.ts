import {
	assessCompliancePosture,
	type ComplianceTenantMetrics,
} from '@tenantiq/ai/tools/compliance-posture';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import type { TenantSecurityData } from '../lib/compliance/types';
import { evaluateSOC2 } from '../lib/compliance/soc2-engine';
import { evaluateHIPAA } from '../lib/compliance/hipaa-engine';
import { evaluateGDPR } from '../lib/compliance/gdpr-engine';
import { evaluateISO27001, ISO_27001_OUT_OF_SCOPE_CONTROLS } from '../lib/compliance/iso27001-engine';
import { kvCache } from '../middleware/cache';

const compliancePosture = new Hono<AppEnv>();

compliancePosture.use('*', authMiddleware);
compliancePosture.use('*', standardRateLimit);

/**
 * POST /api/compliance-posture/assess
 * Run full compliance posture assessment
 */
compliancePosture.post('/assess', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		const body = await c.req.json<{ metrics: ComplianceTenantMetrics; tenantName?: string }>();

		if (!body.metrics) {
			return c.json({ error: 'Bad Request', message: 'Compliance metrics required' }, 400);
		}

		const posture = assessCompliancePosture(tenantId, body.tenantName || 'Tenant', body.metrics);

		return c.json({ success: true, data: posture, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('Compliance assessment failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/compliance-posture/quick-check
 * Quick compliance check with estimated metrics
 */
compliancePosture.get('/quick-check', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');

	try {
		// Use estimated/default metrics for quick check
		const estimatedMetrics: ComplianceTenantMetrics = {
			mfaEnabled: true,
			mfaAdoptionRate: 78,
			conditionalAccessPolicies: 2,
			dlpPoliciesEnabled: false,
			retentionPoliciesEnabled: true,
			sensitivityLabelsEnabled: false,
			auditLogRetentionDays: 90,
			secureScore: 65,
			adminCount: 5,
			totalUsers: 100,
			guestAccessRestricted: false,
			passwordPolicyStrength: 'moderate',
			encryptionAtRest: true,
			encryptionInTransit: true,
			breakGlassAccountExists: false,
			privilegedAccessReviewEnabled: false,
			deviceComplianceEnabled: false,
			appProtectionEnabled: true,
		};

		const posture = assessCompliancePosture(tenantId, 'Tenant', estimatedMetrics);

		return c.json({
			success: true,
			data: {
				overallScore: posture.overallScore,
				overallGrade: posture.overallGrade,
				criticalGapsCount: posture.criticalGaps.length,
				criticalGaps: posture.criticalGaps,
				auditReady: posture.auditReadiness.ready,
				topRecommendations: posture.recommendations.slice(0, 3),
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Quick compliance check failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/compliance-posture/frameworks
 * Evaluate tenant against SOC 2, HIPAA, and GDPR engines
 */
compliancePosture.get('/frameworks', tenantScopingMiddleware, kvCache({ ttl: 600, prefix: 'compliance-frameworks' }), async (c) => {
	try {
		const kvKey = `compliance:${c.get('tenantId')}:security-data`;
		const cached = await c.env.KV.get(kvKey, 'json') as TenantSecurityData | null;

		const tenantData: TenantSecurityData = cached || {
			mfaRate: 0.78,
			caEnabled: 2,
			caTotal: 4,
			auditEnabled: true,
			dlpPolicies: 1,
			sensitivityLabels: 2,
			secureScore: 65,
			riskyUsers: 0,
			backupConfigured: false,
			encryptionEnabled: true,
		};

		const frameworks = [
			evaluateSOC2(tenantData),
			evaluateHIPAA(tenantData),
			evaluateGDPR(tenantData),
			evaluateISO27001(tenantData),
		];

		// Persist each framework score for trend charting. Best-effort —
		// outer try/catch covers test mocks that lack DB.prepare entirely.
		const assessedAt = new Date().toISOString();
		try {
			const tenantId = c.get('tenantId');
			const user = c.get('user');
			for (const fw of frameworks) {
				await c.env.DB.prepare(
					`INSERT INTO compliance_assessments (id, tenant_id, org_id, framework, overall_score, pass_count, fail_count, partial_count, error_count, controls_json, assessed_at, assessed_by)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				).bind(
					crypto.randomUUID(), tenantId, user?.orgId ?? null, fw.framework,
					fw.score, fw.passCount, fw.failCount, fw.partialCount, fw.errorCount,
					JSON.stringify(fw.controls.map(c => ({ id: c.id, status: c.status }))),
					assessedAt, user?.email ?? user?.sub ?? 'system',
				).run().catch(() => {});
			}
		} catch { /* ignore — trend write is non-critical */ }

		return c.json({
			success: true,
			data: {
				frameworks,
				meta: {
					iso27001: {
						telemetryEvaluable: 25,
						organisationalOutOfScope: ISO_27001_OUT_OF_SCOPE_CONTROLS,
					},
				},
			},
			timestamp: assessedAt,
		});
	} catch (error) {
		console.error('Framework evaluation failed:', error);
		return c.json({
			error: 'Internal Server Error',
		}, 500);
	}
});

// POST /api/compliance-posture/explain — AI explainer for a specific compliance control.
// Body: { framework: 'SOC 2' | 'HIPAA' | 'GDPR' | 'ISO 27001', controlId: string }
// Same pattern as /api/cis-benchmark/explain — Claude-generated, KV-cached 24h,
// degrades to static text when ANTHROPIC_API_KEY missing.
compliancePosture.post('/explain', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const body = await c.req.json<{ framework?: string; controlId?: string }>().catch(() => ({} as { framework?: string; controlId?: string }));
	if (!body.framework || !body.controlId) return c.json({ error: 'framework + controlId required' }, 400);
	const framework = body.framework;
	const controlId = body.controlId;

	const cacheKey = `compliance:explain:${tenantId}:${framework}:${controlId}`;
	const cached = await c.env.KV.get(cacheKey, 'json');
	if (cached) return c.json({ ...cached, source: 'cache' });

	// Re-evaluate frameworks to find the specific control + its evidence.
	const kvKey = `compliance:${tenantId}:security-data`;
	const tenantData = await c.env.KV.get(kvKey, 'json') as TenantSecurityData | null;
	if (!tenantData) return c.json({ error: 'No tenant security data — run /frameworks first' }, 404);

	const allFrameworks = [
		evaluateSOC2(tenantData),
		evaluateHIPAA(tenantData),
		evaluateGDPR(tenantData),
		evaluateISO27001(tenantData),
	];
	const fw = allFrameworks.find(f => f.framework === framework);
	const control = fw?.controls.find(c => c.id === controlId);
	if (!control) return c.json({ error: `Control ${controlId} not found in ${framework}` }, 404);

	if (!c.env.ANTHROPIC_API_KEY) {
		return c.json({
			explanation: control.remediation ?? control.evidence ?? 'No remediation guidance available.',
			source: 'static-fallback',
		});
	}

	try {
		const { callAnthropic } = await import('../lib/ai-anthropic');
		const ctx = `Compliance Framework: ${framework}
Control: ${control.id} — ${control.name}
Status: ${control.status}
Evidence: ${control.evidence}
Static remediation: ${control.remediation ?? '(none)'}
Tenant data: MFA ${Math.round(tenantData.mfaRate * 100)}%, ${tenantData.caEnabled} CA policies, ${tenantData.dlpPolicies} DLP, ${tenantData.sensitivityLabels} labels, Secure Score ${tenantData.secureScore}.`;
		const question = `Explain this ${framework} compliance gap to an MSP technician in 4-6 sentences. Cover:
1. What auditors look for in this control
2. Why this tenant is non-compliant given the data above
3. The exact M365 admin action to close the gap (portal path, not "review policies")
4. Cross-reference to similar controls in other frameworks if applicable
Keep it data-rich and actionable.`;
		const text = await callAnthropic(c.env.ANTHROPIC_API_KEY, ctx, question);

		const result = {
			framework, controlId,
			explanation: text,
			source: 'claude',
			generatedAt: new Date().toISOString(),
		};
		await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 86400 });
		return c.json(result);
	} catch (err) {
		console.error('[compliance.explain] Claude call failed', err);
		return c.json({
			explanation: control.remediation ?? control.evidence,
			source: 'static-fallback',
			error: err instanceof Error ? err.message : 'AI unavailable',
		});
	}
});

// GET /api/compliance-posture/trend?framework=ISO%2027001&days=30
// Time-series of overall compliance score. Reads from compliance_assessments
// table (already in schema). Empty if no historical assessments stored.
compliancePosture.get('/trend', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const framework = c.req.query('framework') ?? 'ISO 27001';
	const days = Math.min(365, Math.max(7, parseInt(c.req.query('days') ?? '30', 10) || 30));
	const since = new Date(Date.now() - days * 86400_000).toISOString();

	const rows = await c.env.DB.prepare(
		`SELECT date(assessed_at) AS day,
		        AVG(overall_score) AS score,
		        COUNT(*) AS assessments
		 FROM compliance_assessments
		 WHERE tenant_id = ? AND framework = ? AND assessed_at >= ?
		 GROUP BY date(assessed_at)
		 ORDER BY day ASC`,
	).bind(tenantId, framework, since).all<{ day: string; score: number; assessments: number }>()
		.catch(() => ({ results: [] as Array<{ day: string; score: number; assessments: number }> }));

	const points = (rows.results ?? []).map(r => ({
		date: r.day,
		score: Math.round(r.score),
		assessmentsThatDay: r.assessments,
	}));
	const latest = points[points.length - 1];
	const earliest = points[0];
	const delta = latest && earliest ? latest.score - earliest.score : 0;

	return c.json({
		framework,
		points,
		summary: {
			windowDays: days,
			assessmentCount: points.reduce((s, p) => s + p.assessmentsThatDay, 0),
			latestScore: latest?.score ?? null,
			earliestScore: earliest?.score ?? null,
			scoreDelta: delta,
			direction: delta > 5 ? 'improving' : delta < -5 ? 'regressing' : 'stable',
		},
	});
});

export default compliancePosture;
