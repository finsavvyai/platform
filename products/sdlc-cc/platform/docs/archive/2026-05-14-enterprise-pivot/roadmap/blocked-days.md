# Blocked Days

This file tracks roadmap days that could not be completed fully due to
missing external credentials, infrastructure, or approvals.

---

## Day 24 — SAML SSO + OIDC + MFA (partial)

**Status:** Code complete; integration E2E tests blocked on external credentials.

### What was completed

- `services/gateway/internal/infrastructure/sso/saml.go` — real SAML
  ServiceProvider using `crewjam/saml`. Includes `NewSAMLProvider`,
  `MakeAuthRequest`, `ValidateResponse`, `GenerateSPKeypair`, `LoadSPKeypair`.
- `services/gateway/internal/infrastructure/sso/oidc.go` — OIDC provider
  using `coreos/go-oidc/v3`. Includes `NewOIDCProvider`, `AuthCodeURL`,
  `Exchange`, `VerifyIDToken`, `ExtractClaims`.
- `services/gateway/internal/infrastructure/sso/saml_test.go` — 7 unit tests
  covering keypair generation, config validation, auth-request generation, and
  IdP metadata building. All pass without any external IdP.
- `services/gateway/internal/infrastructure/sso/oidc_test.go` — 5 unit tests
  using a mock TLS httptest server for OIDC discovery. All pass.
- `services/gateway/internal/infrastructure/sso/mfa_test.go` — 3 MFA
  step-up tests already passing (carried from Day 23 scaffold).
- `services/gateway/internal/infrastructure/migrations/migrations/017_idp_config.sql`
  — per-tenant IdP config table with SAML + OIDC columns, encrypted-secret
  columns, and MFA flag.
- `services/admin-ui/src/app/dashboard/settings/sso/page.tsx` — admin UI for
  SAML + OIDC configuration with protocol selector and MFA toggle.

### Blockers requiring human action

| Item | What's needed |
|------|---------------|
| SAML E2E round-trip | A live **Okta tenant** (or SimpleSAMLphp Docker instance with a signed assertion fixture) to run `TestSAMLRoundTrip` against the real `ParseResponse` path |
| OIDC E2E round-trip | An **Auth0 test tenant** (or Azure AD app registration) to test `Exchange` + `VerifyIDToken` against a real token |
| "Done when" criterion | "An admin can connect Okta via SAML and Azure AD via OIDC and force MFA on key rotation" requires both credentials above |

### Next steps for the human

1. Create a free **Auth0 tenant** at auth0.com and add an app. Set:
   - `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER_URL`
2. Either spin up **SimpleSAMLphp** in Docker (`kristophjunge/test-saml-idp`) or
   request an Okta developer account at developer.okta.com. Set:
   - `SAML_IDP_ENTITY_ID`, `SAML_SSO_URL`, `SAML_IDP_CERT_PEM`
3. Re-run `go test ./internal/infrastructure/sso/... -run TestSAMLRoundTrip -run TestOIDCRoundTrip`
   with those env vars to complete the day's Done-when criteria.
