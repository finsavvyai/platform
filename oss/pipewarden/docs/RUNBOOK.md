# PipeWarden Operator Runbook

Production deploy + on-call guide for `pipewarden.io`. Updated 2026-05-11.

## Architecture at 30 seconds

```
                        Cloudflare
   ┌─────────────────┐  ┌──────────────────────────────────────┐
   │  pipewarden.io  │→ │ Pages (website/)                     │
   │ (marketing)     │  │ CSP + HSTS + Permissions-Policy      │
   └─────────────────┘  └──────────────────────────────────────┘

   ┌─────────────────┐  ┌──────────────────────────────────────┐
   │ api.pipewarden  │→ │ Worker (worker/proxy.js)             │
   │      .io        │  │   ↓ getRandom(env.PIPEWARDEN_CONTAINER)
   └─────────────────┘  │ Durable Object → Container           │
                        │   image: ghcr.io/finsavvyai/         │
                        │   pipewarden:<version>               │
                        │   Go binary on :8080                 │
                        └──────────────────────────────────────┘
                                       │
                                       ▼
                              Postgres (Neon)
```

Worker forwards 30+ secrets into the container at start (see
`worker/proxy.js` `envVarsFor`). Container refuses to boot if any
required secret is empty (see `internal/config/validate.go`).

## First-time deploy — 7 steps

### 1. Provision Postgres (Neon recommended)

```bash
# Sign up at https://neon.tech (free tier ok for v0.1)
# Create project: pipewarden-prod
# Copy connection string with sslmode=require
export PIPEWARDEN_DATABASE_URL='postgres://<user>:<pw>@<host>/pipewarden?sslmode=require'

# Smoke + apply schema
./scripts/provision-postgres.sh
```

Expected output ends with `done. Postgres ready for PipeWarden.` and
20 tables verified.

### 2. Provision SMTP (Resend recommended)

```bash
# Sign up at https://resend.com (3k emails/mo free)
# Create API key, add domain pipewarden.io, set up DKIM
export PIPEWARDEN_SMTP_HOST='smtp.resend.com'
export PIPEWARDEN_SMTP_PORT=587
export PIPEWARDEN_SMTP_USER='resend'
export PIPEWARDEN_SMTP_PASSWORD='re_...'           # API key
export PIPEWARDEN_SMTP_FROM='PipeWarden <noreply@pipewarden.io>'
```

### 3. Generate cryptographic secrets

```bash
# 32-byte vault key (AES-256-GCM)
openssl rand -hex 32   # → PIPEWARDEN_VAULT_KEY

# 32-byte session-cookie signer
openssl rand -hex 32   # → PIPEWARDEN_SESSION_SECRET
```

Store these in a password manager. They never rotate; rotating the
vault key requires re-encrypting every stored connection credential.

### 4. Push secrets to PushCI (or wrangler)

PushCI is canonical:

```bash
pushci secret put PIPEWARDEN_VAULT_KEY
pushci secret put PIPEWARDEN_SESSION_SECRET
pushci secret put PIPEWARDEN_DATABASE_URL
pushci secret put PIPEWARDEN_SMTP_HOST
pushci secret put PIPEWARDEN_SMTP_USER
pushci secret put PIPEWARDEN_SMTP_PASSWORD
pushci secret put PIPEWARDEN_SMTP_FROM
pushci secret put PIPEWARDEN_WEBAUTHN_RPID         # pipewarden.io
pushci secret put PIPEWARDEN_WEBAUTHN_ORIGINS      # https://app.pipewarden.io
pushci secret put CLAUDE_API_KEY                   # sk-ant-...
pushci secret put CLOUDFLARE_API_TOKEN
pushci secret put CLOUDFLARE_ACCOUNT_ID
pushci secret put GHCR_TOKEN                       # GitHub PAT, write:packages

# Optional (only when features.billing=true)
pushci secret put LEMONSQUEEZY_API_KEY
pushci secret put LEMONSQUEEZY_STORE_ID
pushci secret put LEMONSQUEEZY_WEBHOOK_SECRET

# Optional (only when GitHub App auth on)
pushci secret put GITHUB_APP_ID
pushci secret put GITHUB_APP_SLUG
pushci secret put GITHUB_PRIVATE_KEY               # PEM contents, multi-line
pushci secret put GITHUB_CLIENT_ID
pushci secret put GITHUB_CLIENT_SECRET
pushci secret put GITHUB_WEBHOOK_SECRET
```

Also push the same secrets to Cloudflare so the Worker can forward
them into the container:

```bash
echo "$PIPEWARDEN_VAULT_KEY" | wrangler secret put PIPEWARDEN_VAULT_KEY
# ...repeat for every secret above
```

### 5. DNS

In Cloudflare DNS for `pipewarden.io`:

| Type | Name | Target | Proxied |
|------|------|--------|---------|
| CNAME | `@` | `pipewarden-website.pages.dev` | yes |
| CNAME | `www` | `pipewarden-website.pages.dev` | yes |
| CNAME | `api` | (auto from Workers route) | yes |
| CNAME | `app` | `pipewarden-website.pages.dev` | yes |

