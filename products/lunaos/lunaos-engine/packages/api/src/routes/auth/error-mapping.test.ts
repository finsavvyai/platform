/**
 * error-mapping — FIND-009 fix verification.
 *
 * Internal SSO error codes (xxe_blocked, idtoken_iss_mismatch, secret_vault_*,
 * etc.) MUST NOT be echoed to the client. Only allow-listed public codes
 * pass through; everything else collapses to a generic 'auth_failed'.
 */
import { describe, it, expect } from 'vitest';
import { mapInternalToPublic, publicErrorCodes } from './error-mapping';

describe('mapInternalToPublic — FIND-009 redaction', () => {
    it('passes allow-listed public codes through', () => {
        expect(mapInternalToPublic('saml_validation_failed')).toBe('saml_validation_failed');
        expect(mapInternalToPublic('sso_callback_failed')).toBe('sso_callback_failed');
        expect(mapInternalToPublic('idp_not_found_or_disabled')).toBe('idp_not_found_or_disabled');
        expect(mapInternalToPublic('rate_limit_exceeded')).toBe('rate_limit_exceeded');
    });

    it('redacts internal SAML error codes to generic auth_failed', () => {
        expect(mapInternalToPublic('xxe_blocked')).toBe('auth_failed');
        expect(mapInternalToPublic('xsw_reference_mismatch')).toBe('auth_failed');
        expect(mapInternalToPublic('digest_mismatch')).toBe('auth_failed');
        expect(mapInternalToPublic('signature_invalid')).toBe('auth_failed');
        expect(mapInternalToPublic('replay_detected')).toBe('auth_failed');
        expect(mapInternalToPublic('audience_mismatch')).toBe('auth_failed');
        expect(mapInternalToPublic('encrypted_assertion_unsupported')).toBe('auth_failed');
        expect(mapInternalToPublic('inclusive_namespaces_unsupported')).toBe('auth_failed');
    });

    it('redacts internal OIDC error codes to generic auth_failed', () => {
        expect(mapInternalToPublic('idtoken_iss_mismatch')).toBe('auth_failed');
        expect(mapInternalToPublic('idtoken_aud_mismatch')).toBe('auth_failed');
        expect(mapInternalToPublic('idtoken_alg_rejected')).toBe('auth_failed');
        expect(mapInternalToPublic('idtoken_iat_too_old')).toBe('auth_failed');
        expect(mapInternalToPublic('idtoken_not_yet_valid')).toBe('auth_failed');
        expect(mapInternalToPublic('state_bad_sig')).toBe('auth_failed');
        expect(mapInternalToPublic('state_expired')).toBe('auth_failed');
    });

    it('redacts secret-vault internal codes (highest sensitivity)', () => {
        expect(mapInternalToPublic('secret_vault_tamper')).toBe('auth_failed');
        expect(mapInternalToPublic('secret_vault_missing_key')).toBe('auth_failed');
        expect(mapInternalToPublic('secret_vault_format')).toBe('auth_failed');
    });

    it('handles null / undefined / empty defensively', () => {
        expect(mapInternalToPublic(null)).toBe('auth_failed');
        expect(mapInternalToPublic(undefined)).toBe('auth_failed');
        expect(mapInternalToPublic('')).toBe('auth_failed');
    });

    it('publicErrorCodes is a non-empty read-only set', () => {
        const codes = publicErrorCodes();
        expect(codes.size).toBeGreaterThan(5);
        expect(codes.has('saml_validation_failed')).toBe(true);
        expect(codes.has('xxe_blocked')).toBe(false);
    });
});
