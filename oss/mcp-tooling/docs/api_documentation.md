# MCPOverflow API Documentation

## Overview
The MCPOverflow API enables developers to programmatically generate MCP connectors, manage AI agents, and integrate with the platform.

**Base URL**: `https://api.mcpoverflow.io/api/v1`

## Authentication
We support two API authentication methods:

### 1. Bearer Token (JWT)
Used for frontend applications and user sessions.
**Header**: `Authorization: Bearer <your_jwt_token>`

### 2. API Key (Server-to-Server)
Used for backend integrations and CI pipelines.
**Header**: `X-API-Key: <your_api_key>`

## 📚 OpenAPI Specification
The full API specification is available in OpenAPI 3.0 format.
- **Swagger UI**: `https://api.mcpoverflow.io/swagger/index.html`
- **JSON Spec**: `https://api.mcpoverflow.io/swagger/doc.json`

## Common Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

## Error Handling
| Status Code | Description |
|-------------|-------------|
| 200 | OK - Request successful |
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - Invalid or missing token/key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Something went wrong |

## Pagination
List endpoints use cursor-based or offset-based pagination.
Query params: `?page=1&limit=20`

## Rate Limiting
- **Standard**: 100 requests / minute per IP.
- **Authenticated**: 1000 requests / minute per User/Key.
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
