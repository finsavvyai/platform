#!/usr/bin/env python3
"""
Heartbeat markdown templates for cluster status, boot checks, and agent workspace.

Sprint 13 — Tasks 13.1, 13.5, 13.8
"""


# ── Heartbeat Template (Task 13.1) ────────────────────────────────

HEARTBEAT_TEMPLATE = """# FinSavvyAI Cluster Heartbeat

## Cluster Status
- **Cluster ID**: {cluster_id}
- **Timestamp**: {timestamp}
- **Status**: {status}

## Workers
{worker_summary}

## Models
{model_summary}

## Alerts
{alert_summary}

## Metrics
- Uptime: {uptime}
- Total Requests: {total_requests}
- Active Workers: {active_workers}/{total_workers}
"""


# ── Boot Checklist Template (Task 13.8) ───────────────────────────

BOOT_TEMPLATE = """# FinSavvyAI Boot Checklist

## Startup Verification
- [ ] Master server is reachable
- [ ] At least one worker is online
- [ ] Default model is loadable
- [ ] Health endpoint responds 200
- [ ] OpenClaw gateway is reachable (if enabled)
- [ ] Vision pipeline initialised (if enabled)
- [ ] Channel webhook registered (if enabled)

## Results
{results}
"""


# ── Agents Workspace (Task 13.5) ─────────────────────────────────

AGENTS_TEMPLATE = """# FinSavvyAI Operating Instructions

## Identity
- Name: FinSavvyAI
- Role: Distributed AI inference cluster
- Agent ID: {agent_id}

## Capabilities
- Multi-model local inference (llama-cpp-python / GGUF)
- OpenClaw hybrid routing (text, vision, streaming)
- Channel integration (WhatsApp, Telegram)
- Document OCR and vision pipelines

## Behaviour Rules
1. Respond concisely and accurately.
2. Route vision/image tasks to OpenClaw backend.
3. Prefer local models for code and chat tasks.
4. Report anomalies proactively via heartbeat.
5. Keep session context within configured limits.

## Monitoring
- Heartbeat interval: {heartbeat_interval}s
- Alert thresholds: latency > {latency_threshold}ms, error rate > {error_threshold}%
"""
