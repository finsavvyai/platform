/**
 * Public-facing error-code allow-list for SSO routes.
 *
 * FIND-009 fix: never echo internal error codes (xxe_blocked, secret_vault_*,
 * idtoken_iss_mismatch, etc.) directly to clients — they reveal which check
 * failed and accelerate forging attacks. Map every internal code through this
 * module: known-public codes pass through, everything else collapses to
 * `auth_failed` with the correlationId for log correlation.
 *
 * The full internal code is still written to logs / audit so operators can
 * triage from telemetry without leaking it to the client.
 */

/** Codes safe to echo back to the caller (no information disclosure). */
const PUBLIC_ERROR_CODES = new Set<string>([
    // Generic
    'invalid_request',
    'invalid_json',
    'validation_failed',
    'missing_params',
    'unauthorized',
    'forbidden',
    'not_found',
    'rate_limit_exceeded',

    // SSO routing / lifecycle (no detail leakage)
    'idp_not_found_or_disabled',
    'idp_not_available',
    'idp_error',
    'sp_not_configured',
    'orgId_missing',

    // SAML / OIDC public failure codes (intentionally coarse)
    'saml_validation_failed',
    'sso_callback_failed',
    'sso_initiate_failed',
    'auth_failed',

    // Specific public-safe outcomes (no oracle leakage):
    'invalid_relay',
    'no_fields_to_update',
    'identity_provider_deleted',
]);

const GENERIC_ERROR = 'auth_failed';

/** Map any internal error code to a publicly-safe one. */
export function mapInternalToPublic(internal: string | undefined | null): string {
    if (!internal) return GENERIC_ERROR;
    if (PUBLIC_ERROR_CODES.has(internal)) return internal;
    return GENERIC_ERROR;
}

/** Test-only: expose the allow-list without mutating it. */
export function publicErrorCodes(): ReadonlySet<string> {
    return PUBLIC_ERROR_CODES;
}
