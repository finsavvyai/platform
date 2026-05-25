/**
 * OpenClaw Integration for TenantIQ AI Engine
 *
 * Adapted from openhands-ai-engine/src/services/openclaw-bridge.ts
 * (Apache-2.0 licensed open source project)
 *
 * Provides TenantIQ with access to LunaOS/OpenClaw capabilities:
 *   - Specialized AI agents (365-security, license-optimizer, compliance-auditor, etc.)
 *   - Multi-agent chains
 *   - RAG semantic search
 *
 * Acts as a typed HTTP client to the OpenClaw Backend Service.
 */

export interface OpenClawConfig {
	baseUrl: string;
	serviceKey: string;
}

export interface AgentResult {
	output: string;
	executionId: string;
	durationMs: number;
	agent: string;
	provider: string;
}

export interface SearchResult {
	results: Array<{
		id: string;
		score: number;
		content: string;
		metadata: Record<string, unknown>;
	}>;
	total: number;
	searchTimeMs: number;
}

export class OpenClawBridge {
	private baseUrl: string;
	private serviceKey: string;

	constructor(baseUrl: string, serviceKey: string) {
		this.baseUrl = baseUrl || 'http://localhost:8790';
		this.serviceKey = serviceKey || '';
	}

	/**
	 * Run a LunaOS agent.
	 *
	 * @param agent - Agent slug (e.g. '365-security', 'license-optimizer', 'compliance-auditor')
	 * @param context - The tenant data / context for the agent to analyze
	 * @param opts - Optional: provider, userId
	 */
	async runAgent(
		agent: string,
		context: string,
		opts?: { provider?: string; userId?: string },
	): Promise<AgentResult> {
		const result = await this.bridgeCall('run', {
			agent,
			context,
			provider: opts?.provider || 'anthropic',
		}, opts?.userId);

		return {
			output: result.data?.output || '',
			executionId: result.data?.executionId || result.requestId,
			durationMs: result.durationMs,
			agent,
			provider: opts?.provider || 'anthropic',
		};
	}

	/**
	 * Run a multi-agent chain.
	 *
	 * @param preset - Chain preset (e.g. 'security-audit', 'compliance-check', 'cost-review', 'full-assessment')
	 * @param context - The tenant data / context to analyze
	 */
	async runChain(
		preset: string,
		context: string,
		opts?: { provider?: string; userId?: string },
	): Promise<unknown> {
		return this.bridgeCall('chain', {
			preset,
			context,
			provider: opts?.provider || 'anthropic',
		}, opts?.userId);
	}

	/**
	 * Search indexed content using RAG.
	 *
	 * @param query - Natural language search query
	 * @param topK - Number of results (default 5)
	 */
	async search(query: string, topK = 5): Promise<SearchResult> {
		const result = await this.bridgeCall('search', { query, topK });
		return result.data as SearchResult;
	}

	/**
	 * List available agents.
	 */
	async listAgents(): Promise<string[]> {
		const result = await this.bridgeCall('agents', {});
		return result.data?.agents || [];
	}

	/**
	 * Get system status.
	 */
	async getStatus(): Promise<unknown> {
		const result = await this.bridgeCall('status', {});
		return result.data;
	}

	/**
	 * List available integration channels.
	 */
	async listChannels(): Promise<unknown> {
		const res = await fetch(`${this.baseUrl}/bridge/channels`, {
			headers: {
				'X-Service-Key': this.serviceKey,
				'X-Request-Source': 'tenantiq',
			},
		});
		return res.json();
	}

	/**
	 * Health check.
	 */
	async healthCheck(): Promise<unknown> {
		const res = await fetch(`${this.baseUrl}/health`, {
			headers: { 'X-Request-Source': 'tenantiq' },
		});
		return res.json();
	}

	// ─── Internal ───────────────────────────────────────────────────────

	private async bridgeCall(
		action: string,
		payload: Record<string, unknown>,
		userId?: string,
	): Promise<{ data: Record<string, unknown>; requestId: string; durationMs: number }> {
		const response = await fetch(`${this.baseUrl}/bridge/execute`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Service-Key': this.serviceKey,
				'X-User-Id': userId || 'tenantiq',
				'X-Request-Source': 'tenantiq',
			},
			body: JSON.stringify({
				action,
				source: 'tenantiq',
				payload,
				correlationId: crypto.randomUUID(),
			}),
		});

		if (!response.ok) {
			const err = await response.text();
			throw new Error(`OpenClaw bridge error (${response.status}): ${err}`);
		}

		return response.json() as Promise<{ data: Record<string, unknown>; requestId: string; durationMs: number }>;
	}
}
