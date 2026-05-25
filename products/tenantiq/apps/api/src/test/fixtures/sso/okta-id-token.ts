/**
 * Okta OIDC id_token claim shape — based on Okta's documented OIDC claims.
 * Reference: https://developer.okta.com/docs/reference/api/oidc/#id-token-claims
 *
 * The claim structure here mirrors what Okta actually emits in production.
 * Test code passes this object to a JWT signer (jose) — signature is irrelevant
 * because sso-callback.ts uses `decodeJwt` (decode-only, no verify).
 */

export interface OktaIdTokenClaims {
	sub: string;
	iss: string;
	aud: string;
	email: string;
	email_verified: boolean;
	name: string;
	preferred_username: string;
	given_name?: string;
	family_name?: string;
	locale?: string;
	zoneinfo?: string;
	updated_at?: number;
	groups?: string[];
}

export function oktaSampleClaims(overrides: Partial<OktaIdTokenClaims> = {}): OktaIdTokenClaims {
	return {
		sub: '00u1abc2def3ghi4jkl5',
		iss: 'https://dev-12345.okta.com/oauth2/default',
		aud: '0oa1abc2def3ghi4jkl5',
		email: 'alice@acme-corp.com',
		email_verified: true,
		name: 'Alice Anderson',
		preferred_username: 'alice@acme-corp.com',
		given_name: 'Alice',
		family_name: 'Anderson',
		locale: 'en-US',
		zoneinfo: 'America/Los_Angeles',
		updated_at: 1714000000,
		groups: ['Everyone', 'Engineering', 'TenantIQ-Admins'],
		...overrides,
	};
}
