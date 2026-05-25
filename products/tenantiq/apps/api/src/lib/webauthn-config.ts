/**
 * WebAuthn relying party configuration.
 *
 * `rpID` MUST match the eTLD+1 of the production frontend hostname. For local
 * dev, browsers accept "localhost" without HTTPS. For production, the entire
 * origin must be HTTPS and the rpID must be a registrable domain suffix of
 * the origin (e.g. rpID="tenantiq.app" works for app.tenantiq.app).
 *
 * Challenges are stored in KV under `wa-chal:{challenge}` with 5min TTL.
 */
export const WEBAUTHN_RP_NAME = 'TenantIQ';

export function getRpId(env: { ENVIRONMENT?: string }): string {
	if (env.ENVIRONMENT === 'production') return 'tenantiq.app';
	return 'localhost';
}

export function getOrigin(env: { ENVIRONMENT?: string }): string[] {
	// Multiple origins valid in production (web app + capacitor mobile).
	if (env.ENVIRONMENT === 'production') {
		return [
			'https://app.tenantiq.app',
			'https://tenantiq.app',
			'capacitor://localhost',  // iOS native shell
			'http://localhost',        // Android native shell
		];
	}
	return ['http://localhost:5173', 'http://localhost:8787'];
}

export const CHALLENGE_TTL_SECONDS = 300; // 5 minutes
