# Qestro API Documentation

Welcome to the Qestro API documentation. This comprehensive guide will help you integrate Qestro's testing capabilities into your applications and workflows.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [WebSocket API](#websocket-api)
5. [SDKs and Libraries](#sdks-and-libraries)
6. [Rate Limiting](#rate-limiting)
7. [Error Handling](#error-handling)
8. [Examples](#examples)

## Getting Started

### Base URLs

- **Production**: `https://api.qestro.app`
- **Staging**: `https://staging-api.qestro.app`

### API Version

Current API version: `v1`

All API endpoints are prefixed with `/api/v1` unless otherwise specified.

### Content Type

All API requests should use `application/json` content type:

```http
Content-Type: application/json
```

## Authentication

Qestro API uses JWT (JSON Web Tokens) for authentication.

### Getting an API Token

1. **Login to get JWT token**:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "your-email@example.com",
    "name": "Your Name"
  }
}
```

2. **Use token in subsequent requests**:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### API Keys (Enterprise)

Enterprise customers can use API keys for server-to-server authentication:

```http
X-API-Key: your-api-key-here
```

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
Authenticate user and receive JWT token.

**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response**:
```json
{
  "success": true,
  "token": "string",
  "user": {
    "id": "string",
    "email": "string",
    "name": "string",
    "role": "string"
  }
}
```

#### POST /api/auth/register
Register a new user account.

**Request Body**:
```json
{
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

#### POST /api/auth/refresh
Refresh JWT token.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "token": "string"
}
```

### Test Management Endpoints

#### GET /api/tests
List all tests for the authenticated user.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `type` (optional): Filter by test type (web, mobile, api, database)
- `status` (optional): Filter by status (active, archived)

**Response**:
```json
{
  "success": true,
  "data": {
    "tests": [
      {
        "id": "string",
        "name": "string",
        "description": "string",
        "type": "web|mobile|api|database",
        "status": "active|archived",
        "createdAt": "2023-01-01T00:00:00Z",
        "updatedAt": "2023-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

#### POST /api/tests
Create a new test.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "name": "string",
  "description": "string",
  "type": "web|mobile|api|database",
  "configuration": {
    "url": "string",
    "framework": "playwright|cypress|selenium",
    "browser": "chrome|firefox|safari",
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "steps": [
    {
      "action": "navigate|click|type|wait|assert",
      "selector": "string",
      "value": "string",
      "options": {}
    }
  ]
}
```

#### GET /api/tests/{testId}
Get a specific test by ID.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "description": "string",
    "type": "web|mobile|api|database",
    "configuration": {},
    "steps": [],
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:00:00Z"
  }
}
```

#### PUT /api/tests/{testId}
Update an existing test.

**Headers**: `Authorization: Bearer <token>`

**Request Body**: Same as POST /api/tests

#### DELETE /api/tests/{testId}
Delete a test.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "message": "Test deleted successfully"
}
```

### Test Execution Endpoints

#### POST /api/tests/{testId}/execute
Execute a test.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "environment": "development|staging|production",
  "configuration": {
    "browser": "chrome|firefox|safari",
    "headless": true,
    "timeout": 30000,
    "retries": 3
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "executionId": "string",
    "status": "queued|running|completed|failed",
    "startedAt": "2023-01-01T00:00:00Z"
  }
}
```

#### GET /api/executions/{executionId}
Get execution status and results.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "testId": "string",
    "status": "queued|running|completed|failed",
    "startedAt": "2023-01-01T00:00:00Z",
    "completedAt": "2023-01-01T00:00:00Z",
    "duration": 15000,
    "results": {
      "passed": true,
      "steps": [
        {
          "action": "string",
          "status": "passed|failed|skipped",
          "duration": 1000,
          "screenshot": "string",
          "error": "string"
        }
      ],
      "screenshots": ["string"],
      "logs": ["string"]
    }
  }
}
```

### Recording Endpoints

#### POST /api/recordings/start
Start a new recording session.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "url": "string",
  "browser": "chrome|firefox|safari",
  "viewport": {
    "width": 1280,
    "height": 720
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "status": "recording",
    "startedAt": "2023-01-01T00:00:00Z"
  }
}
```

#### POST /api/recordings/{sessionId}/stop
Stop a recording session.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "status": "completed",
    "actions": [
      {
        "type": "click|type|navigate|wait",
        "selector": "string",
        "value": "string",
        "timestamp": "2023-01-01T00:00:00Z"
      }
    ],
    "generatedTest": "string"
  }
}
```

### AI Test Generation Endpoints

#### POST /api/ai/generate-test
Generate a test using AI from natural language description.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "description": "string",
  "url": "string",
  "framework": "playwright|cypress|selenium",
  "testType": "e2e|integration|unit"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "testCode": "string",
    "metadata": {
      "framework": "string",
      "testType": "string",
      "description": "string",
      "generatedAt": "2023-01-01T00:00:00Z"
    }
  }
}
```

### Analytics Endpoints

#### GET /api/analytics/dashboard
Get dashboard analytics data.

**Headers**: `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalTests": 150,
      "totalProjects": 10,
      "successRate": 95.5,
      "testsRunToday": 25,
      "aiTestsGenerated": 75
    },
    "usage": {
      "aiTokensUsed": 50000,
      "aiTokensLimit": 100000,
      "currentPlan": "pro"
    },
    "recentActivity": [
      {
        "id": "string",
        "description": "string",
        "project": "string",
        "timestamp": "2023-01-01T00:00:00Z"
      }
    ]
  }
}
```

## WebSocket API

Qestro provides real-time updates through WebSocket connections.

### Connection

Connect to: `wss://api.qestro.app`

### Authentication

Send authentication message after connection:

```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

### Message Types

#### Test Execution Updates

```json
{
  "type": "execution_update",
  "data": {
    "executionId": "string",
    "status": "running|completed|failed",
    "progress": 75,
    "currentStep": "string"
  }
}
```

#### Recording Updates

```json
{
  "type": "recording_update",
  "data": {
    "sessionId": "string",
    "action": {
      "type": "click",
      "selector": "#button",
      "timestamp": "2023-01-01T00:00:00Z"
    }
  }
}
```

#### System Notifications

```json
{
  "type": "notification",
  "data": {
    "level": "info|warning|error",
    "message": "string",
    "timestamp": "2023-01-01T00:00:00Z"
  }
}
```

## SDKs and Libraries

### JavaScript/Node.js

```bash
npm install @qestro/sdk
```

```javascript
const { QestroClient } = require('@qestro/sdk');

const client = new QestroClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.qestro.app'
});

