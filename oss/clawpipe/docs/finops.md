# ClawPipe for FinOps

Governance and cost controls for AI spend — configured by finance, enforced by the gateway.

## Who this is for

Finance, FinOps, and operations leaders who need to:
- Cap monthly AI spend per team without waiting on engineering.
- Get pushed weekly digests instead of polling a dashboard.
- Export raw data to Snowflake, Looker, or spreadsheets.

## Onboarding (5 minutes, no engineering ticket)

1. Sign in at https://app.clawpipe.ai.
2. Create a project (or open an existing one).
3. Give the resulting API key to your engineering team — one env var change on their side, no code modifications.
4. Open the **Settings** tab and configure Slack, email, and budget caps.

## Features

### Monthly budget caps

- Set a dollar cap per project in Settings → Monthly budget cap.
- When month-to-date spend reaches the cap, `/v1/prompt` returns HTTP 402 immediately.
- Threshold alerts fire at **50 %**, **80 %**, **100 %** of the cap — each threshold fires at most once per calendar month.

API:
```
PUT /v1/projects/:id/budget
  body: { "monthlyCap": 500 }
```

### Team budget caps

Link a project to a team and enforce an aggregate cap across all projects in that team.

```
POST /v1/teams              { "name": "Growth team" }
PUT  /v1/teams/:id/budget   { "monthlyCap": 10000 }
PUT  /v1/projects/:id/team  { "teamId": "..." }
```

If either project cap or team cap is exceeded, `/v1/prompt` returns 402.

### Slack weekly digest

- Paste an incoming-webhook URL (`https://hooks.slack.com/services/...`) in Settings → Slack digest.
- Every Monday at 09:00 UTC, a Block-Kit formatted summary posts to your channel:
  total spend · requests · avg latency · wk-over-wk delta · cached/boosted % · top-3 models by cost.
- **Send test digest** button triggers an immediate post for verification.

API:
```
PUT  /v1/projects/:id/slack-webhook        { "url": "https://hooks.slack.com/..." }
POST /v1/projects/:id/slack-digest/test
```

### Email weekly digest

- Drop an email address in Settings → Email digest. Delivered via Resend, same schedule as Slack.
- HTML summary with the same content as the Slack digest.

API:
```
PUT /v1/projects/:id/digest-email   { "email": "finance@acme.com" }
```

### Threshold alerts

When month-to-date spend crosses 50 / 80 / 100 % of the monthly cap for the first time that calendar month, an alert fires to whichever channels are configured (Slack, email, or both).

### CSV export

Download request-level data for the last 30 days (or any range):

```
GET /v1/projects/:id/export.csv?from=2026-04-01&to=2026-04-30
```

Columns: `timestamp, provider, model, tokens_in, tokens_out, latency_ms, cost_usd, cached, boosted, session_id`. Up to 50 000 rows per call.

## Security notes

- All settings endpoints require admin role on the project.
- Slack webhook URLs are validated to start with `https://hooks.slack.com/services/`.
- Email addresses are RFC-5322 shape-checked before save.
- Prompt content is never logged — only metadata (tokens, cost, provider, model).
- Provider API keys are encrypted at rest; Slack webhook URLs and email addresses are stored in plaintext in D1.

## Pricing

All FinOps features are available on every tier, including the Free plan (1 000 requests/day). The Growth tier adds SLA + priority support for teams managing real spend.

See [pricing](https://clawpipe.ai/#pricing).
