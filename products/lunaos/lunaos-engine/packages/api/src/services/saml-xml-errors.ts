/**
 * Typed SAML errors. All SAML failures throw SamlError with a stable code so
 * callers can audit-log {reason: code} without leaking detail to users.
 */

export class SamlError extends Error {
    public readonly code: string;
    constructor(code: string, message?: string) {
        super(message || code);
        this.code = code;
        this.name = 'SamlError';
    }
}
