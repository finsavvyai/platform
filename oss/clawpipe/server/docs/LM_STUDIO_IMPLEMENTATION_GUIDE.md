# LM Studio Extension - Implementation Guide

**Quick Start:** Build the LM Studio provider in 2 hours
**Full Integration:** Complete cluster manager in 2 weeks

---

## Part 1: LM Studio Provider (2 hours)

### Step 1: Create Provider Class

**File:** `src/providers/lmstudio_provider.py`

```python
"""LM Studio provider - local model inference via LM Studio API."""

import os
import logging
from typing import AsyncIterator, List
import httpx

from .base import (
    BaseProvider,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    StreamChunk,
)

logger = logging.getLogger("finsavvyai.lmstudio")


class LMStudioProvider(BaseProvider):
    """
    Connect to LM Studio's OpenAI-compatible API server.

    LM Studio runs on http://localhost:1234 by default and provides
    an OpenAI-compatible /v1/chat/completions endpoint.

    Example:
        provider = LMStudioProvider()
        response = await provider.chat(ChatRequest(...))
    """

    name = "lmstudio"

    def __init__(self, base_url: str = ""):
        """
        Initialize LM Studio provider.

        Args:
            base_url: LM Studio API server URL.
                     Defaults to http://localhost:1234
                     Can be set via LMSTUDIO_BASE_URL env var.
        """
        self.base_url = (
            base_url or os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234")
        ).rstrip("/")

        logger.info(f"LM Studio provider initialized for {self.base_url}")

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """
        Send chat completion request to LM Studio.

        Args:
            request: Chat request with messages, model, parameters

        Returns:
            ChatResponse with generated content and usage stats

        Raises:
            httpx.HTTPError: If request fails
            RuntimeError: If LM Studio is not reachable
        """
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        payload = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
        }

        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens
        if request.stop:
            payload["stop"] = request.stop

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

        except httpx.ConnectError as e:
            raise RuntimeError(
                f"Cannot connect to LM Studio at {self.base_url}. "
                f"Ensure LM Studio is running with API server enabled."
            ) from e

        choice = data["choices"][0]

        return ChatResponse(
            content=choice["message"]["content"],
            model=data.get("model", request.model),
            provider=self.name,
            usage={
                "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
                "total_tokens": data.get("usage", {}).get("total_tokens", 0),
            },
            finish_reason=choice.get("finish_reason", "stop"),
        )

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        """
        Stream chat completion from LM Studio.

        Args:
            request: Chat request with messages, model, parameters

        Yields:
            StreamChunk with content deltas
        """
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        payload = {
            "model": request.model,
            "messages": messages,
            "stream": True,
            "temperature": request.temperature,
            "top_p": request.top_p,
        }

        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens
        if request.stop:
            payload["stop"] = request.stop

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/v1/chat/completions",
                    json=payload,
                ) as resp:
                    resp.raise_for_status()

                    async for line in resp.aiter_lines():
                        if not line.strip() or not line.startswith("data: "):
                            continue

                        data_str = line[6:]  # Remove "data: " prefix

                        if data_str == "[DONE]":
                            yield StreamChunk(content="", finish_reason="stop")
                            break

                        try:
                            import json
                            data = json.loads(data_str)

                            if data.get("choices"):
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")

                                if content:
                                    yield StreamChunk(content=content)

                                finish_reason = data["choices"][0].get("finish_reason")
                                if finish_reason:
                                    yield StreamChunk(
                                        content="",
                                        finish_reason=finish_reason
                                    )
                                    break

                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse SSE line: {data_str}")
                            continue

        except httpx.ConnectError as e:
            raise RuntimeError(
                f"Cannot connect to LM Studio at {self.base_url}"
            ) from e

    async def list_models(self) -> List[ModelInfo]:
        """
        List models available in LM Studio.

        Returns:
            List of ModelInfo objects
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/v1/models")
                resp.raise_for_status()
                data = resp.json()

                return [
                    ModelInfo(
                        id=m["id"],
                        provider=self.name,
                        owned_by="lmstudio",
                    )
                    for m in data.get("data", [])
                ]

        except Exception as e:
            logger.warning(f"Failed to list LM Studio models: {e}")
            return []

    async def health_check(self) -> bool:
        """
        Check if LM Studio API server is running.

        Returns:
            True if LM Studio is reachable
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/v1/models")
                return resp.status_code == 200
        except Exception:
            return False
```

