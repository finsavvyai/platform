/**
 * Onboarding execution handler — dry run and live provisioning.
 * Split from onboarding.ts to stay under 200-line limit.
 */
import { type ProvisioningPlan } from '@tenantiq/ai/tools/onboarding-advisor';
import { getTenantById } from '@tenantiq/db';
import type { Context } from 'hono';
import type { AppEnv } from '../index';
import { getDb } from '../lib/db';

/**
 * POST /api/onboarding/execute
 * Execute onboarding plan (create user, assign licenses, add to groups)
 */
export async function handleExecute(c: Context<AppEnv>) {
	const tenantId = c.get('tenantId');

	try {
		const body = await c.req.json<{
			plan: ProvisioningPlan;
			dryRun?: boolean;
		}>();

		if (!body.plan) {
			return c.json(
				{
					error: 'Bad Request',
					message: 'Missing provisioning plan',
				},
				400
			);
		}

		const dryRun = body.dryRun !== false; // Default to dry run for safety

		if (dryRun) {
			return c.json(buildDryRunResponse(body.plan));
		}

		return await executeLive(c, tenantId, body.plan);
	} catch (error) {
		console.error('Onboarding execution failed:', error);
		return c.json(
			{
				error: 'Internal Server Error',
			},
			500
		);
	}
}

function buildDryRunResponse(plan: ProvisioningPlan) {
	return {
		success: true,
		dryRun: true,
		message: 'Dry run - no changes made',
		actions: [
			{
				step: 1,
				action: 'Create user account',
				details: `Would create user: ${plan.user.email}`,
				status: 'pending',
			},
			{
				step: 2,
				action: 'Assign licenses',
				details: `Would assign ${plan.licenses.length} licenses`,
				licenses: plan.licenses.map((l) => l.skuName),
				status: 'pending',
			},
			{
				step: 3,
				action: 'Add to groups',
				details: `Would add to ${plan.groups.length} groups`,
				groups: plan.groups.map((g) => g.groupName),
				status: 'pending',
			},
			{
				step: 4,
				action: 'Configure security',
				details: `Would configure ${plan.securitySettings.length} security settings`,
				settings: plan.securitySettings.map((s) => `${s.setting}: ${s.value}`),
				status: 'pending',
			},
		],
		estimatedTime: '28 minutes',
		estimatedCost: plan.estimatedCost,
	};
}

async function executeLive(c: Context<AppEnv>, tenantId: string, plan: ProvisioningPlan) {
	const db = getDb(c.env);
	const tenant = await getTenantById(db as any, tenantId);
	if (!tenant?.azureTenantId) {
		return c.json({ error: 'Tenant not configured for Graph API' }, 400);
	}

	const { createGraphClient } = await import('../lib/graph-client');
	const { executeOnboardingPlan } = await import('../lib/onboarding-executor');
	const graph = createGraphClient(c.env as any, tenant.azureTenantId);
	const { results, success } = await executeOnboardingPlan(graph, plan);

	const completed = results.filter((r) => r.status === 'completed').length;
	const failed = results.filter((r) => r.status === 'failed').length;

	return c.json({
		success,
		dryRun: false,
		message: `Onboarding ${success ? 'completed' : 'completed with errors'}`,
		results,
		summary: { completed, failed, total: results.length },
	});
}
