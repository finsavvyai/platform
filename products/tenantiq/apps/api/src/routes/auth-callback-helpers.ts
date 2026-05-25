/**
 * Helpers for the Microsoft OAuth callback — token exchange, KV writes,
 * platform-user upsert, JWT issuance, and UI payload construction.
 * Extracted so auth-callback.ts stays under the 200-line cap.
 */

import * as jose from 'jose';
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { GRAPH } from '../lib/constants';
import { getRS256PrivateKey, getHS256Secret, isRS256Configured } from '../lib/jwt-keys';
import { putRefreshToken } from '../lib/graph-token-store';

export function genId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function exchangeCodeForTokens(c: Context<AppEnv>, code: string) {
	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
	const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: c.env.AZURE_CLIENT_ID!,
			client_secret: c.env.AZURE_CLIENT_SECRET!,
			code,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code',
			scope: GRAPH.OAUTH_SCOPES,
		}),
	});
	if (!resp.ok) {
		const errBody = await resp.text();
		console.error('Token exchange failed:', errBody);
		let userMsg = 'Sign in failed during token exchange.';
		try {
			const p = JSON.parse(errBody);
			userMsg = p.error_description || `Microsoft error: ${p.error}` || userMsg;
		} catch {
			/* not JSON */
		}
		throw new Error(userMsg);
	}
	return resp.json() as Promise<{
		access_token: string;
		refresh_token: string;
		id_token: string;
		expires_in: number;
	}>;
}

export async function storeGraphTokens(
	c: Context<AppEnv>,
	azureTenantId: string,
	tokens: { access_token: string; refresh_token?: string; expires_in: number },
) {
	await c.env.KV.put(`graph:${azureTenantId}:access_token`, tokens.access_token, {
		expirationTtl: tokens.expires_in || 3600,
	});
	if (tokens.refresh_token) await putRefreshToken(c.env, azureTenantId, tokens.refresh_token);
}

export async function upsertPlatformUser(
	c: Context<AppEnv>,
	azureOid: string,
	email: string,
	name: string,
	scopeLevel: 'admin' | 'personal',
	azureTenantId?: string,
) {
	const db = c.env.DB;
	let user = await db
		.prepare('SELECT * FROM platform_users WHERE azure_oid = ? LIMIT 1')
		.bind(azureOid)
		.first<Record<string, unknown>>();
	if (!user) {
		// Check if email already exists (UNIQUE index) before creating a new org+user.
		// Handles the case where the same person signs in with a different identity provider
		// or after a DB migration that preserved their email but not their azure_oid.
		const existingByEmail = await db
			.prepare('SELECT * FROM platform_users WHERE email = ? LIMIT 1')
			.bind(email)
			.first<Record<string, unknown>>();

		if (existingByEmail) {
			// Link the azure_oid to the existing account and update scope.
			const currentLevel = (existingByEmail.scope_level as string | undefined) ?? 'admin';
			const nextLevel = currentLevel === 'admin' ? 'admin' : scopeLevel;
			await db
				.prepare('UPDATE platform_users SET azure_oid = ?, last_login_at = ?, scope_level = ? WHERE id = ?')
				.bind(azureOid, Math.floor(Date.now() / 1000), nextLevel, existingByEmail.id as string)
				.run();
			existingByEmail.azure_oid = azureOid;
			existingByEmail.scope_level = nextLevel;
			return existingByEmail;
		}

		// Merge new accounts from the same Microsoft Entra tenant into a shared TenantIQ org.
		// This keeps info@ + admin@ from the same company under one org — matching how
		// customer tenants are keyed — instead of creating a per-user org on every sign-in.
		let orgId: string;
		let existingOrg: Record<string, unknown> | null = null;
		if (azureTenantId) {
			existingOrg = await db
				.prepare('SELECT id FROM organizations WHERE azure_tenant_id = ? LIMIT 1')
				.bind(azureTenantId)
				.first<Record<string, unknown>>();
		}
		if (existingOrg) {
			orgId = existingOrg.id as string;
		} else {
			orgId = genId();
			await db
				.prepare('INSERT INTO organizations (id, name, type, azure_tenant_id, created_at) VALUES (?, ?, ?, ?, ?)')
				.bind(orgId, `${name}'s Organization`, 'direct', azureTenantId ?? null, Math.floor(Date.now() / 1000))
				.run();
		}
		const userId = genId();
		// Users joining an existing org are members, not admins. First user is admin.
		const role = existingOrg ? 'member' : 'admin';
		await db
			.prepare(
				'INSERT INTO platform_users (id, organization_id, email, name, role, azure_oid, status, scope_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
			)
			.bind(userId, orgId, email, name, role, azureOid, 'active', scopeLevel, Math.floor(Date.now() / 1000))
			.run();
		return {
			id: userId,
			organization_id: orgId,
			email,
			name,
			role,
			status: 'active',
			scope_level: scopeLevel,
		};
	}
	// Only *upgrade* scope_level (personal → admin) on re-login; never downgrade
	// an admin user who momentarily uses a personal sign-in link.
	const currentLevel = (user.scope_level as string | undefined) ?? 'admin';
	const nextLevel = currentLevel === 'admin' ? 'admin' : scopeLevel;
	await db
		.prepare('UPDATE platform_users SET last_login_at = ?, scope_level = ? WHERE id = ?')
		.bind(Date.now(), nextLevel, user.id as string)
		.run();
	user.scope_level = nextLevel;
	return user;
}

export async function issueJwt(
	c: Context<AppEnv>,
	claims: {
		azureOid: string;
		email: string;
		name: string;
		orgId: string;
		tenantIds: string[];
		role: string;
		scopeLevel?: 'admin' | 'personal';
	},
) {
	// Random per-token JTI so logout can revoke it from the deny-list.
	const jtiBytes = new Uint8Array(16);
	crypto.getRandomValues(jtiBytes);
	const jti = Array.from(jtiBytes, (b) => b.toString(16).padStart(2, '0')).join('');

	const body = new jose.SignJWT({
		sub: claims.azureOid,
		email: claims.email,
		name: claims.name,
		orgId: claims.orgId,
		tenantIds: claims.tenantIds,
		role: claims.role,
		scopeLevel: claims.scopeLevel ?? 'admin',
	})
		.setIssuedAt()
		.setExpirationTime('24h')
		.setIssuer('tenantiq.app')
		.setAudience('tenantiq-api')
		.setJti(jti);

	if (isRS256Configured(c.env)) {
		const privateKey = await getRS256PrivateKey(c.env.RS256_PRIVATE_KEY!);
		return body.setProtectedHeader({ alg: 'RS256', kid: 'tenantiq-rs256-1' }).sign(privateKey);
	}
	const secret = getHS256Secret(c.env.JWT_SECRET);
	return body.setProtectedHeader({ alg: 'HS256' }).sign(secret);
}

export { buildUserPayload } from './auth-callback-user-payload';
