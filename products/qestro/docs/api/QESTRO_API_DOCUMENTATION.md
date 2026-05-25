# Qestro API Documentation

## Overview

The Qestro REST API provides comprehensive access to the AI-powered testing automation platform. This API enables you to create, manage, and execute automated tests for mobile and web applications using natural language processing and AI intelligence.

## Base URLs

- **Production**: `https://api.qestro.com/v1`
- **Staging**: `https://staging-api.qestro.com/v1`
- **Development**: `http://localhost:8787/v1`

## Authentication

Qestro uses JWT (JSON Web Token) authentication with refresh token rotation for enhanced security.

### Authentication Flow

1. **Login**: Obtain access and refresh tokens
2. **API Calls**: Include access token in Authorization header
3. **Token Refresh**: Use refresh token to obtain new access token
4. **Logout**: Invalidate all tokens

### Required Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
X-API-Version: 1.0
```

## Quick Start

### 1. Get Your API Key

```bash
curl -X POST https://api.qestro.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-secure-password"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_12345",
      "email": "your-email@example.com",
      "name": "John Doe",
      "subscription": {
        "plan": "professional",
        "status": "active"
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

### 2. Create Your First Test

```bash
curl -X POST https://api.qestro.com/v1/ai/generate-test \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Login to the mobile app with valid credentials",
    "platform": "mobile",
    "targetApplication": "com.example.myapp",
    "testType": "functional"
  }'
```

### 3. Execute the Test

```bash
curl -X POST https://api.qestro.com/v1/test-execution/execute \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testCaseId": "tc_12345",
    "platform": "mobile",
    "device": "iPhone_14_Pro",
    "config": {
      "captureScreenshots": true,
      "captureVideo": true
    }
  }'
```

## API Endpoints

### Authentication Endpoints

#### POST /auth/login
Authenticate user and obtain tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "rememberMe": true
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
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  }
}
```

#### POST /auth/refresh
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
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

#### POST /auth/logout
Invalidate user tokens and logout.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### User Management

#### GET /users/profile
Get current user profile information.

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "avatar": "https://cdn.qestro.com/avatars/user_123.jpg",
    "subscription": {
      "plan": "professional",
      "status": "active",
      "expiresAt": "2024-12-31T23:59:59.000Z",
      "features": ["ai_generation", "mobile_testing", "collaboration"]
    },
    "usage": {
      "testsExecuted": 245,
      "aiGenerations": 89,
      "storageUsed": "2.3GB",
      "apiCalls": 1245
    },
    "preferences": {
      "notifications": {
        "email": true,
        "slack": false,
        "inApp": true
      },
      "theme": "light",
      "language": "en"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-11-03T15:45:00.000Z"
  }
}
```

#### PUT /users/profile
Update user profile information.

**Request Body:**
```json
{
  "name": "John Smith",
  "avatar": "https://example.com/new-avatar.jpg",
  "preferences": {
    "notifications": {
      "email": true,
      "slack": true,
      "inApp": false
    },
    "theme": "dark",
    "language": "en"
  }
}
```

### Project Management

#### GET /projects
List all projects accessible to the user.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `search` (string): Search term for project names
- `status` (string): Filter by status (active, archived, all)
- `sort` (string): Sort field (name, createdAt, updatedAt)
- `order` (string): Sort order (asc, desc)

**Example Request:**
```bash
curl -X GET "https://api.qestro.com/v1/projects?page=1&limit=10&status=active&sort=createdAt&order=desc" \
  -H "Authorization: Bearer <access_token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "proj_123",
        "name": "Mobile App Testing",
        "description": "Automated tests for iOS and Android apps",
        "status": "active",
        "visibility": "team",
        "platforms": ["ios", "android"],
        "owner": {
          "id": "user_123",
          "name": "John Doe"
        },
        "stats": {
          "testCases": 45,
          "testRuns": 1245,
          "lastRun": "2024-11-03T10:30:00.000Z",
          "successRate": 94.5
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-11-03T09:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 23,
      "totalPages": 3
    }
  }
}
```

#### POST /projects
Create a new project.

**Request Body:**
```json
{
  "name": "E-commerce Website Testing",
  "description": "Comprehensive tests for the e-commerce platform",
  "visibility": "team",
  "platforms": ["web"],
  "settings": {
    "defaultDevice": "Chrome_Desktop",
    "testTimeout": 30000,
    "retryAttempts": 3,
    "notifications": {
      "onFailure": true,
      "onSuccess": false,
      "recipients": ["team@example.com"]
    }
  }
}
```

