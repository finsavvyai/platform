/**
 * Auto-fix scanner cron.
 *
 * Every hour: for every active tenant whose org has the `auto-remediator`
 * skill activated, look at the last hour of unack'd config_drifts that
 * match a known-safe recipe (today: only "policy regressed to report-only"
 * for Conditional Access). Per-tenant rate limit: max 5 auto-fix messages
 * enqueued per day. Each enqueue is a regular message on the existing
 * remediation-jobs queue with `type: 'auto-fix'` so the consumer routes
 * to the new handler.
 *
 * Default mode is dry-run. Tenants flip the per-tenant `autoFixMode` flag
 * in KV (`autofix:mode:<tenantId>` → 'live' | 'dry-run', default 'dry-run')
 * after observing the dry-run timeline for a few days.
 */

import type { Env } from '../app/types';
import { matchRecipe } from '../lib/auto-fix-recipes';
import { logAgentAction } from '../lib/agent-actions';

const DAILY_CAP = 5;

interface TenantRow { id: string; org_id: string; status: string }
interface DriftRow { id: string; tenant_id: string; category: string; severity: string; summary: string; detected_at: string; acknowledged_at: string | null }

export async function runAutoFixScanner(env: Env): Promise<void> {
	const tenants = await env.DB.prepare(
		"SELECT id, org_id, status FROM tenants WHERE status = 'active' LIMIT 200",
	).all<TenantRow>().catch(() => ({ results: [] as TenantRow[] }));

	for (const t of tenants.results ?? []) {
		try {
			await scanOneTenant(env, t);
		} catch (err) {
			console.error(`[auto-fix-scanner] tenant ${t.id} failed:`, err);
		}
	}
}

async function scanOneTenant(env: Env, t: TenantRow): Promise<void> {
	const skills = await env.KV.get(`skills:${t.id}`, 'json') as Array<{ id: string; status: string }> | null;
	if (!skills?.some((s) => s.id === 'auto-remediator' && (s.status === 'active' || s.status === 'trial'))) return;

	// Per-tenant daily cap
	const counterKey = `autofix:counter:${t.id}:${todayStr()}`;
	const used = parseInt((await env.KV.get(counterKey)) ?? '0', 10);
	if (used >= DAILY_CAP) return;

	const sinceIso = new Date(Date.now() - 3600_000).toISOString();
	const drifts = await env.DB.prepare(
		`SELECT id, tenant_id, category, severity, summary, detected_at, acknowledged_at
		 FROM config_drifts
		 WHERE tenant_id = ? AND detected_at >= ? AND acknowledged_at IS NULL
		 ORDER BY detected_at DESC LIMIT 25`,
	).bind(t.id, sinceIso).all<DriftRow>().catch(() => ({ results: [] as DriftRow[] }));

	let enqueued = used;
	for (const d of drifts.results ?? []) {
		if (enqueued >= DAILY_CAP) break;
		const recipe = matchRecipe(d.category, d.summary);
		if (!recipe) continue;

		const mode = (await env.KV.get(`autofix:mode:${t.id}`)) ?? 'dry-run';
		const dryRun = mode !== 'live';

		await env.REMEDIATION_QUEUE?.send?.({
			type: 'auto-fix',
			tenantId: t.id,
			orgId: t.org_id,
			driftId: d.id,
			recipeId: recipe.id,
			severity: d.severity,
			dryRun,
		}).catch((err: unknown) => console.error('[auto-fix-scanner] enqueue failed', err));

		await logAgentAction(env, {
			orgId: t.org_id, tenantId: t.id, agent: 'auto-remediator', action: 'tool-invoked',
			findingId: d.id, severity: d.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
			metadata: { stage: 'enqueue', recipeId: recipe.id, dryRun },
		});

		enqueued++;
	}

	if (enqueued > used) {
		await env.KV.put(counterKey, String(enqueued), { expirationTtl: 90_000 }); // ~25h
	}
}

function todayStr(): string {
	return new Date().toISOString().slice(0, 10);
}
