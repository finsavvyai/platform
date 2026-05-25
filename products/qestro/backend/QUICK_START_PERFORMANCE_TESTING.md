# Quick Start: Performance Testing

## TL;DR

Two new performance testing capabilities have been added to Qestro:

1. **Load Testing** — Execute tests under realistic user load
2. **Browser Matrix** — Test across multiple browsers and devices

## 5-Minute Setup

### 1. Verify Route Registration

The routes are already registered in `backend/src/index.production.ts`:

```typescript
{ path: '/api/load-test', file: './services/load-testing/load-testing.routes', exportName: 'loadTestingRouter' },
{ path: '/api/browser-matrix', file: './services/browser-matrix/browser-matrix.routes', exportName: 'browserMatrixRouter' },
```

### 2. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The server will start on `http://localhost:8000`.

### 3. Test Load Testing API

```bash
# Start a load test
curl -X POST http://localhost:8000/api/load-test/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "testId": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "API Load Test",
    "targetUrl": "https://api.example.com/users",
    "method": "GET",
    "loadProfile": "constant",
    "initialVirtualUsers": 10,
    "maxVirtualUsers": 10,
    "testDurationMs": 30000
  }'
```

Response:
```json
{
  "runId": "run_550e8400-...",
  "message": "Load test started"
}
```

### 4. Get Live Metrics

```bash
curl -X GET http://localhost:8000/api/load-test/metrics/run_550e8400-... \
  -H "Authorization: Bearer your_token"
```

### 5. Test Browser Matrix API

```bash
curl -X POST http://localhost:8000/api/browser-matrix/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "testId": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "browsers": [
      { "type": "chromium" }
    ],
    "devicePresets": [
      "desktop-fullhd",
      "mobile-iphone15"
    ]
  }'
```

### 6. List Available Devices

```bash
curl -X GET http://localhost:8000/api/browser-matrix/devices \
  -H "Authorization: Bearer your_token"
```

## Load Testing API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/load-test/start` | Start new load test |
| POST | `/api/load-test/stop/:runId` | Stop running test |
| GET | `/api/load-test/results/:runId` | Get final results |
| GET | `/api/load-test/metrics/:runId` | Get live metrics |
| GET | `/api/load-test/history` | List past tests |

## Browser Matrix API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/browser-matrix/run` | Execute test matrix |
| GET | `/api/browser-matrix/results/:id` | Get results |
| GET | `/api/browser-matrix/devices` | List devices |
| GET | `/api/browser-matrix/browsers` | List browsers |

## Load Profiles

Choose one:
- **constant** — Fixed number of users
- **ramp_up** — Gradually increase users
- **spike** — Sudden load spike then return to baseline
- **step** — Increase load in discrete steps

## Device Presets

### Desktop (4)
- `desktop-fullhd` — 1920×1080
- `desktop-hd` — 1440×900
- `desktop-wxga` — 1366×768
- `desktop-4k` — 3840×2160

### Tablet (3)
- `tablet-ipad` — iPad (5th Gen)
- `tablet-ipad-pro` — iPad Pro
- `tablet-samsung` — Samsung Galaxy Tab S7

### Mobile (5)
- `mobile-iphone15` — iPhone 15
- `mobile-iphone14pro` — iPhone 14 Pro
- `mobile-pixel8` — Google Pixel 8
- `mobile-galaxys24` — Samsung Galaxy S24
- `mobile-galaxya50` — Samsung Galaxy A50

## Threshold Rules

Stop or alert when metrics exceed thresholds:

```json
{
  "thresholdRules": [
    {
      "metric": "errorRate",
      "operator": ">",
      "value": 1,
      "action": "stop"
    },
    {
      "metric": "p95Latency",
      "operator": ">",
      "value": 5000,
      "action": "alert"
    }
  ]
}
```

Supported metrics:
- `errorRate` — Percentage (0-100)
- `p95Latency` — Milliseconds
- `throughput` — Requests/second
- `avgLatency` — Milliseconds

## Common Workflows

### Simple Load Test

