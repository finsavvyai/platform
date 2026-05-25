/**
 * Smart Router — AI pathway selection based on success rate, latency, and cost.
 *
 * Tracks per-pathway stats and auto-routes to the cheapest pathway
 * with >95% success rate. Falls back through progressively costlier options.
 */

const STATS_PREFIX = 'smart-router:stats:';
const MIN_SAMPLES = 5;
const SUCCESS_THRESHOLD = 0.95;

export type Pathway = 'booster' | 'cache' | 'groq' | 'gemini' | 'deepseek' | 'claw-gateway' | 'anthropic' | 'openclaw';

export interface RouteDecision {
	pathway: Pathway;
	reason: string;
	fallbacks: Pathway[];
}

export interface PathwayStats {
	successCount: number;
	failCount: number;
	avgLatencyMs: number;
	avgTokenCost: number;
	lastUsed: number;
}

/** Estimated cost per 1K tokens by pathway. */
const COST_ESTIMATE: Record<Pathway, number> = {
	booster: 0,
	cache: 0,
	groq: 0,
	gemini: 0,
	deepseek: 0.0003,
	'claw-gateway': 0.002,
	openclaw: 0.005,
	anthropic: 0.008,
};

/** Default ordering when no stats exist (cheapest first). */
const DEFAULT_ORDER: Pathway[] = ['booster', 'cache', 'groq', 'gemini', 'deepseek', 'claw-gateway', 'openclaw', 'anthropic'];

function statsKey(operation: string, pathway: string): string {
	return `${STATS_PREFIX}${operation}:${pathway}`;
}

function successRate(s: PathwayStats): number {
	const total = s.successCount + s.failCount;
	return total === 0 ? 1 : s.successCount / total;
}

function effectiveCost(s: PathwayStats, pathway: Pathway): number {
	return s.avgTokenCost > 0 ? s.avgTokenCost : COST_ESTIMATE[pathway];
}

export class SmartRouter {
	constructor(private kv: KVNamespace) {}

	async route(operation: string, available: Pathway[]): Promise<RouteDecision> {
		const statsMap = await this.loadStats(operation, available);
		const scored = available.map((p) => {
			const s = statsMap[p];
			const rate = s ? successRate(s) : 1;
			const cost = s ? effectiveCost(s, p) : COST_ESTIMATE[p];
			const samples = s ? s.successCount + s.failCount : 0;
			const reliable = samples >= MIN_SAMPLES ? rate >= SUCCESS_THRESHOLD : true;
			return { pathway: p, rate, cost, reliable, samples };
		});

		// Sort: reliable first, then by cost ascending, then by latency
		scored.sort((a, b) => {
			if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
			if (a.cost !== b.cost) return a.cost - b.cost;
			return 0;
		});

		const chosen = scored[0];
		const fallbacks = scored.slice(1).map((s) => s.pathway);
		const reason = chosen.samples >= MIN_SAMPLES
			? `cheapest with ${Math.round(chosen.rate * 100)}% success rate (${chosen.samples} samples)`
			: `cheapest available (insufficient data, ${chosen.samples} samples)`;

		return { pathway: chosen.pathway, reason, fallbacks };
	}

	async recordOutcome(
		pathway: string,
		operation: string,
		success: boolean,
		latencyMs: number,
		tokenCost: number,
	): Promise<void> {
		const key = statsKey(operation, pathway);
		const existing = await this.loadSingle(key);
		const stats = existing ?? newStats();

		const total = stats.successCount + stats.failCount;
		if (success) stats.successCount++;
		else stats.failCount++;

		stats.avgLatencyMs = total === 0 ? latencyMs : (stats.avgLatencyMs * total + latencyMs) / (total + 1);
		stats.avgTokenCost = total === 0 ? tokenCost : (stats.avgTokenCost * total + tokenCost) / (total + 1);
		stats.lastUsed = Date.now();

		await this.kv.put(key, JSON.stringify(stats), { expirationTtl: 86400 * 7 });
	}

	async getStats(): Promise<Record<string, Record<string, PathwayStats>>> {
		const list = await this.kv.list({ prefix: STATS_PREFIX });
		const result: Record<string, Record<string, PathwayStats>> = {};

		const entries = await Promise.all(
			list.keys.map(async (k) => ({ name: k.name, stats: await this.loadSingle(k.name) })),
		);

		for (const { name, stats } of entries) {
			if (!stats) continue;
			const parts = name.replace(STATS_PREFIX, '').split(':');
			const [operation, pathway] = [parts[0], parts.slice(1).join(':')];
			if (!result[operation]) result[operation] = {};
			result[operation][pathway] = stats;
		}
		return result;
	}

	private async loadStats(
		operation: string,
		pathways: Pathway[],
	): Promise<Record<string, PathwayStats>> {
		const entries = await Promise.all(
			pathways.map(async (p) => {
				const s = await this.loadSingle(statsKey(operation, p));
				return [p, s] as const;
			}),
		);
		const map: Record<string, PathwayStats> = {};
		for (const [p, s] of entries) {
			if (s) map[p] = s;
		}
		return map;
	}

	private async loadSingle(key: string): Promise<PathwayStats | null> {
		const raw = await this.kv.get(key, 'text');
		if (!raw) return null;
		try {
			return JSON.parse(raw) as PathwayStats;
		} catch {
			return null;
		}
	}
}

function newStats(): PathwayStats {
	return { successCount: 0, failCount: 0, avgLatencyMs: 0, avgTokenCost: 0, lastUsed: 0 };
}
