# OpenClaw & OpenHands — Embedded Integration

**Status:** Implemented  
**Last updated:** February 27, 2026

OpenClaw and OpenHands are **embedded** in UPM.Plus — they run inside our stack, not as external SaaS. No public exposure of optional integrations.

---

## 1. What Are OpenClaw and OpenHands?

### OpenClaw
- **Purpose:** Open-source, self-hosted AI agent framework that connects LLMs to messaging apps.
- **Features:** Multi-model (Claude, OpenAI, Gemini, Ollama), 20+ channels (WhatsApp, Telegram, Discord, Slack, iMessage), 50+ tools, WebSocket gateway, Control UI.
- **Embedded:** Fork in `openclaw/` (git submodule). Docker builds from `./openclaw`. Configure channels via Control UI at `:18789`. See `FORKS.md`.

### OpenHands
- **Purpose:** AI-driven software development framework (code generation, refactoring, debugging).
- **Features:** Python SDK, CLI, React GUI, Cloud API; pre-built tools (bash, file edit, web browse, MCP).
- **Embedded:** Uses vendored fork `vendor/openhands` (git submodule). No external API. DevelopmentAgent runs OpenHands via SDK when `OPENHANDS_MODE=sdk` (default). See `FORKS.md`.

---

## 2. OpenClaw Integration

### 2.1 Architecture Options

| Option | Description | When to use |
|--------|-------------|-------------|
| **A. Webhook receiver** | OpenClaw sends incoming messages to UPM.Plus webhook; we create tasks/chat messages and return replies. | OpenClaw is primary; we are the “backend brain”. |
| **B. OpenClaw as client** | Our API is the source of truth; an optional bridge service calls OpenClaw’s API to send/receive per channel. | We own orchestration; OpenClaw is one channel layer. |
| **C. Sidecar** | OpenClaw runs as sidecar; shared Redis/queue for message passing. | Self-hosted, low latency, more ops complexity. |

**Recommended:** Start with **A** (webhook receiver) for minimal coupling and fast rollout.

### 2.2 Webhook Receiver Design

- **Endpoint:** `POST /api/v1/integrations/openclaw/incoming` (tenant-scoped, authenticated or signed).
- **Flow:**
  1. Validate signature/secret (e.g. `X-OpenClaw-Signature`).
  2. Deduplicate by `message_id` (Redis or DB) for idempotency.
  3. Map `channel_id` + `user_id` to tenant and optional user.
  4. Create chat message or task (e.g. “run workflow X” or “ask agent Y”).
  5. Enqueue workflow/agent execution; on completion, call OpenClaw outbound API to send reply (or use OpenClaw’s callback URL if supported).
- **Robustness:** Idempotency, rate limit per channel/user, circuit breaker for outbound calls to OpenClaw, audit log for every incoming/outgoing message.

### 2.3 Exposing UPM.Plus to OpenClaw as Tools

- Register MCP-compatible or HTTP tools that OpenClaw can call: e.g. “run_workflow”, “query_knowledge”, “list_agents”.
- Implement in our MCP layer or as small HTTP handlers; reuse existing auth (API key or JWT for server-to-server).

---

## 3. OpenHands Integration

### 3.1 Architecture

- Add a new agent type **DevelopmentAgent** (or **OpenHandsAgent**) that implements `UPMAgent`.
- **Execution:** For each task, the agent calls either:
  - **OpenHands Cloud API** (REST): `POST https://app.all-hands.dev/api/conversations` with `initial_user_msg` and repo/workspace; poll or webhook for result.
  - **OpenHands SDK (local):** Subprocess or in-process SDK call with sandboxed workspace (e.g. temp dir or container).
- **Result:** Map OpenHands result (patch, summary, logs) to `TaskResult` and optionally attach artifacts (diffs, files) to the task.

### 3.2 Security and Robustness

- **Sandboxing:** Run OpenHands in a dedicated workspace (ephemeral dir or container); no direct access to host or main app DB.
- **Quotas:** Per-tenant and per-user rate limits and token/cost caps for OpenHands API to avoid runaway cost.
- **Timeouts:** Hard timeout for each OpenHands run (e.g. 5–15 minutes); kill and return partial result on timeout.
- **Audit:** Log every delegation to OpenHands (tenant, user, task id, input hash, duration, success/failure).

### 3.3 Placement in Registry

- Register `DevelopmentAgent` in `backend/app/agents/__init__.py` and in the agent registry with capability tags (e.g. `code_generation`, `refactor`, `debug`).
- Workflow nodes can reference “development” or “openhands” agent type; task executor routes to DevelopmentAgent when OpenHands is enabled.

---

## 4. Robustness Features (Platform-Wide)

Apply these to OpenClaw, OpenHands, and other external integrations (MCP, LLM APIs, etc.) to make the platform more robust.

