/**
 * Helper for writing to the agent_actions log. Every autonomous agent in the
 * system (public scan, tenant auditor, auto-remediator, …) calls logAgentAction
 * to record what it did. Powers the /api/stats/public counter and the public
 * /leaderboard.
 *
 * Always best-effort: never let logging failure block the agent's main work.
 */

export type AgentName =
	| 'public-scan'
	| 'autonomous-auditor'
	| 'auto-remediator'
	| 'mcp-tool-call'
	| 'mcp-public-call'
	| 'narrated-scan';

export type AgentAction =
	| 'scan'
	| 'finding-raised'
	| 'email-sent'
	| 'fix-applied'
	| 'drift-reverted'
	| 'tool-invoked'
	| 'rollback';

export type AgentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AgentActionInput {
	orgId?: string | null;
	tenantId?: string | null;
	agent: AgentName;
	action: AgentAction;
	findingId?: string | null;
	severity?: AgentSeverity | null;
	status?: 'success' | 'failed' | 'rolled-back' | 'pending-approval' | 'aborted' | 'approved';
	metadata?: Record<string, unknown>;
}

interface BusEnv { DB?: D1Database; TENANT_EVENTS?: DurableObjectNamespace }

export async function logAgentAction(
	envOrDb: BusEnv | D1Database | undefined,
	input: AgentActionInput,
	legacyBus?: { TENANT_EVENTS?: DurableObjectNamespace },
): Promise<void> {
	// Accept either { DB, TENANT_EVENTS } (preferred) or a bare D1Database
	// (legacy callers). Pull both pieces out either way.
	let db: D1Database | undefined;
	let bus: { TENANT_EVENTS?: DurableObjectNamespace } | undefined;
	if (envOrDb && typeof (envOrDb as unknown as { prepare?: unknown }).prepare !== 'function') {
		const env = envOrDb as BusEnv;
		db = env.DB;
		bus = { TENANT_EVENTS: env.TENANT_EVENTS };
	} else {
		db = envOrDb as D1Database | undefined;
		bus = legacyBus;
	}
	if (!db) return;
	const id = crypto.randomUUID();
	const ts = Date.now();
	const meta = input.metadata ? JSON.stringify(input.metadata) : null;
	try {
		await db.prepare(
			`INSERT INTO agent_actions (id, org_id, tenant_id, agent, action, finding_id, severity, status, metadata, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			id,
			input.orgId ?? null,
			input.tenantId ?? null,
			input.agent,
			input.action,
			input.findingId ?? null,
			input.severity ?? null,
			input.status ?? 'success',
			meta,
			ts,
		).run();
	} catch (err) {
		console.error('[agent-actions] log failed (non-fatal)', err);
	}

	// Best-effort publish to the org's Durable Object so any open SSE
	// stream sees the event sub-second instead of via the 5s D1 poll.
	if (bus?.TENANT_EVENTS && input.orgId) {
		try {
			const doId = bus.TENANT_EVENTS.idFromName(`org:${input.orgId}`);
			const stub = bus.TENANT_EVENTS.get(doId);
			await stub.fetch('https://internal/broadcast', {
				method: 'POST',
				body: JSON.stringify({
					type: 'agent_action',
					id, orgId: input.orgId, tenantId: input.tenantId ?? null,
					agent: input.agent, action: input.action,
					findingId: input.findingId ?? null,
					severity: input.severity ?? null,
					status: input.status ?? 'success',
					metadata: input.metadata ?? null,
					at: new Date(ts).toISOString(),
				}),
			});
		} catch { /* never block on the publish */ }
	}
}
