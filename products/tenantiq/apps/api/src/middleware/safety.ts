/**
 * Safety middleware — guards AI endpoints against prompt injection.
 * Uses self-hosted Claw gateway /v1/guard (Ollama + superagent-guard-1.7B).
 * Zero external API calls — all inference runs on our infrastructure.
 *
 * Fail-open by default: if the guard is unreachable, requests proceed.
 */

import type { Context, Next } from 'hono';
import { SafetyClient } from '../lib/safety/client';

/**
 * Extract the user message from common AI request body shapes.
 */
function extractUserMessage(body: Record<string, unknown>): string | null {
	if (typeof body.message === 'string') return body.message;
	if (typeof body.question === 'string') return body.question;
	if (typeof body.prompt === 'string') return body.prompt;
	if (typeof body.input === 'string') return body.input;
	return null;
}

/**
 * Hono middleware that guards POST bodies on AI endpoints.
 * Attach to any route that sends user text to an LLM.
 */
export function safetyGuard() {
	return async (c: Context, next: Next) => {
		if (c.req.method !== 'POST') return next();

		const env = c.env as Record<string, string>;
		const apiKey = env.CLAW_API_KEY || env.SUPERAGENT_API_KEY;
		if (!apiKey) return next();
		const baseUrl = env.CLAW_GATEWAY_URL || undefined;

		let body: Record<string, unknown>;
		try {
			body = await c.req.json();
		} catch {
			return next();
		}

		const message = extractUserMessage(body);
		if (!message) return next();

		const client = new SafetyClient({ apiKey, enabled: true, ...(baseUrl ? { baseUrl } : {}) });
		const result = await client.guard(message);

		if (result.classification === 'block') {
			console.warn('[Safety] Blocked prompt injection attempt', {
				violations: result.violationTypes,
				confidence: result.confidence,
				user: (c.get('user') as Record<string, string>)?.email,
			});

			return c.json({
				error: 'Input blocked by safety filter',
				violations: result.violationTypes,
			}, 400);
		}

		// Store guard result for downstream logging
		c.set('safetyGuard', result);
		await next();
	};
}
