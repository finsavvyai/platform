/**
 * Superagent Safety SDK types for Guard and Redact APIs.
 */

export interface GuardResult {
	classification: 'block' | 'pass';
	violationTypes: string[];
	cweCodes: string[];
	confidence: number;
}

export interface RedactResult {
	redacted: string;
	redactions: Record<string, number>;
}

export interface SafetyConfig {
	apiKey?: string;
	baseUrl: string;
	enabled: boolean;
	/** Block on guard failure or just log */
	enforceGuard: boolean;
	/** Timeout in ms for safety API calls */
	timeoutMs: number;
}

/**
 * Default: self-hosted Claw gateway guard endpoint.
 * Set CLAW_GATEWAY_URL env var to override. Falls back to Superagent hosted API
 * only if SUPERAGENT_API_KEY is set and no Claw gateway is configured.
 */
export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
	baseUrl: 'https://claw.opensyber.cloud/v1',
	enabled: true,
	enforceGuard: true,
	timeoutMs: 3000,
};
