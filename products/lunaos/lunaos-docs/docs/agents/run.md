# 🏃 Run Agent

<Badge type="warning" text="Pro" />

Quick code execution, prototyping, and one-off coding tasks.

## CLI Usage

```bash
luna run run --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "run", "context": "your input here"}'
```
