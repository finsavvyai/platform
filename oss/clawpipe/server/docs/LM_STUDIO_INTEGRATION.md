# LM Studio Integration Guide

**FinSavvyAI + LM Studio = Production-Ready Local LLMs**

Use FinSavvyAI to turn LM Studio into an enterprise-grade LLM platform with clustering, load balancing, observability, and more.

---

## Quick Start (5 minutes)

### Prerequisites

1. **Install LM Studio** from https://lmstudio.ai
2. **Install FinSavvyAI:**

```bash
pip install finsavvyai[lmstudio]
```

### Step 1: Start LM Studio

1. Open LM Studio
2. Load a model (e.g., Llama 3, Mistral, Gemma)
3. Enable the API server:
   - **Settings → Developer → Enable API Server**
   - Default port: `1234`

### Step 2: Configure FinSavvyAI

```bash
# Copy environment template
cp .env.example .env

# Edit .env (LM Studio URL is pre-configured)
# LMSTUDIO_BASE_URL=http://localhost:1234
```

### Step 3: Start FinSavvyAI Gateway

```bash
python -m src.api.gateway
```

### Step 4: Verify Connection

```bash
# Check health
curl http://localhost:8080/health

# List models (should include LM Studio models)
curl http://localhost:8080/v1/models

# Make a request
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lmstudio/your-model-name",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## Usage Examples

### Python OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="any",  # Not used for LM Studio
)

response = client.chat.completions.create(
    model="lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
)

print(response.choices[0].message.content)
```

### cURL

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "lmstudio/Mistral-7B-Instruct-v0.3-GGUF",
    "messages": [
      {"role": "user", "content": "Write a haiku about AI"}
    ],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    model="lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
    temperature=0.7,
)

response = llm.invoke("What is machine learning?")
print(response.content)
```

---

## Multi-Node Clustering

### Scenario: Multiple Machines Running LM Studio

**Machine A (192.168.1.100):** Running LM Studio with Llama 3
**Machine B (192.168.1.101):** Running LM Studio with Mistral
**Machine C (192.168.1.102):** Running LM Studio with Gemma

### Step 1: Install FinSavvyAI on Each Machine

```bash
# On each machine
pip install finsavvyai[lmstudio]
```

### Step 2: Start FinSavvyAI Workers

```bash
# Machine A
LMSTUDIO_BASE_URL=http://localhost:1234 \
finsavvyai start worker \
  --worker-id worker-a \
  --provider lmstudio

# Machine B
LMSTUDIO_BASE_URL=http://localhost:1234 \
finsavvyai start worker \
  --worker-id worker-b \
  --provider lmstudio

# Machine C
LMSTUDIO_BASE_URL=http://localhost:1234 \
finsavvyai start worker \
  --worker-id worker-c \
  --provider lmstudio
```

### Step 3: Start Master Server

```bash
# On any machine (or separate server)
finsavvyai start master
```

### Step 4: Start API Gateway

```bash
# On any machine
FINSAVVYAI_MASTER_HOST=localhost \
finsavvyai start gateway
```

### Step 5: Use the Cluster

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="any",
)

# FinSavvyAI automatically load balances across nodes
response = client.chat.completions.create(
    model="lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

---

## Model Discovery

FinSavvyAI automatically discovers models loaded in LM Studio:

```bash
# List all available models
curl http://localhost:8080/v1/models | jq
```

Response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
      "object": "model",
      "owned_by": "lmstudio"
    },
    {
      "id": "lmstudio/Mistral-7B-Instruct-v0.3-GGUF",
      "object": "model",
      "owned_by": "lmstudio"
    }
  ]
}
```

---

## Streaming Support

FinSavvyAI supports streaming from LM Studio:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="any",
)

stream = client.chat.completions.create(
    model="lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
    messages=[{"role": "user", "content": "Count to 10"}],
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

---

## Health Monitoring

Check LM Studio connection status:

```bash
curl http://localhost:8080/health?verbose=true
```

Response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "setup_completion": 100,
  "providers": {
    "lmstudio": {
      "status": "healthy",
      "base_url": "http://localhost:1234",
      "models_count": 2
    }
  }
}
```

---

## Troubleshooting

### Issue: "Cannot connect to LM Studio"

**Solution:**
1. Verify LM Studio is running
2. Enable API server: **Settings → Developer → Enable API Server**
3. Check port: Default is `1234`
4. Test connection: `curl http://localhost:1234/v1/models`

### Issue: Models not appearing

**Solution:**
1. Load a model in LM Studio
2. Wait for model to fully load
3. Refresh FinSavvyAI models list: `curl http://localhost:8080/v1/models`

### Issue: Slow responses

**Solution:**
1. Check LM Studio system resources (CPU/GPU)
2. Adjust LM Studio context size
3. Use FinSavvyAI's request queue: `FINSAVVYAI_QUEUE_ENABLED=true`

### Issue: Connection timeout

**Solution:**
```bash
# Increase timeout in .env
FINSAVVYAI_TIMEOUT=120
```

---

## Advanced Configuration

### Custom LM Studio URL

```bash
# .env
LMSTUDIO_BASE_URL=http://192.168.1.100:1234
```

### Multiple LM Studio Instances

```bash
# Configure multiple instances via worker nodes
finsavvyai start worker \
  --provider lmstudio \
  --base-url http://192.168.1.100:1234

finsavvyai start worker \
  --provider lmstudio \
  --base-url http://192.168.1.101:1234
```

### Load Balancing

FinSavvyAI automatically load balances across multiple LM Studio instances:

```python
# Requests distributed across all available LM Studio nodes
for i in range(10):
    response = client.chat.completions.create(
        model="lmstudio/Meta-Llama-3-8B-Instruct-GGUF",
        messages=[{"role": "user", "content": f"Request {i}"}],
    )
```

---

## Observability

### Metrics

FinSavvyAI exposes Prometheus metrics for LM Studio:

```bash
curl http://localhost:8080/metrics
```

Metrics include:
- `finsavvyai_requests_total{provider="lmstudio"}`
- `finsavvyai_request_duration_seconds{provider="lmstudio"}`
- `finsavvyai_errors_total{provider="lmstudio"}`

### Logging

Enable debug logging for LM Studio provider:

```bash
# .env
FINSAVVYAI_LOG_LEVEL=DEBUG
```

---

## Next Steps

1. **Production Deployment:** See [Deployment Guide](../DEPLOYMENT_RUNBOOK.md)
2. **Observability:** Set up [Grafana Dashboards](../observability/grafana/)
3. **Clustering:** Read [Cluster Documentation](../ARCHITECTURE.md)
4. **API Reference:** Check [OpenAPI Spec](http://localhost:8080/openapi.json)

---

## Community

- **GitHub:** https://github.com/finsavvyai/finsavvyai
- **Discord:** https://discord.gg/finsavvyai
- **Issues:** https://github.com/finsavvyai/finsavvyai/issues

---

**Need help?** Join our Discord or open a GitHub issue!
