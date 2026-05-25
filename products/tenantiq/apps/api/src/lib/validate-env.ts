import type { Env } from '../index';

// Only JWT_SECRET is truly required for basic operation
// Azure credentials are optional (only needed for M365 OAuth)
// Anthropic API key is optional (only needed for AI features)
const REQUIRED_SECRETS = ['JWT_SECRET'] as const;

const OPTIONAL_SECRETS = [
	'AZURE_CLIENT_ID',
	'AZURE_CLIENT_SECRET',
	'AZURE_TENANT_ID',
	'ANTHROPIC_API_KEY'
] as const;

/**
 * Validates required environment variables are set.
 * Called on first request — throws if critical vars are missing.
 */
export function validateEnv(env: Env): void {
	const missing: string[] = [];
	const warnings: string[] = [];

	// Check required secrets
	for (const key of REQUIRED_SECRETS) {
		if (!env[key]) {
			missing.push(key);
		}
	}

	// Check D1 database binding
	if (!env.DB) {
		missing.push('DB (D1 database binding)');
	}

	// Warn about optional secrets
	for (const key of OPTIONAL_SECRETS) {
		if (!env[key]) {
			warnings.push(key);
		}
	}

	if (warnings.length > 0) {
		console.warn(
			`[ENV] Optional secrets not set (some features will be disabled): ${warnings.join(', ')}`
		);
	}

	if (missing.length > 0) {
		const msg = `Missing required environment variables: ${missing.join(', ')}`;
		console.error(`[ENV] ${msg}`);
		throw new Error(msg);
	}

	console.log('[ENV] ✓ All required environment variables are set');
}
