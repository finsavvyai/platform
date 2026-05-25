# API Overview

The MCPOverflow API provides comprehensive functionality for managing MCP connectors, processing jobs, and monitoring usage. This document covers the API architecture, authentication, and general usage patterns.

## 🏗️ API Architecture

### Base URL

```
Production: https://api.mcpoverflow.com/v1
Development: http://localhost:5173/api/v1
```

### Request/Response Format

All API responses follow a consistent JSON format:

```typescript
// Success Response
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}

// Error Response
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

### HTTP Status Codes

| Status | Description           | Usage                         |
| ------ | --------------------- | ----------------------------- |
| `200`  | OK                    | Successful request            |
| `201`  | Created               | Resource created successfully |
| `400`  | Bad Request           | Invalid request data          |
| `401`  | Unauthorized          | Authentication required       |
| `403`  | Forbidden             | Insufficient permissions      |
| `404`  | Not Found             | Resource not found            |
| `409`  | Conflict              | Resource conflict             |
| `422`  | Unprocessable Entity  | Validation failed             |
| `429`  | Too Many Requests     | Rate limit exceeded           |
| `500`  | Internal Server Error | Server error                  |

## 🔐 Authentication

### Bearer Token Authentication

```http
Authorization: Bearer <supabase_jwt_token>
```

### API Key Authentication

```http
X-API-Key: <api_key>
```

### CSRF Protection

Include CSRF token for state-changing requests:

```http
X-CSRF-Token: <csrf_token>
```

## 📡 API Endpoints

### Authentication

#### Sign Up

```http
POST /auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  },
  "message": "Account created successfully! Please verify your email."
}
```

#### Sign In

```http
POST /auth/sign-in
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "jwt_token",
      "refresh_token": "refresh_token",
      "expires_in": 3600
    },
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

#### Sign Out

```http
POST /auth/sign-out
```

**Headers:**

```http
Authorization: Bearer <token>
```

### Connectors

#### List Connectors

```http
GET /connectors
```

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status
- `search` (string): Search term
- `sort` (string): Sort field (created_at, name, status)
- `order` (string): Sort order (asc, desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "connectors": [
      {
        "id": "uuid",
        "name": "E-commerce API",
        "slug": "ecommerce-api",
        "description": "E-commerce platform API",
        "status": "active",
        "runtime": "worker-ts",
        "auth_mode": "api_key",
        "tool_count": 15,
        "is_public": false,
        "created_at": "2025-11-02T10:00:00Z",
        "updated_at": "2025-11-02T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

#### Get Connector

```http
GET /connectors/{id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "E-commerce API",
    "slug": "ecommerce-api",
    "description": "E-commerce platform API",
    "owner_id": "uuid",
    "version": 1,
    "status": "active",
    "runtime": "worker-ts",
    "auth_mode": "api_key",
    "spec_url": "https://api.example.com/openapi.json",
    "spec_content": {
      /* OpenAPI spec */
    },
    "manifest_content": {
      /* MCP manifest */
    },
    "tool_count": 15,
    "tags": ["ecommerce", "products"],
    "is_public": false,
    "download_count": 42,
    "created_at": "2025-11-02T10:00:00Z",
    "updated_at": "2025-11-02T15:30:00Z"
  }
}
```

#### Create Connector

```http
POST /connectors
```

**Request Body:**

```json
{
  "name": "My API Connector",
  "slug": "my-api-connector",
  "description": "API connector for my service",
  "runtime": "worker-ts",
  "auth_mode": "api_key",
  "spec_url": "https://api.example.com/openapi.json",
  "spec_content": {
    /* OpenAPI spec */
  },
  "tags": ["api", "service"],
  "is_public": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My API Connector",
    "status": "draft",
    "created_at": "2025-11-02T16:00:00Z"
  }
}
```

#### Update Connector

```http
PUT /connectors/{id}
```

**Request Body:**

```json
{
  "name": "Updated Connector Name",
  "description": "Updated description",
  "tags": ["updated", "tags"]
}
```

#### Delete Connector

```http
DELETE /connectors/{id}
```

### Generation

#### Start Generation Job

```http
POST /generate
```

**Request Body:**

```json
{
  "connectorId": "uuid",
  "specContent": "openapi_spec_content",
  "specUrl": "https://api.example.com/openapi.json",
  "targetRuntime": "worker-ts",
  "authMode": "api_key",
  "connectorName": "Generated Connector",
  "filter": {
    "exclude": ["/internal/*", "/admin/*"]
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "connectorId": "uuid",
    "estimatedDuration": 180
  }
}
```

#### Get Job Status

```http
GET /jobs/{id}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "connector_id": "uuid",
    "type": "generate",
    "status": "running",
    "priority": "normal",
    "progress": {
      "stage": "parsing",
      "percentage": 45
    },
    "created_at": "2025-11-02T16:00:00Z",
    "started_at": "2025-11-02T16:01:00Z",
    "estimated_duration": 180
  }
}
```

#### Get Job Logs

```http
GET /jobs/{id}/logs
```

**Query Parameters:**

- `level` (string): Filter by log level (debug, info, warn, error)
- `limit` (number): Number of logs to return
- `since` (string): ISO timestamp for filtering

**Response:**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "timestamp": "2025-11-02T16:01:30Z",
        "level": "info",
        "message": "Starting OpenAPI specification parsing",
        "metadata": {
          "spec_size": 2048
        }
      }
    ]
  }
}
```

### User Profile

#### Get User Profile

```http
GET /user/profile
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "created_at": "2025-11-01T10:00:00Z",
    "last_sign_in_at": "2025-11-02T09:30:00Z",
    "preferences": {
      "theme": "dark",
      "language": "en",
      "notifications": {
        "email_notifications": true,
        "job_completion": true,
        "deployment_status": true,
        "usage_alerts": false
      }
    }
  }
}
```

#### Update User Profile

```http
PUT /user/profile
```

**Request Body:**

```json
{
  "displayName": "Jane Doe",
  "avatarUrl": "https://example.com/new-avatar.jpg",
  "preferences": {
    "theme": "light",
    "notifications": {
      "email_notifications": false
    }
  }
}
```

#### Get User Statistics

```http
GET /user/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total_connectors": 5,
    "active_connectors": 3,
    "total_jobs": 12,
    "completed_jobs": 10,
    "failed_jobs": 2,
    "total_requests": 1500,
    "avg_response_time": 245.5
  }
}
```

### Analytics

#### Get Connector Analytics

```http
GET /analytics/connectors/{id}
```

**Query Parameters:**

- `startDate` (string): Start date (ISO format)
- `endDate` (string): End date (ISO format)
- `granularity` (string): hour, day, week, month

**Response:**

```json
{
  "success": true,
  "data": {
    "timeSeries": [
      {
        "date": "2025-11-01",
        "requests": 150,
        "errors": 3,
        "avgResponseTime": 245,
        "p95ResponseTime": 500
      }
    ],
    "summary": {
      "totalRequests": 1500,
      "totalErrors": 30,
      "errorRate": 2.0,
      "avgResponseTime": 245.5
    }
  }
}
```

#### Get System Health

```http
GET /analytics/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "metrics": [
      {
        "name": "total_connectors",
        "value": 100,
        "status": "healthy"
      },
      {
        "name": "active_jobs",
        "value": 5,
        "status": "info"
      },
      {
        "name": "failed_jobs_24h",
        "value": 2,
        "status": "warning"
      }
    ],
    "timestamp": "2025-11-02T16:00:00Z"
  }
}
```

## 🚨 Error Handling

### Common Error Codes

| Code                   | Description                 | Resolution                 |
| ---------------------- | --------------------------- | -------------------------- |
| `VALIDATION_ERROR`     | Request validation failed   | Check request format       |
| `AUTHENTICATION_ERROR` | Invalid credentials         | Check authentication       |
| `AUTHORIZATION_ERROR`  | Insufficient permissions    | Check user permissions     |
| `RESOURCE_NOT_FOUND`   | Resource doesn't exist      | Verify resource ID         |
| `RATE_LIMIT_EXCEEDED`  | Too many requests           | Wait and retry             |
| `GENERATION_ERROR`     | Connector generation failed | Check specification format |
| `DEPLOYMENT_ERROR`     | Deployment failed           | Check configuration        |

### Error Response Example

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

## 🔄 Rate Limiting

### Rate Limits

| Endpoint       | Limit        | Window     |
| -------------- | ------------ | ---------- |
| Authentication | 5 requests   | 15 minutes |
| Generation     | 10 requests  | 1 hour     |
| General API    | 100 requests | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1635840000
```

