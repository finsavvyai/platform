# PushCI API -- Extended Details

## Authentication
All requests: `Authorization: Bearer <jwt>`. Runner endpoints: `X-Runner-Token: <token>`.
```
POST /auth/github  Body: { "code": "oauth-code" }
Response 200: { "token": "eyJ...", "user": { "id", "email", "name", "avatar_url" } }
```

## Pagination (cursor-based)
```
GET /repos/:id/runs?cursor=eyJ...&limit=25
Response: { "data": [...], "pagination": { "next_cursor": "eyJ...", "has_more": true } }
```
Default limit: 25. Max: 100.

## Error Format
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Branch name is required" } }
```
| Status | Code | When |
|--------|------|------|
| 400 | VALIDATION_FAILED | Invalid request body |
| 401 | UNAUTHORIZED | Missing/expired token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Duplicate resource |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

## Rate Limits (per-org)
| Plan | Req/min | Runners | Build min/month |
|------|---------|---------|-----------------|
| free | 100 | 1 | 500 |
| pro | 1,000 | 5 | 5,000 |
| team | 5,000 | 25 | 25,000 |
| enterprise | custom | unlimited | custom |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## Request/Response Examples

### Connect repository
```
POST /orgs/:id/repos/connect
Body: { "platform": "github", "full_name": "acme/api", "clone_url": "https://..." }
201: { "id": "uuid", "name": "api", "full_name": "acme/api", "platform": "github" }
```

### Rerun pipeline
```
POST /runs/:id/rerun
201: { "id": "new-uuid", "status": "queued", "branch": "main", "sha": "abc123" }
```

### Register runner
```
POST /orgs/:id/runners/register
Body: { "name": "build-01", "labels": ["linux","gpu"], "os": "linux", "arch": "amd64" }
201: { "id": "uuid", "token": "rnnr_abc123...", "name": "build-01" }
```
Token returned once; server stores `token_hash` only.

### Stream logs (SSE)
```
GET /jobs/:id/logs  Accept: text/event-stream
event: log   data: {"line":1,"ts":"...","text":"Cloning repo..."}
event: done  data: {"exit_code":0}
```
Full logs: `GET /jobs/:id/logs?stream=false` returns plain text.

### Create secret
```
POST /repos/:id/secrets  Body: { "key": "NPM_TOKEN", "value": "npm_abc123" }
201: { "id": "uuid", "key": "NPM_TOKEN", "created_at": "..." }
```
Values never returned in GET responses.

## Webhook Verification
- **GitHub**: HMAC-SHA256 via `X-Hub-Signature-256`
- **GitLab**: `X-Gitlab-Token` header match
- **Bitbucket**: HMAC-SHA256 via `X-Hub-Signature`

## Filtering & Sorting
| Endpoint | Filters | Default Sort |
|----------|---------|--------------|
| /repos/:id/runs | status, branch, trigger | started_at DESC |
| /orgs/:id/runners | status, labels | last_heartbeat DESC |
| /orgs/:id/audit-logs | action, user_id | created_at DESC |
| /envs/:id/deployments | status | created_at DESC |
