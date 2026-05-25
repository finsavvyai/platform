# UPM API Reference

Complete API reference for the Universal Dependency Platform.

## Base URL

```
Production: https://api.upm.internal
Staging: https://api.staging.upm.internal
Local: http://localhost:8040
```

## Authentication

All API requests require authentication except where noted.

### Bearer Token

```http
Authorization: Bearer <access_token>
```

### API Key

```http
X-API-Key: <api_key>
```

---

## Authentication Endpoints

### Register New User

```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "email": "string (valid email)",
  "password": "string (min 12 chars)",
  "full_name": "string (optional)"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "created_at": "ISO8601"
}
```

### Login

```http
POST /api/v1/auth/token
```

**Request Body (form-data):**
```
username: string
password: string
```

**Response (200):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "token_type": "bearer",
  "expires_in": 900
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

### Logout

```http
POST /api/v1/auth/logout
```

---

## Projects Endpoints

### List Projects

```http
GET /api/v1/projects
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | int | 1 | Page number |
| size | int | 20 | Items per page |
| search | string | - | Search in name/description |
| ecosystem | string | - | Filter by ecosystem |
| sort | string | created_at | Sort field |

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "ecosystem": "maven|npm|pypi|cargo|go|php|nuget",
      "repository_url": "string",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "total": 100,
  "page": 1,
  "size": 20
}
```

### Create Project

```http
POST /api/v1/projects
```

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "ecosystem": "maven|npm|pypi|cargo|go|php|nuget (required)",
  "repository_url": "string (optional)",
  "settings": {
    "auto_scan": "boolean (default: true)",
    "notify_on_vuln": "boolean (default: true)"
  }
}
```

### Get Project

```http
GET /api/v1/projects/{project_id}
```

### Update Project

```http
PATCH /api/v1/projects/{project_id}
```

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "settings": "object (optional)"
}
```

### Delete Project

```http
DELETE /api/v1/projects/{project_id}
```

---

## Dependency Endpoints

### Analyze Dependencies

```http
POST /api/v1/dependencies/analyze
```

**Request Body (multipart/form-data):**
```
project_id: uuid (optional, creates new project if omitted)
ecosystem: string (maven|npm|pypi|cargo|go|php|nuget)
manifest_file: file (pom.xml, package.json, requirements.txt, etc.)
```

**Response (202):**
```json
{
  "task_id": "uuid",
  "status": "pending",
  "message": "Analysis started"
}
```

**Response (200) - if synchronous:**
```json
{
  "project_id": "uuid",
  "dependencies": [
    {
      "name": "string",
      "version": "string",
      "ecosystem": "string",
      "type": "direct|transitive",
      "scope": "compile|runtime|test|provided",
      "resolved": {
        "file": "string",
        "sha256": "string",
        "size": 12345
      }
    }
  ],
  "dependency_tree": "object",
  "metadata": {
    "total_count": 42,
    "direct_count": 10,
    "transitive_count": 32
  }
}
```

### Get Analysis Status

```http
GET /api/v1/tasks/{task_id}
```

**Response:**
```json
{
  "task_id": "uuid",
  "status": "pending|running|completed|failed",
  "progress": 0-100,
  "result": "object (if completed)",
  "error": "string (if failed)"
}
```

---

## Vulnerability Endpoints

### Scan for Vulnerabilities

```http
POST /api/v1/vulnerabilities/scan
```

**Request Body:**
```json
{
  "project_id": "uuid (required)",
  "scan_depth": "full|quick (default: full)",
  "sources": ["osv", "nvd", "github"]
}
```

**Response (202):**
```json
{
  "scan_id": "uuid",
  "status": "pending"
}
```

### Get Vulnerabilities