### Step 2: Register Provider

**File:** `src/providers/__init__.py`

```python
from .lmstudio_provider import LMStudioProvider

__all__ = ["LMStudioProvider", ...]
```

**File:** `src/core/provider_registry.py`

```python
# In get_registry() function
from src.providers.lmstudio_provider import LMStudioProvider

registry.register("lmstudio", LMStudioProvider())
```

### Step 3: Add Tests

**File:** `tests/unit/test_lmstudio_provider.py`

```python
"""Tests for LM Studio provider."""

import pytest
from src.providers.lmstudio_provider import LMStudioProvider
from src.providers.base import ChatRequest, ChatMessage

@pytest.fixture
def provider():
    return LMStudioProvider("http://localhost:1234")

@pytest.mark.asyncio
async def test_health_check(provider):
    """Test LM Studio health check."""
    # This test requires LM Studio to be running
    is_healthy = await provider.health_check()
    assert isinstance(is_healthy, bool)

@pytest.mark.asyncio
async def test_list_models(provider):
    """Test listing models from LM Studio."""
    models = await provider.list_models()
    assert isinstance(models, list)

@pytest.mark.asyncio
async def test_chat_completion(provider):
    """Test basic chat completion."""
    request = ChatRequest(
        model="test-model",
        messages=[ChatMessage(role="user", content="Hello")],
        temperature=0.7,
        top_p=0.9,
    )

    # This test requires LM Studio with a loaded model
    try:
        response = await provider.chat(request)
        assert response.content
        assert response.model
        assert response.provider == "lmstudio"
    except RuntimeError:
        pytest.skip("LM Studio not running")

@pytest.mark.asyncio
async def test_chat_stream(provider):
    """Test streaming chat completion."""
    request = ChatRequest(
        model="test-model",
        messages=[ChatMessage(role="user", content="Hello")],
        temperature=0.7,
    )

    chunks = []
    try:
        async for chunk in provider.chat_stream(request):
            chunks.append(chunk)
            if chunk.finish_reason:
                break

        assert len(chunks) > 0
    except RuntimeError:
        pytest.skip("LM Studio not running")
```

### Step 4: Update Documentation

**File:** `docs/OPENAI_COMPAT.md`

```markdown
## LM Studio Integration

FinSavvyAI supports LM Studio as a provider for local LLM inference.

### Setup

1. Install LM Studio from https://lmstudio.ai
2. Load a model in LM Studio
3. Enable the API server (Settings → Developer → Enable API Server)
4. Set environment variable:

```bash
export LMSTUDIO_BASE_URL="http://localhost:1234"
```

5. FinSavvyAI will auto-discover and use LM Studio models

### Usage

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="any",
)

response = client.chat.completions.create(
    model="lmstudio/your-model-name",  # LM Studio model
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### Available Models

FinSavvyAI automatically detects models loaded in LM Studio.
Check available models:

```bash
curl http://localhost:8080/v1/models
```
```

### Step 5: Update CLI

**File:** `src/cli/cli_commands.py`

```python
# In doctor command
async def check_lmstudio():
    """Check LM Studio connection."""
    from src.providers.lmstudio_provider import LMStudioProvider

    provider = LMStudioProvider()
    is_healthy = await provider.health_check()

    if is_healthy:
        console.print("[✓] LM Studio detected")
        models = await provider.list_models()
        if models:
            console.print(f"  Models: {', '.join(m.id for m in models)}")
    else:
        console.print("[ ] LM Studio not running")
```

---

## Part 2: Auto-Discovery (3 hours)

### Step 1: Implement mDNS Discovery

**File:** `src/discovery/mdns_discovery.py`

