/**
 * SAML 2.0 SP routes for lunaos-engine.
 * KV: saml:relay:{token}, saml:authnreq:{id}, saml:resp:{id}.
 * Errors → 400 + correlationId only; never echo XML/IdP detail.
 *
 * The callback handler is split into ./saml-callback to keep both files ≤200
 * lines (FIND-002, FIND-009 fixes live in saml-callback.ts).
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../worker';
import { SamlProvider } from '../../services/saml-provider';
import {
    loadIdp,
    randomToken,
    base64Encode,
    sanitiseReturnPath,
    RELAY_TTL,
    AUTHNREQ_TTL,
} from './saml-helpers';
import { handleSamlCallback } from './saml-callback';

type Bindings = Env & {
    SP_ENTITY_ID?: string;
    SP_ACS_URL?: string;
    SAML_BINDING?: string;
    SESSION_SECRET?: string;
};

export const samlRouter = new Hono<{ Bindings: Bindings }>();

// ─── Initiate ────────────────────────────────────────────────────────────────

const InitiateBody = z.object({
    idpId: z.string().min(1).max(64),
    returnPath: z.string().max(512).optional(),
});

samlRouter.post('/v1/sso/saml/initiate', async (c) => {
    const correlationId = crypto.randomUUID();
    let parsed: z.infer<typeof InitiateBody>;
    try {
        parsed = InitiateBody.parse(await c.req.json());
    } catch {
        return c.json({ error: 'invalid_request', correlationId }, 400);
    }

    const idp = await loadIdp(c.env.DB, parsed.idpId);
    if (!idp || idp.type !== 'saml' || !idp.enabled) {
        return c.json({ error: 'idp_not_available', correlationId }, 400);
    }
    const spEntityId = c.env.SP_ENTITY_ID || 'lunaos.ai';
    const spAcsUrl = c.env.SP_ACS_URL;
    if (!spAcsUrl) return c.json({ error: 'sp_not_configured', correlationId }, 500);

    const provider = new SamlProvider();
    const requestId = `_${crypto.randomUUID()}`;
    const xml = provider.buildAuthnRequest(idp, requestId, spEntityId, spAcsUrl);
    const samlRequestB64 = base64Encode(new TextEncoder().encode(xml));

    const relayToken = randomToken(16);
    const safeReturn = sanitiseReturnPath(parsed.returnPath);

    await c.env.KV.put(
        `saml:relay:${relayToken}`,
        JSON.stringify({
            idpId: idp.id,
            returnPath: safeReturn,
            requestId,
            exp: Date.now() + RELAY_TTL * 1000,
        }),
        { expirationTtl: RELAY_TTL },
    );
    await c.env.KV.put(`saml:authnreq:${requestId}`, '1', { expirationTtl: AUTHNREQ_TTL });

    if ((c.env.SAML_BINDING || 'REDIRECT').toUpperCase() === 'POST') {
        return c.json({
            method: 'POST',
            url: idp.samlSsoUrl,
            params: { SAMLRequest: samlRequestB64, RelayState: relayToken },
        });
    }
    const sep = (idp.samlSsoUrl || '').includes('?') ? '&' : '?';
    const redirectUrl = `${idp.samlSsoUrl}${sep}SAMLRequest=${encodeURIComponent(samlRequestB64)}&RelayState=${encodeURIComponent(relayToken)}`;
    return c.json({ method: 'GET', redirectUrl });
});

// ─── Callback (ACS) — delegated to ./saml-callback ───────────────────────────

samlRouter.post('/v1/sso/saml/callback', handleSamlCallback);