### Rate Limit Response

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again in 5 minutes.",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "resetTime": "2025-11-02T16:05:00Z",
    "retryAfter": 300
  }
}
```

## 📚 SDK Examples

### JavaScript/TypeScript

```typescript
import { MCPOverflowAPI } from '@mcpoverflow/client'

const api = new MCPOverflowAPI({
  baseURL: 'https://api.mcpoverflow.com/v1',
  apiKey: 'your-api-key',
})

// Get connectors
const connectors = await api.connectors.list({
  status: 'active',
  page: 1,
  limit: 10,
})

// Generate connector
const job = await api.generate.create({
  specUrl: 'https://api.example.com/openapi.json',
  targetRuntime: 'worker-ts',
  connectorName: 'Example API',
})
```

### Python

```python
import mcpoverflow

client = mcpoverflow.Client(
    api_key='your-api-key',
    base_url='https://api.mcpoverflow.com/v1'
)

# Get connectors
connectors = client.connectors.list(status='active')

# Generate connector
job = client.generate.create(
    spec_url='https://api.example.com/openapi.json',
    target_runtime='worker-ts',
    connector_name='Example API'
)
```

### cURL

```bash
# List connectors
curl -X GET "https://api.mcpoverflow.com/v1/connectors" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Generate connector
curl -X POST "https://api.mcpoverflow.com/v1/generate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "specUrl": "https://api.example.com/openapi.json",
    "targetRuntime": "worker-ts",
    "connectorName": "Example API"
  }'
```

## 🔄 Webhooks

### Configure Webhooks

```http
POST /webhooks
```

**Request Body:**

```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["job.completed", "job.failed", "connector.deployed"],
  "secret": "webhook_secret"
}
```

### Webhook Payload

```json
{
  "event": "job.completed",
  "data": {
    "jobId": "uuid",
    "connectorId": "uuid",
    "status": "completed",
    "result": {
      "downloadUrl": "https://example.com/download/uuid"
    }
  },
  "timestamp": "2025-11-02T16:00:00Z"
}
```

---

For detailed endpoint documentation, see the [API Reference](./reference.md) section.
