# OpenCLaw Integration Guide

## Overview

[OpenCLaw](https://openclaw.com) is an open-source local AI assistant created by Peter Steinberger in November 2025. It provides a browser-based AI assistant with API endpoints for integration with external applications and services.

## Key Information

| Attribute | Details |
|-----------|---------|
| **Created** | November 2025 |
| **Creator** | Peter Steinberger (PSPDFKit founder) |
| **Type** | Open-source local AI assistant |
| **Architecture** | Browser-based with HTTP API |

## Integration Approach for FinSavvyAI

### Option 1: Proxy Mode (Recommended)

Treat OpenCLaw as another inference backend. The FinSavvyAI gateway can route requests to OpenCLaw when specific models or task types require it.

**Architecture:**
```
┌─────────────┐
│   Client     │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│  FinSavvyAI Gateway │  ← Routes based on model/task
└──────┬───────────────┘
       │
       ├───────────┬──────────────┐
       ▼            ▼               ▼
┌────────────┐  ┌───────────┐  ┌──────────┐
│ OpenCLaw   │  │ Worker     │  │ LLaMA     │
│ (via API)   │  │ (llama)    │  │ Model     │
└────────────┘  └───────────┘  └──────────┘
```

**Implementation:**
```python
# src/core/openclaw_client.py (new module)

import aiohttp
from typing import Dict, Any, Optional

class OpenCLawClient:
    """Client for interacting with OpenCLaw API."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session

    async def complete(
        self,
        prompt: str,
        model: str = "default",
        stream: bool = False,
    ) -> Dict[str, Any]:
        """Send completion request to OpenCLaw."""
        session = await self._get_session()

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
        }

        async with session.post(
            f"{self.base_url}/v1/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            if response.status == 200:
                return await response.json()
            else:
                return {
                    "error": f"OpenCLaw returned {response.status}",
                    "details": await response.text(),
                }

    async def chat(
        self,
        messages: list,
        model: str = "default",
    ) -> Dict[str, Any]:
        """Send chat completion request to OpenCLaw."""
        session = await self._get_session()

        payload = {
            "model": model,
            "messages": messages,
        }

        async with session.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            if response.status == 200:
                return await response.json()
            else:
                return {
                    "error": f"OpenCLaw returned {response.status}",
                    "details": await response.text(),
                }

    async def is_available(self) -> bool:
        """Check if OpenCLaw service is reachable."""
        try:
            session = await self._get_session()
            async with session.get(
                f"{self.base_url}/health",
                timeout=aiohttp.ClientTimeout(total=5),
            ) as response:
                return response.status == 200
        except Exception:
            return False
```

### Option 2: Hybrid Mode

FinSavvyAI aggregates multiple inference sources:
- Local models (llama-cpp-python)
- OpenCLaw (via HTTP API)
- Other external APIs

**Configuration:**
```python
# src/core/hybrid_router.py (new module)

from src.core.openclaw_client import OpenCLawClient
from src.core.inference_engine import InferenceEngine

class HybridRouter:
    """Router that supports multiple inference backends."""

    def __init__(self):
        self.openclaw = OpenCLawClient(
            base_url=os.environ.get("OPENCLAW_URL", "http://localhost:11434")
        )
        self.local_engine = InferenceEngine()
        self.route_config = {
            "code": "local",      # Use local for code tasks
            "writing": "openclaw",  # Use OpenCLaw for writing
            "analysis": "openclaw",  # Use OpenCLaw for analysis
            "vision": "openclaw",  # Use OpenCLaw for vision
            "chat": "openclaw",     # Use OpenCLaw for general chat
        }

    async def route(self, prompt: str, task_type: str) -> str:
        """Route request to appropriate backend."""
        backend = self.route_config.get(task_type, "local")
        
        if backend == "openclaw":
            logger.info(f"Routing to OpenCLaw for task: {task_type}")
            return await self.openclaw.complete(prompt)
        else:
            logger.info(f"Routing to local engine for task: {task_type}")
            return await self.local_engine.complete_async(prompt)
```

## Configuration

Add to `.env` or `scripts/config/production.env.example`:

```bash
# OpenCLaw Integration
OPENCLAW_ENABLED=true
OPENCLAW_URL=http://localhost:11434
OPENCLAW_API_KEY=your-api-key-here
OPENCLAW_MODEL=default

# Routing preferences (optional)
ROUTER_PREFERENCE_OPENCLAW_FOR=chat,writing,analysis,vision
```

## Worker Node Changes

Update worker to support OpenCLaw as a fallback:

```python
# src/workers/worker_node.py additions

async def _handle_completion(self, request):
    """Handle completion with OpenCLaw fallback."""
    try:
        # Try local inference first
        if self.engine.is_model_ready(model):
            if stream:
                return await self._stream_response(...)
            else:
                return await self._non_stream_response(...)
        
        # Fallback to OpenCLaw if local unavailable
        if self.openclaw_available and self.openclaw_enabled:
            self.logger.warning(f"Local model unavailable, trying OpenCLaw")
            return await self._openclaw_fallback(request, model, stream)
            
    except Exception as e:
        # Final fallback to OpenCLaw
        if self.openclaw_available and self.openclaw_enabled:
            self.logger.error(f"Local inference failed, using OpenCLaw: {e}")
            return await self._openclaw_fallback(request, model, stream)
```

## Testing

```python
# tests/integration/test_openclaw.py (new file)

import pytest
from src.core.openclaw_client import OpenCLawClient

@pytest.mark.asyncio
async def test_openclaw_health_check():
    """Test OpenCLaw service availability."""
    client = OpenCLawClient()
    assert await client.is_available()

@pytest.mark.asyncio
async def test_openclaw_completion():
    """Test basic completion request."""
    client = OpenCLawClient()
    result = await client.complete("Hello, OpenCLaw!")
    assert "text" in result or "choices" in result

@pytest.mark.asyncio
async def test_openclaw_chat():
    """Test chat completion with messages."""
    client = OpenCLawClient()
    result = await client.chat([
        {"role": "user", "content": "Explain quantum computing"}
    ])
    assert "choices" in result or "text" in result
```

## Pros and Cons

### Pros of Integration
- ✅ **Enhanced Capabilities** - OpenCLaw may have features not in local models
- ✅ **Redundancy** - Fallback option if local models fail
- ✅ **Flexibility** - Users choose between local and cloud inference
- ✅ **No API Key Cost** - OpenCLaw is free and open-source

### Cons of Integration
- ❌ **Dependency** - Requires running OpenCLaw instance (Docker/npm)
- ❌ **Latency** - HTTP API call adds latency vs local inference
- ❌ **Privacy** - Data sent to external service (self-hosted mitigates this)
- ❌ **Complexity** - Another service to monitor and maintain

## Deployment

### Running OpenCLaw Locally

```bash
# Using Docker (recommended)
docker run -d -p 11434:11434 openclaw/openclaw:latest

# Using npm
npm install -g openclaw
openclaw --port 11434
```

Then configure FinSavvyAI:

```bash
export OPENCLAW_URL=http://localhost:11434
export OPENCLAW_ENABLED=true
./scripts/start_worker.sh
```

## References

- [OpenCLaw Website](https://openclaw.com)
- [OpenCLaw GitHub](https://github.com/PeterSuhra/OpenCLaw)
- [API Documentation](https://docs.apiyi.com/en/scenarios/engineering/openclaw)
- [Python Integration Guide](https://apify.com/apify/openclaw/api/python)
