# PipeWarden Production Handoff

**Live URL**: https://pipewarden.broad-dew-49ad.workers.dev
**Account**: `Info@finsavvyai.com` (CF account `d2fe608a92dc9faa2ce5b0fd2cad5eb7`)
**Worker**: `pipewarden`
**Container app**: `pipewarden-pipewardencontainer` (`a032c378-c0ac-4f5a-8cb0-95f6e3606a20`)

Current state: live, healthy, SQLite-backed, no optional features wired.
Every section below is a one-command flip to enable an additional feature.

## Apply a new secret (the template)

```
source ~/.zshrc            # exports CLOUDFLARE_API_TOKEN
printf "<value>" | wrangler secret put <NAME> --config wrangler.toml
bash scripts/deploy.sh     # picks up the new secret on next container start
```

`scripts/deploy.sh` will refuse to proceed unless the 4 baseline secrets
already exist (verified via `wrangler secret list`). It then rebuilds the
Docker image, pushes it to the CF managed registry, deploys, waits for
container warm, runs smoke tests, tails logs for 180s with voice announce,
and re-runs smoke after the tail window.

## Feature flip table

| Feature | Secrets to add | wrangler.toml change | Effect |
|---|---|---|---|
| **Persistent Postgres** | `PIPEWARDEN_DATABASE_URL=postgres://user:pass@host:port/db?sslmode=require` | `PIPEWARDEN_DATABASE_DRIVER = "postgres"` | Survives container cold restart. Required for hosted mode + multi-tenant. |
| **Hosted SaaS mode** | (Postgres above) | `PIPEWARDEN_HOSTED_MODE = "true"` | Boot gate then requires SMTP and rejects sqlite. |
| **SMTP email delivery** | `PIPEWARDEN_SMTP_HOST`, `PIPEWARDEN_SMTP_USER`, `PIPEWARDEN_SMTP_PASSWORD`, `PIPEWARDEN_SMTP_FROM`, optional `PIPEWARDEN_SMTP_PORT` (default 587) | none | `/auth/verify/request` + password reset send real email. Without these, sender falls back to stderr log-only. |
| **GitHub OAuth (user sign-in)** | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | none | `/api/v1/auth/github/start` redirects to GitHub instead of returning 503. |
| **GitHub App (CI/CD install)** | `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `GITHUB_WEBHOOK_SECRET` | (Set `Auth.GitHubApp.Enabled=true` in config) | App install flow + webhook reception. Boot gate then demands private key + webhook secret. |
| **Claude AI analyzer** | `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) | none | `/api/v1/analysis/run` uses Claude instead of heuristic. |
| **LemonSqueezy billing** | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` | (Set `Features.Billing=true`) | `/api/v1/billing/checkout` issues real checkout URLs. |
| **SIEM routing** | `SLACK_WEBHOOK_URL` and/or `PAGERDUTY_INTEGRATION_KEY` and/or `JIRA_API_TOKEN`+`JIRA_BASE_URL`+`JIRA_EMAIL`+`JIRA_PROJECT_KEY` | none | Findings get pushed to your incident management on creation. |

## Domain cutover (api.pipewarden.io)

The apex route is currently held by an older `pipewarden-prod` worker. To
move it to this build:

```
# Verify the legacy worker is not in active use:
wrangler tail pipewarden-prod --format=pretty   # watch for traffic

# Cutover (one of these):
wrangler delete pipewarden-prod                  # nuclear; or
# uncomment the [[routes]] block in wrangler.toml here, then:
bash scripts/deploy.sh
```

## WebAuthn passkey end-to-end

The Begin steps for registration + login are unit-tested with real crypto
state (`internal/handlers/passkey_begin_test.go`). Finish steps require a
real browser ceremony — see `internal/web/static/app.js` for the call
sites. To smoke-test post-deploy:

1. Visit `https://pipewarden.broad-dew-49ad.workers.dev/signup` (or the
   apex once cut over).
2. Sign up with an email.
3. From settings → passkeys → "Register passkey", complete the browser
   ceremony.
4. Log out, log back in with passkey.

Discoverable-credential login (no email entry) is supported by the SDK
but needs Chrome 108+ / Safari 17+ / Firefox 122+ for full coverage.

## Coverage status

- Overall: **88.0%** statements
- Critical paths: router 94%, integrations 88-89%, email 100%, tracing 90%
- Open gap to 90%: WebAuthn FinishRegistration / FinishLogin (browser-only
  attestation crypto) + GitHub App installation JWT (needs your RSA
  private key in CI to test against the real GitHub Apps API).

## Rollback

```
# Roll back to the previous deployment:
wrangler rollback --config wrangler.toml

# Or pin to a specific version:
wrangler deployments list
wrangler rollback --version-id <id>
```

## Voice + observability

`scripts/deploy.sh` uses macOS `say` for phase narration. Worker logs are
visible via `wrangler tail pipewarden`. CF Workers Observability is
enabled (`[observability] enabled = true`).
