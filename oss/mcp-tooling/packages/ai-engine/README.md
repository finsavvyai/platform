# MCPoverflow AI Engine

OpenHands integration for AI-powered MCP connector generation.

## Overview

This package provides a REST API bridge between the Go backend and the OpenHands AI engine. It exposes the TypeScript OpenHands adapter as HTTP endpoints that the Go service can consume.

## Features

- **Natural Language Connector Generation**: Generate connectors from plain English descriptions
- **API Analysis**: Intelligent analysis of OpenAPI, GraphQL, and Postman specs
- **Code Generation**: Generate production-ready connector code in TypeScript, Go, or Python
- **Test Generation**: Automatically create comprehensive test suites
- **Validation**: Validate connectors with real API calls
- **Auto-Fix**: Automatically fix broken connectors when APIs change
- **Documentation**: Generate complete documentation for connectors

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

- `OPENHANDS_API_URL`: OpenHands API endpoint
- `OPENHANDS_API_KEY`: OpenHands API authentication key
- `OPENHANDS_LLM`: LLM model to use (claude-3.5-sonnet, gpt-4, gpt-4-turbo)
- `OPENHANDS_RUNTIME`: Runtime environment (docker, cloudflare-workers, local)

## Development

Start the development server with hot reload:

```bash
npm run dev
```

The server will start on port 3001 by default.

## Production

Build and start the production server:

```bash
npm run build
npm start
```

## Docker

Build and run with Docker:

```bash
docker build -t mcpoverflow-ai-engine .
docker run -p 3001:3001 --env-file .env mcpoverflow-ai-engine
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the health status of the service and OpenHands connection.

### Analyze API

```
POST /api/analyze
Content-Type: application/json

{
  "specType": "openapi",
  "spec": { ... }
}
```

### Generate Connector

```
POST /api/generate-connector
Content-Type: application/json

{
  "name": "stripe-connector",
  "specType": "openapi",
  "spec": { ... },
  "language": "typescript",
  "runtime": "cloudflare-workers",
  "authConfig": {
    "type": "apikey",
    "config": { ... }
  }
}
```

### Generate Tests

```
POST /api/generate-tests
Content-Type: application/json

{
  "connector": { ... },
  "spec": { ... }
}
```

### Validate Connector

```
POST /api/validate-connector
Content-Type: application/json

{
  "connector": { ... },
  "tests": { ... }
}
```

### Fix Connector

```
POST /api/fix-connector
Content-Type: application/json

{
  "connector": { ... },
  "error": {
    "message": "API endpoint not found",
    "stack": "...",
    "apiResponse": { ... }
  }
}
```

### Generate Documentation

```
POST /api/generate-documentation
Content-Type: application/json

{
  "connector": { ... },
  "spec": { ... }
}
```

### Generate from Natural Language

```
POST /api/generate-from-description
Content-Type: application/json

{
  "description": "Create a connector for the Stripe API that allows me to create customers, manage subscriptions, and process payments"
}
```

## Architecture

```
┌─────────────────┐
│   Go Backend    │
│  (API Service)  │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│   AI Engine     │
│ (Node.js/TS)    │
│ Bridge Server   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OpenHands       │
│ Adapter         │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│   OpenHands     │
│   AI Service    │
└─────────────────┘
```

## Integration with MCPoverflow

This service is designed to be called by the Go backend via HTTP. The Go service handles:

- Authentication and authorization
- Rate limiting
- Job queue management
- Database persistence
- User management

The AI engine focuses solely on interfacing with OpenHands and processing AI requests.

## Error Handling

All endpoints return structured error responses:

```json
{
  "error": "Failed to generate connector",
  "details": "OpenHands API error: timeout"
}
```

HTTP status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `500`: Internal server error
- `503`: Service unavailable (OpenHands connection failed)

## Performance

- Typical API analysis: 10-30 seconds
- Connector generation: 1-3 minutes
- Test generation: 30-60 seconds
- Documentation generation: 20-45 seconds

Response times depend on:
- Complexity of the API specification
- Number of endpoints
- LLM model used
- OpenHands service load

## Monitoring

The service exposes a `/health` endpoint for monitoring. Monitor these metrics:

- Response times
- Error rates
- OpenHands connection status
- Memory usage
- CPU usage

## Troubleshooting

### OpenHands connection failed

Check:
1. `OPENHANDS_API_URL` is correct
2. `OPENHANDS_API_KEY` is valid
3. OpenHands service is running
4. Network connectivity

### Timeout errors

Increase timeout in `server.ts`:
```typescript
const adapter = new OpenHandsAdapter({
  timeout: 300000, // 5 minutes
});
```

### Memory issues

For large API specifications, increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## License

MIT