| Feature | Description | Where |
|--------|-------------|--------|
| **Circuit breaker** | After N failures or error rate threshold, stop calling the integration for a cooldown period; then half-open probe. | Per integration client (OpenClaw, OpenHands, MCP). |
| **Health checks** | `/health` or `/health/ready` reports status of optional integrations (e.g. `openclaw: optional, unreachable`; `openhands: optional, ok`). | Health endpoint; no hard failure if optional. |
| **Rate limiting** | Per-tenant and per-user limits for OpenHands and OpenClaw outbound calls; return 429 and audit. | Middleware or service layer; reuse Redis. |
| **Feature flags** | Config or DB flags: `OPENCLAW_ENABLED`, `OPENHANDS_ENABLED` per tenant (or global). Disabled = adapter no-op or 503. | Config + optional tenant override in DB. |
| **Audit logging** | Every external call: integration name, tenant, user, task id, timestamp, success/failure, duration. | Central audit service; immutable store. |
| **Idempotency** | For incoming webhooks (OpenClaw), use `message_id` (or similar) as idempotency key; ignore duplicates. | Webhook handler + Redis/DB. |
| **Timeouts and retries** | All outbound HTTP calls: connect/read timeouts; retry with backoff and max attempts; then circuit breaker. | Shared HTTP client or wrapper. |
| **Unified adapter interface** | Abstract interface for “external agent” (e.g. `submit_task`, `get_status`, `get_result`). OpenHands and future frameworks implement it. | `backend/app/integrations/base.py` (see below). |

---

## 5. Unified External-Agent Adapter Interface

To add OpenHands, OpenClaw (as tool executor), or other frameworks without duplicating logic:

```python
# backend/app/integrations/base.py (conceptual)
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from uuid import UUID

class ExternalAgentAdapter(ABC):
    """Interface for external agent frameworks (OpenHands, OpenClaw tools, etc.)."""

    @property
    def name(self) -> str:
        """Integration name for health and audit."""
        ...

    @abstractmethod
    async def submit_task(self, task_payload: Dict[str, Any], context: Dict[str, Any]) -> str:
        """Submit task; return external task_id."""
        ...

    @abstractmethod
    async def get_status(self, external_task_id: str) -> str:
        """Return status: pending|running|completed|failed."""
        ...

    @abstractmethod
    async def get_result(self, external_task_id: str) -> Dict[str, Any]:
        """Return result payload or raise if not ready."""
        ...

    async def cancel(self, external_task_id: str) -> bool:
        """Optional: cancel running task."""
        return False
```

- **OpenHandsAdapter:** Wraps Cloud API or SDK; implements `submit_task` (create conversation), `get_status` (poll), `get_result` (artifacts + summary).
- **OpenClawAdapter (outbound):** If we use OpenClaw to execute “tools”, same interface could represent “send message and wait for response” as a task.

This keeps workflow engine and task executor agnostic of the specific integration.

---

## 6. Configuration

Add to config (or dedicated `integrations_config.py` to keep `config.py` under 200 lines):

- `OPENCLAW_ENABLED`: bool, default False.
- `OPENCLAW_WEBHOOK_SECRET`: for verifying incoming webhooks.
- `OPENCLAW_API_URL`, `OPENCLAW_API_KEY`: for outbound replies.
- `OPENHANDS_ENABLED`: bool, default False.
- `OPENHANDS_MODE`: `cloud` | `sdk`.
- `OPENHANDS_API_URL`, `OPENHANDS_API_KEY`: for Cloud mode.
- `OPENHANDS_WORKSPACE_ROOT`: for SDK mode (sandbox dir).
- `OPENHANDS_MAX_DURATION_SECONDS`, `OPENHANDS_RATE_LIMIT_PER_TENANT_PER_HOUR`: robustness.

---

## 7. Suggested File Layout

- `backend/app/integrations/base.py` — `ExternalAgentAdapter` and shared helpers (timeout, retry, circuit breaker).
- `backend/app/integrations/openhands_adapter.py` — OpenHands implementation.
- `backend/app/integrations/openclaw_webhook.py` — Incoming webhook handler and idempotency.
- `backend/app/agents/development_agent.py` — DevelopmentAgent using OpenHandsAdapter.
- `backend/app/api/v1/endpoints/integrations.py` — Routes for `/integrations/openclaw/incoming` and optional admin/status.

Keep each file under 200 lines; split by handler vs. client vs. model if needed.

---

## 8. Summary

- **OpenClaw:** Integrate as a channel gateway via webhook receiver; optional outbound API for replies; expose UPM.Plus as tools to OpenClaw.
- **OpenHands:** New DevelopmentAgent + OpenHandsAdapter (Cloud API or SDK); sandboxing, quotas, timeouts, audit.
- **Robustness:** Circuit breaker, health checks, rate limits, feature flags, audit logging, idempotency, timeouts/retries, and a unified external-agent adapter interface for all such integrations.

Implementing the adapter interface and one integration (e.g. OpenHands) first gives a template for adding OpenClaw and future frameworks while keeping the system secure and maintainable.
