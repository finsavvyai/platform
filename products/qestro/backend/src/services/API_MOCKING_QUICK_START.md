# API Mocking Service - Quick Start

## Creating a Mock Server

```typescript
import { mockEngine } from './api-mocking/MockEngine.js';
import { mockScenarioManager } from './api-mocking/MockScenarioManager.js';

// 1. Create server
const server = await mockEngine.createMockServer('proj-123', {
  projectId: 'proj-123',
  port: 3001,
  baseUrl: 'http://localhost:3001'
});
// Returns: { id: 'srv-xxx', projectId: 'proj-123', ... }

// 2. Add simple endpoint
await mockEngine.addEndpoint(server.id, {
  method: 'GET',
  path: '/api/users',
  defaultResponse: {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: [{id: 1, name: 'Alice'}, {id: 2, name: 'Bob'}]
  },
  rules: []
});

// 3. Handle requests
const response = await mockEngine.handleRequest(
  server.id, 
  'GET', 
  '/api/users'
);
// Returns: { statusCode: 200, body: [...] }
```

## Using Pre-built Scenarios

```typescript
// Happy Path
const scenario = await mockScenarioManager.createHappyPathScenario('proj-123');
// Includes: GET /api/users, POST /api/users, GET /api/users/{id}

// Error Responses
const errorScenario = await mockScenarioManager.createErrorScenario('proj-123');
// Includes: 404, 400, 401, 403, 500 endpoints

// Slow Network
const slowScenario = await mockScenarioManager.createSlowNetworkScenario('proj-123');
// Includes: 3-10 second delays

// Auth Failures
const authScenario = await mockScenarioManager.createAuthFailureScenario('proj-123');
// Includes: Login flow with conditional responses

// Activate scenario
await mockScenarioManager.activateScenario(scenario.id, 'proj-123');
```

## Conditional Responses

```typescript
await mockEngine.addEndpoint(server.id, {
  method: 'POST',
  path: '/api/users',
  defaultResponse: { statusCode: 400, body: {error: 'Invalid email'} },
  rules: [
    {
      id: 'rule-1',
      conditions: [
        {type: 'body', key: 'email', value: '@example.com', operator: 'contains'}
      ],
      response: { statusCode: 201, body: {id: 3, created: true} },
      priority: 10  // Higher priority = checked first
    }
  ]
});

// POST /api/users with body containing @example.com → 201
// Otherwise → 400
```

## Request Logging

```typescript
// Get request logs
const logs = await mockEngine.getRequestLogs(server.id);
// Returns: [{url: 'GET /api/users', timestamp: Date}, ...]

// Clear logs
await mockEngine.clearLogs(server.id);
```

## API Endpoints

```bash
# Create mock server
POST /api/mocks/servers
{
  "projectId": "proj-123",
  "baseUrl": "http://localhost:3001",
  "port": 3001
}

# Add endpoint
POST /api/mocks/servers/srv-xxx/endpoints
{
  "method": "GET",
  "path": "/api/users",
  "defaultResponse": {
    "statusCode": 200,
    "body": [...]
  }
}

# Create pre-built scenario
POST /api/mocks/scenarios/preset/happy-path
{"projectId": "proj-123"}
# Types: happy-path, errors, slow-network, auth-failures
```
