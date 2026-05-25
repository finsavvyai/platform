/**
 * Require Org Admin Middleware — enforces caller has admin or owner role
 * for the target orgId.
 *
 * FIND-003 fix: never trust caller-supplied orgId for security decisions.
 * Sources of truth (in priority order):
 *   1. URL path param `:orgId` — verified by joining team_members in a
 *      single query: caller must be admin/owner of THAT path's org.
 *   2. URL path param `:id` (an IdP id) — server-derives the orgId from
 *      `identity_providers.org_id WHERE id = ?`. Caller's role is then
 *      verified for that derived orgId.
 *   3. Otherwise — server-derives the caller's primary admin/owner org from
 *      `team_members WHERE user_id = ? AND role IN ('owner','admin') LIMIT 1`.
 *      The body's `orgId`, if any, must equal the derived one or 403.
 *
 * Body / query orgId values are NEVER used for the SQL bind that drives the
 * authorization decision. The derived orgId is exposed to handlers via
 * `c.set('orgId', derived)` for downstream queries.
 *
 * Role table: team_members (team_id = orgId, user_id, role)
 * Allowed roles: 'owner', 'admin'
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export const requireOrgAdmin = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const userId = c.get('userId');
        if (!userId) {
            const correlationId = crypto.randomUUID();
            return c.json({ error: 'unauthorized', correlationId }, 401);
        }

        const correlationId = crypto.randomUUID();
        let derivedOrgId: string | undefined;

        // 1. Explicit path param :orgId.
        const pathOrg = c.req.param('orgId') as string | undefined;
        if (pathOrg && pathOrg.length > 0) {
            derivedOrgId = pathOrg;
        }

        // 2. IdP id path param :id → SELECT org_id FROM identity_providers.
        if (!derivedOrgId) {
            const idpId = c.req.param('id') as string | undefined;
            if (idpId && idpId.length > 0) {
                const row = await c.env.DB.prepare(
                    'SELECT org_id FROM identity_providers WHERE id = ? AND deleted_at IS NULL LIMIT 1',
                ).bind(idpId).first<{ org_id: string }>();
                if (row && row.org_id) derivedOrgId = row.org_id;
                // If the IdP doesn't exist, fall through — the route handler
                // will produce 404 against its own org-scoped query.
            }
        }

        // 3. Fall back to caller's primary admin/owner org.
        if (!derivedOrgId) {
            const row = await c.env.DB.prepare(
                `SELECT team_id FROM team_members
                 WHERE user_id = ? AND role IN ('owner','admin')
                 ORDER BY joined_at ASC LIMIT 1`,
            ).bind(userId).first<{ team_id: string }>();
            if (row && row.team_id) derivedOrgId = row.team_id;
        }

        if (!derivedOrgId) {
            return c.json(
                { error: 'bad_request', reason: 'orgId_missing', correlationId },
                400,
            );
        }

        // Reject any attempt to coerce a different orgId via body/query —
        // FIND-003: caller-supplied orgId is informational at best.
        try {
            const body = await c.req.json<{ orgId?: unknown }>().catch(() => null);
            if (body && typeof body.orgId === 'string' && body.orgId.length > 0
                && body.orgId !== derivedOrgId) {
                return c.json(
                    { error: 'forbidden', reason: 'orgId_mismatch', correlationId },
                    403,
                );
            }
        } catch { /* non-JSON / no body — fine */ }

        // Verify caller's role for the *server-derived* orgId.
        const role = await c.env.DB.prepare(
            'SELECT role FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
        ).bind(derivedOrgId, userId).first<{ role: string }>();

        if (!role || !ADMIN_ROLES.has(role.role)) {
            return c.json(
                { error: 'forbidden', reason: 'org_admin_required', correlationId },
                403,
            );
        }

        // Expose to downstream handlers — handlers MUST use this, not body.
        c.set('orgId' as 'userId', derivedOrgId);
        await next();
    },
);
