/**
 * OpenClaw Bridge for TenantIQ
 *
 * Adapts the OpenHands AI Engine's OpenClawBridge pattern for Cloudflare Workers.
 * Gives TenantIQ access to 28+ Luna AI agents for:
 *   - M365 security analysis
 *   - License optimization recommendations
 *   - Compliance report generation
 *   - Natural language tenant queries
 *   - Multi-agent security chains
 */

import type { Env } from '../../index';
import type {
	AgentResult,
	SearchResult,
	TenantSecurityAnalysis,
	LicenseOptimizationResult,
	TenantSecurityContext,
	LicenseContext,
	BridgeCallResult,
} from './types';
import { parseSecurityAnalysis, parseLicenseAnalysis } from './parsers';
import { buildSecurityPosturePrompt, buildLicenseWastePrompt } from './prompts';

export type {
	AgentResult,
	SearchResult,
	TenantSecurityAnalysis,
	LicenseOptimizationResult,
	TenantSecurityContext,
	LicenseContext,
} from './types';

export class OpenClawBridge {
	private baseUrl: string;
	private serviceKey: string;
	private fetcher: Fetcher | null;

	constructor(env: Env) {
		this.fetcher = env.AI_ENGINE || null;
		this.baseUrl = env.OPENCLAW_URL || 'http://localhost:8790';
		this.serviceKey = env.OPENCLAW_SERVICE_KEY || '';
	}

	get isConfigured(): boolean {
		return !!this.fetcher || (!!this.baseUrl && this.baseUrl !== 'http://localhost:8790');
	}

	private async executeFetch(url: string, init?: RequestInit): Promise<Response> {
		if (this.fetcher) {
			const serviceUrl = url.startsWith('http') ? url : `https://ai-engine${url}`;
			return this.fetcher.fetch(serviceUrl, init);
		}
		return fetch(url, init);
	}

	async runAgent(
		agent: string,
		context: string,
		opts?: { provider?: string; userId?: string }
	): Promise<AgentResult> {
		const result = await this.bridgeCall(
			'run',
			{ agent, context, provider: opts?.provider || 'claude' },
			opts?.userId
		);
		return {
			output: result.data?.output || '',
			executionId: result.data?.executionId || result.requestId || crypto.randomUUID(),
			durationMs: result.durationMs || 0,
			agent,
			provider: opts?.provider || 'claude',
		};
	}

	async runChain(
		preset: string,
		context: string,
		opts?: { provider?: string }
	): Promise<AgentResult> {
		const result = await this.bridgeCall('chain', {
			preset,
			context,
			provider: opts?.provider || 'claude',
		});
		return {
			output: result.data?.output || '',
			executionId: result.data?.executionId || result.requestId || crypto.randomUUID(),
			durationMs: result.durationMs || 0,
			agent: `chain:${preset}`,
			provider: opts?.provider || 'claude',
		};
	}

	async analyzeSecurityPosture(
		tenantContext: TenantSecurityContext
	): Promise<TenantSecurityAnalysis> {
		const context = buildSecurityPosturePrompt(tenantContext);
		const result = await this.runAgent('365-security', context);
		return parseSecurityAnalysis(result);
	}

	async analyzeLicenseWaste(licenseContext: LicenseContext): Promise<LicenseOptimizationResult> {
		const totalCost = licenseContext.licenses.reduce((sum, l) => sum + l.assigned * l.cost, 0);
		const context = buildLicenseWastePrompt(licenseContext, totalCost);
		const result = await this.runAgent('license-optimizer', context);
		return parseLicenseAnalysis(result, totalCost);
	}

	async search(query: string, topK = 5): Promise<SearchResult> {
		const result = await this.bridgeCall('search', { query, topK });
		return result.data as SearchResult;
	}

	async listAgents(): Promise<string[]> {
		const result = await this.bridgeCall('agents', {});
		return result.data?.agents || [];
	}

	async healthCheck(): Promise<{ status: string; agents?: number }> {
		try {
			const url = this.fetcher ? 'https://ai-engine/health' : `${this.baseUrl}/health`;
			const res = await this.executeFetch(url, {
				headers: { 'X-Request-Source': 'tenantiq' },
			});
			return res.json() as Promise<{ status: string; agents?: number }>;
		} catch {
			return { status: 'unreachable' };
		}
	}

	private async bridgeCall(
		action: string,
		payload: Record<string, unknown>,
		userId?: string
	): Promise<BridgeCallResult> {
		const url = this.fetcher
			? 'https://ai-engine/bridge/execute'
			: `${this.baseUrl}/bridge/execute`;
		const response = await this.executeFetch(url, {
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

		return response.json() as Promise<BridgeCallResult>;
	}
}

/**
 * Get OpenClaw bridge from env.
 * Returns null if not configured - all routes should handle this gracefully.
 */
export function getOpenClawBridge(env: Env): OpenClawBridge | null {
	if (!env.AI_ENGINE && !env.OPENCLAW_URL) return null;
	return new OpenClawBridge(env);
}
