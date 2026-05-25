# LLM Gateway Service

A multi-provider LLM gateway that provides a unified API for accessing various Large Language Model providers with automatic failover, cost tracking, and comprehensive monitoring.

## Features

- **Multi-Provider Support**: Integrated support for OpenAI, Anthropic Claude, **Ollama** (local LLMs), and other LLM providers
- **Automatic Failover**: Seamlessly switches between providers when one is unavailable
- **Cost Tracking**: Real-time cost monitoring and budget enforcement
- **Response Validation**: Built-in content filtering and PII detection
- **Rate Limiting**: Configurable rate limiting and quota management
- **Monitoring**: Prometheus metrics and distributed tracing
- **Security**: JWT authentication, API key management, and request validation

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL database
- API keys for LLM providers

### Installation

1. Clone the repository:
```bash
git clone https://github.com/SDLC/llm-gateway.git
cd llm-gateway
```

2. Install dependencies:
```bash
go mod download
```
Anthropic support uses `github.com/anthropics/anthropic-sdk-go`. See [config.yaml](config.yaml) for enabling Ollama.

3. Configure environment variables:
```bash
export OPENAI_API_KEY="your-openai-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export DATABASE_URL="postgres://user:password@localhost:5432/llm_gateway"
export JWT_SECRET="your-jwt-secret"
```

4. Run the service:
```bash
go run cmd/server/main.go
```

### Docker Deployment

1. Build the Docker image:
```bash
docker build -t llm-gateway:latest .
```

2. Run with Docker Compose:
```bash
docker-compose up -d
```

## API Usage

### Authentication

Include your JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Generate Completion

```bash
curl -X POST http://localhost:8080/api/v1/llm/complete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "max_tokens": 100,
    "temperature": 0.7
  }'
```

### List Available Models

```bash
curl -X GET http://localhost:8080/api/v1/models \
  -H "Authorization: Bearer <token>"
```

### Check Provider Health

```bash
curl -X GET http://localhost:8080/api/v1/health
```

## Configuration

The service is configured via `config.yaml` and environment variables. Key configuration options:

### Providers

Configure LLM providers with their API keys and models:

```yaml
providers:
  openai:
    api_key: "${OPENAI_API_KEY}"
    models: ["gpt-4", "gpt-3.5-turbo"]
    timeout: 30
    retry_count: 3
  
  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"
    models: ["claude-3-sonnet-20240229"]
    timeout: 30
    retry_count: 3
```

### Pricing

Configure pricing for cost tracking:

```yaml
pricing:
  openai:
    gpt-4:
      prompt_token_cost: 0.03
      completion_token_cost: 0.06
```

### Security

Enable authentication and rate limiting:

```yaml
security:
  authentication:
    enabled: true
    type: "jwt"
  rate_limiting:
    enabled: true
    requests_per_minute: 60
```

## Monitoring

### Prometheus Metrics

Access metrics at `http://localhost:8080/metrics`

Key metrics:
- `llm_gateway_requests_total`: Total requests processed
- `llm_gateway_provider_requests_total`: Requests per provider
- `llm_gateway_tokens_total`: Token usage
- `llm_gateway_tokens_cost_dollars`: Cost in USD

### Health Checks

- Service health: `/api/v1/health`
- Provider status: `/api/v1/providers/status`

## Architecture

The LLM Gateway consists of several key components:

1. **Provider Abstraction**: Unified interface for different LLM providers
2. **Gateway Service**: Request routing and failover logic
3. **Cost Tracker**: Real-time cost monitoring and budgeting
4. **Validator**: Response content validation and sanitization
5. **Middleware**: Authentication, rate limiting, and monitoring

## Development

### Running Tests

```bash
go test ./...
```

### Building

```bash
go build -o llm-gateway cmd/server/main.go
```

### Mock Providers

For testing, you can use mock providers by setting the configuration:

```yaml
providers:
  mock:
    api_key: "test"
    models: ["mock-model"]
```

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/llm/complete` | Generate completion |
| POST | `/api/v1/llm/stream` | Stream completion |
| GET | `/api/v1/models` | List available models |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/providers/status` | Provider status |
| GET | `/api/v1/usage/stats` | Usage statistics |
| GET | `/api/v1/usage/cost` | Cost information |

### Response Format

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  },
  "provider": "openai"
}
```

## Security Considerations

- All API requests must be authenticated
- Sensitive data (PII) is filtered from responses
- Rate limits prevent abuse
- API keys are securely stored and managed
- Requests are validated for prompt injection attacks

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API reference