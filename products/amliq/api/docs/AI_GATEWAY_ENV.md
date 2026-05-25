# AI Gateway — Environment Configuration

Last updated: 2026-05-03

The aegis AI gateway has two backends and one optional auth layer.
This doc maps each env var to the endpoint(s) it affects so an ops
engineer can wire a deployment without reading source.

## Backend selection (boot-time)

Aegis picks an AI provider at process start in this order:

| Var | Effect |
|---|---|
| `AWS_BEDROCK_REGION` set + AWS creds | Bedrock wins. Anthropic API is **not** called even if the API key is also set. |
| `ANTHROPIC_API_KEY` set | Direct Anthropic API. |
| Neither | Both `/api/v1/ai/summarize` and `/v1/messages` 503 `AI_UNAVAILABLE`. |

Boot-time selection means a flip requires a restart. Per-tenant
runtime routing is a separate roadmap item (see `migration 027`
template `tenant_provider_credentials` in the sdlc-platform repo).

## Direct Anthropic backend

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

That's the entire surface. Model is hard-coded to
`claude-haiku-4-5-20251001` for the AML summarize endpoint;
`/v1/messages` honours the `model` field in the request body when
it's a Bedrock-supported model alias and falls back to the default
otherwise.

## AWS Bedrock backend

```bash
AWS_BEDROCK_REGION=us-east-1
AWS_BEDROCK_MODEL=anthropic.claude-haiku-4-5-20251001-v1:0  # optional
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...   # optional, for STS / SSO callers
```

The signer is hand-rolled SigV4 (no aws-sdk-go dep). For VPC-isolated
deployments, point the runtime at a Bedrock VPC endpoint via
PrivateLink and prompts never leave the customer's AWS account —
that's the data-residency story.

## SAML SSO

```bash
AEGIS_SSO_BASE_URL=https://api.aegis.cc
```

When unset OR when `deps.DB` is nil, the `/sso/{tenant}/...` routes
are not mounted. This lets dev runs boot without SAML configured
without forcing every developer to create a tenant_saml_config row.

Per-tenant config lives in the database (migration 070). See
`SAML_SSO_SETUP.md` for the per-tenant onboarding runbook.

## Audit log dependency

Both AI endpoints fail-closed when `deps.Audit` is nil. This is a
deliberate choice: a regulator must be able to answer "what did the
analyst send to a model" so a missing audit repo is treated as a
P0 wiring failure (500), not a soft degrade.

## Daily AI quota (per tenant)

```bash
AEGIS_AI_DAILY_CAP=1000        # 0 / unset / negative = no enforcement
```

When set, both `/api/v1/ai/summarize` and `/v1/messages` enforce a
24-hour sliding-window cap per tenant. Responses past the cap return
HTTP 429 with `AI_QUOTA_EXCEEDED`. Counter is in-memory so multi-
replica deploys will undercount; switch to Redis when scaling past
one API replica.

Recommended Pilot defaults:
- `1000` daily — enough for ~30 alerts/day per analyst on a
  10-person team without pinch
- Lower to `100` for early demos
- Raise / unset for Enterprise tenants who paid for unmetered

## Tenant API key auth

The AI endpoints route through the same authChain as every other
authenticated route. Either:

- `Authorization: Bearer <jwt>` — primary path, used by amliq-frontend
- `X-API-Key: <key>` — for SDK callers (Claude Code, scripts)

Per `docs/API_REFERENCE.md` Authentication section.

## Verifying the wiring

```bash
# Health
curl -s https://api.aegis.cc/health

# AI ready (returns 503 AI_UNAVAILABLE if no provider configured)
curl -s -X POST https://api.aegis.cc/api/v1/ai/summarize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"test","type":"alert"}'

# /v1/messages drop-in
curl -s -X POST https://api.aegis.cc/v1/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":64,"messages":[{"role":"user","content":"hello"}]}'
```

A successful call writes exactly one `AuditActionAISummarized` row;
verify via `GET /api/v1/audit?action=AISummarized`.
