/**
 * Claw Gateway Client — routes AI requests through the shared gateway
 * for centralized billing, usage tracking, rate limiting, and prompt guard.
 *
 * Endpoint: https://claw-gateway.broad-dew-49ad.workers.dev
 * Falls back to direct Anthropic API if gateway is unreachable.
 */

import { AI } from './constants';

const CLAW_GATEWAY_URL = 'https://claw-gateway.broad-dew-49ad.workers.dev';
const TIMEOUT_MS = 30_000;

export interface ClawConfig {
	apiKey: string;
	projectId: string;
	gatewayUrl?: string;
}

export interface ClawPromptRequest {
	prompt: string;
	system?: string;
	provider?: 'anthropic' | 'openai' | 'groq';
	model?: string;
	maxTokens?: number;
	temperature?: number;
	metadata?: Record<string, string>;
}

export interface ClawPromptResponse {
	text: string;
	model: string;
	usage: { inputTokens: number; outputTokens: number };
	cached: boolean;
	durationMs: number;
}

export class ClawClient {
	private apiKey: string;
	private projectId: string;
	private gatewayUrl: string;

	constructor(config: ClawConfig) {
		this.apiKey = config.apiKey;
		this.projectId = config.projectId;
		this.gatewayUrl = config.gatewayUrl || CLAW_GATEWAY_URL;
	}

	/** Send a prompt through the Claw gateway. */
	async prompt(req: ClawPromptRequest): Promise<ClawPromptResponse> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const provider = req.provider || 'anthropic';
			// Opus 4.7 (and any Claude 4.x model the gateway forwards to) rejects
			// temperature/top_p/top_k. Only include temperature when the caller
			// asked for it AND the provider is non-Anthropic.
			const payload: Record<string, unknown> = {
				prompt: req.prompt,
				system: req.system,
				provider,
				model: req.model || AI.MODEL,
				maxTokens: req.maxTokens || AI.MAX_TOKENS_DEFAULT,
				metadata: { ...req.metadata, source: 'tenantiq' },
			};
			if (req.temperature !== undefined && provider !== 'anthropic') {
				payload.temperature = req.temperature;
			}
			const res = await fetch(`${this.gatewayUrl}/v1/prompt`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`,
					'X-Project-Id': this.projectId,
				},
				body: JSON.stringify(payload),
				signal: controller.signal,
			});

			if (!res.ok) {
				const body = await res.text().catch(() => '');
				throw new Error(`Claw gateway ${res.status}: ${body}`);
			}

			return (await res.json()) as ClawPromptResponse;
		} finally {
			clearTimeout(timeout);
		}
	}

	/** Health check — verify the gateway is reachable. */
	async health(): Promise<{ ok: boolean; latencyMs: number }> {
		const start = Date.now();
		try {
			const res = await fetch(`${this.gatewayUrl}/health`, {
				headers: { Authorization: `Bearer ${this.apiKey}` },
			});
			return { ok: res.ok, latencyMs: Date.now() - start };
		} catch {
			return { ok: false, latencyMs: Date.now() - start };
		}
	}
}

/**
 * Create a ClawClient from environment variables.
 * Returns null if CLAW_API_KEY is not set.
 */
export function createClawClient(env: {
	CLAW_API_KEY?: string;
	CLAW_PROJECT_ID?: string;
	CLAW_GATEWAY_URL?: string;
}): ClawClient | null {
	if (!env.CLAW_API_KEY) return null;
	return new ClawClient({
		apiKey: env.CLAW_API_KEY,
		projectId: env.CLAW_PROJECT_ID || 'tenantiq',
		gatewayUrl: env.CLAW_GATEWAY_URL,
	});
}
