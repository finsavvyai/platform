# 🖥️ UI Fix Agent

<Badge type="warning" text="Pro" />

Debug and fix frontend UI issues — CSS, layout, responsiveness, and accessibility.

## CLI Usage

```bash
luna run ui-fix --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "ui-fix", "context": "your input here"}'
```
