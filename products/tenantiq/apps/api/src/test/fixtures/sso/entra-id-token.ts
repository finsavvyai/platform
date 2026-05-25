/**
 * Microsoft Entra ID (Azure AD) v2.0 id_token claim shape.
 * Reference: https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
 *
 * Key differences from Okta:
 *  - `oid` is the immutable Entra object id (preferred over `sub` for stable id)
 *  - `tid` identifies the home tenant
 *  - `email` may be omitted for B2B guests; falls back to `preferred_username`
 *  - `groups` overage past 200 emits `_claim_names` instead — we don't handle that yet
 */

export interface EntraIdTokenClaims {
	sub: string;
	iss: string;
	aud: string;
	tid: string;
	oid: string;
	email?: string;
	name: string;
	preferred_username: string;
	upn?: string;
	given_name?: string;
	family_name?: string;
	roles?: string[];
	groups?: string[];
}

export function entraSampleClaims(overrides: Partial<EntraIdTokenClaims> = {}): EntraIdTokenClaims {
	return {
		sub: 'AAAAAAAAAAAAAAAAAAAAAEXAMPLE_SUB',
		iss: 'https://login.microsoftonline.com/72f988bf-86f1-41af-91ab-2d7cd011db47/v2.0',
		aud: 'b14a7505-96e9-4927-91e8-0601d7272dde',
		tid: '72f988bf-86f1-41af-91ab-2d7cd011db47',
		oid: '11111111-2222-3333-4444-555555555555',
		email: 'bob@contoso.com',
		name: 'Bob Builder',
		preferred_username: 'bob@contoso.com',
		upn: 'bob@contoso.onmicrosoft.com',
		given_name: 'Bob',
		family_name: 'Builder',
		roles: ['TenantIQ.Admin'],
		groups: [],
		...overrides,
	};
}

/** B2B guest variant — `email` claim absent; consumer must fall back. */
export function entraGuestClaims(overrides: Partial<EntraIdTokenClaims> = {}): EntraIdTokenClaims {
	const base = entraSampleClaims(overrides);
	const { email, ...rest } = base;
	void email;
	return { ...rest, preferred_username: 'guest@partner.com' };
}
