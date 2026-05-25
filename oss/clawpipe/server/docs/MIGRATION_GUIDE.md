# Migrating from OpenAI to FinSavvyAI

This guide covers switching existing OpenAI SDK clients to use FinSavvyAI as a drop-in replacement.

## Python SDK

```python
# Before (OpenAI direct)
from openai import OpenAI
client = OpenAI(api_key="sk-...")

# After (FinSavvyAI)
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="your-finsavvyai-key",
)
```

All existing calls work unchanged:

```python
resp = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "Hello"}],
)
print(resp.choices[0].message.content)
```

## Node.js SDK

```javascript
// Before (OpenAI direct)
import OpenAI from "openai";
const client = new OpenAI({ apiKey: "sk-..." });

// After (FinSavvyAI)
import OpenAI from "openai";
const client = new OpenAI({
  baseURL: "http://localhost:8080/v1",
  apiKey: "your-finsavvyai-key",
});
```

## curl

```bash
# Before
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"hi"}]}'

# After — change hostname only
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer your-finsavvyai-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"hi"}]}'
```

## What works the same

| Feature | Status |
|---|---|
| `POST /v1/chat/completions` | Fully compatible |
| `POST /v1/chat/completions` (stream=true) | Fully compatible (SSE) |
| `GET /v1/models` | Fully compatible |
| `POST /v1/embeddings` | Fully compatible |
| `POST /v1/completions` (legacy) | Compatible (shimmed to chat) |
| Response shape (id, object, choices, usage) | Identical |
| Error shape (error.type, error.message, error.code) | Identical |
| OpenAI headers (openai-version, x-request-id) | Present |

## What is different

### Provider routing

FinSavvyAI routes model names to the appropriate backend provider automatically:

| Model prefix | Routed to |
|---|---|
| `gpt-*` | OpenAI |
| `claude-*` | Anthropic |
| `llama-*`, `mistral-*` | Cluster workers (Ollama/local) |
| Any model on a connected worker | Cluster |

You can also force routing with the `backend` field:

```json
{
  "model": "my-model",
  "backend": "cluster",
  "messages": [{"role": "user", "content": "hi"}]
}
```

Valid backend values: `auto` (default), `cluster`, `openclaw`, `openhands`.

### Extra response fields

FinSavvyAI responses may include additional fields that the OpenAI SDK ignores:

- `provider` — which backend served the request
- `request_id` — correlation ID for tracing
- `trace_id` — distributed trace ID (when tracing is active)
- `governance` — policy evaluation report (when governance is enabled)

These fields do not break SDK parsing.

### Rate limiting

FinSavvyAI returns standard rate-limit headers:

```
X-RateLimit-Limit-Requests: 100
X-RateLimit-Remaining-Requests: 99
```

Default limits are configurable per API key. Contact your admin to adjust.

### Authentication

FinSavvyAI uses its own API keys managed via `scripts/manage_api_keys.py`. OpenAI `sk-*` keys are not valid for FinSavvyAI authentication, but they can be configured as upstream provider credentials.

### Endpoints not yet supported

- `POST /v1/images/generations` — planned
- `POST /v1/audio/transcriptions` — planned
- `POST /v1/fine-tuning/jobs` — not planned
- `DELETE /v1/models/:id` — not applicable

Check `GET /v1/compat` for the live compatibility matrix.

## Checking compatibility

```bash
curl http://localhost:8080/v1/compat | python -m json.tool
```

This returns a machine-readable report of all supported endpoints and SDK compatibility status.

## Troubleshooting

**SDK raises `AuthenticationError`**: Ensure your FinSavvyAI API key is set correctly. The key format differs from OpenAI.

**Model not found**: Run `curl http://localhost:8080/v1/models` to see available models. Cloud models require provider API keys in `.env`.

**503 responses**: No provider or worker is available for the requested model. Check `GET /health?verbose=true` for system status.

**Streaming hangs**: Verify the gateway is reachable and the upstream provider supports streaming for the selected model.