// Create a test
const test = await client.tests.create({
  name: 'My Test',
  type: 'web',
  configuration: {
    url: 'https://example.com'
  }
});

// Execute the test
const execution = await client.tests.execute(test.id);
```

### Python

```bash
pip install qestro-sdk
```

```python
from qestro import QestroClient

client = QestroClient(
    api_key='your-api-key',
    base_url='https://api.qestro.app'
)

# Create a test
test = client.tests.create({
    'name': 'My Test',
    'type': 'web',
    'configuration': {
        'url': 'https://example.com'
    }
})

# Execute the test
execution = client.tests.execute(test['id'])
```

### cURL Examples

```bash
# Create a test
curl -X POST https://api.qestro.app/api/tests \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Test",
    "type": "web",
    "configuration": {
      "url": "https://example.com"
    }
  }'

# Execute a test
curl -X POST https://api.qestro.app/api/tests/test-id/execute \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "production"
  }'
```

## Rate Limiting

API requests are rate limited to ensure fair usage:

- **Free Tier**: 100 requests per hour
- **Pro Tier**: 1,000 requests per hour
- **Enterprise Tier**: 10,000 requests per hour

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED` - Missing or invalid authentication
- `VALIDATION_ERROR` - Request validation failed
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `QUOTA_EXCEEDED` - Usage quota exceeded

## Examples

### Complete Test Creation and Execution

```javascript
// 1. Authenticate
const authResponse = await fetch('https://api.qestro.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

const { token } = await authResponse.json();

// 2. Create a test
const testResponse = await fetch('https://api.qestro.app/api/tests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Login Test',
    type: 'web',
    configuration: {
      url: 'https://example.com/login',
      framework: 'playwright'
    },
    steps: [
      {
        action: 'navigate',
        value: 'https://example.com/login'
      },
      {
        action: 'type',
        selector: '#email',
        value: 'test@example.com'
      },
      {
        action: 'type',
        selector: '#password',
        value: 'password'
      },
      {
        action: 'click',
        selector: '#login-button'
      },
      {
        action: 'assert',
        selector: '.welcome-message',
        value: 'Welcome back!'
      }
    ]
  })
});

const test = await testResponse.json();

// 3. Execute the test
const executionResponse = await fetch(`https://api.qestro.app/api/tests/${test.data.id}/execute`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    environment: 'production',
    configuration: {
      browser: 'chrome',
      headless: true
    }
  })
});

const execution = await executionResponse.json();

// 4. Poll for results
const checkResults = async () => {
  const resultResponse = await fetch(`https://api.qestro.app/api/executions/${execution.data.executionId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const result = await resultResponse.json();
  
  if (result.data.status === 'completed' || result.data.status === 'failed') {
    console.log('Test completed:', result.data);
    return result.data;
  } else {
    setTimeout(checkResults, 2000); // Check again in 2 seconds
  }
};

checkResults();
```

### WebSocket Real-time Updates

```javascript
const ws = new WebSocket('wss://api.qestro.app');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'execution_update':
      console.log('Test execution update:', message.data);
      break;
    case 'recording_update':
      console.log('Recording update:', message.data);
      break;
    case 'notification':
      console.log('System notification:', message.data);
      break;
  }
};
```

## Support

For API support and questions:

- **Documentation**: [docs.qestro.app](https://docs.qestro.app)
- **Email**: [api-support@qestro.app](mailto:api-support@qestro.app)
- **Community Forum**: [community.qestro.app](https://community.qestro.app)
- **Status Page**: [status.qestro.app](https://status.qestro.app)