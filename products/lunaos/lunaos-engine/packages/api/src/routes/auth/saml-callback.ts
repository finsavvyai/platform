/**
 * SAML callback (ACS) handler — split from saml.ts to keep both files ≤200 lines.
 *
 * FIND-002 fix: builds a typed JitInput and passes jitEnabled/emailDomain.
 * FIND-009 fix: client-facing errors mapped to public allow-list; raw codes
 *   only enter audit/log.
 */

import type { Context } from 'hono';
import { SamlProvider, type SamlEnv } from '../../services/saml-provider';
import { SamlError } from '../../services/saml-xml';
import { logAuditEvent, getClientInfo } from '../../services/audit-logger';
import { provisionUser, type JitInput } from '../../services/jit-provisioner';
import { mapInternalToPublic } from './error-mapping';
import {
    loadIdp,
    sanitiseReturnPath,
    safeJsonParse,
    signCookieValue,
    SESSION_TTL_SECONDS,
} from './saml-helpers';

export async function handleSamlCallback(c: Context<any>) {
    const correlationId = crypto.randomUUID();
    const client = getClientInfo(c);
    const form = await c.req.parseBody().catch(() => null);
    if (!form) return c.json({ error: 'invalid_request', correlationId }, 400);
    const samlResponse = typeof form.SAMLResponse === 'string' ? form.SAMLResponse : '';
    const relayState = typeof form.RelayState === 'string' ? form.RelayState : '';
    if (!samlResponse || !relayState || relayState.length > 80) {
        return c.json({ error: 'invalid_request', correlationId }, 400);
    }

    const relayKey = `saml:relay:${relayState}`;
    const relayRaw = await c.env.KV.get(relayKey);
    if (!relayRaw) return c.json({ error: 'invalid_relay', correlationId }, 400);
    await c.env.KV.delete(relayKey);
    const relay = safeJsonParse(relayRaw);
    if (!relay || !relay.idpId || !relay.requestId) {
        return c.json({ error: 'invalid_relay', correlationId }, 400);
    }

    const idp = await loadIdp(c.env.DB, relay.idpId);
    if (!idp || idp.type !== 'saml' || !idp.enabled) {
        return c.json({ error: 'idp_not_available', correlationId }, 400);
    }

    const provider = new SamlProvider();
    const samlEnv: SamlEnv = {
        KV: c.env.KV,
        SP_ENTITY_ID: c.env.SP_ENTITY_ID,
        SP_ACS_URL: c.env.SP_ACS_URL,
    };
    let assertion;
    try {
        assertion = await provider.parseAndVerifyResponse(
            idp, samlResponse, relay.requestId, samlEnv,
        );
    } catch (err) {
        const code = err instanceof SamlError ? err.code : 'saml_failed';
        await logAuditEvent(c.env.DB, {
            action: 'auth.login_failed',
            metadata: { correlationId, reason: code, idpId: idp.id },
            ...client,
        });
        return c.json(
            { error: mapInternalToPublic('saml_validation_failed'), correlationId },
            400,
        );
    }

    // FIND-002: typed JitInput passes jitEnabled + emailDomain.
    const jitInput: JitInput = {
        email: assertion.email,
        name: assertion.displayName ??
            `${assertion.firstName ?? ''} ${assertion.lastName ?? ''}`.trim(),
        orgId: idp.orgId,
        defaultRole: idp.defaultRole,
        emailDomain: idp.emailDomain ?? undefined,
        jitEnabled: idp.jitEnabled,
        idpId: idp.id,
    };
    let user;
    try {
        user = await provisionUser(c.env, jitInput);
    } catch (e) {
        const reason = e instanceof Error ? e.message : 'jit_failed';
        await logAuditEvent(c.env.DB, {
            action: 'auth.login_failed',
            metadata: { correlationId, reason, idpId: idp.id },
            ...client,
        });
        return c.json(
            { error: mapInternalToPublic('saml_validation_failed'), correlationId },
            400,
        );
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await c.env.DB.prepare(
        `INSERT INTO sso_sessions (id, user_id, org_id, idp_id, name_id, session_index, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
        sessionId, user.id, idp.orgId, idp.id, assertion.nameId,
        assertion.sessionIndex || null,
        expiresAt.toISOString(), new Date().toISOString(),
    ).run();

    const sessionSecret = c.env.SESSION_SECRET || c.env.JWT_SECRET;
    const cookieValue = await signCookieValue(sessionId, sessionSecret);

    await logAuditEvent(c.env.DB, {
        action: 'auth.login',
        userId: user.id,
        resourceId: idp.id,
        resourceType: 'identity_provider',
        metadata: { method: 'saml', correlationId, sessionId },
        ...client,
    });

    const safeReturn = sanitiseReturnPath(relay.returnPath);
    c.header(
        'Set-Cookie',
        `sso_session=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
    );
    return c.redirect(safeReturn, 302);
}
