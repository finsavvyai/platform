# FinSavvyAI API Reference

OpenAI-compatible REST API for AI model routing and cluster management.

## Base URL

```
http://localhost:8040/v1
```

## Authentication

Include API key in Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Chat Completions

Create a chat completion from a list of messages.

**POST** `/v1/chat/completions`

Request:
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are helpful."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 100,
  "provider": "openai",
  "stream": false
}
```

Response:
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4",
  "provider": "openai",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hi! How can I help?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  }
}
```

### List Models

Retrieve available models.

**GET** `/v1/models`

Query parameters:
- `provider` (optional): Filter by provider (openai, anthropic, ollama, lm_studio)

Response:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "owned_by": "openai",
      "provider": "openai",
      "permission": []
    },
    {
      "id": "claude-3-opus",
      "object": "model",
      "owned_by": "anthropic",
      "provider": "anthropic",
      "permission": []
    }
  ]
}
```

### Health Check

Check API health status.

**GET** `/health`

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-03-20T10:30:00Z",
  "version": "1.0.0"
}
```

### Readiness

Check cluster readiness.

**GET** `/ready`

Response: `200 OK` or `503 Service Unavailable`

### Cluster Status

Get cluster status and metrics.

**GET** `/v1/cluster/status`

Response:
```json
{
  "cluster_id": "prod-cluster-1",
  "master_node": "master-1",
  "nodes": [
    {
      "node_id": "worker-1",
      "status": "healthy",
      "load": 0.45,
      "capacity": 100
    }
  ],
  "healthy_nodes": 3,
  "unhealthy_nodes": 0,
  "uptime_seconds": 86400
}
```

### List Nodes

Retrieve cluster nodes.

**GET** `/v1/cluster/nodes`

Response:
```json
{
  "nodes": [
    {
      "node_id": "worker-1",
      "type": "worker",
      "status": "healthy",
      "cpu_usage": 25.5,
      "memory_usage": 45.2,
      "active_requests": 12,
      "ip_address": "192.168.1.10"
    }
  ]
}
```

### Get Usage

Retrieve usage and cost information.

**GET** `/v1/usage`

Query parameters:
- `days` (optional, default=1): Number of days of history

Response:
```json
{
  "user_id": "user-1",
  "period": "2024-03-20",
  "requests": 150,
  "tokens_used": 50000,
  "cost_usd": 45.50,
  "rate_limit_remaining": 850,
  "cost_limit_remaining": 9954.50
}
```

### Get Policies

Retrieve applied governance policies.

**GET** `/v1/policies`

Response:
```json
{
  "policies": [
    {
      "policy_id": "policy-1",
      "name": "default_policy",
      "rate_limit_per_minute": 1000,
      "max_concurrent_requests": 500,
      "cost_limit_per_day_usd": 10000,
      "allowed_models": ["gpt-4", "claude-3"]
    }
  ]
}
```

## Error Responses

### 400 Bad Request

```json
{
  "error": {
    "message": "Invalid request format",
    "type": "invalid_request_error",
    "param": null,
    "code": "invalid_request_error"
  }
}
```

### 401 Unauthorized

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "param": null,
    "code": "invalid_api_key"
  }
}
```

### 429 Too Many Requests

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}
```

### 503 Service Unavailable

```json
{
  "error": {
    "message": "Service unavailable",
    "type": "server_error",
    "param": null,
    "code": "service_unavailable"
  }
}
```

## Rate Limits

Rate limits are enforced per user/API key:
- Requests per minute: Configured in policy (default 1000)
- Concurrent requests: Configured in policy (default 500)
- Daily cost limit: Configured in policy (default $10,000)

Rate limit information is returned in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

## SDK Usage

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:8040/v1"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### JavaScript

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "your-api-key",
  baseURL: "http://localhost:8040/v1"
});

const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }]
});
```

### Go

```go
import "github.com/sashabaranov/go-openai"

client := openai.NewClient("your-api-key")
client.BaseURL = "http://localhost:8040/v1"

resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
    Model: "gpt-4",
    Messages: []openai.ChatCompletionMessage{
        {Role: "user", Content: "Hello!"},
    },
})
```

## Versioning

API versions are prefixed in the URL (e.g., `/v1`). Current version is `v1`.
