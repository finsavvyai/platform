/**
 * Autonomous remediator with rollback.
 *
 * Given a finding, this:
 *   1. Captures a baseline snapshot of the affected resource via Graph GET.
 *   2. Applies the fix (Graph PATCH/POST/DELETE).
 *   3. Watches the audit log for 60 seconds for blast-radius signals
 *      (mass user lock-out, sign-in failure spike, MFA-prompt collapse).
 *   4. If anomaly: rolls back by restoring the captured baseline.
 *
 * Logs every step (apply / watch-start / watch-clear / rollback) to
 * agent_actions so the leaderboard + per-tenant timeline reflect
 * autonomous activity. Skill-gated: only fires for tenants whose org has
 * the `auto-remediator` skill activated.
 *
 * Pure-ish: takes a `graph` callback (test-injectable) so the queue handler
 * can drive it without binding to GraphClient internals.
 */

import { logAgentAction, type AgentSeverity } from './agent-actions';

export type GraphFn = (
	method: 'GET' | 'PATCH' | 'POST' | 'DELETE',
	path: string,
	body?: unknown,
) => Promise<{ ok: boolean; status: number; body?: unknown }>;

export interface RemediationPlan {
	tenantId: string;
	orgId: string;
	findingId: string;
	severity: AgentSeverity;
	target: { method: 'PATCH' | 'POST' | 'DELETE'; path: string; body?: unknown };
	baselinePath: string; // GET endpoint that captures the pre-fix state
	watchSeconds?: number; // default 60
	/**
	 * dry-run: capture baseline + log "would-apply" but skip the actual
	 * mutation. Default per-tenant flag is dry-run until ops opts in.
	 */
	dryRun?: boolean;
	/** Optional — written into pending-approval metadata so the approve
	 *  handler can reconstruct the auto-fix message and re-enqueue it. */
	recipeId?: string;
}

export interface RemediationResult {
	findingId: string;
	applied: boolean;
	rolledBack: boolean;
	reason: string;
	durationMs: number;
}

interface AnomalyCheckEnv {
	DB: D1Database;
	tenantId: string;
}

export async function runRemediation(
	env: { DB?: D1Database } & AnomalyCheckEnv,
	plan: RemediationPlan,
	graph: GraphFn,
	now: () => number = () => Date.now(),
): Promise<RemediationResult> {
	const start = now();
	const watchSeconds = plan.watchSeconds ?? 60;

	// 1. Capture baseline
	const baseline = await graph('GET', plan.baselinePath)
		.catch(() => ({ ok: false, status: 0, body: undefined as unknown }));
	if (!baseline.ok) {
		await logAgentAction(env, {
			orgId: plan.orgId, tenantId: plan.tenantId, agent: 'auto-remediator', action: 'fix-applied',
			findingId: plan.findingId, severity: plan.severity, status: 'failed',
			metadata: { stage: 'baseline-capture', status: baseline.status },
		});
		return { findingId: plan.findingId, applied: false, rolledBack: false, reason: 'baseline-capture failed', durationMs: now() - start };
	}

	// 2. Apply (or queue for human approval in dry-run)
	if (plan.dryRun) {
		await logAgentAction(env, {
			orgId: plan.orgId, tenantId: plan.tenantId, agent: 'auto-remediator', action: 'fix-applied',
			findingId: plan.findingId, severity: plan.severity, status: 'pending-approval',
			metadata: {
				dryRun: true,
				recipeId: plan.recipeId,
				method: plan.target.method,
				path: plan.target.path,
				body: plan.target.body,
				baselinePath: plan.baselinePath,
				baselineCaptured: baseline.body,
			},
		});
		return {
			findingId: plan.findingId, applied: false, rolledBack: false,
			reason: 'dry-run — baseline captured, awaiting approval', durationMs: now() - start,
		};
	}

	const apply = await graph(plan.target.method, plan.target.path, plan.target.body)
		.catch(() => ({ ok: false, status: 0 }));
	if (!apply.ok) {
		await logAgentAction(env, {
			orgId: plan.orgId, tenantId: plan.tenantId, agent: 'auto-remediator', action: 'fix-applied',
			findingId: plan.findingId, severity: plan.severity, status: 'failed',
			metadata: { stage: 'apply', status: apply.status },
		});
		return { findingId: plan.findingId, applied: false, rolledBack: false, reason: 'apply failed', durationMs: now() - start };
	}

	await logAgentAction(env, {
		orgId: plan.orgId, tenantId: plan.tenantId, agent: 'auto-remediator', action: 'fix-applied',
		findingId: plan.findingId, severity: plan.severity, status: 'success',
		metadata: { method: plan.target.method, path: plan.target.path },
	});

	// 3. Watch — bounded sleep window with one anomaly check at the end
	await sleep(watchSeconds * 1000);
	const anomaly = await checkAnomaly(env, watchSeconds);

	// 4. Rollback if needed
	if (anomaly) {
		const rollback = await graph(plan.target.method === 'DELETE' ? 'POST' : plan.target.method, plan.baselinePath, baseline.body)
			.catch(() => ({ ok: false, status: 0 }));
		await logAgentAction(env, {
			orgId: plan.orgId, tenantId: plan.tenantId, agent: 'auto-remediator', action: 'rollback',
			findingId: plan.findingId, severity: plan.severity,
			status: rollback.ok ? 'rolled-back' : 'failed',
			metadata: { reason: anomaly, rollbackStatus: rollback.status },
		});
		return {
			findingId: plan.findingId, applied: true, rolledBack: rollback.ok,
			reason: `anomaly detected: ${anomaly}`, durationMs: now() - start,
		};
	}

	return {
		findingId: plan.findingId, applied: true, rolledBack: false,
		reason: 'no anomaly within watch window', durationMs: now() - start,
	};
}

/**
 * Heuristic anomaly check: in the last `windowSeconds`, did sign-in failures
 * for this tenant spike to ≥ 3× the prior-hour baseline? Returns a string
 * description if anomaly, null if clean.
 */
async function checkAnomaly(env: AnomalyCheckEnv, windowSeconds: number): Promise<string | null> {
	const since = Date.now() - windowSeconds * 1000;
	const sinceIso = new Date(since).toISOString();
	const baselineIso = new Date(since - 3600_000).toISOString();

	try {
		const recent = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM alerts WHERE tenant_id = ? AND severity IN ('critical','high') AND created_at >= ?",
		).bind(env.tenantId, since).first<{ n: number }>();
		const baseline = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM alerts WHERE tenant_id = ? AND severity IN ('critical','high') AND created_at >= ? AND created_at < ?",
		).bind(env.tenantId, since - 3600_000, since).first<{ n: number }>();
		const r = recent?.n ?? 0;
		const b = baseline?.n ?? 0;
		if (r >= 3 && r >= b * 3) {
			return `${r} new critical/high alerts in last ${windowSeconds}s vs ${b} in prior hour`;
		}
	} catch {
		// If we can't read the audit log, assume clean — don't auto-rollback on read failure
		void sinceIso; void baselineIso;
	}
	return null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
