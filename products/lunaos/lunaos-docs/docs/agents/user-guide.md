# 📘 User Guide Agent

<Badge type="warning" text="Pro" />

Generate end-user documentation, onboarding flows, and help content.

## CLI Usage

```bash
luna run user-guide --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "user-guide", "context": "your input here"}'
```
