/**
 * Cookie-or-Bearer Auth — accepts SSO `sso_session` HttpOnly cookie OR
 * delegates to existing Bearer/API-key flow. Used on /v1/sso/* admin
 * routes so dashboard SSO admin pages (which authenticate via the cookie
 * set by /v1/sso/{oidc,saml}/callback) do not require a Bearer token.
 *
 * Cookie format (set by oidc.ts / saml-callback.ts):
 *   sso_session=<sessionId>.<base64url(HMAC-SHA256(sessionId, SESSION_SECRET))>
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from './api-key-auth';

const COOKIE_NAME = 'sso_session';
const enc = new TextEncoder();

function toBuf(u: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(u.byteLength);
    new Uint8Array(out).set(u);
    return out;
}

function b64urlNoPad(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function expectedSig(sessionId: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw', toBuf(enc.encode(secret)),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, toBuf(enc.encode(sessionId))));
    return b64urlNoPad(sig);
}

function constantTimeEq(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

function readCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;
    for (const part of header.split(/;\s*/)) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        if (part.slice(0, eq) === name) return part.slice(eq + 1);
    }
    return null;
}

interface SsoSessionRow {
    user_id: string;
    org_id: string;
    expires_at: string;
}

interface UserRow {
    id: string;
    email: string | null;
    tier: string | null;
}

export const cookieOrBearerAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const cookieVal = readCookie(c.req.header('cookie'), COOKIE_NAME);

    if (cookieVal) {
        const dot = cookieVal.lastIndexOf('.');
        if (dot < 1) return c.json({ error: 'invalid_sso_session' }, 401);
        const sessionId = cookieVal.slice(0, dot);
        const sig = cookieVal.slice(dot + 1);

        const secret = c.env.SESSION_SECRET ?? c.env.JWT_SECRET;
        if (!secret) return c.json({ error: 'server_misconfigured' }, 500);

        const want = await expectedSig(sessionId, secret);
        if (!constantTimeEq(sig, want)) {
            return c.json({ error: 'invalid_sso_session' }, 401);
        }

        const session = await c.env.DB.prepare(
            `SELECT user_id, org_id, expires_at FROM sso_sessions
             WHERE id = ? AND datetime(expires_at) > datetime('now')`,
        ).bind(sessionId).first<SsoSessionRow>();

        if (!session) return c.json({ error: 'sso_session_expired' }, 401);

        const user = await c.env.DB.prepare(
            `SELECT id, email, tier FROM users WHERE id = ?`,
        ).bind(session.user_id).first<UserRow>();

        if (!user) return c.json({ error: 'user_not_found' }, 401);

        c.set('userId', user.id);
        c.set('userEmail', user.email ?? '');
        c.set('userTier', (user.tier as 'free' | 'pro' | 'enterprise') ?? 'free');
        c.set('orgId', session.org_id);
        c.set('authMethod', 'sso_cookie');
        await next();
        return;
    }

    return requireAuthOrApiKey(c, next);
});
