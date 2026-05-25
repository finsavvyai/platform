# OpenSyber API Reference

**Base URL:** `https://api.opensyber.cloud`
**Auth:** Bearer token (JWT) via Auth.js
**Format:** JSON

## Authentication

All API requests require an `Authorization: Bearer <token>` header.

Tokens are issued by Auth.js after OAuth login (Google, GitHub, LinkedIn, Microsoft). The token is an HMAC-SHA256 JWT containing `userId` and `orgId`.

**Agent requests** use gateway token auth instead:
```
X-Gateway-Token: <token>
X-Instance-Id: <instance-id>
```

Gateway tokens are stored in Cloudflare KV (`CREDENTIAL_VAULT`).

---

## Instance Management

### Create Instance
`POST /api/instances`

### Get Instance
`GET /api/instances/:id`

### Delete Instance
`DELETE /api/instances/:id`

### Restart Instance
`POST /api/proxy/instances/:id/restart`

---

## Skills & Marketplace

### Browse Skills
`GET /api/marketplace?q=&category=&tier=&limit=20`

### Get Skill Detail
`GET /api/marketplace/:id`

### Install Skill
`POST /api/marketplace/:id/install`
Body: `{ "instanceId": "..." }`

### List Installed Skills
`GET /api/instances/:id/skills`

### Uninstall Skill
`DELETE /api/instances/:id/skills/:skillId`

---

## Security Events

### Agent Event Ingestion
`POST /api/security/instances/:id/events`
Auth: Gateway token (X-Gateway-Token)

### Security Dashboard
`GET /api/security/instances/:id/dashboard`

### Alerts
`GET /api/security/instances/:id/alerts`
`POST /api/security/instances/:id/alert-rules`

### Audit Logs
`GET /api/security/instances/:id/audit-log`

### Vulnerabilities
`GET /api/security/instances/:id/vulnerabilities`

---

## Team & Organization

### List Members
`GET /api/organizations/:orgId/members`

### Invite Member
`POST /api/organizations/:orgId/invitations`

### Update Role
`PATCH /api/organizations/:orgId/members/:userId`

---

## AI Gateway (Claw)

Separate service at `https://claw-gateway.broad-dew-49ad.workers.dev`

### Health
`GET /health`

### One-Shot Prompt
`POST /v1/prompt`
Headers: `Authorization: Bearer <claw-api-key>`, `X-Project-Id: opensyber`

### Create Session
`POST /v1/sessions`

### Send Message
`POST /v1/sessions/:id/message`

See `apps/claw-gateway/` for full documentation.

---

## Error Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

## Rate Limiting

Standard: 1000 req/min per API key.
Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
