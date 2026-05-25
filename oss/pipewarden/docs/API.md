# PipeWarden API Reference

## Authentication

All endpoints (except `/health` and `/metrics`) require JWT authentication.

```bash
curl -H "Authorization: Bearer <jwt_token>" https://pipewarden.local/api/v1/connections
```

Generate token via CLI or `/api/v1/auth/login` endpoint.

## Endpoints

### Health & Status

#### `GET /health`

Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "database": "connected"
}
```

#### `GET /metrics`

Prometheus metrics (no authentication required).

**Response:** Prometheus text format
```
# HELP pipewarden_analyses_total Total analyses performed
# TYPE pipewarden_analyses_total counter
pipewarden_analyses_total 1234

# HELP pipewarden_api_request_duration_seconds API request latency
# TYPE pipewarden_api_request_duration_seconds histogram
```

### Connections

#### `GET /api/v1/connections`

List all configured provider connections.

**Response:**
```json
{
  "connections": [
    {
      "id": "conn-1",
      "platform": "github",
      "name": "my-github",
      "created_at": "2026-03-20T10:00:00Z",
      "last_synced": "2026-03-20T14:30:00Z",
      "status": "connected",
      "run_count": 42
    }
  ]
}
```

#### `POST /api/v1/connections`

Add a new provider connection.

**Request (GitHub):**
```json
{
  "platform": "github",
  "token": "ghp_YOUR_TOKEN",
  "name": "my-org-github"
}
```

**Request (GitLab):**
```json
{
  "platform": "gitlab",
  "url": "https://gitlab.com",
  "token": "glpat_YOUR_TOKEN",
  "name": "my-gitlab"
}
```

**Request (Bitbucket):**
```json
{
  "platform": "bitbucket",
  "username": "user@example.com",
  "app_password": "YOUR_APP_PASSWORD",
  "name": "my-bitbucket"
}
```

**Response:**
```json
{
  "connection_id": "conn-1",
  "platform": "github",
  "status": "connected",
  "message": "Connection established"
}
```

**Status Codes:**
- `201 Created`: Connection successful
- `400 Bad Request`: Missing/invalid fields
- `409 Conflict`: Connection with same name exists
- `503 Service Unavailable`: Provider unreachable

#### `DELETE /api/v1/connections/{connection_id}`

Remove a provider connection.

**Response:**
```json
{
  "message": "Connection deleted",
  "connection_id": "conn-1"
}
```

### Analysis

#### `POST /api/v1/analyze`

Run security analysis on a repository.

**Request:**
```json
{
  "connection_id": "conn-1",
  "owner": "my-org",
  "repo": "my-repo",
  "branch": "main",
  "use_claude": true
}
```

**Response:**
```json
{
  "result_id": "result-abc123",
  "status": "queued",
  "estimated_time_seconds": 30,
  "message": "Analysis queued for processing"
}
```

**Status Codes:**
- `202 Accepted`: Analysis queued
- `400 Bad Request`: Invalid repository
- `404 Not Found`: Connection not found
- `429 Too Many Requests`: Rate limit exceeded

#### `GET /api/v1/results/{result_id}`

Fetch analysis results.

**Response:**
```json
{
  "result_id": "result-abc123",
  "connection_id": "conn-1",
  "repository": "my-org/my-repo",
  "branch": "main",
  "analyzed_at": "2026-03-20T14:35:00Z",
  "status": "completed",
  "findings": [
    {
      "id": "finding-1",
      "category": "branch_security",
      "severity": "medium",
      "title": "Direct push to main branch",
      "description": "Production branch receives direct commits.",
      "remediation": "Require pull request reviews before merge.",
      "cwe": "CWE-434",
      "rules": ["rule:protection:main-branch"]
    }
  ],
  "summary": {
    "total_findings": 3,
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 0,
    "info": 0
  },
  "tokens_used": 2500,
  "analysis_models": ["heuristic-v1", "claude-3.5-sonnet"]
}
```

#### `GET /api/v1/results`

List all analysis results (paginated).

**Query Parameters:**
- `limit` (int, default: 50): Results per page
- `offset` (int, default: 0): Pagination offset
- `connection_id` (string): Filter by connection
- `severity` (string): Filter by max severity (critical, high, medium, low)

**Response:**
```json
{
  "results": [
    {
      "result_id": "result-abc123",
      "repository": "my-org/my-repo",
      "analyzed_at": "2026-03-20T14:35:00Z",
      "finding_count": 3
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### Export

#### `POST /api/v1/export/sarif`

Export analysis result as SARIF 2.1.0 format.

**Request:**
```json
{
  "result_id": "result-abc123"
}
```

**Response:**
```json
{
  "sarif_url": "/files/result-abc123.sarif",
  "format": "SARIF 2.1.0",
  "download": true
}
```

### Trends & Analytics

#### `GET /api/v1/trends`

Security trends over time.

**Query Parameters:**
- `connection_id` (string, required): Connection to analyze
- `days` (int, default: 30): Time window

**Response:**
```json
{
  "connection_id": "conn-1",
  "period_days": 30,
  "data": [
    {
      "date": "2026-02-20",
      "total_findings": 15,
      "critical": 0,
      "high": 2,
      "medium": 10,
      "low": 3
    }
  ],
  "trend": "improving",
  "percentage_change": -15
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "error code",
  "message": "Human readable message",
  "details": {
    "field": "error details"
  },
  "request_id": "req-123"
}
```

**Common Error Codes:**

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid JWT token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

Rate limits are returned in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1679872800
```

When limit exceeded, receive `429 Too Many Requests`.

## Pagination

List endpoints support cursor-based pagination:

```bash
curl "https://pipewarden.local/api/v1/results?limit=50&offset=100"
```

## Webhooks (Enterprise)

POST to configured webhook URL on analysis completion:

```json
{
  "event": "analysis.completed",
  "result_id": "result-abc123",
  "severity_summary": {
    "critical": 0,
    "high": 1
  },
  "timestamp": "2026-03-20T14:35:00Z"
}
```

## SDKs

- **Go**: `github.com/pipewarden/sdk-go`
- **Python**: `pip install pipewarden-sdk`
- **TypeScript**: `npm install pipewarden-sdk`

```go
client := pipewarden.New("http://localhost:8080", jwtToken)
result, err := client.Analyze(ctx, &pipewarden.AnalyzeRequest{
    ConnectionID: "conn-1",
    Owner: "my-org",
    Repo: "my-repo",
})
```

## Versioning

API follows semantic versioning. Current: **v1**

Breaking changes will increment major version in URL path (`/api/v2`).
