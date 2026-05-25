/**
 * Auth0 OIDC id_token claim shape.
 * Reference: https://auth0.com/docs/secure/tokens/id-tokens/id-token-structure
 *
 * Key differences from Okta/Entra:
 *  - `sub` always prefixed with connection (`auth0|`, `google-oauth2|`, etc.)
 *  - Custom claims must be namespaced w/ a URI to survive token transit
 *  - `nickname` is sometimes present in addition to `name`
 *  - `email_verified` strongly recommended; Auth0 emits as boolean
 */

const ROLES_CLAIM = 'https://app.tenantiq.io/roles';
const ORG_CLAIM = 'https://app.tenantiq.io/org_id';

export interface Auth0IdTokenClaims {
	sub: string;
	iss: string;
	aud: string;
	email: string;
	email_verified: boolean;
	name: string;
	nickname?: string;
	picture?: string;
	updated_at?: string;
	[ROLES_CLAIM]?: string[];
	[ORG_CLAIM]?: string;
}

export function auth0SampleClaims(overrides: Partial<Auth0IdTokenClaims> = {}): Auth0IdTokenClaims {
	return {
		sub: 'auth0|6512b9d8e4f01bc5d0a4f8e0',
		iss: 'https://acme-tenant.us.auth0.com/',
		aud: 'EXAMPLE_AUTH0_CLIENT_ID',
		email: 'carol@acme-corp.com',
		email_verified: true,
		name: 'Carol Carter',
		nickname: 'carol',
		picture: 'https://s.gravatar.com/avatar/abc.png',
		updated_at: '2026-04-27T22:00:00.000Z',
		[ROLES_CLAIM]: ['admin', 'billing'],
		[ORG_CLAIM]: 'org_acme',
		...overrides,
	};
}

export const AUTH0_ROLES_CLAIM = ROLES_CLAIM;
export const AUTH0_ORG_CLAIM = ORG_CLAIM;
