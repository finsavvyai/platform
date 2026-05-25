import { describe, it } from "vitest";

/**
 * Documented capability gaps. These tests pass intentionally — they exist so
 * future agents inherit a machine-readable list of what this package does NOT
 * yet do. Each `it.todo` is a contract gap that belongs in a downstream
 * package or a future hardening pass.
 *
 * Do not delete a `todo` here without either implementing the capability or
 * narrowing the README claim in the same commit.
 */
describe("auth package capability gaps (intentional)", () => {
  it.todo("OAuth: Google/GitHub/Microsoft/Apple/LinkedIn provider clients with PKCE + state");
  it.todo("SAML: SP-initiated SSO with signed AuthnRequest and assertion verification");
  it.todo("SCIM: protocol parsing for Users, Groups, PATCH ops (only bearer token is here)");
  it.todo("MFA: TOTP enrolment, code verification, recovery codes");
  it.todo("WebAuthn: attestation parsing, assertion signature verification, counter check");
  it.todo("Audit log emitter wired into every middleware decision");
  it.todo("JWKS fetch + cache for RS256 public keys from a remote issuer");
});
