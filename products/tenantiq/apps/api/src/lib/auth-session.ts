/**
 * Shared session/JWT utilities used by every OAuth provider callback.
 * Keeps the Microsoft and LinkedIn flows consistent.
 */

import * as jose from 'jose';
import type { Context } from 'hono';
import type { AppEnv } from '../app/types';
import { getRS256PrivateKey, getHS256Secret, isRS256Configured } from './jwt-keys';
import { URLS } from './constants';

export interface SessionClaims {
	sub: string;
	email: string;
	name: string;
	orgId: string;
	tenantIds: string[];
	role: string;
	scopeLevel?: 'admin' | 'personal';
}

export async function issueSessionJwt(env: AppEnv['Bindings'], claims: SessionClaims): Promise<string> {
	const body = new jose.SignJWT({ ...claims, scopeLevel: claims.scopeLevel ?? 'admin' })
		.setIssuedAt()
		.setExpirationTime('24h');

	if (isRS256Configured(env)) {
		const privateKey = await getRS256PrivateKey(env.RS256_PRIVATE_KEY!);
		return body.setProtectedHeader({ alg: 'RS256', kid: 'tenantiq-rs256-1' }).sign(privateKey);
	}
	const secret = getHS256Secret(env.JWT_SECRET);
	return body.setProtectedHeader({ alg: 'HS256' }).sign(secret);
}

export async function buildUserPayload(
	c: Context<AppEnv>,
	user: Record<string, unknown>,
	orgId: string,
	tenantIds: string[],
	email: string,
	name: string,
) {
	const org = orgId
		? await c.env.DB.prepare('SELECT created_at, billing_plan FROM organizations WHERE id = ?').bind(orgId).first()
		: null;
	const userCreatedAt = Number((user as { created_at?: number })?.created_at ?? Math.floor(Date.now() / 1000));
	const billingPlan = String((org as { billing_plan?: string })?.billing_plan ?? 'trial');
	const trialEndsAt =
		billingPlan === 'trial' || billingPlan === 'free'
			? new Date(userCreatedAt * 1000 + 14 * 86400000).toISOString()
			: null;
	return {
		id: user.id,
		email,
		name,
		role: user.role,
		status: user.status ?? 'active',
		organizationId: orgId,
		tenantIds,
		plan: billingPlan,
		trialEndsAt,
	};
}

/** Build the redirect response used by every OAuth callback (cookie + fragment delivery). */
export function buildAuthSessionRedirect(
	c: Context<AppEnv>,
	jwt: string,
	userPayload: Record<string, unknown>,
) {
	const frontendUrl = c.env.FRONTEND_URL || URLS.FRONTEND;
	const cookieHost = new URL(frontendUrl).hostname.replace(/^app\./, '');
	c.header(
		'Set-Cookie',
		`tenantiq_session=${jwt}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax; Domain=${cookieHost}`,
	);
	const userEncoded = encodeURIComponent(JSON.stringify(userPayload));
	return c.redirect(`${frontendUrl}/auth/callback#token=${jwt}&user=${userEncoded}`);
}

/** Generate a 32-char hex id from crypto random. */
export function genId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
