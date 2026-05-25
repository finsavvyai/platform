/**
 * Convenience wrappers for Superagent Redact API.
 * Use before storing user-generated content or sending external notifications.
 */

import { SafetyClient } from './client';

let sharedClient: SafetyClient | null = null;

/** Get or create a shared SafetyClient from env bindings. */
export function getSafetyClient(env: { SUPERAGENT_API_KEY?: string }): SafetyClient | null {
	if (!env.SUPERAGENT_API_KEY) return null;
	if (!sharedClient) {
		sharedClient = new SafetyClient({
			apiKey: env.SUPERAGENT_API_KEY,
			enabled: true,
		});
	}
	return sharedClient;
}

/**
 * Redact PII from text before storing in audit logs or sending notifications.
 * Returns original text if Superagent is not configured (graceful degradation).
 */
export async function redactForStorage(
	env: { SUPERAGENT_API_KEY?: string },
	text: string
): Promise<string> {
	const client = getSafetyClient(env);
	if (!client) return text;
	const result = await client.redact(text);
	return result.redacted;
}
