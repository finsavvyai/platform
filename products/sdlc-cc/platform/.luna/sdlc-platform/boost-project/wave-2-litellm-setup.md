# Wave 2 — LiteLLM Sidecar

[LiteLLM](https://github.com/BerriAI/litellm) gives the SDLC platform a
single OpenAI-compatible endpoint in front of 100+ LLM providers
(OpenAI, Anthropic, Bedrock, Azure, Cohere, Mistral, local Ollama, ...).
Running it as a sidecar lets the Go `llm-gateway` drop almost every
provider-specific SDK and instead route through one HTTP call. The
gateway keeps its enterprise-only concerns — tenant isolation, auth,
DLP, audit logging, OPA policy — while LiteLLM owns model fallback,
retry, per-tenant rate limiting, and cost tracking.

This wave is **additive and opt-in**. The native OpenAI, Anthropic, and
Ollama providers stay in place. Flipping `litellm_enabled: false`
restores pre-wave behavior with no code change.

## What shipped in this wave

| Path                                                             | Purpose                                              |
|------------------------------------------------------------------|------------------------------------------------------|
| `deployments/litellm/config.yaml`                                | LiteLLM router: model list, fallbacks, tier quotas   |
| `deployments/litellm/docker-compose.yml`                         | Sidecar stack (LiteLLM + Redis)                      |
| `deployments/litellm/README.md`                                  | Deployment and smoke-test guide                      |
| `services/llm-gateway/internal/providers/litellm/litellm.go`     | Provider implementing `providers.Provider`           |
| `services/llm-gateway/internal/providers/litellm/client.go`      | HTTP client, auth, cost-header parsing               |
| `services/llm-gateway/internal/providers/litellm/types.go`       | OpenAI-compatible request/response structs           |
| `services/llm-gateway/internal/providers/litellm/streaming.go`   | SSE stream reader                                    |
| `services/llm-gateway/config.yaml`                               | New `litellm_enabled` flag + `litellm:` block        |

All source files stay under the 200-line portfolio cap.

## Environment variables

| Variable                        | Required | Default                    | Used by                   |
|---------------------------------|----------|----------------------------|---------------------------|
| `LITELLM_ENABLED`               | no       | `false`                    | llm-gateway runtime flag  |
| `LITELLM_PROXY_URL`             | yes*     | `http://litellm:4000`      | llm-gateway               |
| `LITELLM_MASTER_KEY`            | yes      | —                          | llm-gateway + sidecar     |
| `LITELLM_DATABASE_URL`          | no       | —                          | sidecar (spend tracking)  |
| `OPENAI_API_KEY`                | one-of   | —                          | sidecar                   |
| `ANTHROPIC_API_KEY`             | one-of   | —                          | sidecar                   |
| `AWS_BEDROCK_ACCESS_KEY_ID`     | one-of   | —                          | sidecar                   |
| `AWS_BEDROCK_SECRET_ACCESS_KEY` | one-of   | —                          | sidecar                   |
| `AWS_BEDROCK_REGION`            | no       | `us-east-1`                | sidecar                   |
| `AZURE_API_KEY`                 | one-of   | —                          | sidecar                   |
| `AZURE_API_BASE`                | one-of   | —                          | sidecar                   |
| `AZURE_API_VERSION`             | no       | `2024-02-15-preview`       | sidecar                   |
| `COHERE_API_KEY`                | one-of   | —                          | sidecar                   |
| `REDIS_HOST` / `REDIS_PORT`     | no       | `redis` / `6379`           | sidecar (cache + quotas)  |

`yes*` = required only when `litellm_enabled` is true.

## Run the sidecar

```bash
cd deployments/litellm
cp .env.example .env   # fill in provider keys + LITELLM_MASTER_KEY
docker compose up -d
docker compose logs -f litellm
```

LiteLLM listens on `http://localhost:4000`. If you are using the
platform's shared `sdlc-net` network, other services reach it at
`http://litellm:4000`.

## Smoke test

```bash
# 1. Liveliness
curl -s http://localhost:4000/health/liveliness

# 2. Non-streaming chat
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role":"user","content":"say hi"}],
    "max_tokens": 8,
    "user": "tenant-demo"
  }' | jq

# 3. Streaming
curl -N http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-haiku","stream":true,"user":"tenant-demo",
       "messages":[{"role":"user","content":"count to 3"}]}'
```

You should see `x-litellm-response-cost` and `x-litellm-model-id` on
the non-streaming response — the Go provider reads these headers and
attaches them to `CompletionResponse.Cost` and `.Model`.

## Wiring the Go gateway

1. Set the flag in `services/llm-gateway/config.yaml`:
   ```yaml
   litellm_enabled: true
   litellm:
     proxy_url: "${LITELLM_PROXY_URL:-http://litellm:4000}"
     master_key: "${LITELLM_MASTER_KEY}"
   ```
2. Export env vars in the gateway pod:
   ```bash
   export LITELLM_ENABLED=true
   export LITELLM_PROXY_URL=http://litellm:4000
   export LITELLM_MASTER_KEY=sk-litellm-...
   ```
3. Register the provider at startup (inside the provider factory):
   ```go
   if cfg.LiteLLMEnabled {
       reg.Add(litellm.New(cfg.LiteLLM.AsProviderConfig()))
   }
   ```

From the caller's point of view nothing changes — they still POST to
the gateway's `/v1/completions`. Internally the request now flows:

```
client -> llm-gateway (auth, tenant, policy, DLP, audit)
       -> LiteLLM sidecar (routing, retry, rate limit, cost)
       -> upstream provider
```

## Migration path

The existing OpenAI / Anthropic / Ollama providers stay compiled in.
The rollout is a traffic shift, not a rewrite:

1. **Canary**: leave `litellm_enabled: false` in production; enable it
   only in staging. Run the full integration test suite against staging.
2. **Shadow**: enable LiteLLM in production for a single tenant via
   tenant-scoped config override. Compare latency, cost, error rates
   against the native providers for 48h.
3. **Primary**: flip `litellm_enabled: true` globally. The native
   providers become the fallback path if the sidecar is unreachable.
4. **Cleanup** (future wave): once LiteLLM is stable, the provider
   factory can stop registering the native providers in new deploys.
   Do not delete their code yet — they are still the rollback surface.

## Rollback

Set `litellm_enabled: false` (or `LITELLM_ENABLED=false`) and redeploy.
The gateway instantly resumes routing through the native providers.
No database migration, no data loss, no client-visible change.

## Open items for wave 3

- [ ] Plumb `cfg.LiteLLMEnabled` through the provider factory in
      `internal/providers/factory.go`.
- [ ] Add integration test: Go gateway -> litellm container -> mock
      upstream (`testcontainers-go` + WireMock).
- [ ] Emit Prometheus metric `llm_gateway_litellm_requests_total`
      labelled by model and upstream provider.
- [ ] Export the `x-litellm-response-cost` header value into the
      cost-tracking pipeline so per-tenant spend lines up with
      LiteLLM's own accounting.
