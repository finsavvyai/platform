# sso package — production status

| File | Status | Notes |
|------|--------|-------|
| `mfa.go` | REAL | RFC 6238 TOTP (HMAC-SHA1, 30s window, 6 digits), `EnsureFreshMFA(<5 min)`, in-memory + Redis-backed `MFAStore`. `WithWebAuthn(svc)` composes optional FIDO2. |
| `mfa_test.go` | REAL | 100+ assertions across happy, expiry, and replay paths. |
| `webauthn.go` | REAL | Wraps `github.com/go-webauthn/webauthn` for register + assert. |
| `oidc.go` | REAL | Discovery + auth-code + nonce + PKCE; consumed by Okta / Azure AD / Google ID-token fixtures. |
| `oidc_verify.go` | REAL | JWKS fetch + cache; JWT verification; `aud`/`iss`/`exp` checks. |
| `saml.go` | **STUB** | `NewAuthRequest()` returns a placeholder; `VerifyAssertion()` returns `errors.New("requires crewjam/saml integration")`. |

## BEAT-PLAN S3.2 remaining work

**Why not done in this session**: a credible SAML implementation requires
adding the `github.com/crewjam/saml` dep (XML signing is the load-bearing
piece — re-implementing it inline is a wrong choice) and ~6-8 hours of
focused integration:

1. Replace `NewAuthRequest()` body with crewjam `*saml.IdentityProvider`
   `MakeAuthenticationRequest()` so the redirect URL contains a real
   base64-deflated AuthnRequest XML.
2. Replace `VerifyAssertion()` body with `*saml.ServiceProvider`
   `ParseResponse()` that validates signature + NotBefore + NotOnOrAfter
   + Audience + Recipient + InResponseTo against the per-tenant
   `SAMLConfig.Certificate`.
3. Wire `EnsureFreshMFA` into the SAML callback so post-SSO step-up
   challenges TOTP/WebAuthn before issuing the gateway session.
4. Add per-tenant SAML metadata loader (the IdP-XML upload flow).
5. Integration tests with the `crewjam/saml` test IdP.

## MFA challenge flow

The pieces are in place but the HTTP middleware that returns
`401 + WWW-Authenticate: MFA` on stale MFA still needs a thin caller:

```go
// pseudo-shape — TODO in interfaces/http/middleware/mfa.go
if errors.Is(EnsureFreshMFA(ctx, store, userID, time.Now), ErrMFARequired) {
    w.Header().Set("WWW-Authenticate", `MFA realm="step-up"`)
    writeErrorJSON(w, http.StatusUnauthorized, "step-up MFA required")
    return
}
```

A `POST /v1/auth/mfa/verify` handler needs to:
- Read the TOTP code from the body.
- Call `mfa.VerifyTOTP(secret, code)`.
- On match, write to `MFAStore.RecordSuccess(ctx, userID, time.Now)` so
  the next request in the freshness window passes.

Effort estimate: ~1 person-day for this flow once SAML is in.
