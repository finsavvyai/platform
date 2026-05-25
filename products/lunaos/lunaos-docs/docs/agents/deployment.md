# 🚀 Deployment Agent

<Badge type="tip" text="Free" />

Create CI/CD pipelines, Docker configurations, and cloud deployment scripts.

## CLI Usage

```bash
luna run deployment --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "deployment", "context": "your input here"}'
```
