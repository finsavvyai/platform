/**
 * Feature Flag Engine — KV-backed with gradual rollout support.
 * Compatible with GrowthBook SDK interface for future migration.
 *
 * Builds on the existing targeting helpers in feature-flags.ts
 * but exposes a class-based API for dependency injection.
 */

export interface FeatureFlag {
	key: string;
	enabled: boolean;
	description: string;
	rolloutPercentage: number;
	targetOrgs?: string[];
	targetPlans?: string[];
	createdAt: number;
	updatedAt: number;
}

export interface FlagEvaluationContext {
	orgId: string;
	plan: string;
	userId: string;
}

const KV_PREFIX = 'ff:';

/** Deterministic hash for percentage-based rollout. */
function hashToPercent(input: string): number {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % 100;
}

function kvKey(key: string): string {
	return `${KV_PREFIX}${key}`;
}

export class FeatureFlagEngine {
	constructor(private kv: KVNamespace) {}

	/** Evaluate a flag for a specific context. */
	async isEnabled(key: string, ctx: FlagEvaluationContext): Promise<boolean> {
		const flag = await this.getFlag(key);
		if (!flag) return false;
		if (!flag.enabled) return false;

		if (flag.targetOrgs?.length) {
			if (!flag.targetOrgs.includes(ctx.orgId)) return false;
		}

		if (flag.targetPlans?.length) {
			if (!flag.targetPlans.includes(ctx.plan)) return false;
		}

		if (flag.rolloutPercentage < 100) {
			const bucket = hashToPercent(`${key}:${ctx.orgId}`);
			if (bucket >= flag.rolloutPercentage) return false;
		}

		return true;
	}

	/** Get a single flag by key. */
	async getFlag(key: string): Promise<FeatureFlag | null> {
		return this.kv.get(kvKey(key), 'json') as Promise<FeatureFlag | null>;
	}

	/** List all flags. */
	async listFlags(): Promise<FeatureFlag[]> {
		const result = await this.kv.list({ prefix: KV_PREFIX });
		const flags: FeatureFlag[] = [];
		for (const entry of result.keys) {
			const flag = await this.kv.get(entry.name, 'json') as FeatureFlag | null;
			if (flag) flags.push(flag);
		}
		return flags;
	}

	/** Create or update a flag. */
	async setFlag(flag: FeatureFlag): Promise<void> {
		const now = Date.now();
		const existing = await this.getFlag(flag.key);
		const merged: FeatureFlag = {
			...flag,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
		};
		await this.kv.put(kvKey(flag.key), JSON.stringify(merged));
	}

	/** Delete a flag. */
	async deleteFlag(key: string): Promise<void> {
		await this.kv.delete(kvKey(key));
	}

	/** Seed default flags that don't already exist. */
	async seedDefaults(defaults: FeatureFlag[]): Promise<number> {
		let seeded = 0;
		for (const flag of defaults) {
			const existing = await this.getFlag(flag.key);
			if (!existing) {
				await this.setFlag(flag);
				seeded++;
			}
		}
		return seeded;
	}
}
