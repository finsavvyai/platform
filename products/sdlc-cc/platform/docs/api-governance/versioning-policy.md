# API Versioning Policy

## Version Format

All APIs use **URL path versioning**: `/api/v{major}`

- **Major version** (v1, v2): Breaking changes
- **Minor/patch versions**: Communicated via response headers, non-breaking

## Compatibility Rules

### Non-Breaking (allowed without version bump)
- Adding new optional fields to response bodies
- Adding new optional query parameters
- Adding new API endpoints
- Adding new enum values (when clients handle unknown values)
- Relaxing validation constraints (e.g., increasing max length)
- Adding new HTTP headers

### Breaking (requires major version bump)
- Removing or renaming fields in response bodies
- Removing or renaming query parameters or path parameters
- Changing field types or formats
- Adding new required fields to request bodies
- Tightening validation constraints
- Changing authentication/authorization requirements
- Changing error response structure
- Removing endpoints

## Deprecation Process

### Timeline
1. **Announcement** (T+0): Deprecation notice added to changelog and API docs
2. **Deprecation headers** (T+0): `Deprecation: true` and `Sunset: <date>` headers added
3. **Warning period** (6 months minimum): Both old and new versions operate simultaneously
4. **Sunset** (T+6mo): Old version returns `410 Gone` with migration guide link

### HTTP Headers

All deprecated endpoints MUST include:
```
Deprecation: true
Sunset: Sat, 01 Mar 2027 00:00:00 GMT
Link: <https://docs.sdlc.cc/migration/v1-to-v2>; rel="successor-version"
```

### Client Communication
- Email notification to all registered API consumers
- In-dashboard deprecation banner
- SDK update with migration helpers
- Changelog entry with migration guide

## Version Lifecycle

| Status | Description | Support Level |
|--------|-------------|---------------|
| **Current** | Latest stable version | Full support, active development |
| **Supported** | Previous major version | Security patches, critical bug fixes |
| **Deprecated** | Announced for sunset | No new features, security patches only |
| **Sunset** | End of life | Returns 410 Gone |

## API Design Standards

### Request/Response Format
- All APIs return JSON with `Content-Type: application/json`
- Dates use ISO 8601 format: `2026-02-07T12:00:00Z`
- UUIDs for all resource identifiers
- Pagination via `?page=1&per_page=25` with `X-Total-Count` header

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      {
        "field": "email",
        "reason": "invalid_format",
        "message": "Must be a valid email address"
      }
    ],
    "request_id": "req_abc123",
    "documentation_url": "https://docs.sdlc.cc/errors/VALIDATION_ERROR"
  }
}
```

### Standard HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful DELETE) |
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 422 | Unprocessable entity |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable |

### Rate Limiting Headers
All responses include:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1612345678
Retry-After: 60  (only on 429 responses)
```

## OpenAPI Specification Requirements

- All endpoints MUST be documented in OpenAPI 3.0+ spec
- Spec MUST include `operationId` for every operation
- Spec MUST include request/response schemas with examples
- Spec MUST include authentication requirements
- Spec is validated in CI on every pull request
- Breaking changes are detected automatically via `oasdiff`
