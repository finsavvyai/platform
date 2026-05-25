# Qestro SaaS Platform - API Documentation

## Overview

The Qestro SaaS Platform provides a comprehensive RESTful API for managing testing automation, user authentication, team collaboration, and enterprise-grade features. This documentation covers all API endpoints, authentication, request/response formats, and usage examples.

**Base URL**: `https://api.qestro.io`
**API Version**: `v1`
**Content-Type**: `application/json`

## Authentication

### Overview

The Qestro API uses JWT (JSON Web Tokens) for authentication with refresh token rotation for enhanced security. All API endpoints (except authentication endpoints) require a valid access token.

### Authentication Flow

1. **User Registration/Login**: Receive access token and refresh token
2. **API Requests**: Include access token in Authorization header
3. **Token Refresh**: Use refresh token to obtain new access token
4. **Token Expiration**: Automatically refresh when access token expires

### Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
X-API-Version: v1
```

### Token Types

- **Access Token**: Short-lived (15 minutes) token for API requests
- **Refresh Token**: Long-lived (7 days) token for obtaining new access tokens
- **API Key**: Alternative authentication for programmatic access

## API Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "meta": {
    // Optional metadata (pagination, timestamps, etc.)
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

API requests are rate-limited to ensure fair usage and system stability:

| Endpoint Type | Limit | Window |
|---------------|-------|---------|
| Authentication | 10 requests | 1 minute |
| Standard API | 100 requests | 1 minute |
| Analytics | 50 requests | 1 minute |
| Testing | 200 requests | 1 minute |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

---

## Authentication Endpoints

### Register User

```http
POST /api/auth/register
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Example Corp"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": false,
      "status": "pending"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token",
      "expiresIn": 900
    }
  }
}
```

### Login

```http
POST /api/auth/login
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "rememberMe": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": true,
      "status": "active"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token",
      "expiresIn": 900
    }
  }
}
```

### Refresh Token

```http
POST /api/auth/refresh
```

**Request Body**:
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tokens": {
      "accessToken": "new_jwt_access_token",
      "refreshToken": "new_jwt_refresh_token",
      "expiresIn": 900
    }
  }
}
```

### Logout

```http
POST /api/auth/logout
```

**Request Body**:
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## User Management Endpoints

### Get Current User Profile

```http
GET /api/users/me
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "avatarUrl": "https://example.com/avatar.jpg",
      "role": "user",
      "status": "active",
      "emailVerified": true,
      "mfaEnabled": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Update User Profile

```http
PUT /api/users/me
```

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "avatarUrl": "https://example.com/new-avatar.jpg"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Smith",
      "avatarUrl": "https://example.com/new-avatar.jpg",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Change Password

```http
PUT /api/users/me/password
```

**Request Body**:
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Team Management Endpoints

### Get User's Teams

```http
GET /api/teams?page=1&limit=20
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search term for team names

