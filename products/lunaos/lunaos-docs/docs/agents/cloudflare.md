# ☁️ Cloudflare Deployment Agent

<Badge type="warning" text="Pro" />

Deploy to Cloudflare Workers, D1, Pages, R2, and configure domains.

## CLI Usage

```bash
luna run cloudflare --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "cloudflare", "context": "your input here"}'
```
