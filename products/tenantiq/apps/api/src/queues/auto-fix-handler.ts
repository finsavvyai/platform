/**
 * auto-fix queue consumer. Receives `{ type: 'auto-fix', ... }` messages
 * from the auto-fix-scanner cron, looks up the recipe + drift, builds a
 * RemediationPlan, and runs runRemediation against a real Graph client.
 *
 * Per-tenant `autofix:mode:<tenantId>` KV flag controls whether the
 * mutation actually fires (`live`) or is skipped while the framework
 * captures baselines + logs would-applies (`dry-run`, default).
 */

import type { Env } from '../app/types';
import { runRemediation } from '../lib/auto-remediator';
import { AUTO_FIX_RECIPES, severityMeetsFloor } from '../lib/auto-fix-recipes';
import { GraphClient } from '../lib/graph-client';
import { logAgentAction } from '../lib/agent-actions';

export interface AutoFixMessage {
	type: 'auto-fix';
	tenantId: string;
	orgId: string;
	driftId: string;
	recipeId: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	dryRun?: boolean;
}

interface DriftRow {
	id: string; tenant_id: string; category: string; severity: string;
	summary: string; metadata: string | null;
}

export async function executeAutoFix(message: unknown, env: Env): Promise<void> {
	const msg = message as AutoFixMessage;
	if (!msg || msg.type !== 'auto-fix' || !msg.tenantId || !msg.driftId || !msg.recipeId) {
		console.error('[auto-fix] malformed message', msg);
		return;
	}

	const recipe = AUTO_FIX_RECIPES.find((r) => r.id === msg.recipeId);
	if (!recipe) {
		console.error(`[auto-fix] unknown recipe ${msg.recipeId}`);
		return;
	}

	if (!severityMeetsFloor(msg.severity, recipe.severityFloor)) {
		await logAgentAction(env, {
			orgId: msg.orgId, tenantId: msg.tenantId, agent: 'auto-remediator', action: 'fix-applied',
			findingId: msg.driftId, severity: msg.severity, status: 'failed',
			metadata: { stage: 'gate', reason: 'severity below recipe floor', floor: recipe.severityFloor },
		});
		return;
	}

	const drift = await env.DB.prepare(
		'SELECT id, tenant_id, category, severity, summary, metadata FROM config_drifts WHERE id = ? AND tenant_id = ? LIMIT 1',
	).bind(msg.driftId, msg.tenantId).first<DriftRow>().catch(() => null);

	if (!drift) {
		await logAgentAction(env, {
			orgId: msg.orgId, tenantId: msg.tenantId, agent: 'auto-remediator', action: 'fix-applied',
			findingId: msg.driftId, severity: msg.severity, status: 'failed',
			metadata: { stage: 'lookup', reason: 'drift row missing or wrong tenant' },
		});
		return;
	}

	const policyId = extractResourceId(drift.metadata) ?? '';
	const targetPath = recipe.target.pathTemplate.replace('{policyId}', policyId);
	const baselinePath = recipe.baselinePathTemplate.replace('{policyId}', policyId);

	const azureTenantId = await resolveAzureTenantId(env, msg.tenantId);
	if (!azureTenantId) {
		await logAgentAction(env, {
			orgId: msg.orgId, tenantId: msg.tenantId, agent: 'auto-remediator', action: 'fix-applied',
			findingId: msg.driftId, severity: msg.severity, status: 'failed',
			metadata: { stage: 'graph-bind', reason: 'no azure tenant id' },
		});
		return;
	}

	const graph = new GraphClient(env as unknown as ConstructorParameters<typeof GraphClient>[0], azureTenantId);

	await runRemediation(
		{ DB: env.DB, tenantId: msg.tenantId },
		{
			tenantId: msg.tenantId, orgId: msg.orgId, findingId: msg.driftId, severity: msg.severity,
			target: { method: recipe.target.method, path: targetPath, body: recipe.target.bodyTemplate },
			baselinePath, watchSeconds: 60, dryRun: msg.dryRun !== false,
			recipeId: recipe.id,
		},
		async (method, path, body) => {
			try {
				const url = `https://graph.microsoft.com/v1.0${path}`;
				const res = await graph.request(url, {
					method, body: body ? JSON.stringify(body) : undefined,
				});
				return { ok: true, status: 200, body: res };
			} catch (err) {
				return { ok: false, status: (err as { status?: number })?.status ?? 0 };
			}
		},
	);
}

function extractResourceId(metadata: string | null): string | null {
	if (!metadata) return null;
	try {
		const obj = JSON.parse(metadata) as { resourceId?: string; policyId?: string; id?: string };
		return obj.resourceId ?? obj.policyId ?? obj.id ?? null;
	} catch { return null; }
}

async function resolveAzureTenantId(env: Env, tenantId: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT azure_tenant_id FROM tenants WHERE id = ? LIMIT 1')
		.bind(tenantId)
		.first<{ azure_tenant_id: string | null }>()
		.catch(() => null);
	return row?.azure_tenant_id ?? null;
}
