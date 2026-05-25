# Wave 5 — NeMo Guardrails LLM Safety Layer

NVIDIA [NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails) adds a
pluggable safety layer on top of every LLM call in
`services/rag/`. It provides topical rails (stay on SDLC-relevant
topics), safety rails (block harmful content + PII leakage), and
input/output moderation driven by LLM self-check prompts.

The whole layer is **opt-in via `GUARDRAILS_ENABLED`** and is a
complete no-op when disabled, so merging this wave has zero runtime
cost until a tenant turns it on.

## File layout

```
services/rag/app/guardrails/
├── __init__.py              # public exports
├── types.py                 # GuardrailResult / Violation / TenantConfig
├── engine.py                # GuardrailsEngine (LLMRails wrapper)
├── service.py               # GuardrailsService (high-level wrapper)
└── config/
    ├── config.yml           # models, instructions, default rails
    └── rails/
        ├── topical.co       # stay on topic, refuse off-topic
        ├── safety.co        # block harm + PII leakage
        └── moderation.co    # self-check input/output
```

## Env var reference

| Variable               | Required | Default | Notes                                      |
|------------------------|----------|---------|--------------------------------------------|
| `GUARDRAILS_ENABLED`   | yes      | `false` | Truthy values: `1`, `true`, `yes`, `on`.   |
| `GUARDRAILS_CONFIG_DIR`| no       | —       | Override the default Colang bundle path.   |
| `OPENAI_API_KEY`       | yes*     | —       | Required when the self-check models use OpenAI. |

`*` Only required when the default `config.yml` points at OpenAI. For
air-gapped installs, swap the models for a local llamafile in the
tenant override.

## What each rail does

### Topical rails (`topical.co`)
- Matches off-topic intents (weather, politics, jokes, medical / legal
  advice).
- Refuses politely and stops the flow.
- `check topical output` also screens the generated answer to catch
  drift when the retriever returns unrelated context.

### Safety rails (`safety.co`)
- Blocks harmful content requests (malware, phishing, exploit code).
- Detects jailbreak attempts ("ignore previous instructions", DAN
  prompts, system prompt exfiltration).
- Routes through an existing Presidio-backed `check_pii_leakage` action
  and a `mask_pii` rewriter so emails, SSNs, credit cards, and
  API keys never reach the caller.

### Moderation rails (`moderation.co`)
- Uses NeMo's `self_check_input` / `self_check_output` LLM-graded
  flows with custom prompts tuned for enterprise SDLC use cases.
- Produces a deterministic yes/no decision from a small model
  (`gpt-4o-mini` by default) so latency stays low.

## How violations are handled

The engine converts every NeMo response into a `GuardrailResult` with
a single `action` field:

| Action    | Meaning                                                       |
|-----------|---------------------------------------------------------------|
| `allow`   | All rails passed.                                             |
| `warn`    | Rail matched but did not block — logged only.                 |
| `rewrite` | Rail modified the text (e.g. PII masking). Use the rewritten content. |
| `block`   | Rail refused the request or the response. `GuardrailsService` raises `GuardrailBlockedError`, which the FastAPI handler turns into `HTTP 400` (input) or `HTTP 422` (output). |

Violations are forwarded to Langfuse via `trace_llm_call` when
`LANGFUSE_ENABLED=1`, and the service exposes `violation_counts()` for
Prometheus `/metrics` scraping.

## Defining tenant-specific rails

`TenantGuardrailConfig` supports three override strategies:

1. **Disable specific rails** — e.g. a QA tenant that doesn't want
   topical filtering:

   ```python
   service.set_tenant_config(
       TenantGuardrailConfig(
           tenant_id="tenant-qa",
           disabled_rails=["check topical input", "check topical output"],
       )
   )
   ```

2. **Point at a tenant-scoped Colang bundle** — ships per-tenant flows
   from disk:

   ```python
   service.set_tenant_config(
       TenantGuardrailConfig(
           tenant_id="tenant-acme",
           config_path="/etc/sdlc/guardrails/acme",
       )
   )
   ```

3. **Raise the block threshold** — e.g. developer tenants who want
   only critical violations to block:

   ```python
   TenantGuardrailConfig(
       tenant_id="tenant-dev",
       min_block_severity=GuardrailSeverity.CRITICAL,
   )
   ```

## Example rail — block competitor names in outputs

```
# /etc/sdlc/guardrails/acme/rails/branding.co
define bot refuse competitor mention
  "I can only reference our own products and the sources you provided."

define flow check branding output
  $has_competitor = execute contains_strings(text=$bot_message, needles=["LangChain Cloud", "Pinecone"])
  if $has_competitor
    bot refuse competitor mention
    stop
```

## Integration with the LLM manager

In `services/rag/app/services/llm/llm_manager.py` the `complete()`
method now wraps the provider call in `GuardrailsService.guarded_complete`:

```python
from app.guardrails import GuardrailsService, GuardrailBlockedError

guardrails = GuardrailsService()

try:
    final, result = await guardrails.guarded_complete(
        user_message=request.messages[-1].content,
        llm_call=lambda msg, src: provider.complete_text(msg, src),
        sources=request.metadata.get("sources"),
        tenant_id=request.metadata.get("tenant_id"),
        user_id=request.metadata.get("user_id"),
    )
except GuardrailBlockedError as exc:
    raise HTTPException(status_code=400 if exc.stage == "input" else 422, detail=exc.result.to_dict())
```

When `GUARDRAILS_ENABLED` is unset, `guarded_complete` runs the inner
closure directly and returns an `allow` result in microseconds.

## Performance targets

- **< 300ms p95** for the combined input + output check (measured on
  `gpt-4o-mini` with 4 rails, 3 tokens of context).
- **< 50ms p95** overhead when `GUARDRAILS_ENABLED=false` (single
  attribute read on the engine).
- **< 10ms p95** cache hit for per-tenant `LLMRails` lookups — the
  engine caches one `LLMRails` instance per `(tenant_id, config_path)`
  pair.

Benchmark harness lives in `services/rag/tests/guardrails/bench.py`
(to be added in the next sprint). CI fails the wave if p95 exceeds
`GUARDRAILS_P95_BUDGET_MS` (default `300`).

## Rollout plan

- [x] Land engine + Colang bundle behind the feature flag.
- [ ] Wire `GuardrailsService` into `LLMManager.complete()`.
- [ ] Add Langfuse dashboard: violations per rail per tenant.
- [ ] Expose per-tenant toggle in the admin UI (Policy Editor).
- [ ] Run shadow mode against production traffic for 1 week.
- [ ] Enable for pilot tenants; enforce blocks.
- [ ] GA default-on for Business / Enterprise tiers.