**Response**:
```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "id": "uuid",
        "name": "Development Team",
        "description": "Main development team",
        "memberCount": 5,
        "projectCount": 12,
        "userRole": "admin",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Create Team

```http
POST /api/teams
```

**Request Body**:
```json
{
  "name": "New Team",
  "description": "Team description",
  "settings": {
    "allowInvites": true,
    "defaultRole": "member"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "team": {
      "id": "uuid",
      "name": "New Team",
      "description": "Team description",
      "ownerId": "uuid",
      "settings": {
        "allowInvites": true,
        "defaultRole": "member"
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Invite Team Member

```http
POST /api/teams/{teamId}/members
```

**Request Body**:
```json
{
  "email": "member@example.com",
  "role": "member",
  "permissions": ["view_projects", "edit_tests"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "invitation": {
      "id": "uuid",
      "email": "member@example.com",
      "role": "member",
      "status": "pending",
      "expiresAt": "2024-01-08T00:00:00Z"
    }
  }
}
```

---

## Project Management Endpoints

### Get Projects

```http
GET /api/projects?page=1&limit=20&teamId=uuid&type=web
```

**Query Parameters**:
- `page` (optional): Page number
- `limit` (optional): Items per page
- `teamId` (optional): Filter by team
- `type` (optional): Filter by project type (web, mobile, api, desktop)
- `status` (optional): Filter by status
- `search` (optional): Search term

**Response**:
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "Web Application Tests",
        "description": "E2E tests for web app",
        "type": "web",
        "status": "active",
        "teamId": "uuid",
        "teamName": "Development Team",
        "ownerName": "John Doe",
        "testCount": 25,
        "runCount": 150,
        "userRole": "admin",
        "permissions": {
          "canEdit": true,
          "canDelete": true,
          "canManageMembers": true
        },
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Create Project

```http
POST /api/projects
```

**Request Body**:
```json
{
  "name": "New Project",
  "description": "Project description",
  "teamId": "uuid",
  "type": "web",
  "settings": {
    "framework": "react",
    "targetPlatform": "chrome",
    "testEnvironment": "staging",
    "notifications": true,
    "autoSave": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "New Project",
      "description": "Project description",
      "ownerId": "uuid",
      "teamId": "uuid",
      "type": "web",
      "status": "active",
      "settings": {
        "framework": "react",
        "targetPlatform": "chrome",
        "testEnvironment": "staging",
        "notifications": true,
        "autoSave": true
      },
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

## Testing Endpoints

### Get Test Cases

```http
GET /api/testing/test-cases?projectId=uuid&page=1&limit=20
```

**Query Parameters**:
- `projectId` (optional): Filter by project
- `suiteId` (optional): Filter by test suite
- `type` (optional): Filter by test type
- `status` (optional): Filter by status
- `priority` (optional): Filter by priority
- `search` (optional): Search term

**Response**:
```json
{
  "success": true,
  "data": {
    "testCases": [
      {
        "id": "uuid",
        "name": "Login Test",
        "description": "Verify user login functionality",
        "type": "e2e",
        "priority": "high",
        "status": "active",
        "suiteId": "uuid",
        "suiteName": "Authentication Tests",
        "tags": ["authentication", "critical"],
        "runCount": 50,
        "successCount": 48,
        "successRate": 96,
        "createdBy": "John Doe",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Create Test Case

```http
POST /api/testing/test-cases
```

**Request Body**:
```json
{
  "name": "New Test Case",
  "description": "Test case description",
  "projectId": "uuid",
  "suiteId": "uuid",
  "type": "e2e",
  "priority": "medium",
  "tags": ["smoke", "regression"],
  "steps": [
    {
      "action": "Navigate to login page",
      "expected": "Login page loads successfully",
      "timeout": 5000
    },
    {
      "action": "Enter credentials and submit",
      "expected": "User is redirected to dashboard",
      "timeout": 10000
    }
  ],
  "settings": {
    "timeout": 30000,
    "retries": 0,
    "parallel": false,
    "environment": "staging",
    "browser": "chrome"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "testCase": {
      "id": "uuid",
      "name": "New Test Case",
      "description": "Test case description",
      "projectId": "uuid",
      "suiteId": "uuid",
      "type": "e2e",
      "priority": "medium",
      "status": "active",
      "tags": ["smoke", "regression"],
      "steps": [
        {
          "action": "Navigate to login page",
          "expected": "Login page loads successfully",
          "timeout": 5000
        }
      ],
      "settings": {
        "timeout": 30000,
        "retries": 0,
        "parallel": false,
        "environment": "staging",
        "browser": "chrome"
      },
      "createdBy": "uuid",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Run Tests

```http
POST /api/testing/run
```

**Request Body**:
```json
{
  "testIds": ["uuid1", "uuid2"],
  "settings": {
    "environment": "staging",
    "browser": "chrome",
    "device": "desktop",
    "parallel": true,
    "timeout": 30000,
    "retries": 1,
    "headless": true,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "testRun": {
      "id": "uuid",
      "projectId": "uuid",
      "testCaseIds": ["uuid1", "uuid2"],
      "status": "queued",
      "startedBy": "uuid",
      "settings": {
        "environment": "staging",
        "browser": "chrome",
        "parallel": true
      },
      "startedAt": "2024-01-01T00:00:00Z"
    },
    "message": "Test execution queued successfully"
  }
}
```

### Get Test Runs

```http
GET /api/testing/runs?projectId=uuid&status=completed&page=1&limit=20
```

**Response**:
```json
{
  "success": true,
  "data": {
    "testRuns": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "projectName": "Web Application Tests",
        "status": "completed",
        "testCaseIds": ["uuid1", "uuid2"],
        "startedBy": "John Doe",
        "durationSeconds": 120,
        "settings": {
          "environment": "staging",
          "browser": "chrome"
        },
        "results": {
          "total_tests": 2,
          "passed_tests": 2,
          "failed_tests": 0,
          "skipped_tests": 0
        },
        "successRate": 100,
        "startedAt": "2024-01-01T00:00:00Z",
        "endedAt": "2024-01-01T00:02:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

## Analytics Endpoints

### Get Platform Overview

```http
GET /api/analytics/overview?startDate=2024-01-01&endDate=2024-01-31&timezone=UTC
```

**Query Parameters**:
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `timezone` (optional): Timezone (default: UTC)

**Response**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "users": {
        "total_users": 1000,
        "verified_users": 850,
        "active_users": 600,
        "new_users": 50,
        "returning_users": 200
      },
      "teams": {
        "total_teams": 150,
        "new_teams": 12,
        "avg_team_size": 4.5
      },
      "projects": {
        "total_projects": 500,
        "new_projects": 25,
        "web_projects": 300,
        "mobile_projects": 150,
        "api_projects": 50
      },
      "testRuns": {
        "total_test_runs": 10000,
        "recent_runs": 1000,
        "passed_runs": 8500,
        "failed_runs": 1200,
        "avg_duration_seconds": 45
      },
      "subscriptions": {
        "total_subscriptions": 200,
        "active_subscriptions": 180,
        "enterprise_subscriptions": 20,
        "professional_subscriptions": 60,
        "starter_subscriptions": 100,
        "monthly_recurring_revenue": 15000
      }
    },
    "timeRange": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-01-31T23:59:59Z",
      "timezone": "UTC"
    },
    "generatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Get Usage Analytics

```http
GET /api/analytics/usage?startDate=2024-01-01&endDate=2024-01-31&metrics=all&groupBy=day
```

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `metrics` (optional): Array of metrics (all, test_runs, api_calls, features, user_activity)
- `groupBy` (optional): Group by period (day, week, month)
- `filters` (optional): Object with filter criteria

**Response**:
```json
{
  "success": true,
  "data": {
    "analytics": {
      "testRuns": [
        {
          "period": "2024-01-01T00:00:00Z",
          "total_runs": 100,
          "passed_runs": 85,
          "failed_runs": 12,
          "running_runs": 3,
          "avg_duration": 42.5
        }
      ],
      "apiCalls": [
        {
          "period": "2024-01-01T00:00:00Z",
          "total_calls": 5000,
          "unique_users": 100,
          "avg_response_time": 120,
          "error_calls": 50
        }
      ],
      "features": [
        {
          "feature": "test_recording",
          "usage_count": 150,
          "unique_users": 50,
          "avg_usage_duration": 300
        }
      ],
      "userActivity": [
        {
          "period": "2024-01-01T00:00:00Z",
          "active_users": 80,
          "total_actions": 500,
          "avg_session_duration": 900
        }
      ]
    },
    "meta": {
      "timeRange": {
        "startDate": "2024-01-01T00:00:00Z",
        "endDate": "2024-01-31T23:59:59Z"
      },
      "groupBy": "day",
      "filters": {},
      "generatedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

## Subscription Management Endpoints

### Get Available Plans

```http
GET /api/subscriptions/plans
```

**Response**:
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "starter",
        "name": "Starter",
        "description": "Perfect for small teams getting started",
        "monthlyPrice": 29,
        "annualPrice": 290,
        "features": {
          "users": 5,
          "projects": 10,
          "testRuns": 1000,
          "storage": "10GB",
          "support": "community"
        },
        "limits": {
          "apiCalls": 10000,
          "parallelTests": 2,
          "retentionDays": 30
        }
      },
      {
        "id": "professional",
        "name": "Professional",
        "description": "For growing teams needing advanced features",
        "monthlyPrice": 99,
        "annualPrice": 990,
        "features": {
          "users": 20,
          "projects": 50,
          "testRuns": 10000,
          "storage": "100GB",
          "support": "priority"
        },
        "limits": {
          "apiCalls": 100000,
          "parallelTests": 10,
          "retentionDays": 90
        }
      }
    ]
  }
}
```

### Get Current Subscription

```http
GET /api/subscriptions/current
```

**Response**:
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "uuid",
      "status": "active",
      "planType": "professional",
      "billingInterval": "monthly",
      "currentPeriodStart": "2024-01-01T00:00:00Z",
      "currentPeriodEnd": "2024-02-01T00:00:00Z",
      "cancelAtPeriodEnd": false,
      "usage": {
        "users": 8,
        "projects": 15,
        "testRuns": 2500,
        "apiCalls": 50000
      },
      "limits": {
        "users": 20,
        "projects": 50,
        "testRuns": 10000,
        "apiCalls": 100000
      }
    }
  }
}
```

---

## SDK and Integration Examples

### JavaScript/TypeScript SDK

```typescript
import { QestroAPI } from '@qestro/api-client';

const client = new QestroAPI({
  baseURL: 'https://api.qestro.io',
  apiKey: 'your-api-key'
});

// Create a test case
const testCase = await client.testing.createTestCase({
  name: 'Login Test',
  projectId: 'project-uuid',
  type: 'e2e',
  steps: [
    {
      action: 'Navigate to /login',
      expected: 'Login page loads'
    }
  ]
});

// Run tests
const testRun = await client.testing.runTests({
  testIds: [testCase.id],
  settings: {
    environment: 'staging',
    headless: true
  }
});
```

### Python SDK

```python
from qestro_api import QestroClient

client = QestroClient(
    base_url='https://api.qestro.io',
    api_key='your-api-key'
)

# Get projects
projects = client.projects.list()

# Create test run
test_run = client.testing.run_tests(
    test_ids=['test-uuid'],
    settings={'environment': 'staging'}
)
```

### cURL Examples

```bash
# Login
curl -X POST https://api.qestro.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Get projects
curl -X GET https://api.qestro.io/api/projects \
  -H "Authorization: Bearer <access_token>"

# Create test case
curl -X POST https://api.qestro.io/api/testing/test-cases \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Test",
    "projectId": "project-uuid",
    "type": "e2e"
  }'
```

---

## Error Handling

### Common Error Scenarios

**Invalid Token**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired access token"
  }
}
```

**Rate Limit Exceeded**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "window": 3600
    }
  }
}
```

**Validation Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "fields": {
        "email": "Invalid email format",
        "password": "Password must be at least 8 characters"
      }
    }
  }
}
```

---

## Webhooks

### Configure Webhooks

Webhooks allow you to receive real-time notifications about test runs, system events, and user activities.

**Webhook Events**:
- `test.run.completed` - Test run completed
- `test.run.failed` - Test run failed
- `user.created` - New user registered
- `subscription.created` - New subscription created
- `payment.succeeded` - Payment successful

**Webhook Payload Example**:
```json
{
  "event": "test.run.completed",
  "data": {
    "testRunId": "uuid",
    "projectId": "uuid",
    "status": "completed",
    "results": {
      "total": 10,
      "passed": 8,
      "failed": 2
    },
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

---

## API Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Authentication endpoints
- User management
- Team management
- Project management
- Testing endpoints
- Analytics endpoints
- Subscription management

### v1.1.0 (Upcoming)
- Advanced filtering and search
- Batch operations
- Real-time WebSocket connections
- Advanced analytics features

---

## Support and Documentation

- **Documentation**: https://docs.qestro.io
- **API Reference**: https://api.qestro.io/docs
- **Support**: api-support@qestro.io
- **Status Page**: https://status.qestro.io
- **Community Forum**: https://community.qestro.io

## License

The Qestro API is subject to the terms of service available at https://qestro.io/terms.