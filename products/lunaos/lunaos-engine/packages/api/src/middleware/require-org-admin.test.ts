/**
 * requireOrgAdmin middleware — RBAC guard for org-admin/owner role.
 * Verifies: missing userId → 401, non-member → 403, member → 403,
 * admin/owner → passes through; orgId resolution from path, body, query.
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { requireOrgAdmin } from './require-org-admin';

// ─── App factory ─────────────────────────────────────────────────────────────

type TestEnv = {
    Bindings: { DB: any; JWT_SECRET: string; KV: any };
    Variables: { userId?: string };
};

function makeApp(dbQueryResult: { role: string } | null = null) {
    const prepareMock = vi.fn(() => ({
        bind: vi.fn(() => ({
            first: vi.fn(async () => dbQueryResult),
        })),
    }));

    const app = new Hono<TestEnv>();
    const mockEnv = {
        DB: { prepare: prepareMock },
        JWT_SECRET: 'test',
        KV: {},
    };

    app.use('*', async (c, next) => {
        // Allow tests to inject userId via X-Test-UserId header
        const testUserId = c.req.header('X-Test-UserId');
        if (testUserId) c.set('userId', testUserId);
        await next();
    });

    app.post('/orgs/:orgId/test', requireOrgAdmin, (c) => c.json({ ok: true }));
    app.post('/no-param-test', requireOrgAdmin, (c) => c.json({ ok: true }));
    app.get('/orgs/:orgId/read', requireOrgAdmin, (c) => c.json({ ok: true }));

    return { app, prepareMock, mockEnv };
}

async function req(
    app: Hono<TestEnv>,
    env: object,
    method: string,
    path: string,
    opts: { userId?: string; body?: object; contentType?: string } = {},
) {
    const headers: Record<string, string> = {};
    if (opts.userId) headers['X-Test-UserId'] = opts.userId;
    if (opts.body) headers['Content-Type'] = opts.contentType ?? 'application/json';

    return app.request(
        path,
        {
            method,
            headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        },
        env,
    );
}

// ─── 401: no userId ───────────────────────────────────────────────────────────

describe('requireOrgAdmin — no userId → 401', () => {
    it('returns 401 when userId is not set in context', async () => {
        const { app, mockEnv } = makeApp(null);
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test');
        expect(res.status).toBe(401);
        const body = await res.json() as any;
        expect(body.error).toBe('unauthorized');
    });
});

// ─── 400: orgId missing ───────────────────────────────────────────────────────

describe('requireOrgAdmin — missing orgId → 400', () => {
    it('returns 400 when no orgId in path and no body', async () => {
        const { app, mockEnv } = makeApp({ role: 'admin' });
        const res = await req(app, mockEnv, 'POST', '/no-param-test', { userId: 'user-1' });
        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.reason).toBe('orgId_missing');
    });
});

// ─── 403: not a member ────────────────────────────────────────────────────────

describe('requireOrgAdmin — not in org → 403', () => {
    it('returns 403 when no team_members row found', async () => {
        const { app, mockEnv } = makeApp(null);
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test', {
            userId: 'user-1',
            body: { orgId: 'org-1' },
        });
        expect(res.status).toBe(403);
        const body = await res.json() as any;
        expect(body.error).toBe('forbidden');
        expect(body.reason).toBe('org_admin_required');
    });

    it('returns 403 when user has role=member', async () => {
        const { app, mockEnv } = makeApp({ role: 'member' });
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test', {
            userId: 'user-1',
            body: { orgId: 'org-1' },
        });
        expect(res.status).toBe(403);
    });

    it('returns 403 when user has role=viewer', async () => {
        const { app, mockEnv } = makeApp({ role: 'viewer' });
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test', {
            userId: 'user-1',
            body: { orgId: 'org-1' },
        });
        expect(res.status).toBe(403);
    });
});

// ─── 200: admin / owner roles pass through ────────────────────────────────────

describe('requireOrgAdmin — admin / owner roles → pass through', () => {
    it('passes through for role=admin', async () => {
        const { app, mockEnv } = makeApp({ role: 'admin' });
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test', {
            userId: 'user-1',
            body: { orgId: 'org-1' },
        });
        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.ok).toBe(true);
    });

    it('passes through for role=owner', async () => {
        const { app, mockEnv } = makeApp({ role: 'owner' });
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test', {
            userId: 'user-1',
            body: { orgId: 'org-1' },
        });
        expect(res.status).toBe(200);
    });
});

// ─── orgId resolution — server-derived only (FIND-003) ───────────────────────

describe('requireOrgAdmin — server-derived orgId (FIND-003)', () => {
    it('uses path param :orgId, not body, for the role check bind', async () => {
        const { app, mockEnv, prepareMock } = makeApp({ role: 'admin' });
        const res = await req(app, mockEnv, 'POST', '/orgs/org-from-path/test', {
            userId: 'user-1',
            // Attacker tries to coerce a different org via body — must be rejected.
            body: { orgId: 'org-attacker' },
        });
        // FIND-003: middleware refuses mismatched body orgId with 403.
        expect(res.status).toBe(403);
    });

    it('passes when path orgId matches body orgId (informational only)', async () => {
        const { app, mockEnv, prepareMock } = makeApp({ role: 'owner' });
        const res = await req(app, mockEnv, 'POST', '/orgs/org-1/test', {
            userId: 'user-1',
            body: { orgId: 'org-1' },
        });
        expect(res.status).toBe(200);
        // Verify the SQL bind for role check used the SERVER-DERIVED org
        // (path param), not the body. The role-check is the LAST prepare()
        // call in the middleware (after possible IdP lookup, fallback, etc.).
        const calls = prepareMock.mock.results.map((r: any) => r?.value?.bind?.mock?.calls?.[0])
            .filter(Boolean);
        const last = calls[calls.length - 1];
        expect(last?.[0]).toBe('org-1');
        expect(last?.[1]).toBe('user-1');
    });

    it('falls back to caller primary admin org when no path/body orgId', async () => {
        // Two prepare results: first = team_members lookup (returns team_id),
        // second = role check with derived orgId.
        const adminLookupMock = vi.fn(async () => ({ team_id: 'org-derived' }));
        const roleMock = vi.fn(async () => ({ role: 'admin' }));
        let n = 0;
        const prepareMock = vi.fn(() => ({
            bind: vi.fn(() => ({
                first: n++ === 0 ? adminLookupMock : roleMock,
            })),
        }));
        const env = { DB: { prepare: prepareMock }, JWT_SECRET: 't', KV: {} };
        const app = new Hono<TestEnv>();
        app.use('*', async (c, next) => {
            const u = c.req.header('X-Test-UserId');
            if (u) c.set('userId', u);
            await next();
        });
        app.post('/no-param-test', requireOrgAdmin, (c) => c.json({ ok: true, orgId: c.get('orgId' as 'userId') }));

        const res = await app.request('/no-param-test', {
            method: 'POST', headers: { 'X-Test-UserId': 'user-1' },
        }, env);
        expect(res.status).toBe(200);
    });
});
