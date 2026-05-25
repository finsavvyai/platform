# Questro API Documentation

## Overview

Questro provides a comprehensive RESTful API for AI-powered test automation, including test recording, execution, management, and analytics capabilities.

## Base URL

- **Production**: `https://api.questro.com`
- **Staging**: `https://staging-api.questro.com`
- **Development**: `http://localhost:8000`

## Authentication

Questro uses JWT (JSON Web Token) authentication with refresh token rotation.

### Authentication Flow

1. **Login**: Obtain access and refresh tokens
2. **API Calls**: Include access token in Authorization header
3. **Token Refresh**: Use refresh token to obtain new access token

### Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

### Token Endpoints

#### POST /api/auth/login
Authenticate user and obtain tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "subscription": {
        "plan": "professional",
        "status": "active",
        "expiresAt": "2024-12-31T23:59:59.000Z"
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 900
    }
  }
}
```

#### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}
```

## Core API Endpoints

### User Management

#### GET /api/users/profile
Get current user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "avatar": "https://example.com/avatar.jpg",
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "language": "en"
    },
    "subscription": {
      "plan": "professional",
      "status": "active",
      "expiresAt": "2024-12-31T23:59:59.000Z",
      "features": ["ai-test-generation", "advanced-analytics"]
    },
    "usage": {
      "testsRun": 1250,
      "aiCredits": 750,
      "storageUsed": 2048576
    }
  }
}
```

#### PUT /api/users/profile
Update user profile.

**Request Body:**
```json
{
  "name": "John Smith",
  "preferences": {
    "theme": "light",
    "notifications": false,
    "language": "es"
  }
}
```

### Projects

#### GET /api/projects
List all projects for the authenticated user.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string): Search term
- `sort` (string): Sort field (name, createdAt, updatedAt)
- `order` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_123",
        "name": "E-commerce App Testing",
        "description": "Automated testing for mobile e-commerce application",
        "platform": "mobile",
        "type": "ios",
        "status": "active",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-20T14:45:00.000Z",
        "stats": {
          "testCases": 45,
          "testRuns": 1250,
          "lastRun": "2024-01-20T14:45:00.000Z",
          "successRate": 94.2
        },
        "team": [
          {
            "id": "user_456",
            "name": "Jane Smith",
            "role": "tester",
            "avatar": "https://example.com/avatar2.jpg"
          }
        ]
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

#### POST /api/projects
Create a new project.

**Request Body:**
```json
{
  "name": "New Testing Project",
  "description": "Project description",
  "platform": "web",
  "type": "react",
  "settings": {
    "baseUrl": "https://example.com",
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "timeout": 30000
  }
}
```

#### GET /api/projects/:id
Get project details by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj_123",
    "name": "E-commerce App Testing",
    "description": "Automated testing for mobile e-commerce application",
    "platform": "mobile",
    "type": "ios",
    "status": "active",
    "settings": {
      "bundleId": "com.example.ecommerce",
      "device": "iPhone 14",
      "version": "1.2.3"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:00.000Z",
    "testCases": [
      {
        "id": "test_123",
        "name": "Login Flow Test",
        "status": "active",
        "lastRun": "2024-01-20T14:45:00.000Z"
      }
    ]
  }
}
```

### Test Cases

#### GET /api/projects/:projectId/test-cases
List test cases for a project.

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `status` (string): Filter by status (active, inactive, draft)
- `search` (string): Search term

**Response:**
```json
{
  "success": true,
  "data": {
    "testCases": [
      {
        "id": "test_123",
        "name": "User Registration Flow",
        "description": "Test complete user registration process",
        "status": "active",
        "priority": "high",
        "tags": ["registration", "critical"],
        "steps": [
          {
            "id": "step_1",
            "type": "navigate",
            "target": "/register",
            "description": "Navigate to registration page"
          },
          {
            "id": "step_2",
            "type": "input",
            "target": "#email",
            "value": "test@example.com",
            "description": "Enter email address"
          }
        ],
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-20T14:45:00.000Z",
        "stats": {
          "totalRuns": 45,
          "successRate": 95.6,
          "avgDuration": 1250,
          "lastRun": "2024-01-20T14:45:00.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "totalPages": 1
    }
  }
}
```

