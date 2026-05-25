/**
 * LinkedIn OpenID Connect login as a secondary auth provider.
 * Microsoft remains primary for Graph-API-powered features.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { LINKEDIN, TTL, URLS } from '../lib/constants';
import { writeAuditLog } from '../lib/audit-logger';
import {
	buildAuthSessionRedirect,
	buildUserPayload,
	genId,
	issueSessionJwt,
} from '../lib/auth-session';

export async function linkedinLogin(c: Context<AppEnv>) {
	if (!c.env.LINKEDIN_CLIENT_ID) {
		return c.json({ error: 'LinkedIn sign-in not configured' }, 503);
	}
	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback/linkedin`;
	const state = crypto.randomUUID();
	await c.env.KV.put(`auth:state:linkedin:${state}`, '1', { expirationTtl: TTL.AUTH_STATE });

	const authUrl = new URL(LINKEDIN.AUTHORIZE_URL);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('client_id', c.env.LINKEDIN_CLIENT_ID);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('scope', LINKEDIN.SCOPES);
	authUrl.searchParams.set('state', state);
	return c.redirect(authUrl.toString());
}

export async function linkedinCallback(c: Context<AppEnv>) {
	const frontendUrl = c.env.FRONTEND_URL || URLS.FRONTEND;
	const code = c.req.query('code');
	const state = c.req.query('state');
	const err = c.req.query('error_description') || c.req.query('error');

	if (!code) {
		const msg = err ? `LinkedIn error: ${err}` : 'Sign-in failed.';
		return c.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(msg)}`);
	}
	if (!state || !(await c.env.KV.get(`auth:state:linkedin:${state}`))) {
		return c.json({ error: 'Invalid state parameter' }, 400);
	}
	await c.env.KV.delete(`auth:state:linkedin:${state}`);

	try {
		if (!c.env.LINKEDIN_CLIENT_ID || !c.env.LINKEDIN_CLIENT_SECRET) {
			return c.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent('LinkedIn sign-in not configured')}`);
		}
		const tokens = await exchangeCodeForTokens(c, code);
		const profile = await fetchLinkedInProfile(tokens.access_token);
		const userRow = await upsertLinkedInUser(c, profile);

		const orgId = (userRow.organization_id as string) ?? '';
		const existingTenants = orgId
			? await c.env.DB.prepare('SELECT id FROM tenants WHERE organization_id = ?').bind(orgId).all<{ id: string }>()
			: { results: [] };
		const tenantIds = existingTenants.results.map((t) => t.id);

		const jwt = await issueSessionJwt(c.env, {
			sub: userRow.id as string,
			email: profile.email,
			name: profile.name,
			orgId,
			tenantIds,
			role: userRow.role as string,
			scopeLevel: 'personal',
		});
		await c.env.KV.put(`session:${userRow.id}`, jwt, { expirationTtl: TTL.ONE_DAY });

		writeAuditLog(c, {
			tenantId: orgId,
			eventType: 'auth.login',
			actorId: userRow.id as string,
			actorType: 'user',
			action: 'login.linkedin',
			result: 'success',
			details: { email: profile.email, linkedinId: profile.sub },
			complianceCategory: 'authentication',
		}).catch(() => {});

		const payload = await buildUserPayload(c, userRow, orgId, tenantIds, profile.email, profile.name);
		return buildAuthSessionRedirect(c, jwt, payload);
	} catch (error) {
		console.error('LinkedIn callback error:', error);
		return c.redirect(
			`${frontendUrl}/auth/callback?error=${encodeURIComponent('LinkedIn sign-in failed. Please try again.')}`,
		);
	}
}

interface LinkedInTokens {
	access_token: string;
	expires_in: number;
	scope?: string;
	id_token?: string;
}

async function exchangeCodeForTokens(c: Context<AppEnv>, code: string): Promise<LinkedInTokens> {
	const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback/linkedin`;
	const resp = await fetch(LINKEDIN.TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			client_id: c.env.LINKEDIN_CLIENT_ID!,
			client_secret: c.env.LINKEDIN_CLIENT_SECRET!,
		}),
	});
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`LinkedIn token exchange failed: ${body}`);
	}
	return resp.json() as Promise<LinkedInTokens>;
}

interface LinkedInProfile {
	sub: string; // LinkedIn member ID
	email: string;
	name: string;
	picture?: string;
}

async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
	const resp = await fetch(LINKEDIN.USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!resp.ok) {
		throw new Error(`LinkedIn /userinfo failed: ${resp.status}`);
	}
	const data = (await resp.json()) as Record<string, unknown>;
	const sub = String(data.sub ?? '');
	const email = String(data.email ?? '');
	const name = String(data.name ?? '');
	if (!sub || !email) throw new Error('LinkedIn profile missing sub or email');
	return {
		sub,
		email,
		name: name || email.split('@')[0],
		picture: typeof data.picture === 'string' ? data.picture : undefined,
	};
}

async function upsertLinkedInUser(c: Context<AppEnv>, profile: LinkedInProfile) {
	const db = c.env.DB;
	// Prefer LinkedIn ID; fall back to email (users who previously signed in with MS).
	let user = await db
		.prepare('SELECT * FROM platform_users WHERE linkedin_id = ? OR email = ? LIMIT 1')
		.bind(profile.sub, profile.email)
		.first<Record<string, unknown>>();

	if (!user) {
		const orgId = genId();
		await db
			.prepare('INSERT INTO organizations (id, name, type) VALUES (?, ?, ?)')
			.bind(orgId, `${profile.name}'s Organization`, 'direct')
			.run();
		const userId = genId();
		await db
			.prepare(
				'INSERT INTO platform_users (id, organization_id, email, name, role, auth_provider, linkedin_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			)
			.bind(userId, orgId, profile.email, profile.name, 'admin', 'linkedin', profile.sub, 'active')
			.run();
		user = {
			id: userId,
			organization_id: orgId,
			email: profile.email,
			name: profile.name,
			role: 'admin',
			status: 'active',
			auth_provider: 'linkedin',
			linkedin_id: profile.sub,
		};
	} else {
		// Backfill linkedin_id on pre-existing users (e.g. MS-primary accounts)
		// so subsequent LinkedIn logins resolve via the faster linkedin_id index.
		await db
			.prepare('UPDATE platform_users SET linkedin_id = ?, last_login_at = ? WHERE id = ?')
			.bind(profile.sub, Date.now(), user.id as string)
			.run();
	}
	return user;
}