#### GET /projects/{projectId}
Get detailed project information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj_123",
    "name": "Mobile App Testing",
    "description": "Automated tests for iOS and Android apps",
    "status": "active",
    "visibility": "team",
    "platforms": ["ios", "android"],
    "owner": {
      "id": "user_123",
      "name": "John Doe",
      "avatar": "https://cdn.qestro.com/avatars/user_123.jpg"
    },
    "team": [
      {
        "id": "user_456",
        "name": "Jane Smith",
        "role": "editor"
      },
      {
        "id": "user_789",
        "name": "Bob Johnson",
        "role": "viewer"
      }
    ],
    "settings": {
      "defaultDevice": "iPhone_14_Pro",
      "testTimeout": 30000,
      "retryAttempts": 3,
      "notifications": {
        "onFailure": true,
        "onSuccess": false,
        "recipients": ["team@example.com"]
      }
    },
    "stats": {
      "testCases": 45,
      "testSuites": 8,
      "testRuns": 1245,
      "lastRun": "2024-11-03T10:30:00.000Z",
      "successRate": 94.5,
      "avgDuration": 45000
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-11-03T09:15:00.000Z"
  }
}
```

### AI Services

#### POST /ai/generate-test
Generate automated test cases from natural language description.

**Request Body:**
```json
{
  "description": "Verify user can successfully login with valid credentials and sees their dashboard",
  "platform": "mobile",
  "targetApplication": "com.example.myapp",
  "testType": "functional",
  "complexity": "medium",
  "includeAssertions": true,
  "includeEdgeCases": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "testId": "generated_12345",
    "platform": "mobile",
    "testScript": {
      "name": "User Login Success Test",
      "description": "Verify login functionality with valid credentials",
      "framework": "maestro",
      "script": "appId: com.example.myapp\n- launchApp\n- tapOn: \"Login\"\n- inputText: \"john@example.com\"\n- tapOn: \"Email\"\n- inputText: \"SecurePassword123\"\n- tapOn: \"Password\"\n- tapOn: \"Sign In\"\n- assertVisible: \"Welcome, John\"",
      "steps": [
        {
          "id": "step_1",
          "action": "launchApp",
          "description": "Launch the application"
        },
        {
          "id": "step_2",
          "action": "tapOn",
          "target": "Login",
          "description": "Tap on Login button"
        }
      ]
    },
    "metadata": {
      "confidence": 0.92,
      "estimatedDuration": 15000,
      "testType": "functional",
      "generatedAt": "2024-11-03T10:30:00.000Z"
    }
  }
}
```

#### POST /ai/optimize-test
Optimize and enhance existing test cases.

**Request Body:**
```json
{
  "testCode": "appId: com.example.myapp\n- tapOn: \"Login\"\n- inputText: \"test@example.com\"\n- tapOn: \"Password\"\n- inputText: \"password\"",
  "optimizationGoals": ["performance", "reliability", "maintainability"],
  "platform": "mobile"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedTest": {
      "originalCode": "...",
      "optimizedCode": "appId: com.example.myapp\n- tapOn:\n    id: \"login_button\"\n- inputText:\n    id: \"email_field\"\n    text: \"test@example.com\"\n- tapOn:\n    id: \"password_field\"\n- inputText:\n    id: \"password_field\"\n    text: \"password\"",
      "changes": [
        {
          "type": "selector",
          "description": "Replaced text-based selectors with IDs for better reliability"
        },
        {
          "type": "structure",
          "description": "Improved test structure with explicit element targeting"
        }
      ]
    },
    "improvements": {
      "reliability": 35,
      "performance": 20,
      "maintainability": 45
    },
    "recommendations": [
      "Consider adding wait commands for elements that load dynamically",
      "Add assertions to verify successful login",
      "Test with different user roles for comprehensive coverage"
    ]
  }
}
```

#### POST /ai/analyze-failure
Analyze test failures and provide root cause analysis.

**Request Body:**
```json
{
  "testRunId": "run_12345",
  "errorLogs": ["Element not found: Login button", "Timeout after 30 seconds"],
  "screenshots": ["https://storage.qestro.com/screenshots/failed_1.png"],
  "deviceInfo": {
    "platform": "iOS",
    "version": "17.0",
    "device": "iPhone 14 Pro"
  },
  "appVersion": "2.1.0"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "rootCause": "UI element changed in app version 2.1.0",
      "failureType": "selector_issue",
      "confidence": 0.89,
      "category": "ui_mismatch"
    },
    "suggestedFixes": [
      {
        "description": "Update selector to use accessibility ID",
        "code": "- tapOn:\n    id: \"login_button_accessibility\"",
        "confidence": 0.95
      },
      {
        "description": "Add retry logic with exponential backoff",
        "code": "- repeat:\n    until: \n        visible: \"Login\"\n    commands:\n        - wait: 1\n        - tapOn: \"Login\"",
        "confidence": 0.82
      }
    ],
    "patterns": [
      {
        "pattern": "element_selector_issues",
        "frequency": 45,
        "description": "Similar failures observed in other tests"
      }
    ],
    "recommendations": [
      "Review all tests using text-based selectors",
      "Implement robust selector strategy",
      "Add visual regression testing"
    ]
  }
}
```

### Test Execution

#### POST /test-execution/execute
Execute a test case or test suite.

**Request Body:**
```json
{
  "testCaseId": "tc_12345",
  "projectId": "proj_123",
  "platform": "mobile",
  "device": "iPhone_14_Pro",
  "config": {
    "captureScreenshots": true,
    "captureVideo": true,
    "captureLogs": true,
    "performanceMetrics": true,
    "networkThrottling": false,
    "retryOnFailure": true,
    "maxRetries": 3
  },
  "environment": {
    "baseUrl": "https://staging.example.com",
    "userData": {
      "email": "test@example.com",
      "password": "TestPassword123"
    },
    "deviceSettings": {
      "orientation": "portrait",
      "darkMode": false
    }
  },
  "metadata": {
    "tags": ["smoke", "critical"],
    "priority": "high",
    "timeout": 300000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_67890",
    "status": "queued",
    "queuePosition": 3,
    "estimatedStart": "2024-11-03T10:31:00.000Z",
    "estimatedDuration": 45000,
    "device": {
      "id": "device_iphone14_001",
      "name": "iPhone 14 Pro",
      "platform": "iOS",
      "version": "17.0",
      "status": "available"
    },
    "config": {
      "captureScreenshots": true,
      "captureVideo": true,
      "captureLogs": true
    }
  }
}
```

#### GET /test-execution/execution/{executionId}/status
Get real-time execution status.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_67890",
    "status": "running",
    "progress": 45,
    "currentStep": "Verifying dashboard elements",
    "startedAt": "2024-11-03T10:31:15.000Z",
    "duration": 20345,
    "device": {
      "id": "device_iphone14_001",
      "name": "iPhone 14 Pro",
      "platform": "iOS"
    },
    "results": {
      "steps": [
        {
          "id": "step_1",
          "name": "Launch app",
          "status": "passed",
          "duration": 2500,
          "screenshot": "https://storage.qestro.com/screenshots/step_1.png"
        },
        {
          "id": "step_2",
          "name": "Enter credentials",
          "status": "passed",
          "duration": 5000,
          "screenshot": "https://storage.qestro.com/screenshots/step_2.png"
        },
        {
          "id": "step_3",
          "name": "Verify dashboard",
          "status": "running",
          "duration": 12845
        }
      ]
    },
    "artifacts": {
      "video": "https://storage.qestro.com/videos/exec_67890.mp4",
      "logs": "https://storage.qestro.com/logs/exec_67890.log",
      "screenshots": [
        "https://storage.qestro.com/screenshots/exec_67890_1.png",
        "https://storage.qestro.com/screenshots/exec_67890_2.png"
      ]
    }
  }
}
```

