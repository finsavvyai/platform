# 🛡️ 365 Security Agent

<Badge type="warning" text="Pro" />

Enterprise security hardening — Zero Trust, Azure AD, BFF auth pattern.

## CLI Usage

```bash
luna run 365-security --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "365-security", "context": "your input here"}'
```
