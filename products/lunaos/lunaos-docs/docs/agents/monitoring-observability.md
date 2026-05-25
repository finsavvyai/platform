# 📡 Monitoring & Observability Agent

<Badge type="warning" text="Pro" />

Implement comprehensive monitoring, logging, alerting, and observability.

## CLI Usage

```bash
luna run monitoring-observability --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "monitoring-observability", "context": "your input here"}'
```