#### POST /api/projects/:projectId/test-cases
Create a new test case.

**Request Body:**
```json
{
  "name": "Checkout Process Test",
  "description": "Test complete checkout flow",
  "priority": "high",
  "tags": ["checkout", "payment"],
  "steps": [
    {
      "type": "navigate",
      "target": "/product/123",
      "description": "Navigate to product page"
    },
    {
      "type": "click",
      "target": "[data-testid='add-to-cart']",
      "description": "Add product to cart"
    },
    {
      "type": "navigate",
      "target": "/cart",
      "description": "Go to cart"
    },
    {
      "type": "click",
      "target": "[data-testid='checkout']",
      "description": "Proceed to checkout"
    }
  ]
}
```

### Test Recording

#### POST /api/recordings/start
Start a new recording session.

**Request Body:**
```json
{
  "projectId": "proj_123",
  "platform": "mobile",
  "type": "ios",
  "settings": {
    "device": "iPhone 14",
    "version": "16.0",
    "bundleId": "com.example.app"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_123",
    "websocketUrl": "wss://api.questro.com/recordings/session_123",
    "status": "started",
    "instructions": {
      "ios": "Install the Questro Agent app on your iOS device and connect using session ID: session_123"
    }
  }
}
```

#### POST /api/recordings/:sessionId/stop
Stop a recording session and generate test case.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_123",
    "status": "completed",
    "testCase": {
      "id": "test_456",
      "name": "Recorded Test - Shopping Flow",
      "steps": [
        {
          "id": "step_1",
          "type": "launch",
          "target": "com.example.app",
          "timestamp": "2024-01-20T14:45:00.000Z"
        }
      ],
      "duration": 1250,
      "screenshots": ["screenshot_1.png", "screenshot_2.png"]
    },
    "analytics": {
      "totalActions": 15,
      "uniqueElements": 8,
      "coverage": 78.5
    }
  }
}
```

### Test Execution

#### POST /api/test-execution/run
Execute a test case or suite.

**Request Body:**
```json
{
  "testCaseIds": ["test_123", "test_456"],
  "projectId": "proj_123",
  "environment": "staging",
  "settings": {
    "parallel": true,
    "retries": 2,
    "timeout": 30000,
    "screenshots": true,
    "videos": true
  },
  "devices": [
    {
      "platform": "ios",
      "device": "iPhone 14",
      "version": "16.0"
    },
    {
      "platform": "android",
      "device": "Pixel 6",
      "version": "13.0"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_123",
    "status": "running",
    "estimatedDuration": 45000,
    "websocketUrl": "wss://api.questro.com/test-execution/exec_123",
    "testRuns": [
      {
        "id": "run_123",
        "testCaseId": "test_123",
        "device": "iPhone 14",
        "status": "pending"
      }
    ]
  }
}
```

#### GET /api/test-execution/:executionId/status
Get execution status and results.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_123",
    "status": "completed",
    "startedAt": "2024-01-20T14:45:00.000Z",
    "completedAt": "2024-01-20T14:45:45.000Z",
    "summary": {
      "total": 2,
      "passed": 1,
      "failed": 1,
      "skipped": 0,
      "successRate": 50.0
    },
    "testRuns": [
      {
        "id": "run_123",
        "testCaseId": "test_123",
        "status": "passed",
        "duration": 12500,
        "device": "iPhone 14",
        "steps": [
          {
            "id": "step_1",
            "status": "passed",
            "duration": 1500,
            "screenshots": ["step_1_1.png"]
          }
        ],
        "artifacts": {
          "video": "run_123_video.mp4",
          "screenshots": ["run_123_final.png"],
          "logs": "run_123_logs.txt"
        }
      }
    ]
  }
}
```

### AI Test Generation

#### POST /api/ai/generate-test
Generate test cases using AI.

**Request Body:**
```json
{
  "description": "Generate test cases for user login functionality including validation of error messages",
  "projectId": "proj_123",
  "platform": "web",
  "baseUrl": "https://example.com",
  "options": {
    "count": 5,
    "complexity": "medium",
    "includeNegativeTests": true,
    "includeEdgeCases": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "generationId": "gen_123",
    "status": "completed",
    "testCases": [
      {
        "name": "Valid Login Test",
        "description": "Test successful login with valid credentials",
        "priority": "high",
        "steps": [
          {
            "type": "navigate",
            "target": "/login",
            "description": "Navigate to login page"
          },
          {
            "type": "input",
            "target": "#email",
            "value": "test@example.com",
            "description": "Enter valid email"
          }
        ]
      }
    ],
    "usage": {
      "tokensUsed": 1250,
      "cost": 0.025,
      "creditsRemaining": 8750
    }
  }
}
```

### Analytics and Reporting

#### GET /api/analytics/dashboard
Get dashboard analytics data.

**Query Parameters:**
- `projectId` (string): Project ID (optional)
- `timeRange` (string): Time range (7d, 30d, 90d, 1y)
- `metrics` (string[]): Metrics to include

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTests": 1250,
      "successRate": 94.2,
      "avgDuration": 2500,
      "testsPerDay": 45
    },
    "trends": [
      {
        "date": "2024-01-20",
        "testsRun": 45,
        "successRate": 95.6,
        "avgDuration": 2300
      }
    ],
    "topFailures": [
      {
        "testCase": "test_123",
        "name": "Login Flow Test",
        "failureCount": 12,
        "failureRate": 8.5
      }
    ],
    "deviceUsage": [
      {
        "device": "iPhone 14",
        "usage": 45.6,
        "successRate": 96.2
      }
    ]
  }
}
```

#### GET /api/reports/:reportId
Get detailed test report.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "report_123",
    "name": "Weekly Test Report",
    "generatedAt": "2024-01-20T14:45:00.000Z",
    "period": {
      "start": "2024-01-14T00:00:00.000Z",
      "end": "2024-01-20T23:59:59.000Z"
    },
    "summary": {
      "totalTests": 315,
      "passed": 298,
      "failed": 17,
      "successRate": 94.6,
      "totalDuration": 787500
    },
    "testRuns": [
      {
        "id": "run_123",
        "testCase": "Login Flow Test",
        "status": "passed",
        "duration": 1250,
        "device": "iPhone 14",
        "executedAt": "2024-01-20T14:45:00.000Z"
      }
    ],
    "charts": {
      "successRateTrend": [
        {"date": "2024-01-14", "value": 92.1},
        {"date": "2024-01-20", "value": 94.6}
      ],
      "testExecutionTrend": [
        {"date": "2024-01-14", "value": 42},
        {"date": "2024-01-20", "value": 45}
      ]
    }
  }
}
```