```python
"""Auto-discover LM Studio instances via mDNS."""

import asyncio
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger("finsavvyai.discovery")


@dataclass
class DiscoveredInstance:
    """A discovered LM Studio instance."""
    name: str
    host: str
    port: int
    url: str
    models: List[str]


class LMStudioDiscovery:
    """
    Discover LM Studio instances on the local network.

    Uses mDNS/Bonjour to find instances broadcasting their presence.
    Falls back to scanning common ports if mDNS fails.
    """

    LMSTUDIO_SERVICE = "_lmstudio._tcp.local."
    DEFAULT_PORT = 1234

    def __init__(self):
        self.zeroconf = None
        self.browser = None

    async def discover(
        self,
        timeout: int = 5,
        scan_range: Optional[str] = None
    ) -> List[DiscoveredInstance]:
        """
        Discover LM Studio instances.

        Args:
            timeout: Seconds to wait for discovery
            scan_range: IP range to scan (e.g., "192.168.1.0/24")
                       If None, only mDNS is used

        Returns:
            List of discovered instances
        """
        instances = []

        # Try mDNS first
        try:
            instances.extend(await self._discover_mdns(timeout))
        except Exception as e:
            logger.warning(f"mDNS discovery failed: {e}")

        # Fallback to port scan if requested
        if scan_range:
            instances.extend(await self._scan_network(scan_range))

        # Remove duplicates
        seen = set()
        unique_instances = []
        for instance in instances:
            key = (instance.host, instance.port)
            if key not in seen:
                seen.add(key)
                unique_instances.append(instance)

        return unique_instances

    async def _discover_mdns(self, timeout: int) -> List[DiscoveredInstance]:
        """Discover instances via mDNS."""
        instances = []

        try:
            from zeroconf import ServiceBrowser, Zeroconf
        except ImportError:
            logger.warning("zeroconf not installed, skipping mDNS discovery")
            return instances

        def on_service_change(zeroconf, service_type, name):
            try:
                info = zeroconf.get_service_info(service_type, name)
                if info:
                    host = info.parsed_addresses()[0]
                    port = info.port
                    instances.append(DiscoveredInstance(
                        name=name,
                        host=host,
                        port=port,
                        url=f"http://{host}:{port}",
                        models=[],
                    ))
                    logger.info(f"Discovered LM Studio at {host}:{port}")
            except Exception as e:
                logger.warning(f"Error processing service: {e}")

        zeroconf = Zeroconf()
        browser = ServiceBrowser(
            zeroconf,
            self.LMSTUDIO_SERVICE,
            handlers=[on_service_change]
        )

        await asyncio.sleep(timeout)

        zeroconf.close()
        return instances

    async def _scan_network(self, network: str) -> List[DiscoveredInstance]:
        """Scan network for LM Studio instances."""
        instances = []

        try:
            import httpx
        except ImportError:
            logger.warning("httpx not installed, skipping network scan")
            return instances

        # Parse network range (simple implementation)
        # In production, use ipaddress module for proper CIDR parsing
        base_ip = network.rsplit('.', 1)[0]

        async def check_host(i: int):
            host = f"{base_ip}.{i}"
            try:
                async with httpx.AsyncClient(timeout=1.0) as client:
                    resp = await client.get(
                        f"http://{host}:{self.DEFAULT_PORT}/v1/models",
                        timeout=1.0
                    )
                    if resp.status_code == 200:
                        return DiscoveredInstance(
                            name=f"LM Studio at {host}",
                            host=host,
                            port=self.DEFAULT_PORT,
                            url=f"http://{host}:{self.DEFAULT_PORT}",
                            models=[],
                        )
            except Exception:
                return None

        # Scan last octet 1-254
        tasks = [check_host(i) for i in range(1, 255)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if result and not isinstance(result, Exception):
                instances.append(result)

        return instances

    async def query_models(self, instance: DiscoveredInstance) -> List[str]:
        """Query available models from discovered instance."""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{instance.url}/v1/models")
                if resp.status_code == 200:
                    data = resp.json()
                    return [m["id"] for m in data.get("data", [])]
        except Exception as e:
            logger.warning(f"Failed to query models from {instance.url}: {e}")

        return []
```

### Step 2: Integrate with Gateway

**File:** `src/api/gateway.py`

```python
# In APIGateway.__init__
from src.discovery.mdns_discovery import LMStudioDiscovery

self.discovery = LMStudioDiscovery()

# Auto-discover LM Studio instances on startup
async def _discover_lm_studio_instances(self):
    """Auto-discover and register LM Studio instances."""
    instances = await self.discovery.discover(timeout=3)

    for instance in instances:
        logger.info(f"Discovered LM Studio at {instance.url}")

        # Register as a worker node
        await self._register_worker(
            worker_id=f"lmstudio-{instance.host}",
            base_url=instance.url,
            models=await self.discovery.query_models(instance),
        )
```