#### POST /test-execution/execution/{executionId}/cancel
Cancel a running or queued test execution.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec_67890",
    "status": "cancelled",
    "cancelledAt": "2024-11-03T10:33:00.000Z",
    "reason": "User requested cancellation",
    "completedSteps": 2,
    "totalSteps": 5
  }
}
```

#### GET /test-execution/results
Get test execution results and reports.

**Query Parameters:**
- `projectId` (string): Filter by project ID
- `status` (string): Filter by execution status
- `dateFrom` (string): Start date filter (ISO 8601)
- `dateTo` (string): End date filter (ISO 8601)
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "executionId": "exec_67890",
        "testCaseId": "tc_12345",
        "projectName": "Mobile App Testing",
        "platform": "iOS",
        "device": "iPhone 14 Pro",
        "status": "passed",
        "startedAt": "2024-11-03T10:31:15.000Z",
        "completedAt": "2024-11-03T10:32:00.000Z",
        "duration": 45000,
        "metrics": {
          "cpuUsage": 15.2,
          "memoryUsage": 128.5,
          "networkRequests": 23,
          "screenshots": 5
        },
        "result": {
          "steps": 5,
          "passed": 5,
          "failed": 0,
          "skipped": 0
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1245,
      "totalPages": 63
    },
    "summary": {
      "totalExecutions": 1245,
      "passed": 1178,
      "failed": 45,
      "successRate": 94.58,
      "avgDuration": 42000
    }
  }
}
```

