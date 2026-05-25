# 📱 Human Interface Guidelines Agent

<Badge type="warning" text="Pro" />

Apple HIG compliance, platform-native UI patterns, and accessibility.

## CLI Usage

```bash
luna run hig --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "hig", "context": "your input here"}'
```
