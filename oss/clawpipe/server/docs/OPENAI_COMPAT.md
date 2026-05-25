# OpenAI API Compatibility Guide

FinSavvyAI implements the OpenAI REST API surface so any tool, SDK, or script
that talks to OpenAI works unchanged — just swap the `base_url`.

## Quick Switch

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",  # ← only change
    api_key="any",                         # ← not validated unless auth enabled
)
```

## Supported Endpoints

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/v1/chat/completions` | POST | **Supported** | Streaming via `stream=true` |
| `/v1/models` | GET | **Supported** | Aggregated from all providers |
| `/v1/compat` | GET | Extension | FinSavvyAI compatibility matrix |
| `/v1/completions` | POST | Planned | Use chat/completions now |
| `/v1/embeddings` | POST | Planned | S43 sprint |
| `/v1/images/generations` | POST | Planned | S44 multimodal sprint |
| `/v1/audio/transcriptions` | POST | Planned | S45 audio sprint |

Current API coverage: **40%** (2 of 5 core endpoints).
See live matrix: `GET /v1/compat`.

## Response Headers

Every FinSavvyAI response includes OpenAI-compatible headers:

```
openai-version: 2020-10-01
openai-processing-ms: 142
x-request-id: req_01jk9xmv3f...
```

## SDK Compatibility

### Python (`openai >= 1.0.0`)

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8080/v1", api_key="any")

# Chat
resp = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hello"}],
)
print(resp.choices[0].message.content)

# List models
models = client.models.list()
for m in models.data:
    print(m.id)
```

### Node.js (`openai >= 4.0.0`)

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "any",
});

const resp = await client.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(resp.choices[0].message.content);
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    api_key="any",
    model="gpt-3.5-turbo",
)
print(llm.invoke("Hello"))
```

### LiteLLM

```bash
export OPENAI_API_BASE=http://localhost:8080/v1
export OPENAI_API_KEY=any
```

```python
import litellm
resp = litellm.completion(model="gpt-3.5-turbo", messages=[{"role": "user", "content": "Hello"}])
```

### curl

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Routing to Specific Backends

Pass `backend` in the request body to target a provider explicitly:

```json
{
  "model": "gpt-4",
  "messages": [...],
  "backend": "openai"
}
```

Valid values: `openai`, `anthropic`, `ollama`, `local`.

## Authentication

By default (`FINSAVVYAI_AUTH_ENABLED=false`) any `api_key` is accepted.

When auth is enabled, pass your gateway key as a Bearer token:

```
Authorization: Bearer fs-your-api-key
```

## Streaming

Set `"stream": true` — responses arrive as Server-Sent Events identical to
the OpenAI streaming format:

```python
stream = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Count to 5"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

## Error Codes

| HTTP Status | Meaning |
|---|---|
| 400 | Invalid request body (missing `messages`, bad JSON) |
| 401 | Auth enabled and token missing or invalid |
| 429 | Rate limit exceeded |
| 503 | No provider available for the requested model |

## Running the Compatibility Test Suite

```bash
# Start the gateway
python -m src.api.gateway &

# Run all compat tests
pytest tests/integration/test_openai_compat.py -v

# Run with OpenAI SDK tests
FINSAVVYAI_TEST_SDK=1 pytest tests/integration/test_openai_compat.py -v
```
