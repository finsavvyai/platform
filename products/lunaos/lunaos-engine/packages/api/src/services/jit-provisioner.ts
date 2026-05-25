/**
 * JIT Provisioner — Just-in-Time user provisioning for SSO logins.
 *
 * Idempotent: looks up by (orgId, email lowercase); creates only if missing.
 * Honors per-IdP `jitEnabled` and `emailDomain` (case-insensitive match).
 *
 * Errors thrown (caller maps to structured response with correlationId):
 *   - 'jit_disabled'
 *   - 'email_domain_mismatch'
 *   - 'email_invalid'
 *
 * Schema dependency:
 *   The columns `org_id`, `role`, and `provisioned_via` are added by
 *   migrations/022_users_sso_columns.sql (Phase 3.1 fix). Run that
 *   migration before the SSO routes are exercised against real D1.
 */
import type { Env } from '../worker';
import { logAuditEvent } from './audit-logger';

export interface JitInput {
    email: string;
    name?: string;
    orgId: string;
    defaultRole: string;
    emailDomain?: string | null;
    jitEnabled: boolean;
    idpId: string;
}

export interface JitUser {
    id: string;
    email: string;
    name: string;
    orgId: string;
    role: string;
    tier: string;
    created: boolean;
}

function emailDomainOf(email: string): string {
    const idx = email.lastIndexOf('@');
    if (idx < 0 || idx === email.length - 1) return '';
    return email.slice(idx + 1).toLowerCase();
}

/**
 * Find or JIT-provision a user. Idempotent on (orgId, email).
 */
export async function provisionUser(env: Env, input: JitInput): Promise<JitUser> {
    if (!input.jitEnabled) throw new Error('jit_disabled');

    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('email_invalid');

    if (input.emailDomain) {
        const want = input.emailDomain.toLowerCase();
        if (emailDomainOf(email) !== want) throw new Error('email_domain_mismatch');
    }

    // Case-insensitive lookup: stored emails are lowercased on insert.
    const existing = await env.DB.prepare(
        'SELECT id, email, name, tier, org_id, role FROM users WHERE org_id = ? AND email = ? LIMIT 1',
    ).bind(input.orgId, email).first<{
        id: string; email: string; name: string | null; tier: string;
        org_id: string; role: string | null;
    }>();

    if (existing) {
        return {
            id: existing.id,
            email: existing.email,
            name: existing.name ?? '',
            orgId: existing.org_id,
            role: existing.role ?? input.defaultRole,
            tier: existing.tier,
            created: false,
        };
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    // password_hash empty: SSO users authenticate via SsoSession, not password.
    await env.DB.prepare(
        `INSERT INTO users
         (id, email, name, password_hash, tier, org_id, role, provisioned_via, created_at, updated_at)
         VALUES (?, ?, ?, '', 'free', ?, ?, 'sso', ?, ?)`,
    ).bind(
        userId, email, input.name ?? '', input.orgId, input.defaultRole, now, now,
    ).run();

    // Audit — non-blocking. AuditAction now includes 'user.provisioned_via_sso'
    // so no `as never` cast is needed (Phase-3.1 fix to audit-logger.ts).
    await logAuditEvent(env.DB, {
        action: 'user.provisioned_via_sso',
        userId,
        resourceType: 'identity_provider',
        resourceId: input.idpId,
        metadata: { orgId: input.orgId, email, idpId: input.idpId, role: input.defaultRole },
    }).catch(() => { });

    return {
        id: userId,
        email,
        name: input.name ?? '',
        orgId: input.orgId,
        role: input.defaultRole,
        tier: 'free',
        created: true,
    };
}
