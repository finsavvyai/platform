# OpenAPI3 Migration — Gateway Service

## Overview

This document describes the OpenAPI 3.0.3 migration for the SDLC.ai Gateway service. The migration introduces structured OpenAPI validation, refactored route organization, and a modern API specification that enables better tooling, documentation generation, and request/response validation.

## Files Created/Modified

### 1. OpenAPI3 Specification (Existing, Enhanced)

**File**: `api/openapi.yaml`

**Changes**:
- Updated server URLs to base paths (removed `/v1` suffix to allow path-based versioning)
- Updated all endpoint paths to include `/api/v1` prefix for consistency
- Enhanced with comprehensive request/response schemas
- Added security schemes (Bearer JWT, API Key)
- Added tags for endpoint grouping (Auth, Documents, RAG, Health, etc.)
- Maintained all existing error response definitions

**Key Endpoints Documented**:
- **Health**: `/health`, `/health/ready`, `/health/live`, `/version`
- **Auth**: `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/refresh`, `/api/v1/auth/me`
- **Documents**: `/api/v1/documents` (list, create, get, update, delete, get content)
- **RAG**: `/api/v1/rag/query`, `/api/v1/rag/ingest`, `/api/v1/rag/search`
- **Users**: `/api/v1/users` (CRUD operations)
- **Tenants**: `/api/v1/tenants` (CRUD operations)
- **Policies**: `/api/v1/policies` (CRUD operations)
- **Files**: `/api/v1/files` (upload, download, management)

### 2. OpenAPI Validator Middleware

**File**: `internal/interfaces/http/middleware/openapi_validator.go` (179 lines)

**Purpose**: Validates incoming HTTP requests against the OpenAPI specification before they reach handlers.

**Key Features**:
- **Lazy Loading**: Loads OpenAPI spec from file at initialization
- **Route Matching**: Uses kin-openapi router to find matching operation for each request
- **Parameter Validation**: Validates path and query parameters against their schemas
- **Error Handling**: Returns structured validation errors with proper HTTP status codes
- **Dev Mode Support**: Optional response validation in development mode
- **Graceful Degradation**: Allows requests to proceed if spec loading fails (with warning)

**Types**:
- `OpenAPIValidator`: Main validator struct holding spec and router
- `ErrorResponse`: Structured error response matching API conventions

**Methods**:
- `NewOpenAPIValidator(specPath string, dev bool) (*OpenAPIValidator, error)`: Constructor
- `ValidateRequest(w http.ResponseWriter, r *http.Request) (bool, error)`: Request validation
- `ValidateResponse(r *http.Request, status int) bool`: Response validation (dev mode)
- `Middleware() func(http.Handler) http.Handler`: Chi middleware wrapper

**Usage**:
```go
validator, err := middleware.NewOpenAPIValidator("api/openapi.yaml", config.Debug)
if err != nil {
    logrus.WithError(err).Warn("OpenAPI validation disabled")
}
if validator != nil {
    router.Use(validator.Middleware())
}
```

### 3. Refactored Route Registration

**File**: `internal/interfaces/http/routes/routes_v2.go` (239 lines)

**Purpose**: Organizes and registers all routes with OpenAPI validation, replacing the original routes.go.

**Key Features**:
- **OpenAPI Integration**: Initializes and applies OpenAPI validator middleware
- **Organized Route Groups**: Separate setup functions for each logical group (auth, documents, RAG, etc.)
- **Tagged Grouping**: Routes organized by OpenAPI tags for better documentation
- **Error Handling**: Proper error propagation and logging
- **Backward Compatibility**: Maintains all existing endpoints and behavior

**Main Functions**:
- `SetupRoutesV2(r *chi.Mux, deps *handlers.Dependencies) error`: Main route setup
- `SetupRoutesWithValidator(r *chi.Mux, deps *handlers.Dependencies, specPath string) error`: Setup with explicit validator initialization
- Helper functions (setupAuthRoutes, setupDocumentRoutes, setupRAGRoutes, etc.): Organize routes by domain

**Organization**:
```
Health Routes (no auth required)
├── /health
├── /health/ready
├── /health/live
└── /version

API v1 Routes
├── Auth Routes
│   ├── POST /api/v1/auth/login
│   ├── POST /api/v1/auth/logout
│   ├── POST /api/v1/auth/refresh
│   └── GET /api/v1/auth/me
├── Document Routes
│   ├── GET/POST /api/v1/documents
│   ├── GET/PUT/DELETE /api/v1/documents/{id}
│   └── GET /api/v1/documents/{id}/content
├── RAG Routes
│   ├── POST /api/v1/rag/query
│   ├── POST /api/v1/rag/ingest
│   └── GET /api/v1/rag/search
├── Tenant Routes (admin only)
├── User Routes (admin only)
├── Policy Routes
├── File Routes
├── API Key Routes
├── Usage Routes
├── DLP Routes
└── Vector Routes
```

**Usage**:
```go
// In main.go or app initialization
deps := &handlers.Dependencies{...}
if err := routes.SetupRoutesV2(mux, deps); err != nil {
    logrus.Fatalf("Failed to setup routes: %v", err)
}
```

## Implementation Guide

### Step 1: Update Main Application

Update `cmd/server/main.go` or your server initialization file:

```go
package main

import (
    "github.com/go-chi/chi/v5"
    "github.com/finsavvyai/sdlc-platform/services/gateway/internal/interfaces/http/routes"
    "github.com/finsavvyai/sdlc-platform/services/gateway/internal/interfaces/http/handlers"
)

func setupRoutes(mux *chi.Mux, deps *handlers.Dependencies) error {
    return routes.SetupRoutesV2(mux, deps)
}
```

### Step 2: Optional - Enable Validator in Different Environments

