# @finsavvyai/auth

Auth primitives for the FinsavvyAI platform.

## What is shipped

- **JWT**: sign, verify, and rotate short-lived tokens (HS256, RS256). Alg-pinned per key — no `alg=none`, no alg-confusion.
- **HMAC**: SHA-256 sign/verify with constant-time comparison (`node:crypto.timingSafeEqual`).
- **API keys**: `hashApiKey` with optional pepper, hash-only storage helpers.
- **RBAC**: `StaticRbac` evaluator, default-deny, with shared/OpenSyber/TenantIQ role catalogs.
- **Middleware** (framework-agnostic, Hono-compatible): bearer/cookie JWT auth, role gate, tenant gate, SCIM token gate.
- **JTI revocation + session store**: in-memory adapters plus a Redis-compatible JTI deny-list adapter.
- **WebAuthn**: challenge issuance + origin allowlist. Attestation/assertion verification is **out of scope** in this package.

## Not in this package (yet)

- OAuth provider clients (Google/GitHub/Microsoft/Apple/LinkedIn).
- SAML SP/IdP flow.
- SCIM protocol parsing (`Users`, `Groups`, PATCH). Only the SCIM bearer-token middleware is here.
- MFA TOTP enrolment/verification.
- WebAuthn signature/attestation verification.

These belong in product-side packages that depend on this one.

## Critical paths (100% covered)

- `verifyToken` rejects: missing iss/aud config, expired, wrong issuer, wrong audience, tampered signature, wrong signing key, `alg=none` forgery, empty/garbage input.
- `rotateTokenIfNeeded` only mints a replacement inside the configured renewal window, preserves custom claims, and can deny-list the old JTI.
- `timingSafeEqualStr` is constant-time, length-mismatch safe.
- `StaticRbac.can` denies by default; unknown role / unknown permission both deny.
- `requireRole` / `requireTenant` deny when subject missing.

## Exports

`StaticRbac`, `signToken`, `verifyToken`, `rotateTokenIfNeeded`, `hmacSign`, `hmacVerify`, `timingSafeEqualStr`, `hashApiKey`, `createAuthMiddleware`, `requireRole`, `requireTenant`, `createScimAuthMiddleware`, `generateScimToken`, `verifyScimTokenHash`, WebAuthn challenge helpers, in-memory and Redis-compatible JTI/session adapters, role catalogs, and supporting types (`Subject`, `TokenClaims`, `AuthResult`, `Permission`, `RoleDefinition`, `TokenVerifier`, `RbacEvaluator`).