## WebSocket APIs

### Recording Session WebSocket

Connect to: `wss://api.questro.com/recordings/:sessionId`

**Events:**

#### Client → Server
```json
{
  "type": "action",
  "data": {
    "action": "tap",
    "element": {
      "id": "login-button",
      "type": "button",
      "text": "Login",
      "xpath": "//button[@id='login-button']",
      "coordinates": { "x": 150, "y": 300 }
    },
    "timestamp": "2024-01-20T14:45:00.000Z"
  }
}
```

#### Server → Client
```json
{
  "type": "action_recorded",
  "data": {
    "actionId": "action_123",
    "status": "recorded",
    "screenshot": "screenshot_123.png"
  }
}
```

### Test Execution WebSocket

Connect to: `wss://api.questro.com/test-execution/:executionId`

**Events:**

#### Server → Client
```json
{
  "type": "test_started",
  "data": {
    "testRunId": "run_123",
    "testCaseId": "test_123",
    "device": "iPhone 14"
  }
}
```

```json
{
  "type": "step_completed",
  "data": {
    "testRunId": "run_123",
    "stepId": "step_1",
    "status": "passed",
    "duration": 1500,
    "screenshot": "step_1_1.png"
  }
}
```

```json
{
  "type": "test_completed",
  "data": {
    "testRunId": "run_123",
    "status": "passed",
    "duration": 12500,
    "summary": {
      "totalSteps": 8,
      "passedSteps": 8,
      "failedSteps": 0
    }
  }
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-20T14:45:00.000Z",
    "requestId": "req_123"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 402 | Usage quota exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

Questro implements rate limiting to ensure fair usage:

- **Standard Plan**: 100 requests per minute
- **Professional Plan**: 500 requests per minute  
- **Enterprise Plan**: 2000 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642694400
```

## 🦞 OpenClaw AI Agent Integration

