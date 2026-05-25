# 📋 Post-Launch Review Agent

<Badge type="warning" text="Pro" />

Production readiness audit — performance, security, monitoring, and compliance.

## CLI Usage

```bash
luna run post-launch-review --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "post-launch-review", "context": "your input here"}'
```
