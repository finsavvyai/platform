/**
 * FIND-001 regression — verifies the migration declares the SAME column names
 * the runtime queries use. Pre-fix: migration was camelCase, queries were
 * snake_case → 100% DoS for SSO.
 *
 * We don't run real D1 — we string-match the migration SQL against the column
 * names asserted by oidc.ts, idp-admin.ts, jit-provisioner.ts, etc.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadMigration(): string {
    // packages/api/src/services → up two = packages/api → migrations/021_sso.sql
    const p = join(__dirname, '..', '..', 'migrations', '021_sso.sql');
    return readFileSync(p, 'utf8');
}

const REQUIRED_COLUMNS_IDP = [
    'id', 'org_id', 'type', 'name', 'enabled',
    'email_domain', 'jit_enabled', 'default_role',
    'oidc_issuer', 'oidc_client_id', 'oidc_client_secret',
    'oidc_discovery_url', 'oidc_scopes',
    'saml_entity_id', 'saml_sso_url', 'saml_certificate', 'saml_slo_url',
    'created_at', 'updated_at', 'deleted_at',
];
const REQUIRED_COLUMNS_SESSION = [
    'id', 'user_id', 'org_id', 'idp_id', 'name_id',
    'session_index', 'expires_at', 'created_at',
];

describe('FIND-001 — migration uses snake_case to match runtime queries', () => {
    const sql = loadMigration();

    it.each(REQUIRED_COLUMNS_IDP)(
        'identity_providers declares column %s (snake_case)',
        (col) => {
            // match `col TYPE` declaration; allow whitespace
            const re = new RegExp(`\\b${col}\\b\\s+(TEXT|INTEGER|BOOLEAN|TIMESTAMP)`, 'i');
            expect(sql).toMatch(re);
        },
    );

    it.each(REQUIRED_COLUMNS_SESSION)(
        'sso_sessions declares column %s (snake_case)',
        (col) => {
            const re = new RegExp(`\\b${col}\\b\\s+(TEXT|INTEGER|BOOLEAN|TIMESTAMP)`, 'i');
            expect(sql).toMatch(re);
        },
    );

    it('does NOT declare any quoted camelCase column (regression vs. pre-fix)', () => {
        expect(sql).not.toMatch(/"orgId"/);
        expect(sql).not.toMatch(/"emailDomain"/);
        expect(sql).not.toMatch(/"jitEnabled"/);
        expect(sql).not.toMatch(/"oidcIssuer"/);
        expect(sql).not.toMatch(/"samlEntityId"/);
        expect(sql).not.toMatch(/"createdAt"/);
    });

    it('declares deleted_at on identity_providers (referenced by soft-delete)', () => {
        expect(sql).toMatch(/\bdeleted_at\b\s+TEXT/i);
    });
});
