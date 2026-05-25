# 🍋 LemonSqueezy Agent

<Badge type="warning" text="Pro" />

Payment integration with LemonSqueezy for SaaS billing and subscriptions.

## CLI Usage

```bash
luna run lemonsqueezy --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "lemonsqueezy", "context": "your input here"}'
```
