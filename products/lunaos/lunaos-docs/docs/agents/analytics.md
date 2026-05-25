# 📊 Analytics Agent

<Badge type="warning" text="Pro" />

Implement analytics tracking, metrics, dashboards, and monitoring solutions.

## CLI Usage

```bash
luna run analytics --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "analytics", "context": "your input here"}'
```
