# OpenHands + SDLC.ai Integration

Use [OpenHands](https://openhands.dev) (open-source AI coding agents) with SDLC.ai for compliant, audited LLM traffic.

## Overview

OpenHands agents call LLM APIs (OpenAI, Anthropic, etc.). Route those calls through the SDLC proxy so all prompts and responses get PII redaction, audit logging, and policy enforcement.

## Quick Setup

### 1. Get Your SDLC API Key

Sign up at [sdlc.cc](https://sdlc.cc) and obtain an API key from the dashboard.

### 2. Configure OpenHands to Use SDLC Proxy

Set the LLM base URL to your SDLC proxy endpoint:

```bash
# Environment variables for OpenHands
export OPENAI_API_BASE="https://api.sdlc.cc/v1"
export OPENAI_API_KEY="sk-sdlc-your-key-here"

# Or for Anthropic
export ANTHROPIC_API_BASE="https://api.sdlc.cc/v1"
export ANTHROPIC_API_KEY="sk-sdlc-your-key-here"
```

### 3. OpenHands Config File

If using a config file (e.g. `~/.openhands/config.yaml` or project config):

```yaml
# Point OpenHands to SDLC proxy
llm:
  provider: openai  # or anthropic
  base_url: "https://api.sdlc.cc/v1"
  api_key: "sk-sdlc-your-key-here"
```

### 4. Run OpenHands

```bash
# CLI
openhands "Fix the bug in src/utils.py"

# Or with Python SDK
from openhands import Agent
agent = Agent()
# Uses OPENAI_API_BASE / OPENAI_API_KEY from env
```

## What SDLC Provides

- **PII redaction** before data reaches the LLM
- **Audit trail** for compliance (who, when, what)
- **Policy enforcement** (rate limits, model allowlists)
- **Multi-provider** (OpenAI, Anthropic, etc.) through one endpoint

## Supported OpenHands Modes

| Mode | Supported | Notes |
|------|-----------|-------|
| CLI | Yes | Set env vars before running |
| Local GUI | Yes | Configure base URL in settings |
| Python SDK | Yes | Pass base_url to client |
| Cloud Platform | Partial | Use custom endpoint if configurable |

## Troubleshooting

- **401 Unauthorized:** Verify API key from dashboard; ensure no extra whitespace.
- **Connection refused:** Confirm `api.sdlc.cc` (or your proxy URL) is reachable.
- **Model not found:** SDLC proxy forwards to upstream; ensure model is enabled in your plan.

## See Also

- [Getting Started](/getting-started) — General proxy setup
- [NEW_FEATURES_AND_OPEN_SOURCE_AI_INTEGRATION.md](../NEW_FEATURES_AND_OPEN_SOURCE_AI_INTEGRATION.md) — Full integration guide
