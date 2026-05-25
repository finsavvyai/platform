# Sentry PII Scrubbing

> M365 Cert TB5 (Worker ↔ third parties — Sentry).
> Auditor-readable proof we don't egress credentials or PII to a US sub-processor.

Last reviewed: 2026-04-29.

## What gets sent

- **API worker** (`@sentry/cloudflare`) — exceptions + console.error/warn (via `captureConsoleIntegration`), 10% trace sample.
- **Web client** (custom envelope, no SDK) — `window.error` + `unhandledrejection` events.

## Scrubbing layers

### Layer 1 — Sentry SDK defaults (worker)

`@sentry/cloudflare` strips `authorization`, `cookie`, `x-csrf-token`, `set-cookie` headers by default. Not enough — we also need custom headers and query strings.

### Layer 2 — `beforeSend` scrubber (worker, `apps/api/src/lib/sentry.ts`)

Applied to every event before egress:

| Item | Rule |
|---|---|
| `request.url` | strip query values for keys `token, xcode, code, state, secret, apikey, api_key, access_token, refresh_token` |
| `request.headers[k]` | redact if name matches `^(authorization\|cookie\|set-cookie\|x-.*-token\|x-.*-secret\|x-.*-key)$` |
| `request.cookies` | dropped entirely |
| `request.data` (request body) | dropped entirely |
| `request.query_string` | dropped entirely |
| `extra.*`, `contexts.*` | recursive walk — redact any key matching `password\|secret\|token\|apikey\|api_key\|cookie\|authorization\|client_secret\|refresh_token\|access_token\|kek` |
| `user` | reduced to `{ id }` only — strip email, ip, username |
| `breadcrumbs[].data` | recursive walk same as `extra` |
| `breadcrumbs[].message` | URL redaction applied |

### Layer 3 — pre-send sanitizer (web, `apps/web/src/lib/sentry-client.ts`)

Web client doesn't use the SDK so we sanitize the raw error message + stack:

- `Bearer <tok>` → `Bearer [redacted]`
- `eyJ<...>` (JWTs) → `[jwt-redacted]`
- query params `token=`, `xcode=`, `code=`, `state=`, `access_token=`, `refresh_token=`, `secret=` → value `[redacted]`

## What is *not* in scope

- **Customer Microsoft 365 data** — never sent to Sentry. Errors thrown during Graph calls include the request path (`/users`, `/groups`) but never response bodies. Verified by reading every `console.error('Graph...` call in the API.
- **PII other than admin email** — admin email is sometimes written into audit log messages (`[me] user not found ...`). The scrubber's `extra` walk catches it via the `email`-adjacent keys — but `console.error` strings aren't structured. **Action**: review every `console.error` that interpolates email and replace with `oid` or `redactString()` wrapper. Tracked in `docs/MS_CERTIFICATION.md` C10.

## Testing the scrubber

Unit tests live alongside `sentry.ts`. To regenerate fixtures after rule changes:

```bash
cd apps/api && pnpm test -- sentry
```

To smoke-test in production:

```bash
# Trigger a 500 deliberately (replace with a known error endpoint)
curl https://api.tenantiq.app/api/_debug/throw

# Check Sentry — event should contain '[redacted]' in URL, no Bearer tokens, no email
```

## Rotation policy

If a rule misses something an auditor finds:

1. Add to `SENSITIVE_FIELD_PATTERN` / `SENSITIVE_HEADER_PATTERN` / `SENSITIVE_QUERY_KEYS`
2. Bump `Last reviewed` date
3. Add unit test for the missed case
4. If the leak already shipped: notify customer per `docs/INCIDENT_RESPONSE.md` and request Sentry event purge

## Sentry-side controls (vendor)

- Event retention: 90 days (Sentry org default; verify in Sentry settings)
- IP scrubbing: enabled in Sentry org settings (verify checkbox)
- Project DSN tied to single project — no cross-project leakage
- DPA executed with Sentry, ref `docs/SUB_PROCESSORS.md`
