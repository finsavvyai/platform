# LiteLLM Sidecar

LiteLLM (https://github.com/BerriAI/litellm) runs as a sidecar service next to
the Go `llm-gateway`. It exposes a single OpenAI-compatible endpoint that
routes to 100+ upstream providers (OpenAI, Anthropic, Bedrock, Azure, Cohere,
...). The Go gateway keeps its enterprise concerns — auth, tenant isolation,
audit, DLP, policy — while delegating provider SDKs, fallback, retry, and
cross-tenant rate limiting to LiteLLM.

## Files

| File               | Purpose                                                  |
|--------------------|----------------------------------------------------------|
| `config.yaml`      | Router config: model list, fallbacks, per-tier quotas    |
| `docker-compose.yml` | LiteLLM + Redis sidecar                                |
| `README.md`        | You are here                                             |

## Prerequisites

Set these in a `.env` file next to `docker-compose.yml` (or export them):

```bash
# Required
LITELLM_MASTER_KEY=sk-litellm-local-dev-change-me

# At least one provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional providers
AWS_BEDROCK_ACCESS_KEY_ID=...
AWS_BEDROCK_SECRET_ACCESS_KEY=...
AWS_BEDROCK_REGION=us-east-1
AZURE_API_KEY=...
AZURE_API_BASE=https://your-resource.openai.azure.com
AZURE_API_VERSION=2024-02-15-preview
COHERE_API_KEY=...

# Optional — Postgres for spend/team persistence. Omit for in-memory.
LITELLM_DATABASE_URL=postgres://litellm:litellm@postgres:5432/litellm
```

## Start

```bash
cd deployments/litellm
docker compose up -d
docker compose logs -f litellm
```

LiteLLM listens on `http://localhost:4000`. The SDLC platform's private
docker network (`sdlc-net`) is reused so other services can address it at
`http://litellm:4000`.

## Smoke test

Non-streaming:

```bash
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role":"user","content":"ping"}],
    "max_tokens": 16,
    "user": "tenant-demo"
  }' | jq
```

Streaming (SSE):

```bash
curl -N http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-haiku","messages":[{"role":"user","content":"count to 5"}],"stream":true,"user":"tenant-demo"}'
```

Health:

```bash
curl -s http://localhost:4000/health/liveliness
curl -s http://localhost:4000/health/readiness
```

Provider list:

```bash
curl -s -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  http://localhost:4000/v1/models | jq '.data[].id'
```

## Wiring the Go gateway

Set these env vars for `services/llm-gateway`:

```bash
LITELLM_ENABLED=true
LITELLM_PROXY_URL=http://litellm:4000    # or http://localhost:4000 off-compose
LITELLM_MASTER_KEY=sk-litellm-local-dev-change-me
```

Then set `litellm_enabled: true` in `services/llm-gateway/config.yaml`.
Requests flow as: client -> llm-gateway (auth, tenant, DLP, audit) ->
LiteLLM sidecar -> upstream provider.

## Rollback

Flip `litellm_enabled: false` in `config.yaml` (or `LITELLM_ENABLED=false`).
The Go gateway falls back to the native OpenAI / Anthropic / Ollama
providers that already exist. No code change required.

## Production notes

- Mount `config.yaml` from a secret/config store rather than the repo.
- Use the Postgres DSN (`LITELLM_DATABASE_URL`) for cross-pod team and
  spend accounting.
- Run LiteLLM with `--num_workers` scaled to CPU cores.
- Put LiteLLM behind the platform's mTLS mesh; only the `llm-gateway`
  service should be allowed to reach port 4000.