### Real-time Features (WebSocket)

#### Connect to WebSocket
Connect to real-time test execution updates and collaboration features.

**WebSocket URL:**
```
wss://api.qestro.com/v1/realtime?token=<access_token>
```

#### WebSocket Events

**Join Execution Updates:**
```json
{
  "type": "subscribe",
  "channel": "execution",
  "executionId": "exec_67890"
}
```

**Receive Updates:**
```json
{
  "type": "execution_update",
  "data": {
    "executionId": "exec_67890",
    "status": "running",
    "progress": 60,
    "currentStep": "Verifying dashboard",
    "timestamp": "2024-11-03T10:32:30.000Z"
  }
}
```

**Live Collaboration:**
```json
{
  "type": "collaborate",
  "channel": "project",
  "projectId": "proj_123",
  "action": "cursor_move",
  "data": {
    "userId": "user_456",
    "position": { "x": 450, "y": 230 },
    "element": "#login-button"
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @qestro/api-client
```

```typescript
import { QestroAPI } from '@qestro/api-client';

// Initialize client
const qestro = new QestroAPI({
  baseURL: 'https://api.qestro.com/v1',
  apiKey: 'your-access-token'
});

// Generate a test
const test = await qestro.ai.generateTest({
  description: 'Login to the app with valid credentials',
  platform: 'mobile',
  targetApplication: 'com.example.app'
});

// Execute the test
const execution = await qestro.testExecution.execute({
  testCaseId: test.testId,
  platform: 'mobile',
  device: 'iPhone_14_Pro',
  config: {
    captureScreenshots: true,
    captureVideo: true
  }
});

// Monitor execution in real-time
execution.onProgress((progress) => {
  console.log(`Progress: ${progress.percentage}%`);
  console.log(`Current step: ${progress.currentStep}`);
});

execution.onComplete(async (result) => {
  console.log('Test completed:', result.status);
  const artifacts = await execution.getArtifacts();
  console.log('Video:', artifacts.video);
  console.log('Screenshots:', artifacts.screenshots);
});
```

### Python SDK

```bash
pip install qestro-python
```

```python
from qestro import QestroClient
from qestro.models import TestGenerationRequest

# Initialize client
client = QestroClient(
    base_url='https://api.qestro.com/v1',
    api_key='your-access-token'
)

# Generate a test
request = TestGenerationRequest(
    description='Login to the app with valid credentials',
    platform='mobile',
    target_application='com.example.app'
)
test = client.ai.generate_test(request)

# Execute the test
execution = client.test_execution.execute(
    test_case_id=test.test_id,
    platform='mobile',
    device='iPhone_14_Pro',
    config={
        'capture_screenshots': True,
        'capture_video': True
    }
)

# Monitor execution
while not execution.is_complete():
    status = client.test_execution.get_status(execution.execution_id)
    print(f"Progress: {status.progress}%")
    time.sleep(2)

# Get results
result = client.test_execution.get_results(execution.execution_id)
print(f"Final status: {result.status}")
```

### cURL Examples

#### Create Test Suite
```bash
curl -X POST https://api.qestro.com/v1/projects/proj_123/test-suites \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Login Flow Tests",
    "description": "All tests related to user authentication",
    "tests": ["tc_123", "tc_124", "tc_125"],
    "executionOrder": "parallel"
  }'
```

#### Run Test Suite
```bash
curl -X POST https://api.qestro.com/v1/test-execution/execute-suite \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "testSuiteId": "ts_456",
    "devices": ["iPhone_14_Pro", "Pixel_7"],
    "environment": "staging",
    "parallel": true
  }'
```

