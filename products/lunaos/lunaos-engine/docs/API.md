# Luna OS API Documentation

Complete REST and WebSocket API reference for Luna OS Engine. All endpoints are versioned at `/api/v1`.

## Authentication

All requests require JWT token in Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Obtain token via `POST /api/v1/auth/login`:
```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

## Base URL

- **Development**: `http://localhost:8040/api/v1`
- **Production**: `https://api.luna-os.com/api/v1`
- **WebSocket**: `wss://api.luna-os.com/api/v1/ws`

## REST Endpoints

### Agents

#### List Agents
```
GET /agents
```
Query params: `status`, `type`, `limit`, `offset`

Response (200):
```json
{
  "data": [
    {
      "id": "agent-1",
      "name": "researcher",
      "type": "worker",
      "status": "idle",
      "config": { "timeout": 30000 }
    }
  ],
  "meta": { "total": 15, "hasMore": false }
}
```

#### Get Agent
```
GET /agents/:id
```

Response (200):
```json
{
  "id": "agent-1",
  "name": "researcher",
  "type": "worker",
  "status": "running",
  "pid": 12345,
  "config": { "timeout": 30000, "maxRetries": 3 },
  "metrics": { "uptime": 3600, "memory": 128 }
}
```

#### Spawn Agent
```
POST /agents
```

Body:
```json
{
  "name": "my-agent",
  "type": "worker",
  "config": { "timeout": 60000 }
}
```

Response (201):
```json
{
  "id": "agent-new-123",
  "status": "idle",
  "pid": 54321
}
```

#### Pause Agent
```
PATCH /agents/:id/pause
```

Response (200):
```json
{ "id": "agent-1", "status": "paused" }
```

#### Resume Agent
```
PATCH /agents/:id/resume
```

Response (200):
```json
{ "id": "agent-1", "status": "running" }
```

#### Terminate Agent
```
DELETE /agents/:id
```

Response (200):
```json
{ "id": "agent-1", "terminated": true }
```

#### Agent Logs
```
GET /agents/:id/logs?lines=50&level=info
```

Response (200):
```json
{
  "logs": [
    { "timestamp": "2026-03-20T10:30:45Z", "level": "info", "message": "Agent started" }
  ]
}
```

#### Agent Metrics
```
GET /agents/:id/metrics
```

Response (200):
```json
{
  "id": "agent-1",
  "uptime": 3600000,
  "memory": 256,
  "cpu": 12.5,
  "successRate": 0.98,
  "avgResponseTime": 245
}
```

### Workflows

#### List Workflows
```
GET /workflows
```

Query params: `status`, `owner`, `limit`, `offset`

Response (200):
```json
{
  "data": [
    {
      "id": "workflow-1",
      "name": "data-pipeline",
      "status": "idle",
      "nodes": 5,
      "lastRun": "2026-03-20T10:00:00Z"
    }
  ],
  "meta": { "total": 12 }
}
```

#### Create Workflow
```
POST /workflows
```

Body:
```json
{
  "name": "my-workflow",
  "description": "Process customer data",
  "nodes": [],
  "connections": []
}
```

Response (201):
```json
{
  "id": "workflow-new-456",
  "name": "my-workflow",
  "status": "draft"
}
```

#### Get Workflow
```
GET /workflows/:id
```

Response (200):
```json
{
  "id": "workflow-1",
  "name": "data-pipeline",
  "status": "idle",
  "nodes": [
    {
      "id": "node-1",
      "type": "agent",
      "name": "data-collector",
      "position": { "x": 0, "y": 0, "z": 0 }
    }
  ],
  "connections": []
}
```

#### Add Node
```
POST /workflows/:id/nodes
```

Body:
```json
{
  "type": "agent",
  "name": "my-node",
  "position": { "x": 100, "y": 50, "z": 0 },
  "config": {}
}
```

Response (201):
```json
{
  "nodeId": "node-456",
  "workflowId": "workflow-1"
}
```

#### Connect Nodes
```
POST /workflows/:id/connections
```

Body:
```json
{
  "sourceNodeId": "node-1",
  "targetNodeId": "node-2",
  "condition": "success",
  "delay": 0
}
```

Response (201):
```json
{
  "connectionId": "conn-789",
  "workflowId": "workflow-1"
}
```

#### Validate Workflow
```
POST /workflows/:id/validate
```

Response (200):
```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

#### Execute Workflow
```
POST /workflows/:id/execute
```

Body:
```json
{
  "input": { "query": "example" }
}
```

Response (202):
```json
{
  "executionId": "exec-123",
  "status": "running"
}
```

#### Delete Workflow
```
DELETE /workflows/:id
```

Response (200):
```json
{ "id": "workflow-1", "deleted": true }
```

### Executions

#### Get Execution
```
GET /executions/:id
```

Response (200):
```json
{
  "id": "exec-123",
  "workflowId": "workflow-1",
  "status": "running",
  "startedAt": "2026-03-20T10:00:00Z",
  "nodeExecutions": [
    {
      "nodeId": "node-1",
      "status": "completed",
      "output": { "result": "data" }
    }
  ]
}
```

#### Stop Execution
```
DELETE /executions/:id
```

Response (200):
```json
{ "id": "exec-123", "stopped": true }
```

### Configuration

#### Get Config
```
GET /config/:key
```

Response (200):
```json
{ "key": "api.timeout", "value": 30000 }
```

#### Set Config
```
PATCH /config/:key
```

Body:
```json
{ "value": 60000 }
```

Response (200):
```json
{ "key": "api.timeout", "value": 60000 }
```

#### List Config
```
GET /config
```

Response (200):
```json
{
  "data": [
    { "key": "api.timeout", "value": 30000 },
    { "key": "api.maxRetries", "value": 3 }
  ]
}
```

## WebSocket API

Connect to `wss://api.luna-os.com/api/v1/ws` with auth token in query: `?token=YOUR_JWT`

### Event Types

#### Subscribe to Agent Events
```json
{
  "type": "subscribe",
  "channel": "agent:agent-1"
}
```

Receives:
```json
{
  "type": "agent:status_changed",
  "data": { "id": "agent-1", "status": "running" }
}
```

#### Subscribe to Workflow Execution
```json
{
  "type": "subscribe",
  "channel": "execution:exec-123"
}
```

Receives:
```json
{
  "type": "execution:node_completed",
  "data": { "nodeId": "node-1", "output": {...} }
}
```

#### Send Command
```json
{
  "type": "command",
  "agentId": "agent-1",
  "command": "process",
  "payload": { "task": "analyze" }
}
```

Response:
```json
{
  "type": "command:response",
  "commandId": "cmd-123",
  "status": "success",
  "result": {...}
}
```

## Error Responses

All errors return appropriate HTTP status codes with JSON body:

```json
{
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent with ID 'agent-999' not found",
    "details": {}
  }
}
```

Common errors:
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid auth
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error

## Rate Limiting

- **Free tier**: 100 requests/minute
- **Pro tier**: 1000 requests/minute
- **Enterprise**: Custom limits

Headers include:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Pagination

List endpoints support pagination via query params:
- `limit` (default: 20, max: 100)
- `offset` (default: 0)

Response includes meta:
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

## Versioning

API versions in path: `/api/v1/`, `/api/v2/` (future)

Current version: **v1** (released 2026-03)

## SDKs

Official SDKs available for:
- JavaScript/TypeScript: `npm install luna-os-sdk`
- Python: `pip install luna-os`
- Go: `go get github.com/luna-os/go-sdk`

See documentation for usage examples.