---

## Part 3: LM Studio Desktop Extension (1 week)

### Project Structure

```
lmstudio-extension/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts
│   ├── components/
│   │   ├── ClusterPanel.tsx
│   │   ├── NodeCard.tsx
│   │   └── MetricsChart.tsx
│   └── api/
│       └── cluster.ts
└── dist/
```

### Extension Implementation

**File:** `src/extension.ts`

```typescript
import {
  ExtensionAPI,
  ExtensionContext,
  UIRegistry,
} from '@lmstudio/sdk';

import { ClusterPanel } from './components/ClusterPanel';
import { registerClusterAPI } from './api/cluster';

export class FinSavvyAIExtension implements ExtensionAPI {
  private context: ExtensionContext;
  private clusterUrl: string = 'http://localhost:8080';

  async onActivate(context: ExtensionContext): Promise<void> {
    this.context = context;

    // Register cluster panel
    context.ui.registerPanel({
      id: 'finSavvyCluster',
      title: 'FinSavvyAI Cluster',
      component: ClusterPanel,
      icon: 'network',
      location: 'sidebar',
    });

    // Register API routes
    registerClusterAPI(context, this.clusterUrl);

    // Add menu items
    context.ui.addMenuItem({
      id: 'finSavvy.joinCluster',
      label: 'Join FinSavvyAI Cluster',
      icon: 'plus',
      action: () => this.joinCluster(),
    });

    context.ui.addMenuItem({
      id: 'finSavvy.openDashboard',
      label: 'Open FinSavvyAI Dashboard',
      icon: 'external-link',
      action: () => this.openDashboard(),
    });

    // Start background sync
    await this.startClusterSync();
  }

  async onDeactivate(): Promise<void> {
    // Cleanup
  }

  private async joinCluster(): Promise<void> {
    const url = await this.context.ui.prompt({
      title: 'Join FinSavvyAI Cluster',
      message: 'Enter FinSavvyAI Gateway URL:',
      defaultValue: this.clusterUrl,
    });

    if (url) {
      this.clusterUrl = url;

      try {
        await this.context.api.post(`${url}/api/cluster/join`, {
          nodeId: this.context.config.nodeId,
          modelName: this.context.config.currentModel,
          host: this.context.config.apiHost,
          port: this.context.config.apiPort,
        });

        await this.context.ui.notify({
          type: 'success',
          message: 'Successfully joined FinSavvyAI cluster!',
        });
      } catch (error) {
        await this.context.ui.notify({
          type: 'error',
          message: `Failed to join cluster: ${error.message}`,
        });
      }
    }
  }

  private async openDashboard(): Promise<void> {
    this.context.ui.openExternal(`${this.clusterUrl}/dashboard`);
  }

  private async startClusterSync(): Promise<void> {
    // Sync cluster status every 5 seconds
    setInterval(async () => {
      try {
        const status = await this.context.api.get(
          `${this.clusterUrl}/api/cluster/status`
        );

        this.context.ui.setState('clusterStatus', status);
      } catch (error) {
        this.context.logger.error('Failed to sync cluster status:', error);
      }
    }, 5000);
  }
}
```

### Cluster Panel Component

