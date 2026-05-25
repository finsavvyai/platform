# 🧪 UI Test Agent

<Badge type="warning" text="Pro" />

Visual regression testing, component testing, and E2E UI automation.

## CLI Usage

```bash
luna run ui-test --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "ui-test", "context": "your input here"}'
```
