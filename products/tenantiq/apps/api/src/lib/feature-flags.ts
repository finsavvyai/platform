/**
 * Feature Flag Engine — static defaults + KV-backed targeting rules.
 *
 * Legacy flags remain as simple booleans.
 * New flags support org-level, plan-level, and percentage rollout.
 */

export const FLAGS = {
	AI_AGENT_ENABLED: true,
	REMEDIATION_ENABLED: true,
	BACKUP_ENABLED: true,
	MIGRATION_ENABLED: false,
	BULK_OPERATIONS_ENABLED: true,
	SAVINGS_REPORT_ENABLED: true,
} as const;

export type FlagName = keyof typeof FLAGS;

export interface FeatureFlagRule {
	enabled: boolean;
	description?: string;
	orgs?: string[];
	plans?: string[];
	percentage?: number;
	createdAt?: string;
	updatedAt?: string;
}

export interface FlagContext {
	orgId?: string;
	plan?: string;
	userId?: string;
}

// ── Legacy helpers (backward-compatible) ─────────────────────────

export function isEnabled(flag: FlagName): boolean {
	return FLAGS[flag];
}

export async function getFlag(flag: string, env: { KV: KVNamespace }): Promise<boolean> {
	const override = await env.KV.get(`flag:${flag}`);
	if (override !== null) return override === 'true';
	return (FLAGS as Record<string, boolean>)[flag] ?? false;
}

export async function setFlag(flag: string, value: boolean, env: { KV: KVNamespace }): Promise<void> {
	await env.KV.put(`flag:${flag}`, String(value));
}

export async function deleteFlag(flag: string, env: { KV: KVNamespace }): Promise<void> {
	await env.KV.delete(`flag:${flag}`);
}

export async function getAllFlags(env: { KV: KVNamespace }): Promise<Record<string, boolean>> {
	const result: Record<string, boolean> = { ...FLAGS };
	for (const key of Object.keys(FLAGS)) {
		result[key] = await getFlag(key, env);
	}
	return result;
}

// ── Targeting-aware helpers ──────────────────────────────────────

function ruleKey(name: string): string {
	return `feature-flag:${name}`;
}

/** Deterministic hash for percentage-based rollout. */
function hashToPercent(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % 100;
}

/** Check if a targeted feature flag is enabled for the given context. */
export async function isFeatureEnabled(
	kv: KVNamespace,
	flagName: string,
	context: FlagContext,
): Promise<boolean> {
	const rule = await kv.get(ruleKey(flagName), 'json') as FeatureFlagRule | null;
	if (!rule) return false;
	if (!rule.enabled) return false;

	if (rule.orgs?.length) {
		if (!context.orgId || !rule.orgs.includes(context.orgId)) return false;
	}

	if (rule.plans?.length) {
		if (!context.plan || !rule.plans.includes(context.plan)) return false;
	}

	if (rule.percentage !== undefined && rule.percentage < 100) {
		const seed = context.userId || context.orgId || '';
		if (!seed) return false;
		if (hashToPercent(`${flagName}:${seed}`) >= rule.percentage) return false;
	}

	return true;
}

/** List all targeted feature flags from KV. */
export async function listTargetedFlags(kv: KVNamespace): Promise<string[]> {
	const result = await kv.list({ prefix: 'feature-flag:' });
	return result.keys.map((k) => k.name.replace('feature-flag:', ''));
}

/** Get a targeted flag rule. */
export async function getTargetedFlag(kv: KVNamespace, name: string): Promise<FeatureFlagRule | null> {
	return kv.get(ruleKey(name), 'json') as Promise<FeatureFlagRule | null>;
}

/** Create or update a targeted flag. */
export async function upsertTargetedFlag(
	kv: KVNamespace, name: string, rule: FeatureFlagRule,
): Promise<void> {
	const now = new Date().toISOString();
	const existing = await getTargetedFlag(kv, name);
	const merged: FeatureFlagRule = {
		...rule,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
	};
	await kv.put(ruleKey(name), JSON.stringify(merged));
}

/** Delete a targeted flag. */
export async function deleteTargetedFlag(kv: KVNamespace, name: string): Promise<void> {
	await kv.delete(ruleKey(name));
}
