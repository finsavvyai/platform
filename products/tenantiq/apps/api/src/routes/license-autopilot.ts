import {
	analyzeReclamationCandidates,
	generateReclamationPlan,
	getDefaultAutopilotConfig,
	type UserLicenseData,
	type AutopilotConfig,
	type LicenseSnapshot,
} from '@tenantiq/ai/tools/license-autopilot';
import { getLicensesByTenant, getUsersByTenant } from '@tenantiq/db';
import { Hono } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';
import { authMiddleware, tenantScopingMiddleware } from '../middleware/auth.middleware';
import { standardRateLimit } from '../middleware/rateLimit.middleware';
import {
	createApprovalRequest,
	saveApproval,
	type ApprovalItem,
} from '../lib/workflows/approval-engine';

const licenseAutopilot = new Hono<AppEnv>();

licenseAutopilot.use('*', authMiddleware);
licenseAutopilot.use('*', standardRateLimit);

/**
 * POST /api/license-autopilot/analyze
 * Analyze licenses and identify reclamation candidates
 */
licenseAutopilot.post('/analyze', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const body = await c.req.json<{ config?: Partial<AutopilotConfig> }>().catch(() => ({ config: {} }));

		const config: AutopilotConfig = { ...getDefaultAutopilotConfig(), ...body.config };

		const [users, licenses] = await Promise.all([
			getUsersByTenant(db as any, tenantId),
			getLicensesByTenant(db as any, tenantId),
		]);

		const userData: UserLicenseData[] = users.map((u) => ({
			userId: u.azureUserId,
			email: u.email || '',
			displayName: u.displayName || '',
			licenses: Array.isArray(u.assignedLicenses) ? (u.assignedLicenses as string[]) : [],
			lastSignIn: u.lastSignIn ? String(u.lastSignIn) : null,
			lastNonInteractiveSignIn: u.lastNonInteractiveSignIn ? String(u.lastNonInteractiveSignIn) : null,
			accountEnabled: u.accountEnabled ?? true,
		}));

		const candidates = analyzeReclamationCandidates(userData, config);

		const currentSnapshot: LicenseSnapshot = {
			timestamp: new Date().toISOString(),
			totalLicenses: licenses.reduce((s, l) => s + (l.total || 0), 0),
			assignedLicenses: licenses.reduce((s, l) => s + (l.assigned || 0), 0),
			monthlyCost: licenses.reduce((s, l) => s + (Number(l.costPerUnit) || 0) * (l.assigned || 0), 0),
			utilizationRate: (() => {
				const total = licenses.reduce((s, l) => s + (l.total || 0), 0);
				const assigned = licenses.reduce((s, l) => s + (l.assigned || 0), 0);
				return total > 0 ? Math.round((assigned / total) * 100) : 100;
			})(),
			breakdown: licenses.map((l) => ({
				sku: l.skuId,
				name: l.skuName,
				total: l.total || 0,
				assigned: l.assigned || 0,
				cost: (Number(l.costPerUnit) || 0) * (l.assigned || 0),
			})),
		};

		const plan = generateReclamationPlan(tenantId, 'Tenant', candidates, currentSnapshot, config);

		// Create approval request for optimization candidates
		if (candidates.length > 0) {
			const approvalItems: ApprovalItem[] = candidates.slice(0, 50).map((candidate) => ({
				id: crypto.randomUUID(),
				description: `${candidate.action} license for ${candidate.userEmail || candidate.userId}`,
				impact: `Save $${candidate.monthlySavings.toFixed(2)}/month`,
				approved: false,
			}));

			const orgId = c.get('user').orgId;
			const userId = c.get('user').sub;
			const approval = createApprovalRequest('license_optimization', approvalItems, userId);
			await saveApproval(c.env.KV, orgId, approval);

			return c.json({
				success: true,
				data: plan,
				approvalId: approval.id,
				approvalStatus: 'pending',
				timestamp: new Date().toISOString(),
			});
		}

		return c.json({ success: true, data: plan, timestamp: new Date().toISOString() });
	} catch (error) {
		console.error('License autopilot analysis failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

/**
 * GET /api/license-autopilot/config
 * Get default autopilot configuration
 */
licenseAutopilot.get('/config', async (c) => {
	return c.json({
		success: true,
		data: getDefaultAutopilotConfig(),
		timestamp: new Date().toISOString(),
	});
});

/**
 * POST /api/license-autopilot/preview
 * Preview reclamation without executing (always dry-run)
 */
licenseAutopilot.post('/preview', tenantScopingMiddleware, async (c) => {
	const tenantId = c.get('tenantId');
	const db = getDb(c.env);

	try {
		const [users, licenses] = await Promise.all([
			getUsersByTenant(db as any, tenantId),
			getLicensesByTenant(db as any, tenantId),
		]);

		const config = { ...getDefaultAutopilotConfig(), dryRunMode: true, maxActionsPerRun: 10 };

		const userData: UserLicenseData[] = users.map((u) => ({
			userId: u.azureUserId,
			email: u.email || '',
			displayName: u.displayName || '',
			licenses: Array.isArray(u.assignedLicenses) ? (u.assignedLicenses as string[]) : [],
			lastSignIn: u.lastSignIn ? String(u.lastSignIn) : null,
			lastNonInteractiveSignIn: u.lastNonInteractiveSignIn ? String(u.lastNonInteractiveSignIn) : null,
			accountEnabled: u.accountEnabled ?? true,
		}));

		const candidates = analyzeReclamationCandidates(userData, config);

		return c.json({
			success: true,
			data: {
				candidateCount: candidates.length,
				totalMonthlySavings: candidates.reduce((s, c) => s + c.monthlySavings, 0),
				totalAnnualSavings: candidates.reduce((s, c) => s + c.annualSavings, 0),
				candidates: candidates.slice(0, 10),
				breakdown: {
					removals: candidates.filter((c) => c.action === 'remove').length,
					downgrades: candidates.filter((c) => c.action === 'downgrade').length,
					flagged: candidates.filter((c) => c.action === 'flag_for_review').length,
				},
			},
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('License autopilot preview failed:', error);
		return c.json({ error: 'Internal Server Error' }, 500);
	}
});

export default licenseAutopilot;