```http
GET /api/v1/vulnerabilities?project_id={project_id}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| project_id | uuid | Filter by project |
| severity | string | Filter by severity |
| cve_id | string | Filter by CVE ID |
| state | string | Filter by state (open|fixed|ignored) |

**Response (200):**
```json
{
  "vulnerabilities": [
    {
      "id": "uuid",
      "cve_id": "CVE-2024-1234",
      "package_name": "string",
      "affected_versions": ["string"],
      "fixed_versions": ["string"],
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "cvss_score": 9.8,
      "description": "string",
      "references": ["url"],
      "state": "open|fixed|ignored",
      "found_at": "ISO8601"
    }
  ],
  "summary": {
    "total": 10,
    "critical": 1,
    "high": 3,
    "medium": 4,
    "low": 2
  }
}
```

---

## Policy Endpoints

### List Policies

```http
GET /api/v1/policies
```

**Response (200):**
```json
{
  "policies": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "category": "security|license|quality",
      "enabled": true,
      "rules": [
        {
          "type": "string",
          "condition": "string",
          "action": "block|warn|info"
        }
      ]
    }
  ]
}
```

### Validate Against Policies

```http
POST /api/v1/policies/validate
```

**Request Body:**
```json
{
  "project_id": "uuid (required)",
  "policy_ids": ["uuid"] (optional, default: all enabled)
}
```

**Response (200):**
```json
{
  "compliant": false,
  "violations": [
    {
      "policy_id": "uuid",
      "policy_name": "string",
      "description": "string",
      "affected_packages": ["string"],
      "severity": "CRITICAL|HIGH|MEDIUM|LOW"
    }
  ],
  "score": 85
}
```

---

## Remediation Endpoints

### Get Remediation Suggestions

```http
POST /api/v1/remediation/suggest
```

**Request Body:**
```json
{
  "project_id": "uuid",
  "vulnerability_ids": ["uuid"] (optional)
}
```

**Response (200):**
```json
{
  "suggestions": [
    {
      "dependency": {
        "name": "string",
        "current_version": "string"
      },
      "issue": "string",
      "suggestion": {
        "action": "upgrade|downgrade|replace|remove",
        "target_version": "string",
        "alternative_package": "string"
      },
      "breaking_changes": ["string"],
      "confidence": "high|medium|low"
    }
  ]
}
```

---

## SBOM Endpoints

### Generate SBOM

```http
POST /api/v1/sbom/generate
```

**Request Body:**
```json
{
  "project_id": "uuid",
  "format": "cyclonedx|spdx"
}
```

**Response (200):**
```json
{
  "format": "cyclonedx",
  "version": "1.4",
  "bom": "object",
  "download_url": "string"
}
```

### Download SBOM

```http
GET /api/v1/sbom/{project_id}.{format}
```

Accepts formats: `json`, `xml`, `yaml`

---

## Workflow Endpoints

### Create Workflow

```http
POST /api/v1/workflows
```

**Request Body:**
```json
{
  "name": "string",
  "type": "dependency_update|security_scan|custom",
  "description": "string",
  "config": {
    "approval_required": true,
    "approvers": ["user_id"]
  }
}
```

### Submit for Approval

```http
POST /api/v1/workflows/{workflow_id}/submit
```

### Approve Workflow

```http
POST /api/v1/workflows/{workflow_id}/approve
```

**Request Body:**
```json
{
  "comment": "string"
}
```

### Reject Workflow

```http
POST /api/v1/workflows/{workflow_id}/reject
```

---

## Dashboard Endpoints

### Get Summary

```http
GET /api/v1/dashboard/summary
```

**Response (200):**
```json
{
  "projects": {
    "total": 150,
    "scanned_last_24h": 45,
    "with_vulnerabilities": 23
  },
  "vulnerabilities": {
    "total": 342,
    "critical": 5,
    "high": 42,
    "medium": 156,
    "low": 139
  },
  "compliance": {
    "compliant": 127,
    "non_compliant": 23,
    "score": 84.7
  }
}
```

### Get Trends

```http
GET /api/v1/dashboard/trends
```

**Query Parameters:**
- `days`: Number of days (default: 30)
- `metric`: `vulnerabilities|scans|compliance`

---

## OpenClaw Endpoints

### Scan AI Agent Skill

```http
POST /api/v1/openclaw/skills/scan
```

**Request Body (multipart/form-data):**
```
manifest_file: file (skill.yaml, pyproject.toml, setup.py)
```

**Response (200):**
```json
{
  "skill_name": "string",
  "risk_score": 0-100,
  "vulnerabilities": [],
  "policy_violations": [],
  "recommendations": []
}
```

---

## Bridge Endpoints

### Generate Bridge

```http
POST /api/v1/bridges/generate
```

**Request Body:**
```json
{
  "name": "string",
  "bridge_type": "py4j|rest",
  "target_language": "java|javascript|typescript|python",
  "interfaces": [
    {
      "name": "string",
      "methods": [
        {
          "name": "string",
          "return_type": "string",
          "parameters": [
            {"name": "string", "type": "string"}
          ]
        }
      ]
    }
  ]
}
```

**Response (200):**
```json
{
  "bridge_id": "uuid",
  "files": [
    {
      "path": "string",
      "content": "base64"
    }
  ],
  "build_instructions": "string"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "object (optional)"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing credentials |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

| Tier | Requests | Window |
|------|----------|--------|
| Free | 100 | 1 hour |
| Pro | 1000 | 1 minute |
| Enterprise | Unlimited | - |

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

---

## WebSocket API

### Connect

```javascript
const ws = new WebSocket('wss://api.upm.internal/ws/connect?token=<jwt>');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
};
```

### Message Types

**Subscribe to updates:**
```json
{
  "type": "subscribe",
  "channel": "updates",
  "project_id": "uuid"
}
```

**Analysis progress:**
```json
{
  "type": "analysis_progress",
  "project_id": "uuid",
  "progress": 45,
  "stage": "resolving_dependencies"
}
```

**Vulnerability found:**
```json
{
  "type": "vulnerability_found",
  "project_id": "uuid",
  "vulnerability": "object"
}
```
