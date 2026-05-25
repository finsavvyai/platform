# 📋 Requirements Analyzer Agent

<Badge type="tip" text="Free" />

Analyze and structure project requirements into actionable specifications.

## CLI Usage

```bash
luna run requirements-analyzer --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "requirements-analyzer", "context": "your input here"}'
```
