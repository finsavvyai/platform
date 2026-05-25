# Auth deployment — pipewarden.io / pipewarden.com

End-to-end checklist for getting native signup / login / onboarding
working on the production domains.

## Pre-flight

| Item | Source |
|------|--------|
| Session JWT secret | `openssl rand -hex 32` |
| Domains | `pipewarden.io` (canonical), `pipewarden.com` |
| Backend host | `api.pipewarden.io` |
| Frontend host | `pipewarden.io` (canonical) — `pipewarden.com` 301s here |

The two TLDs CANNOT share a session cookie (`.io` ≠ `.com`). Pick one
canonical domain. We use `pipewarden.io`. `pipewarden.com` 301s to it
at the Cloudflare layer.

## Backend env

```bash
PIPEWARDEN_SESSION_SECRET=<32-byte hex from openssl rand -hex 32>
PIPEWARDEN_COOKIE_DOMAIN=pipewarden.io
PIPEWARDEN_VAULT_KEY=<existing vault key>
PIPEWARDEN_DATABASE_URL=postgres://...
```

Plus everything in `configs/production/config.yml` (already updated:
`publicUrl: https://pipewarden.io` and `corsOrigins:` lists both
TLDs + `www.` + `app.`).

## Backend deploy (Cloudflare Containers)

`wrangler.toml` and `Dockerfile` are already in the repo. The current
`api.pipewarden.io` is a v2.0.0 gateway — replace with the Go binary
or proxy `/api/v1/auth/*` to the Go binary specifically.

```bash
docker build --platform linux/amd64 -t pipewarden:latest .
wrangler containers push pipewarden:latest
wrangler secret put PIPEWARDEN_SESSION_SECRET
wrangler secret put PIPEWARDEN_COOKIE_DOMAIN
wrangler secret put PIPEWARDEN_VAULT_KEY
wrangler deploy
```

Verify:

```bash
curl -i https://api.pipewarden.io/health
# Expect: 200 + {"checks":{"database":true,"vault":true},"status":"ok"}
```

## Frontend deploy (Cloudflare Pages)

Push `website/` to Cloudflare Pages connected to the `pipewarden.io`
domain. `pipewarden.com` configured to 301 redirect to `pipewarden.io`.

The static `/signup/`, `/login/`, `/onboarding/` pages auto-target
`https://api.pipewarden.io` in production (hostname check in each
page's inline script).

## End-to-end smoke

```bash
# 1. Signup
curl -c c.txt -X POST https://api.pipewarden.io/api/v1/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@pipewarden.io","password":"a-very-long-test-pw"}'

# Expect: 200, Set-Cookie: pipewarden_session=...; Domain=pipewarden.io; Secure; HttpOnly

# 2. Verify cookie reaches both hosts
curl -b c.txt https://api.pipewarden.io/api/v1/auth/me
# Expect: 200 + {"user": {...}}

# 3. Browser flow
# Visit https://pipewarden.io → Sign in → enter creds → land on /onboarding/
# Skip → land on /dashboard/ (the SPA, served by api.pipewarden.io
# behind a Cloudflare route)
```

## Cookie-domain gotchas

- Cookie issued with `Domain=pipewarden.io` is sent on requests to
  `pipewarden.io` AND `*.pipewarden.io` (including `api.pipewarden.io`,
  `app.pipewarden.io`, `www.pipewarden.io`).
- The leading dot (`.pipewarden.io`) is stripped by Go per RFC 6265.
  Bare-domain form is the modern standard.
- `pipewarden.com` cannot share this cookie. The 301 to `pipewarden.io`
  means users always end up on the canonical TLD before they have a session.

## CORS gotchas

- `Access-Control-Allow-Origin: *` is INVALID with credentials. The
  middleware echoes the actual `Origin` from the allowlist instead.
- Disallowed origins get NO CORS headers — the browser blocks the
  response, not the server. Same-origin requests work fine without
  headers.
- `Vary: Origin` is added so caches don't poison.

## Followups (not blocking go-live)

- Email verification (needs SMTP — Postmark/SES/Resend)
- Password reset flow (depends on email verification)
- "Sign in with GitHub" (the existing GitHub App OAuth is for
  connecting CI/CD, not user login — needs adaptation)
- Per-IP rate limit on `/api/v1/auth/login` (existing middleware can
  be tuned higher than current global rate limit)
- 2FA / WebAuthn