**File:** `src/components/ClusterPanel.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useExtensionContext } from '@lmstudio/sdk';

interface ClusterNode {
  id: string;
  host: string;
  port: number;
  models: string[];
  status: 'online' | 'offline' | 'loading';
  requests: number;
}

export const ClusterPanel: React.FC = () => {
  const context = useExtensionContext();
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to cluster state
    const unsubscribe = context.ui.subscribeState('clusterStatus', (status) => {
      setNodes(status.nodes || []);
      setLoading(false);
    });

    return unsubscribe;
  }, [context]);

  if (loading) {
    return <div>Loading cluster status...</div>;
  }

  return (
    <div className="cluster-panel">
      <div className="cluster-header">
        <h2>FinSavvyAI Cluster</h2>
        <span className="node-count">{nodes.length} nodes</span>
      </div>

      <div className="node-list">
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>

      <div className="cluster-actions">
        <button onClick={() => window.open('http://localhost:8080/dashboard')}>
          Open Dashboard
        </button>
        <button onClick={() => context.ui.openSettings()}>
          Settings
        </button>
      </div>
    </div>
  );
};

const NodeCard: React.FC<{ node: ClusterNode }> = ({ node }) => {
  const statusColor = {
    online: 'green',
    offline: 'red',
    loading: 'yellow',
  }[node.status];

  return (
    <div className="node-card">
      <div className="node-header">
        <span className="node-id">{node.id}</span>
        <span className="node-status" style={{ color: statusColor }}>
          {node.status}
        </span>
      </div>

      <div className="node-details">
        <div>Host: {node.host}:{node.port}</div>
        <div>Models: {node.models.join(', ')}</div>
        <div>Requests: {node.requests}</div>
      </div>
    </div>
  );
};
```

### Package.json

```json
{
  "name": "finsavvyai-lmstudio-extension",
  "version": "1.0.0",
  "description": "FinSavvyAI cluster management for LM Studio",
  "main": "dist/extension.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@lmstudio/sdk": "^0.3.0",
    "react": "^18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

---

## Part 4: Testing Strategy

### Unit Tests

```bash
# Test LM Studio provider
pytest tests/unit/test_lmstudio_provider.py -v

# Test discovery
pytest tests/unit/test_lmstudio_discovery.py -v
```

### Integration Tests

```bash
# Start LM Studio with a model loaded
# Then run:
pytest tests/integration/test_lmstudio_integration.py -v
```

### Manual Testing Checklist

- [ ] LM Studio auto-discovery works
- [ ] Models appear in `/v1/models`
- [ ] Chat completions work via API
- [ ] Streaming works correctly
- [ ] Cluster join works from LM Studio UI
- [ ] Dashboard shows connected nodes
- [ ] Load balancing distributes requests
- [ ] Failover works when node goes down

---

## Part 5: Deployment

### Installation

```bash
# Install FinSavvyAI with LM Studio support
pip install finsavvyai[lmstudio]

# Or install from source
git clone https://github.com/finsavvyai/finsavvyai.git
cd finsavvyai
pip install -e .[lmstudio]
```

### Configuration

```bash
# .env
LMSTUDIO_BASE_URL=http://localhost:1234
FINSAVVYAI_DISCOVERY_ENABLED=true
FINSAVVYAI_CLUSTER_NAME=my-cluster
```

### Startup

```bash
# Start FinSavvyAI gateway
finsavvyai start service gateway

# Start worker that connects to LM Studio
finsavvyai start worker --provider lmstudio --base-url http://localhost:1234
```

### Verification

```bash
# Check health
curl http://localhost:8080/health

# List models (should include LM Studio models)
curl http://localhost:8080/v1/models

# Make a request
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lmstudio/model-name",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Timeline

### Week 1: Core Provider
- Day 1-2: Implement LMStudioProvider
- Day 3: Add tests
- Day 4: Documentation
- Day 5: Launch beta

### Week 2: Auto-Discovery
- Day 1-2: Implement mDNS discovery
- Day 3: Network scanning fallback
- Day 4: Integration with gateway
- Day 5: Testing

### Week 3-4: Desktop Extension
- Day 1-3: Basic extension structure
- Day 4-7: Cluster panel UI
- Day 8-10: API integration
- Day 11-14: Testing and polish

### Week 5: Documentation & Launch
- Day 1-3: Documentation
- Day 4-5: Tutorial videos
- Day 6-7: Launch campaign

---

## Success Metrics

### Technical
- [ ] Provider works with LM Studio 0.3.x
- [ ] Auto-discovery finds instances on local network
- [ ] 100% API compatibility with OpenAI SDK
- [ ] < 100ms overhead per request
- [ ] 99.9% uptime for clustered deployments

### Adoption
- [ ] 100+ GitHub stars in first month
- [ ] 50+ active users
- [ ] 10+ community contributions
- [ ] Featured in LM Studio marketplace

### Quality
- [ ] 95%+ test coverage
- [ ] Zero critical bugs in production
- [ ] < 1 day response time for issues
- [ ] 4.5+ star rating from users