Qestro integrates with [OpenClaw](https://docs.openclaw.ai), an open-source AI agent platform, enabling QA management through messaging apps (WhatsApp, Telegram, Slack, Discord, etc.).

### Integration Status & Health

#### GET /api/openclaw/status
Get the current OpenClaw integration status and recent event log.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "config": {
      "gatewayUrl": "http://127.0.0.1:18789",
      "hookToken": "***configured***",
      "enabled": true,
      "defaultChannel": "last",
      "defaultThinking": "medium",
      "timeoutSeconds": 120
    },
    "recentEvents": [
      {
        "timestamp": "2026-02-15T21:30:00.000Z",
        "type": "agent_hook",
        "status": "success"
      }
    ]
  }
}
```

#### GET /api/openclaw/health
Check if the OpenClaw Gateway is reachable.

**Response:**
```json
{
  "success": true,
  "data": {
    "openclaw": "connected",
    "latencyMs": 12,
    "error": null
  }
}
```

### Event Notifications (Qestro → OpenClaw)

#### POST /api/openclaw/test-failure
Send a test failure notification to OpenClaw for AI analysis and team notification.

**Request Body:**
```json
{
  "testName": "Login Flow - 2FA Timeout",
  "testId": "test_auth_007",
  "suiteName": "Login Regression",
  "error": "Timeout waiting for 2FA SMS code",
  "stackTrace": "at tests/auth/2fa.spec.ts:42...",
  "runId": "run_20260215_1430",
  "platform": "web",
  "screenshotUrl": "https://app.qestro.ai/screenshots/run_20260215_1430/failure.png",
  "dashboardUrl": "https://app.qestro.ai/runs/run_20260215_1430"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "status": 202
  }
}
```

#### POST /api/openclaw/suite-completed
Notify OpenClaw when a test suite completes.

**Request Body:**
```json
{
  "suiteName": "Login Regression",
  "suiteId": "suite_login_001",
  "runId": "run_20260215_1430",
  "totalTests": 12,
  "passed": 11,
  "failed": 1,
  "skipped": 0,
  "duration": 167000,
  "coverage": 89,
  "selfHealed": 2,
  "dashboardUrl": "https://app.qestro.ai/runs/run_20260215_1430"
}
```

#### POST /api/openclaw/security-alert
Alert OpenClaw about security scan findings.

**Request Body:**
```json
{
  "severity": "critical",
  "category": "SQL Injection",
  "description": "Unsanitized user input in /api/users/:id endpoint",
  "affectedEndpoints": ["/api/users/:id", "/api/users/search"],
  "recommendation": "Apply parameterized queries and input validation",
  "scanId": "scan_20260215"
}
```

#### POST /api/openclaw/self-healing
Notify OpenClaw when self-healing is applied to a test.

**Request Body:**
```json
{
  "testName": "Checkout Flow - Add to Cart",
  "testId": "test_checkout_003",
  "healingType": "locator_update",
  "originalError": "Element not found: #add-to-cart-btn",
  "fixApplied": "Updated selector to [data-testid='add-to-cart']",
  "confidence": 0.95
}
```

#### POST /api/openclaw/daily-summary
Trigger a daily QA summary notification.

**Request Body:**
```json
{
  "totalRuns": 156,
  "passed": 148,
  "failed": 8,
  "coverage": 89,
  "selfHealed": 5,
  "topFailures": [
    { "name": "Payment Timeout", "count": 3 },
    { "name": "2FA SMS Delay", "count": 2 }
  ]
}
```

### Messaging & Agent Control

#### POST /api/openclaw/send-message
Send a custom message to the OpenClaw agent.

**Request Body:**
```json
{
  "message": "QA team standup reminder: 3 tests need review before deployment",
  "channel": "slack",
  "thinking": "low",
  "name": "Qestro-Reminder"
}
```

#### POST /api/openclaw/wake
Send a wake event to OpenClaw.

**Request Body:**
```json
{
  "text": "Nightly regression suite completed — review needed",
  "mode": "now"
}
```

### Configuration

#### PUT /api/openclaw/config
Update OpenClaw integration configuration at runtime.

**Request Body:**
```json
{
  "enabled": true,
  "defaultChannel": "slack",
  "defaultThinking": "medium",
  "timeoutSeconds": 120,
  "gatewayUrl": "http://127.0.0.1:18789"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OpenClaw configuration updated",
  "data": {
    "gatewayUrl": "http://127.0.0.1:18789",
    "hookToken": "***configured***",
    "enabled": true,
    "defaultChannel": "slack",
    "defaultThinking": "medium",
    "timeoutSeconds": 120
  }
}
```

### Incoming Webhook (OpenClaw → Qestro)

#### POST /api/openclaw/incoming
Handle incoming requests from OpenClaw skill scripts.

**Request Body:**
```json
{
  "action": "dashboard",
  "params": {}
}
```

**Available Actions:** `dashboard`, `run-suite`, `failures`, `generate`

**Response (dashboard):**
```json
{
  "success": true,
  "data": {
    "testCases": { "total": 156, "active": 132, "byType": { "web": 89, "api": 45, "mobile": 22 } },
    "execution": { "coverage": 89, "statusBreakdown": { "passed": 75, "failed": 15, "pending": 10 } },
    "security": { "score": 98, "grade": "A+", "criticalIssues": 0 },
    "aiStats": { "selfHealed": 42, "generated": 28, "optimizedTimeMs": 3500 },
    "system": { "status": "OPTIMAL", "uptime": "99.97%" }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCLAW_ENABLED` | `false` | Enable/disable the integration |
| `OPENCLAW_GATEWAY_URL` | `http://127.0.0.1:18789` | OpenClaw Gateway URL |
| `OPENCLAW_HOOK_TOKEN` | *(empty)* | Shared secret for webhook auth |
| `OPENCLAW_DEFAULT_CHANNEL` | `last` | Default messaging channel |
| `OPENCLAW_DEFAULT_THINKING` | `medium` | AI reasoning depth (low/medium/high) |
| `OPENCLAW_TIMEOUT_SECONDS` | `120` | Agent turn timeout |

---

## 📨 Multi-Channel Notification Router

Intelligent routing of QA events to the right people on the right channels, with throttling, quiet hours, and severity-based routing.

### Status & Rules

#### GET /api/notifications/status
Get the notification router status and recent history.

#### GET /api/notifications/rules
List all routing rules.

#### POST /api/notifications/rules
Create or update a routing rule.

**Request Body:**
```json
{
  "id": "rule_ci_failure",
  "eventType": "test_failure",
  "severity": ["critical", "high"],
  "channels": ["slack", "whatsapp"],
  "recipients": ["qa_lead"],
  "enabled": true,
  "throttle": { "maxPerHour": 10, "groupBy": "testId" },
  "quietHours": {
    "start": "22:00",
    "end": "07:00",
    "timezone": "Asia/Jerusalem",
    "fallbackChannel": "slack"
  }
}
```

#### PUT /api/notifications/rules/:ruleId/toggle
Enable or disable a rule.

#### DELETE /api/notifications/rules/:ruleId
Delete a routing rule.

### Recipients

#### GET /api/notifications/recipients
List all notification recipients.

#### POST /api/notifications/recipients
Add or update a recipient.

**Request Body:**
```json
{
  "id": "frontend_lead",
  "name": "Frontend Lead",
  "role": "developer",
  "channels": ["slack", "telegram"]
}
```

### Dispatch

#### POST /api/notifications/test
Fire a test notification to verify routing.

#### POST /api/notifications/dispatch
Dispatch a real notification event.

**Request Body:**
```json
{
  "type": "coverage_drop",
  "severity": "high",
  "title": "Coverage dropped 8%",
  "message": "Coverage went from 89% to 81%",
  "dashboardUrl": "https://app.qestro.ai/coverage"
}
```

**Supported Event Types:** `test_failure`, `suite_completed`, `security_alert`, `self_healing`, `deployment_gate`, `daily_summary`, `coverage_drop`, `flaky_test_detected`, `custom`

---

## 🎬 Browser Recording (via OpenClaw)

CDP-powered browser recording that captures interactions and generates Playwright test code.

#### POST /api/recordings/openclaw/start
Start a new recording session.

**Request Body:**
```json
{
  "url": "https://app.example.com/checkout",
  "name": "Checkout Flow Recording",
  "description": "Record the full checkout flow including payment",
  "framework": "playwright",
  "viewport": { "width": 1920, "height": 1080 }
}
```

#### POST /api/recordings/openclaw/:sessionId/stop
Stop an active recording session.

#### POST /api/recordings/openclaw/:sessionId/interactions
Submit captured interactions for test code generation.

**Request Body:**
```json
{
  "interactions": [
    {
      "id": "int_001",
      "type": "click",
      "timestamp": "2026-02-15T23:30:00Z",
      "selector": "[data-testid='add-to-cart']",
      "description": "Click add to cart button"
    },
    {
      "id": "int_002",
      "type": "type",
      "timestamp": "2026-02-15T23:30:05Z",
      "selector": "#email",
      "value": "user@example.com",
      "description": "Enter email address"
    }
  ]
}
```

#### GET /api/recordings/openclaw/sessions
List all recording sessions with stats.

#### GET /api/recordings/openclaw/sessions/active
List only active recording sessions.

#### GET /api/recordings/openclaw/:sessionId
Get details of a specific session including generated test code.

---

## 💬 Conversational Test Generation

Multi-turn NL dialogue for generating complete test suites through messaging apps.

### Conversation Flow

#### POST /api/testgen/conversations/start
Start a new test generation conversation.

**Request Body:**
```json
{
  "message": "I need tests for our payment API",
  "channel": "slack",
  "notifyOnComplete": true
}
```

**Response includes:** Clarification questions based on detected domain (payment, auth, checkout, api).

#### POST /api/testgen/conversations/:sessionId/answer
Answer clarification questions to refine test requirements.

**Request Body:**
```json
{
  "answers": {
    "methods": ["Credit Card (Visa/MC)", "Bank Transfer"],
    "scenarios": "Full coverage (happy + validation + edge cases)",
    "environment": "Staging"
  }
}
```

**Response includes:** Generated test scenarios with types, priorities, and step counts.

#### POST /api/testgen/conversations/:sessionId/approve
Approve scenarios and generate final Playwright test code.

**Request Body:**
```json
{
  "approvedIds": ["TC-PAY-001", "TC-PAY-002", "TC-PAY-003"],
  "modifications": {
    "TC-PAY-002": { "priority": "critical" }
  }
}
```

#### POST /api/testgen/conversations/:sessionId/cancel
Cancel a conversation.

### Queries

#### GET /api/testgen/conversations
List all conversation sessions.

#### GET /api/testgen/conversations/:sessionId
Get full conversation details including messages and scenarios.

#### GET /api/testgen/conversations/:sessionId/code
Get combined Playwright code for all approved scenarios.

#### GET /api/testgen/stats
Get overall statistics (total sessions, scenarios generated, approval rates).

---

## SDKs and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @questro/sdk
```

```typescript
import { QuestroAPI } from '@questro/sdk';

const client = new QuestroAPI({
  baseURL: 'https://api.questro.com',
  apiKey: 'your-api-key'
});

// Get projects
const projects = await client.projects.list();

// Run test
const execution = await client.testExecution.run({
  testCaseIds: ['test_123'],
  projectId: 'proj_123'
});
```

### Python SDK

```bash
pip install questro-sdk
```

```python
from questro import QuestroClient

client = QuestroClient(
    base_url='https://api.questro.com',
    api_key='your-api-key'
)

# Get projects
projects = client.projects.list()

# Run test
execution = client.test_execution.run(
    test_case_ids=['test_123'],
    project_id='proj_123'
)
```

## Best Practices

### 1. Authentication
- Store tokens securely (httpOnly cookies or secure storage)
- Implement token refresh logic
- Handle token expiration gracefully

### 2. Error Handling
- Always check the `success` field in responses
- Implement retry logic for transient failures
- Log error details for debugging

### 3. Performance
- Use pagination for large datasets
- Implement caching for frequently accessed data
- Use WebSocket connections for real-time updates

### 4. Security
- Never expose API keys in client-side code
- Validate all input parameters
- Use HTTPS for all API calls

## Support and Documentation

- **API Reference**: https://docs.questro.com/api
- **SDK Documentation**: https://docs.questro.com/sdk
- **Support**: api-support@questro.com
- **Status Page**: https://status.questro.com

For API questions and support, please contact our developer relations team at developers@questro.com.