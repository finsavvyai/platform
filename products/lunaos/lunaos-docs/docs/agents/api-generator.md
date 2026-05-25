# 🌐 REST API Generator Agent

<Badge type="warning" text="Pro" />

Generate production-ready REST APIs with routing, validation, error handling, and OpenAPI documentation.

## CLI Usage

```bash
luna run api-generator --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "api-generator", "context": "your input here"}'
```
