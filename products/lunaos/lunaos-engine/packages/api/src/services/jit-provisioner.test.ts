/**
 * JIT Provisioner — just-in-time SSO user provisioning.
 * Known gap: users table missing org_id/role/provisioned_via columns at runtime.
 * All DB calls are mocked; integration tests with live DB are skipped with TODO.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionUser, type JitInput } from './jit-provisioner';

// ─── Mock audit-logger so tests don't need a real DB ─────────────────────────

vi.mock('./audit-logger', () => ({
    logAuditEvent: vi.fn(async () => {}),
}));

// ─── DB mock helpers ──────────────────────────────────────────────────────────

function makeDbMock(existingUser: Record<string, unknown> | null = null) {
    const firstMock = vi.fn(async () => existingUser);
    const runMock = vi.fn(async () => ({}));
    const prepareMock = vi.fn(() => ({
        bind: vi.fn(() => ({
            first: firstMock,
            run: runMock,
        })),
    }));
    return { prepare: prepareMock, _firstMock: firstMock, _runMock: runMock };
}

function makeEnv(db: ReturnType<typeof makeDbMock>) {
    return {
        DB: db,
        JWT_SECRET: 'test',
        KV: {},
    } as unknown as Parameters<typeof provisionUser>[0];
}

const BASE_INPUT: JitInput = {
    email: 'Alice@acme.com',
    name: 'Alice',
    orgId: 'org-1',
    defaultRole: 'member',
    emailDomain: 'acme.com',
    jitEnabled: true,
    idpId: 'idp-1',
};

// ─── Guard: jitEnabled=false ──────────────────────────────────────────────────

describe('provisionUser — JIT disabled guard', () => {
    it('throws jit_disabled when jitEnabled=false', async () => {
        const db = makeDbMock();
        const env = makeEnv(db);
        await expect(provisionUser(env, { ...BASE_INPUT, jitEnabled: false })).rejects.toThrow('jit_disabled');
        expect(db.prepare).not.toHaveBeenCalled();
    });
});

// ─── Email domain enforcement ─────────────────────────────────────────────────

describe('provisionUser — emailDomain enforcement', () => {
    it('throws email_domain_mismatch when email domain differs from configured domain', async () => {
        const db = makeDbMock(null);
        const env = makeEnv(db);
        await expect(
            provisionUser(env, { ...BASE_INPUT, email: 'user@other.com', emailDomain: 'acme.com' }),
        ).rejects.toThrow('email_domain_mismatch');
    });

    it('domain check is case-insensitive', async () => {
        const db = makeDbMock(null);
        const existing = {
            id: 'u1', email: 'bob@acme.com', name: 'Bob', tier: 'free', org_id: 'org-1', role: 'member',
        };
        db.prepare.mockReturnValue({ bind: vi.fn(() => ({ first: vi.fn(async () => existing), run: vi.fn() })) });
        const env = makeEnv(db);
        // EMAIL domain is ACME.COM (uppercase) — should match emailDomain=acme.com
        const result = await provisionUser(env, { ...BASE_INPUT, email: 'Bob@ACME.COM', emailDomain: 'acme.com' });
        expect(result.email).toBe('bob@acme.com');
    });

    it('skips domain check when emailDomain is null', async () => {
        const db = makeDbMock(null);
        // Should proceed to INSERT — we let it succeed
        db.prepare.mockReturnValue({
            bind: vi.fn(() => ({ first: vi.fn(async () => null), run: vi.fn(async () => ({})) })),
        });
        const env = makeEnv(db);
        // Should not throw domain mismatch
        const result = await provisionUser(env, { ...BASE_INPUT, emailDomain: null, email: 'any@whatever.org' });
        expect(result.created).toBe(true);
    });
});

// ─── Email format validation ──────────────────────────────────────────────────

describe('provisionUser — email validation', () => {
    it('throws email_invalid for address without @', async () => {
        const db = makeDbMock();
        const env = makeEnv(db);
        await expect(
            provisionUser(env, { ...BASE_INPUT, email: 'noemail', emailDomain: null }),
        ).rejects.toThrow('email_invalid');
    });

    it('throws email_invalid for empty string', async () => {
        const db = makeDbMock();
        const env = makeEnv(db);
        await expect(
            provisionUser(env, { ...BASE_INPUT, email: '', emailDomain: null }),
        ).rejects.toThrow('email_invalid');
    });
});

// ─── Existing user — idempotent return ───────────────────────────────────────

describe('provisionUser — existing user (idempotent)', () => {
    it('returns existing user without INSERT', async () => {
        const existingUser = {
            id: 'user-abc', email: 'alice@acme.com', name: 'Alice', tier: 'pro',
            org_id: 'org-1', role: 'admin',
        };
        const db = makeDbMock(existingUser);
        const env = makeEnv(db);
        const result = await provisionUser(env, BASE_INPUT);
        expect(result.id).toBe('user-abc');
        expect(result.created).toBe(false);
        expect(result.role).toBe('admin');
        expect(result.tier).toBe('pro');
        // No INSERT should have run
        const runCalls = db.prepare.mock.results.flatMap((r) => {
            const stmts = r.value?.bind?.mock?.results ?? [];
            return stmts.flatMap((s: any) => s.value?.run?.mock?.calls ?? []);
        });
        expect(runCalls.length).toBe(0);
    });

    it('uses defaultRole if existing user has null role', async () => {
        const existingUser = {
            id: 'u2', email: 'alice@acme.com', name: 'Alice', tier: 'free',
            org_id: 'org-1', role: null,
        };
        const db = makeDbMock(existingUser);
        const env = makeEnv(db);
        const result = await provisionUser(env, BASE_INPUT);
        expect(result.role).toBe('member');
    });

    it('lowercases the incoming email for lookup', async () => {
        const db = makeDbMock(null);
        db.prepare.mockReturnValue({
            bind: vi.fn((orgId: string, email: string) => {
                expect(email).toBe('alice@acme.com');
                return { first: vi.fn(async () => null), run: vi.fn(async () => ({})) };
            }),
        });
        const env = makeEnv(db);
        await provisionUser(env, { ...BASE_INPUT, email: 'ALICE@ACME.COM' });
    });
});

// ─── New user — JIT INSERT ────────────────────────────────────────────────────

describe('provisionUser — new user creation', () => {
    /**
     * TODO(SSO-schema-gap): users table missing org_id/role/provisioned_via columns.
     * The following tests mock the DB. Integration tests against live D1 are
     * skipped until migrations/021_add_sso_user_columns.sql is applied.
     */

    it('creates new user with created=true', async () => {
        const db = makeDbMock(null);
        const runMock = vi.fn(async () => ({}));
        db.prepare.mockReturnValue({
            bind: vi.fn(() => ({ first: vi.fn(async () => null), run: runMock })),
        });
        const env = makeEnv(db);
        const result = await provisionUser(env, BASE_INPUT);
        expect(result.created).toBe(true);
        expect(result.email).toBe('alice@acme.com');
        expect(result.role).toBe('member');
        expect(result.tier).toBe('free');
        expect(result.orgId).toBe('org-1');
    });

    it('new user INSERT includes provisioned_via=sso and org_id in the query', async () => {
        const db = makeDbMock(null);
        let capturedSql = '';
        let capturedBindArgs: unknown[] = [];
        db.prepare.mockImplementation((sql: string) => ({
            bind: vi.fn((...args: unknown[]) => {
                capturedSql = sql;
                capturedBindArgs = args;
                return { first: vi.fn(async () => null), run: vi.fn(async () => ({})) };
            }),
        }));
        // On first call (SELECT) return null
        let callCount = 0;
        db.prepare.mockImplementation((sql: string) => {
            callCount++;
            return {
                bind: vi.fn((...args: unknown[]) => {
                    if (callCount === 1) {
                        // SELECT
                        return { first: vi.fn(async () => null), run: vi.fn() };
                    }
                    // INSERT
                    capturedSql = sql;
                    capturedBindArgs = args;
                    return { first: vi.fn(), run: vi.fn(async () => ({})) };
                }),
            };
        });
        const env = makeEnv(db);
        await provisionUser(env, BASE_INPUT);
        expect(capturedSql).toContain('provisioned_via');
        expect(capturedSql).toContain('org_id');
    });
});