#### Get Usage Statistics
```bash
curl -X GET https://api.qestro.com/v1/usage/stats \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -G \
  -d "period=month&date=2024-11"
```

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "reason": "Email is required"
    },
    "requestId": "req_12345",
    "timestamp": "2024-11-03T10:30:00.000Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | No valid authentication token provided |
| `AUTHENTICATION_EXPIRED` | 401 | Authentication token has expired |
| `PERMISSION_DENIED` | 403 | User does not have permission for this action |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `VALIDATION_ERROR` | 400 | Request parameters are invalid |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests, rate limit exceeded |
| `SUBSCRIPTION_REQUIRED` | 402 | Feature requires paid subscription |
| `QUOTA_EXCEEDED` | 402 | Usage quota has been exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Handling Errors

```typescript
try {
  const result = await qestro.testExecution.execute(executionRequest);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Implement exponential backoff
    await new Promise(resolve => setTimeout(resolve, 5000));
    return retryExecution(executionRequest);
  } else if (error.code === 'QUOTA_EXCEEDED') {
    // Upgrade subscription or wait for quota reset
    console.log('Usage quota exceeded. Please upgrade your plan.');
  } else {
    // Handle other errors
    console.error('Execution failed:', error.message);
  }
}
```

## Rate Limiting

### Rate Limit Headers

Every API response includes rate limiting information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1699045800
X-RateLimit-Retry-After: 60
```

### Rate Limits by Plan

| Plan | Requests per Minute | Concurrent Executions | AI Generations per Day |
|------|---------------------|----------------------|------------------------|
| Free | 100 | 1 | 10 |
| Starter | 500 | 5 | 50 |
| Professional | 1000 | 10 | 200 |
| Enterprise | 5000 | 50 | Unlimited |

## Best Practices

### 1. Authentication
- Always use HTTPS for API calls
- Store tokens securely (never in client-side code)
- Implement proper token refresh logic
- Logout properly to invalidate tokens

### 2. Error Handling
- Always check the `success` field in responses
- Implement retry logic with exponential backoff
- Handle rate limiting gracefully
- Log errors for debugging

### 3. Performance
- Use pagination for large result sets
- Request only necessary fields
- Cache responses when appropriate
- Use batch operations for multiple actions

### 4. Security
- Validate all inputs before sending
- Never expose sensitive data in client code
- Use environment variables for API keys
- Implement proper access controls

### 5. Testing
- Test API integrations in staging first
- Mock API responses for unit tests
- Implement proper timeout handling
- Monitor API usage and performance

## Interactive Examples

### Test this API now:

#### 1. Try Authentication
```bash
# Test with demo credentials
curl -X POST https://staging-api.qestro.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@qestro.com",
    "password": "DemoPassword123"
  }'
```

#### 2. Generate a Test
```bash
# After getting your token
curl -X POST https://staging-api.qestro.com/v1/ai/generate-test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Click the login button",
    "platform": "web",
    "testType": "functional"
  }'
```

#### 3. Real-time Monitoring
```javascript
// Connect to WebSocket in browser console
const ws = new WebSocket('wss://staging-api.qestro.com/v1/realtime?token=YOUR_TOKEN');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Subscribe to execution updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'execution',
  executionId: 'exec_demo'
}));
```

## API Changelog

### Version 1.2.0 (2024-11-01)
- Added real-time WebSocket API
- Enhanced AI optimization endpoints
- New batch execution capabilities
- Improved error reporting

### Version 1.1.0 (2024-10-15)
- Added SSO authentication endpoints
- Introduced test suite management
- Enhanced analytics API
- Improved rate limiting

### Version 1.0.0 (2024-10-01)
- Initial API release
- Core test execution functionality
- AI-powered test generation
- User and project management

## Support

For API support and questions:

- **Documentation**: https://docs.qestro.com
- **API Reference**: https://docs.qestro.com/api
- **Status Page**: https://status.qestro.com
- **Email**: api-support@qestro.com
- **Slack Community**: https://qestro.com/slack
- **GitHub Issues**: https://github.com/qestro/qestro-api/issues

## License

The Qestro API is provided under the Qestro Terms of Service. Please see https://qestro.com/terms for more information.

---

Last Updated: 2025-11-03
API Version: 1.2.0
Base URL: https://api.qestro.com/v1