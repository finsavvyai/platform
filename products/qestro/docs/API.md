# Qestro API Documentation

Comprehensive REST API for AI-powered testing automation, test generation, visual regression, and CI/CD integration.

## Base URLs

- **Production**: `https://api.qestro.app`
- **Staging**: `https://staging-api.qestro.app`
- **Development**: `http://localhost:8787`

## Authentication

All API requests require JWT authentication. Obtain tokens via OAuth 2.0 or email/password.

```bash
Authorization: Bearer eyJhbGc...
```

## Test Generation Endpoints

### POST /api/v1/tests/generate

Generate test code from natural language description.

**Request**
```json
{
  "prompt": "Test user login with valid credentials",
  "framework": "playwright",
  "language": "typescript",
  "includeEdgeCases": true
}
```

**Response** (200 OK)
```json
{
  "success": true,
  "data": {
    "testId": "tst_abc123",
    "code": "test('user login', async ({ page }) => {...})",
    "confidence": 0.95,
    "framework": "playwright",
    "validationErrors": []
  }
}
```

**Parameters**
- `prompt` (string, required): Natural language description of test
- `framework` (string): `playwright` | `cypress` | `vitest`
- `language` (string): `typescript` | `javascript`
- `includeEdgeCases` (boolean): Generate edge case scenarios

### GET /api/v1/tests/{testId}

Retrieve generated test.

**Response** (200 OK)
```json
{
  "success": true,
  "data": {
    "testId": "tst_abc123",
    "code": "test('...', async ({ page }) => {...})",
    "status": "ready",
    "createdAt": "2026-03-20T10:00:00Z"
  }
}
```

## Cross-Browser Testing Endpoints

### POST /api/v1/tests/run

Execute tests across multiple browsers.

**Request**
```json
{
  "testIds": ["tst_abc123"],
  "browsers": ["chromium", "firefox", "webkit"],
  "viewports": ["desktop", "mobile-portrait"],
  "parallel": true
}
```

**Response** (202 Accepted)
```json
{
  "success": true,
  "executionId": "exec_xyz789",
  "status": "queued"
}
```

### GET /api/v1/tests/executions/{executionId}

Poll execution status.

**Response** (200 OK)
```json
{
  "executionId": "exec_xyz789",
  "status": "completed",
  "results": [
    {
      "browser": "chromium",
      "viewport": "desktop",
      "passed": true,
      "duration": 2450
    }
  ]
}
```

## Visual Regression Endpoints

### POST /api/v1/visual/baseline

Save screenshot baseline.

**Request** (multipart/form-data)
```
testId=login-page
browser=chromium
viewport=desktop
screenshot=(binary PNG data)
```

**Response** (201 Created)
```json
{
  "success": true,
  "baselineId": "base_123",
  "testId": "login-page"
}
```

### POST /api/v1/visual/compare

Compare screenshots with baseline.

**Request** (multipart/form-data)
```
baselineId=base_123
screenshot=(binary PNG data)
threshold=0.01
```

**Response** (200 OK)
```json
{
  "success": true,
  "passed": true,
  "percentageDifferent": 0.002,
  "pixelsDifferent": 1500
}
```

### GET /api/v1/visual/baselines

List all baselines for project.

**Response** (200 OK)
```json
{
  "success": true,
  "baselines": [
    {
      "baselineId": "base_123",
      "testId": "login-page",
      "browser": "chromium",
      "viewport": "desktop",
      "createdAt": "2026-03-15T09:00:00Z"
    }
  ]
}
```

## WebSocket Real-Time Events

Connect to WebSocket for real-time test execution updates.

```
ws://localhost:8787/ws/tests
```

### Connection

```javascript
const ws = new WebSocket('wss://api.qestro.app/ws/tests', {
  headers: { 'Authorization': 'Bearer token' }
});
```

### Events

**test:started**
```json
{ "type": "test:started", "testId": "tst_123", "browser": "chromium" }
```

**test:completed**
```json
{ "type": "test:completed", "testId": "tst_123", "passed": true, "duration": 2500 }
```

**screenshot:captured**
```json
{ "type": "screenshot:captured", "testId": "tst_123", "url": "r2://..." }
```

## Error Handling

All errors return consistent format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_FRAMEWORK",
    "message": "Framework must be playwright, cypress, or vitest",
    "details": { "provided": "invalid" }
  }
}
```

### Error Codes

- `INVALID_REQUEST`: Malformed request body
- `INVALID_FRAMEWORK`: Unsupported test framework
- `UNAUTHORIZED`: Missing or invalid authentication
- `RATE_LIMIT`: Too many requests (rate limited)
- `NOT_FOUND`: Resource not found
- `INTERNAL_ERROR`: Server error

## Rate Limiting

- **Free plan**: 100 requests/hour
- **Team plan**: 10,000 requests/hour
- **Enterprise**: Custom limits

Headers included in responses:
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9850
X-RateLimit-Reset: 1711000000
```

## Examples

### Generate and Run Test

```bash
# 1. Generate test
TEST=$(curl -s -X POST https://api.qestro.app/api/v1/tests/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test form submission","framework":"playwright"}' \
  | jq -r '.data.testId')

# 2. Run across browsers
EXEC=$(curl -s -X POST https://api.qestro.app/api/v1/tests/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"testIds\":[\"$TEST\"],\"browsers\":[\"chromium\",\"firefox\"]}" \
  | jq -r '.executionId')

# 3. Poll results
curl -s https://api.qestro.app/api/v1/tests/executions/$EXEC \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Visual Regression Workflow

```bash
# 1. Capture baseline
curl -X POST https://api.qestro.app/api/v1/visual/baseline \
  -H "Authorization: Bearer $TOKEN" \
  -F "testId=login-page" \
  -F "browser=chromium" \
  -F "screenshot=@baseline.png"

# 2. Capture current screenshot
curl -X POST https://api.qestro.app/api/v1/visual/compare \
  -H "Authorization: Bearer $TOKEN" \
  -F "baselineId=base_123" \
  -F "screenshot=@current.png" \
  -F "threshold=0.01"
```

## SDK Support

- **JavaScript/TypeScript**: `@qestro/sdk`
- **Python**: `qestro-py`
- **Go**: `go-qestro`

See individual SDK documentation for examples.

## Webhooks

Configure webhooks for test completion events:

```bash
curl -X POST https://api.qestro.app/api/v1/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["test:completed", "visual:regression"]
  }'
```

Webhook payload signature verification:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.QESTRO_WEBHOOK_SECRET)
  .update(req.rawBody)
  .digest('hex');

if (signature !== req.headers['x-qestro-signature']) {
  throw new Error('Invalid signature');
}
```