```go
// In config or initialization
if err := routes.SetupRoutesWithValidator(mux, deps, "api/openapi.yaml"); err != nil {
    return fmt.Errorf("failed to setup OpenAPI routes: %w", err)
}
```

### Step 3: Remove Original routes.go

The original `internal/interfaces/http/routes/routes.go` should be removed or kept as legacy reference:
```bash
# Keep as backup
mv internal/interfaces/http/routes/routes.go internal/interfaces/http/routes/routes_legacy.go
```

## Migration Checklist

- [x] Create `api/openapi.yaml` with all endpoints and proper versioning
- [x] Create `internal/interfaces/http/middleware/openapi_validator.go` with request/response validation
- [x] Create `internal/interfaces/http/routes/routes_v2.go` with organized route setup
- [ ] Update main server initialization to use `SetupRoutesV2`
- [ ] Test all endpoints manually to ensure functionality
- [ ] Run integration tests to verify request/response handling
- [ ] Update API documentation links in README
- [ ] Generate client SDKs from OpenAPI spec (optional)
- [ ] Deploy to staging and validate validator behavior
- [ ] Monitor for validation errors in logs and adjust as needed

## Validation Behavior

### Request Validation
1. Check if request path matches any operation in OpenAPI spec
2. If no match, allow request to proceed (paths not in spec are allowed)
3. If match found, validate path and query parameters against schema definitions
4. Return 400 Bad Request for invalid parameters with error details

### Response Validation
- Only in development mode (when `deps.Config.Debug` is true)
- Checks if response status code is documented in OpenAPI spec
- Logs warnings for undocumented status codes

### Graceful Degradation
- If OpenAPI spec fails to load, validation middleware is skipped with warning
- All requests proceed normally without validation
- No failure at initialization - allows service to start even if spec is unavailable

## Error Response Format

Validation errors follow the standard API error format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid path parameter 'id': parameter is required",
    "details": null
  },
  "meta": {
    "request_id": "req_12345",
    "timestamp": "2024-04-10T12:00:00Z"
  }
}
```

## OpenAPI Spec Details

### Security Schemes
- **BearerAuth**: JWT token in `Authorization: Bearer <token>` header
- **ApiKeyAuth**: API key in `X-API-Key: <api-key>` header

### Common Parameters
- **Pagination**: `limit` (1-1000, default 50), `offset` (default 0)
- **Filtering**: `search` (free-text search), `filters` (JSON-encoded filters)
- **IDs**: Path parameters use UUID format

### Response Structure
All responses include:
- `success`: boolean indicating request success
- `data`: Response payload (varies by endpoint)
- `meta`: Metadata including request_id, timestamp, version

### Error Status Codes
- **400**: Bad Request - validation failed
- **401**: Unauthorized - authentication required or failed
- **403**: Forbidden - insufficient permissions
- **404**: Not Found - resource not found
- **429**: Too Many Requests - rate limit exceeded
- **500**: Internal Server Error - server-side failure

## Dependencies

The implementation uses:
- `github.com/getkin/kin-openapi v0.133+`: OpenAPI 3.0.3 parser and validator
- `github.com/getkin/kin-openapi/routers/gorillamux`: OpenAPI router for Chi
- Existing dependencies: `chi/v5`, `logrus`, `render`

Ensure these are in your `go.mod`:
```
require github.com/getkin/kin-openapi v0.133.0
```

## Testing

### Manual Testing
```bash
# Test health endpoints (no spec validation)
curl http://localhost:8080/health

# Test documented endpoint
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pwd","tenant_id":"uuid"}'

# Test with invalid parameter
curl http://localhost:8080/api/v1/documents/invalid-uuid
# Should return 400 Bad Request
```

### Unit Tests
Create `internal/interfaces/http/routes/routes_v2_test.go`:
```go
package routes

import (
    "testing"
    "github.com/go-chi/chi/v5"
    // ... test setup
)

func TestSetupRoutesV2(t *testing.T) {
    // Test route initialization
    mux := chi.NewMux()
    deps := &handlers.Dependencies{...}
    err := SetupRoutesV2(mux, deps)
    if err != nil {
        t.Fatalf("Failed to setup routes: %v", err)
    }
}
```

## Performance Considerations

- **Spec Loading**: OpenAPI spec is loaded once at startup - negligible performance impact
- **Route Matching**: OpenAPI router uses gorilla/mux under the hood - O(1) lookup
- **Parameter Validation**: Only validates parameters for documented operations - minimal overhead
- **Memory**: Spec file loaded into memory (~100KB for typical spec)

## Troubleshooting

### Spec Loading Fails
**Symptom**: Warning "Failed to load OpenAPI spec - validation disabled"
**Solution**:
- Check file path is correct relative to working directory
- Verify YAML syntax: `yamllint api/openapi.yaml`
- Check file permissions

### Validation Errors for Valid Requests
**Symptom**: 400 Bad Request for valid operations
**Solution**:
- Verify endpoint is documented in openapi.yaml
- Check parameter names match spec exactly (case-sensitive)
- Run `openapi3 lint api/openapi.yaml` to validate spec

### Routes Not Registering
**Symptom**: 404 on valid endpoints
**Solution**:
- Ensure `SetupRoutesV2` is called during server startup
- Check route prefixes in spec match actual paths
- Verify handler functions are not nil

## Future Enhancements

1. **SDK Generation**: Generate client SDKs from OpenAPI spec
2. **API Documentation**: Auto-generate HTML docs from spec
3. **Request/Response Logging**: Log validated requests/responses for audit trails
4. **Automatic Test Generation**: Generate test cases from spec examples
5. **Rate Limiting by Spec**: Use OpenAPI spec to define rate limits per endpoint
6. **Schema Evolution**: Track schema changes across API versions