```bash
# Start test with 100 constant users
curl -X POST http://localhost:8000/api/load-test/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "testId": "uuid",
    "projectId": "uuid",
    "name": "Baseline Load Test",
    "targetUrl": "https://api.example.com/health",
    "method": "GET",
    "loadProfile": "constant",
    "initialVirtualUsers": 100,
    "maxVirtualUsers": 100,
    "testDurationMs": 60000
  }'

# Poll metrics every 5 seconds
for i in {1..12}; do
  curl -X GET http://localhost:8000/api/load-test/metrics/run_uuid \
    -H "Authorization: Bearer token"
  sleep 5
done

# Get final results
curl -X GET http://localhost:8000/api/load-test/results/run_uuid \
  -H "Authorization: Bearer token"
```

### Ramp-up Load Test

```bash
curl -X POST http://localhost:8000/api/load-test/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "testId": "uuid",
    "projectId": "uuid",
    "name": "Ramp-up Test",
    "targetUrl": "https://api.example.com/orders",
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "body": {"items": ["item1"]},
    "loadProfile": "ramp_up",
    "initialVirtualUsers": 10,
    "maxVirtualUsers": 500,
    "rampUpDurationMs": 120000,
    "testDurationMs": 300000,
    "thinkTimeMs": 2000,
    "thresholdRules": [
      {"metric": "errorRate", "operator": ">", "value": 5, "action": "stop"}
    ]
  }'
```

### Cross-Browser Test

```bash
curl -X POST http://localhost:8000/api/browser-matrix/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "testId": "uuid",
    "projectId": "uuid",
    "browsers": [
      {"type": "chromium"},
      {"type": "firefox"},
      {"type": "webkit"}
    ],
    "devicePresets": [
      "desktop-fullhd",
      "tablet-ipad",
      "mobile-iphone15"
    ],
    "maxConcurrency": 4
  }'
```

## Metrics Returned

### Load Test Metrics

```json
{
  "timestamp": 1712500000000,
  "totalRequests": 1523,
  "successfulRequests": 1501,
  "failedRequests": 22,
  "errorRate": 1.44,
  "throughput": 50.77,
  "avgLatency": 234.5,
  "p50Latency": 180,
  "p95Latency": 450,
  "p99Latency": 850,
  "minLatency": 45,
  "maxLatency": 2100,
  "activeVirtualUsers": 125
}
```

### Browser Matrix Summary

```json
{
  "totalEntries": 9,
  "passedEntries": 8,
  "failedEntries": 1,
  "passRate": 88.89,
  "totalDurationMs": 45000
}
```

## Documentation

For detailed information:
- **Load Testing**: `/backend/src/services/load-testing/LOAD_TESTING.md`
- **Browser Matrix**: `/backend/src/services/browser-matrix/BROWSER_MATRIX.md`
- **Integration**: `/backend/PERFORMANCE_TESTING.md`
- **Implementation**: `/backend/IMPLEMENTATION_SUMMARY.md`

## File Locations

```
backend/src/services/
├── load-testing/
│   ├── types.ts
│   ├── LoadTestEngine.ts
│   ├── VirtualUserPool.ts
│   ├── MetricsCollector.ts
│   ├── load-testing.routes.ts
│   ├── index.ts
│   └── LOAD_TESTING.md
└── browser-matrix/
    ├── types.ts
    ├── DevicePresets.ts
    ├── BrowserMatrixEngine.ts
    ├── browser-matrix.routes.ts
    ├── index.ts
    └── BROWSER_MATRIX.md
```

## Troubleshooting

### Routes not found (404)

Verify routes are registered in `backend/src/index.production.ts`:
```typescript
{ path: '/api/load-test', file: './services/load-testing/load-testing.routes', exportName: 'loadTestingRouter' },
{ path: '/api/browser-matrix', file: './services/browser-matrix/browser-matrix.routes', exportName: 'browserMatrixRouter' },
```

### Authentication error (401)

Include valid JWT token:
```bash
curl -H "Authorization: Bearer your_jwt_token"
```

### Test not found (404)

Ensure you're using the correct `runId` or `entryId`:
```bash
# From start response
curl http://localhost:8000/api/load-test/results/run_550e8400-...
```

### Validation error (400)

Check request body matches schema. See full examples above.

## Next Steps

1. **Frontend Integration** — Create UI components for load testing
2. **Database Storage** — Persist results for historical analysis
3. **Alerting** — Set up thresholds and notifications
4. **Reporting** — Generate charts and trend analysis
5. **Advanced Testing** — WebSocket, authentication, parameterization

## Getting Help

- Check the full documentation files listed above
- Review the API contract examples in `PERFORMANCE_TESTING.md`
- See curl examples in this guide and the markdown files
