<!-- cspell:words tenantiq pnp climicrosoft365 federated -->

# Integration Plan — CLI for Microsoft 365 → tenantiq

## Targets

- Adopt **federated-identity** auth pattern (unblocks the SAML/OIDC SSO milestone in CLAUDE.md "Left → Priorities §1").
- Selectively port Graph **per-workload helpers** instead of taking the whole CLI as a dep.

## Why selective port, not dependency

- tenantiq API runs on Cloudflare Workers (`apps/api/wrangler.toml`).
- `@pnp/cli-microsoft365` README does not state Workers compatibility. Most npm libs assume Node-only APIs (fs, child_process, raw http).
- Pulling the whole CLI as a dep would balloon the bundle past Workers' size limits.
- Safer: read the source on GitHub, lift the auth + Graph patterns we need, type them for tenantiq's own use.

## Step 1 — Federated identity auth

- New: `apps/api/src/middleware/auth-federated.ts`.
  - Accept SAML assertion or OIDC ID token from per-org IdP (Okta, Entra, Google).
  - JIT-provision user in `users` table (verified existing) on first login.
  - Reuse existing JWT issuer pattern (HS256 via `jose` per CLAUDE.md "Auth").
- Per-org config table: `org_idp_config` (issuer URL, client_id, secret_encrypted, allowed_domains).
- New routes: `apps/api/src/routes/auth-saml.ts`, `apps/api/src/routes/auth-oidc.ts`.

Reference patterns to copy from cli-microsoft365 source (path: `src/Auth.ts` and friends — to be located after clone):
- Federated identity request shape.
- Token caching strategy.

Rough effort: **~1.5 weeks** including Okta + Entra integration tests.

## Step 2 — Selective Graph helpers

- Audit: `apps/api/src/lib/graph-client.ts` (194 LOC) — list missing operations.
- For each gap, locate the equivalent in `pnp/cli-microsoft365` repo and port the underlying Graph call (not the CLI command shell).
- Stay TS-strict; do not pull runtime deps.

Rough effort: case-by-case; **per-helper ~1–4 hours.**

## Step 3 — Don't adopt

- Their per-workload command surface (Bookings, Planner, To Do, Power Apps) is out of tenantiq's charter per CLAUDE.md mission. Skip.

## Risks / unknowns

- I have not verified cli-microsoft365's exact source path for the auth code.
- I have not verified MIT license compatibility with tenantiq's distribution model — MIT is permissive, but attribution must appear in `apps/web/src/routes/legal/notice` (or equivalent) if material code is copied.
