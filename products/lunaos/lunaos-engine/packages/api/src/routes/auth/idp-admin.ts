/**
 * IdP Admin Routes — CRUD for SSO Identity Providers (org-scoped).
 *
 * POST   /v1/sso/idp        → create IdP (201)
 * GET    /v1/sso/idp        → list IdPs for caller's org
 * GET    /v1/sso/idp/:id    → get single IdP (org-scoped)
 * PATCH  /v1/sso/idp/:id    → update IdP fields (partial)
 * DELETE /v1/sso/idp/:id    → soft-delete IdP
 *
 * All routes: requireAuthOrApiKey + requireOrgAdmin.
 *
 * FIND-003 fix: orgId is *always* sourced from the server-derived value set
 * by `requireOrgAdmin` (`c.get('orgId')`). Body/query orgId values are
 * informational at best — never used for SQL binds that affect authorization.
 *
 * FIND-009 fix: AuditAction extension makes `as never` casts unnecessary.
 */

import { Hono } from 'hono';
import type { Env } from '../../worker';
import { cookieOrBearerAuth } from '../../middleware/cookie-or-bearer-auth';
import { requireOrgAdmin } from '../../middleware/require-org-admin';
import { CreateIdpInput, UpdateIdpInput } from '../../types/sso';
import { logAuditEvent, getClientInfo } from '../../services/audit-logger';
import { createIdp, buildPatchClauses, safeIdp, type IdpVaultEnv } from '../../services/idp-service';

export const idpAdminRouter = new Hono<{ Bindings: Env }>();

/** Read the server-derived orgId set by requireOrgAdmin. Never user-supplied. */
function callerOrgId(c: { get: (k: string) => unknown }): string | undefined {
    const v = c.get('orgId');
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// ─── POST /v1/sso/idp ────────────────────────────────────────────────────────

idpAdminRouter.post('/', cookieOrBearerAuth, requireOrgAdmin, async (c) => {
    const correlationId = crypto.randomUUID();
    const orgId = callerOrgId(c);
    if (!orgId) return c.json({ error: 'orgId_missing', correlationId }, 400);

    let body: unknown;
    try { body = await c.req.json(); } catch {
        return c.json({ error: 'invalid_json', correlationId }, 400);
    }
    const parsed = CreateIdpInput.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'validation_failed', issues: parsed.error.issues, correlationId }, 400);
    }
    // FIND-003: force server-derived orgId regardless of body content.
    const input = { ...parsed.data, orgId };

    const id = await createIdp(c.env.DB, c.env as unknown as IdpVaultEnv, input);
    const row = await c.env.DB.prepare(
        'SELECT * FROM identity_providers WHERE id = ? AND org_id = ?',
    ).bind(id, orgId).first<Record<string, unknown>>();

    logAuditEvent(c.env.DB, {
        action: 'sso.idp.created',
        userId: c.get('userId'),
        resourceId: id, resourceType: 'identity_provider',
        metadata: { orgId, type: input.type, name: input.name },
        ...getClientInfo(c),
    }).catch(() => {});

    return c.json({ idp: await safeIdp(row!) }, 201);
});

// ─── GET /v1/sso/idp ─────────────────────────────────────────────────────────

idpAdminRouter.get('/', cookieOrBearerAuth, requireOrgAdmin, async (c) => {
    const correlationId = crypto.randomUUID();
    const orgId = callerOrgId(c);
    if (!orgId) return c.json({ error: 'orgId_missing', correlationId }, 400);

    const result = await c.env.DB.prepare(
        `SELECT * FROM identity_providers WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    ).bind(orgId).all<Record<string, unknown>>();

    const idps = await Promise.all((result.results ?? []).map(safeIdp));
    return c.json({ idps });
});

// ─── GET /v1/sso/idp/:id ─────────────────────────────────────────────────────

idpAdminRouter.get('/:id', cookieOrBearerAuth, requireOrgAdmin, async (c) => {
    const correlationId = crypto.randomUUID();
    const orgId = callerOrgId(c);
    if (!orgId) return c.json({ error: 'orgId_missing', correlationId }, 400);

    const row = await c.env.DB.prepare(
        `SELECT * FROM identity_providers WHERE id = ? AND org_id = ? AND deleted_at IS NULL`,
    ).bind(c.req.param('id'), orgId).first<Record<string, unknown>>();

    if (!row) return c.json({ error: 'not_found', correlationId }, 404);
    return c.json({ idp: await safeIdp(row) });
});

// ─── PATCH /v1/sso/idp/:id ───────────────────────────────────────────────────

idpAdminRouter.patch('/:id', cookieOrBearerAuth, requireOrgAdmin, async (c) => {
    const correlationId = crypto.randomUUID();
    const orgId = callerOrgId(c);
    if (!orgId) return c.json({ error: 'orgId_missing', correlationId }, 400);

    const idpId = c.req.param('id');
    let body: unknown;
    try { body = await c.req.json(); } catch {
        return c.json({ error: 'invalid_json', correlationId }, 400);
    }
    const parsed = UpdateIdpInput.safeParse(body);
    if (!parsed.success) {
        return c.json({ error: 'validation_failed', issues: parsed.error.issues, correlationId }, 400);
    }

    const existing = await c.env.DB.prepare(
        `SELECT id FROM identity_providers WHERE id = ? AND org_id = ? AND deleted_at IS NULL`,
    ).bind(idpId, orgId).first<{ id: string }>();
    if (!existing) return c.json({ error: 'not_found', correlationId }, 404);

    const { sets, vals, diffFields } = await buildPatchClauses(c.env as unknown as IdpVaultEnv, parsed.data);
    if (sets.length === 0) return c.json({ error: 'no_fields_to_update', correlationId }, 400);

    sets.push('updated_at = ?');
    vals.push(new Date().toISOString(), idpId);
    await c.env.DB.prepare(
        `UPDATE identity_providers SET ${sets.join(', ')} WHERE id = ?`,
    ).bind(...vals).run();

    const updated = await c.env.DB.prepare(
        'SELECT * FROM identity_providers WHERE id = ? AND org_id = ?',
    ).bind(idpId, orgId).first<Record<string, unknown>>();

    logAuditEvent(c.env.DB, {
        action: 'sso.idp.updated',
        userId: c.get('userId'),
        resourceId: idpId, resourceType: 'identity_provider',
        metadata: { orgId, updatedFields: diffFields },
        ...getClientInfo(c),
    }).catch(() => {});

    return c.json({ idp: await safeIdp(updated!) });
});

// ─── DELETE /v1/sso/idp/:id ──────────────────────────────────────────────────

idpAdminRouter.delete('/:id', cookieOrBearerAuth, requireOrgAdmin, async (c) => {
    const correlationId = crypto.randomUUID();
    const orgId = callerOrgId(c);
    if (!orgId) return c.json({ error: 'orgId_missing', correlationId }, 400);

    const idpId = c.req.param('id');
    const row = await c.env.DB.prepare(
        `SELECT id FROM identity_providers WHERE id = ? AND org_id = ?`,
    ).bind(idpId, orgId).first<{ id: string }>();
    if (!row) return c.json({ error: 'not_found', correlationId }, 404);

    const now = new Date().toISOString();
    await c.env.DB.prepare(
        `UPDATE identity_providers SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    ).bind(now, now, idpId).run();

    logAuditEvent(c.env.DB, {
        action: 'sso.idp.deleted',
        userId: c.get('userId'),
        resourceId: idpId, resourceType: 'identity_provider',
        metadata: { orgId },
        ...getClientInfo(c),
    }).catch(() => {});

    return c.json({ message: 'identity_provider_deleted', id: idpId });
});
