# 🔐 Authentication Agent

<Badge type="warning" text="Pro" />

Implement secure auth systems with JWT, OAuth, session management, RBAC, and security best practices.

## CLI Usage

```bash
luna run auth --context "your input here"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent": "auth", "context": "your input here"}'
```