In Workers → Triggers → `pipewarden` Worker, add route:
`api.pipewarden.io/*`.

In Pages → `pipewarden-website` → Custom domains, add
`pipewarden.io` and `www.pipewarden.io`.

TLS auto-provisions in ~30s via Cloudflare Universal SSL.

### 6. Tag the release

```bash
git checkout main
git pull
git tag -a v0.1.0 -m "PipeWarden v0.1.0 — public beta"
git push origin v0.1.0
```

PushCI fires the full pipeline:
1. install → build → test → lint → security
2. container build → trivy → push to ghcr.io
3. migrate against Postgres
4. **manual-approve** api-production
5. **manual-approve** marketing-production
6. smoke (curls /healthz, /llms.txt, security.txt, ai-plugin.json,
   /api/v1/security/audit)

### 7. Rotate the bootstrap creds

After the first green deploy, rotate every credential that has been on
disk during setup:
- Cloudflare API token (Dashboard → My Profile → API Tokens)
- Anthropic key (console.anthropic.com → API Keys)
- Vault key — only if you suspect leak; rotation requires re-encrypt
- Neon password — Neon dashboard → Connection details → Reset

Re-run step 4 with the rotated values. Worker secrets are zero-
downtime: `wrangler secret put` then traffic uses the new value on the
next container start.

## On-call runbook

### Smoke fails after deploy

```bash
# 1. Worker logs
wrangler tail pipewarden

# 2. Container start failure (usually a missing secret)
wrangler tail pipewarden --format=json | jq '.outcome,.logs'

# 3. Confirm boot validation
# Search container logs for "insecure production configuration"
```

If `validate.go` rejects boot, the message lists every missing var.
Add via `wrangler secret put` and the next request spawns a fresh
container that picks it up.

### Postgres connection refused

```bash
# Re-check sslmode and IP allowlist
psql "$PIPEWARDEN_DATABASE_URL" -c 'SELECT 1;'

# Neon scales to zero — first query after idle takes ~3s
# If the API health check is timing out, bump server.readTimeout in
# configs/production/config.yml or move to Neon's autoscaler.
```

### Rollback

```bash
# Worker (instant)
wrangler rollback pipewarden

# Container (point wrangler.toml at previous tag, redeploy)
git checkout v0.0.9
wrangler deploy

# Pages (Cloudflare dashboard → Deployments → "Rollback to this version")
```

### Database disaster

Neon has 7-day point-in-time recovery on the free tier (30-day on
paid). To restore:
1. Neon Console → Branches → "Restore"
2. Pick timestamp before the incident
3. Copy the new branch's connection string
4. `wrangler secret put PIPEWARDEN_DATABASE_URL` with the new URL
5. Worker picks up the change on the next container start

## Monitoring + alerts

- Cloudflare Workers analytics: built-in (wrangler.toml
  `[observability] enabled = true`)
- Prometheus `/metrics` endpoint: scraped by Grafana Cloud (free 10k
  series) — set up `GRAFANA_PROMETHEUS_URL` push gateway
- Alert thresholds:
  - 5xx > 1% over 5 min → Slack `#pipewarden-oncall`
  - Container restart > 3 in 5 min → page
  - `/api/v1/security/audit` `RiskScore > 50` → Slack
  - Postgres p95 latency > 300 ms → Slack

## Known gaps (v0.1.0)

These ship as **not yet end-to-end tested**; scope for v0.2:

1. **LemonSqueezy webhook handlers** are stubs returning nil. Billing
   API key + store work for `/checkout` redirects, but subscription
   state transitions on `subscription_created` / `subscription_updated`
   / `subscription_cancelled` are unimplemented. Disable billing at
   launch by setting `features.billing=false` until v0.2.
2. **WebAuthn end-to-end** lacks a virtual-authenticator test harness.
   The begin/finish ceremony handlers are wired, but the only test
   coverage is at the unit level. If a real passkey registration fails
   in prod, fallback to TOTP works.
3. **GitHub Enterprise OAuth** uses the same code path as github.com
   but isn't tested against a real GHES instance.

## Release checklist (every tag)

- [ ] `pushci run` green locally (38s)
- [ ] `git log v$(prev_tag)..HEAD --oneline` reviewed for surprise commits
- [ ] CHANGELOG updated with user-visible changes
- [ ] No new `// TODO` / `// FIXME` in critical paths (auth, billing,
      vault, storage, security)
- [ ] If schema changed: `cmd/migrate` runs clean against a fresh
      Postgres
- [ ] Browser smoke: register → verify email → enroll passkey → run
      a quick scan
- [ ] Cloudflare Pages preview deploy reviewed
- [ ] Tag pushed; PushCI deploy approved
- [ ] 1-hour soak watch: `/healthz`, error rate, p99 latency

## Contacts

- On-call: see `#pipewarden-oncall` Slack
- Security: `security@pipewarden.io` (RFC 9116 disclosure)
- Cloudflare account: shacharsol@gmail.com (sole owner)
