/**
 * Superagent Safety client — Guard and Redact via REST API.
 * Compatible with Cloudflare Workers (fetch-based, no Node.js deps).
 */

import type {
	GuardResult,
	RedactResult,
	SafetyConfig,
} from './types';
import { DEFAULT_SAFETY_CONFIG } from './types';

export class SafetyClient {
	private config: SafetyConfig;

	constructor(config: Partial<SafetyConfig> = {}) {
		this.config = { ...DEFAULT_SAFETY_CONFIG, ...config };
	}

	/**
	 * Guard user input against prompt injection, jailbreaks, and unsafe instructions.
	 * Returns { classification: 'pass' } on timeout or API failure (fail-open by default).
	 */
	async guard(input: string): Promise<GuardResult> {
		if (!this.config.enabled || !input.trim()) {
			return { classification: 'pass', violationTypes: [], cweCodes: [], confidence: 0 };
		}

		try {
			const res = await this.fetch('/guard', { input });
			const data = await res.json() as Record<string, unknown>;

			return {
				classification: data.classification === 'block' ? 'block' : 'pass',
				violationTypes: Array.isArray(data.violation_types) ? data.violation_types : [],
				cweCodes: Array.isArray(data.cwe_codes) ? data.cwe_codes : [],
				confidence: typeof data.confidence === 'number' ? data.confidence : 0,
			};
		} catch (err) {
			console.warn('[Safety] Guard call failed, failing open:', err);
			return { classification: 'pass', violationTypes: [], cweCodes: [], confidence: 0 };
		}
	}

	/**
	 * Redact PII/PHI/secrets from text before storage or external delivery.
	 * Returns original text on failure (fail-open).
	 */
	async redact(input: string): Promise<RedactResult> {
		if (!this.config.enabled || !input.trim()) {
			return { redacted: input, redactions: {} };
		}

		try {
			const res = await this.fetch('/redact', { input });
			const data = await res.json() as Record<string, unknown>;

			return {
				redacted: typeof data.redacted === 'string' ? data.redacted : input,
				redactions: (data.redactions as Record<string, number>) ?? {},
			};
		} catch (err) {
			console.warn('[Safety] Redact call failed, returning original:', err);
			return { redacted: input, redactions: {} };
		}
	}

	private async fetch(path: string, body: Record<string, unknown>): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (this.config.apiKey) {
				headers['Authorization'] = `Bearer ${this.config.apiKey}`;
			}

			return await fetch(`${this.config.baseUrl}${path}`, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeout);
		}
	}
}
