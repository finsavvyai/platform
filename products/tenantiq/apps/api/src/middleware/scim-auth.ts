/**
 * SCIM 2.0 Bearer-token authentication.
 *
 * IdPs (Okta, Entra) call our SCIM endpoints with `Authorization: Bearer <token>`.
 * The token plaintext is hashed (sha256 hex) on creation and only the hash is
 * stored — we look up by hash, never by plaintext, never log plaintext.
 *
 * Sets `c.set('scimOrgId', ...)` and `c.set('scimTokenId', ...)` for downstream
 * route handlers to scope queries.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app/types';

const SCIM_BEARER_PREFIX = 'Bearer ';
const SCIM_TOKEN_LENGTH = 64;

export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function generateScimTokenPlaintext(): string {
	const bytes = new Uint8Array(SCIM_TOKEN_LENGTH);
	crypto.getRandomValues(bytes);
	return `tiq_scim_${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')}`;
}

function unauthorized(detail: string) {
	return Response.json(
		{
			schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
			status: '401',
			detail,
		},
		{ status: 401, headers: { 'Content-Type': 'application/scim+json' } },
	);
}

interface TokenRow {
	id: string;
	org_id: string;
	scopes_json: string;
	revoked_at: number | null;
}

declare module '../app/types' {
	interface AppVariables {
		scimOrgId?: string;
		scimTokenId?: string;
		scimScopes?: string[];
	}
}

export const scimAuthMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const auth = c.req.header('authorization') ?? c.req.header('Authorization');
	if (!auth || !auth.startsWith(SCIM_BEARER_PREFIX)) {
		return unauthorized('Missing Bearer token');
	}
	const plaintext = auth.slice(SCIM_BEARER_PREFIX.length).trim();
	if (!plaintext) return unauthorized('Empty Bearer token');

	const hash = await sha256Hex(plaintext);
	const row = await c.env.DB
		.prepare(
			'SELECT id, org_id, scopes_json, revoked_at FROM scim_bearer_tokens WHERE token_hash = ?',
		)
		.bind(hash)
		.first<TokenRow>()
		.catch(() => null);

	if (!row) return unauthorized('Invalid token');
	if (row.revoked_at) return unauthorized('Token revoked');

	let scopes: string[];
	try {
		scopes = JSON.parse(row.scopes_json) as string[];
	} catch {
		return unauthorized('Token malformed (scopes)');
	}

	c.set('scimOrgId', row.org_id);
	c.set('scimTokenId', row.id);
	c.set('scimScopes', scopes);

	c.executionCtx.waitUntil(
		c.env.DB.prepare(
			'UPDATE scim_bearer_tokens SET last_used_at = ? WHERE id = ?',
		)
			.bind(Math.floor(Date.now() / 1000), row.id)
			.run()
			.catch(() => {}),
	);

	await next();
});

export function requireScimScope(scope: string) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const scopes = c.get('scimScopes') ?? [];
		if (!scopes.includes(scope)) {
			return Response.json(
				{
					schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
					status: '403',
					detail: `Token missing required scope: ${scope}`,
				},
				{ status: 403, headers: { 'Content-Type': 'application/scim+json' } },
			);
		}
		await next();
	});
}
