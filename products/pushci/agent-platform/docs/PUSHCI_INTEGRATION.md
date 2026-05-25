# PushCI Integration

## Objective

Make PushCI the first tenant of the shared agent platform.

This replaces the current thin AI layer in:
- [api/src/nlp.ts](../../api/src/nlp.ts)
- [api/src/ai-gateway.ts](../../api/src/ai-gateway.ts)

## Edge-to-Core Flow

1. Dashboard calls `api.pushci.dev`
2. PushCI Worker authenticates the user
3. Worker or Go core loads product context
4. PushCI creates or resumes an `agent-platform` session
5. `agent-platform` runs a tool loop using the PushCI toolpack
6. Tool calls hit PushCI-owned APIs
7. Events stream back to the dashboard

## Initial Env Vars

PushCI edge:
- `AGENT_CORE_URL`
- `AGENT_CORE_TOKEN`
- browser/user JWT remains at PushCI edge; it is never forwarded directly to `agent-platform`

Agent Platform:
- `PRODUCT=pushci`
- `TENANT_POLICY_MODE=pushci-default`
- `PUSHCI_API_BASE_URL`
- `PUSHCI_SERVICE_TOKEN`
- `AGENT_CORE_TOKEN`

## Network Note

If Cloudflare Workers call the shared runtime directly, `agent-core` cannot be a Render private service.

Valid first deploy shapes:
- Render web service protected by service token or Cloudflare Access
- Render web service ingress that forwards to deeper private services on the same Render network

Invalid first deploy shape:
- Cloudflare Worker calling a Render private service hostname directly

## Initial Tool Surface

- `pushci.get_project`
- `pushci.list_runs`
- `pushci.get_run`
- `pushci.get_run_logs`
- `pushci.save_pipeline`
- `pushci.retry_run`
- `pushci.create_fix_pr`

## Security Boundary

- `agent-platform` only accepts service-authenticated requests
- `agent-platform` uses a separate service token when calling PushCI internal APIs
- mutating tools must still be authorized by PushCI role/policy checks before execution

## Suggested Endpoint Mapping

PushCI -> Agent Platform:
- `POST /internal/agent/sessions`
- `POST /internal/agent/sessions/:id/messages`
- `GET /internal/agent/sessions/:id/events`

Agent Platform -> PushCI:
- `GET /internal/projects/:id`
- `GET /internal/projects/:id/runs`
- `GET /internal/runs/:id`
- `GET /internal/runs/:id/logs`
- `PUT /internal/projects/:id/pipeline`
- `POST /internal/runs/:id/retry`
- `POST /internal/runs/:id/fix-pr`

## First User Stories

1. Ask why a run failed and cite the real failing step
2. Ask to regenerate or edit a pipeline
3. Ask to retry a failed run
4. Ask to create a fix PR suggestion with concrete next steps
