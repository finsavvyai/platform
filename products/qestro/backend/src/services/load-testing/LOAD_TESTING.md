# Load Testing Engine

## Overview

The Load Testing Engine provides comprehensive performance testing capabilities for Qestro, allowing users to execute load tests against their applications under various load profiles and collect detailed performance metrics.

## Architecture

### Core Components

1. **LoadTestEngine** (200 lines) — Main orchestrator
   - Manages test lifecycle (start, stop, results)
   - Coordinates virtual user pool and metrics collection
   - Supports multiple load profiles with dynamic adjustment
   - Enforces threshold rules and triggers alerts

2. **VirtualUserPool** (149 lines) — Virtual user management
   - Spawns and manages concurrent virtual users
   - Implements ramp-up, ramp-down, and constant load strategies
   - Each VU executes test scenario in loop
   - Records per-request metrics

3. **MetricsCollector** (82 lines) — Performance metrics aggregation
   - Records individual request metrics
   - Calculates aggregate statistics every 10 seconds
   - Computes percentiles: p50, p95, p99 latency
   - Tracks throughput, error rate, min/max latency

4. **Routes** (129 lines) — Express.js API endpoints
   - POST /api/load-test/start — Start load test
   - POST /api/load-test/stop/:runId — Stop load test
   - GET /api/load-test/results/:runId — Get full results
   - GET /api/load-test/metrics/:runId — Get live metrics
   - GET /api/load-test/history — List past tests

## Load Profiles

### Constant Load
Maintains a fixed number of virtual users throughout the test.

```typescript
{
  loadProfile: 'constant',
  initialVirtualUsers: 100,
  testDurationMs: 300000
}
```

### Ramp-up
Gradually increases virtual users from initial to maximum count.

```typescript
{
  loadProfile: 'ramp_up',
  initialVirtualUsers: 10,
  maxVirtualUsers: 100,
  rampUpDurationMs: 60000,
  testDurationMs: 300000
}
```

### Spike Test
Suddenly increases load for a burst period, then returns to baseline.

```typescript
{
  loadProfile: 'spike',
  initialVirtualUsers: 50,
  maxVirtualUsers: 500,
  spikeDurationMs: 30000,
  testDurationMs: 300000
}
```

### Step Function
Gradually increases load in discrete steps.

```typescript
{
  loadProfile: 'step',
  initialVirtualUsers: 10,
  maxVirtualUsers: 100,
  stepIncrement: 10,
  stepDurationMs: 30000,
  testDurationMs: 300000
}
```

## Usage Example

### Starting a Load Test

```bash
curl -X POST http://localhost:8000/api/load-test/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "testId": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "name": "E-commerce Checkout Load Test",
    "targetUrl": "https://api.example.com/checkout",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "items": ["item1", "item2"],
      "paymentMethod": "credit_card"
    },
    "loadProfile": "ramp_up",
    "initialVirtualUsers": 10,
    "maxVirtualUsers": 200,
    "rampUpDurationMs": 60000,
    "testDurationMs": 300000,
    "thinkTimeMs": 1000,
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
  }'
```

Response:
```json
{
  "runId": "run_550e8400-e29b-41d4-a716-446655440000",
  "message": "Load test started"
}
```

### Getting Live Metrics

```bash
curl -X GET http://localhost:8000/api/load-test/metrics/run_550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer token"
```

Response:
```json
{
  "runId": "run_550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "currentMetrics": {
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
  },
  "peakVirtualUsers": 125,
  "durationMs": 30000
}
```

### Stopping a Load Test

```bash
curl -X POST http://localhost:8000/api/load-test/stop/run_550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer token"
```

### Getting Full Results

```bash
curl -X GET http://localhost:8000/api/load-test/results/run_550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer token"
```

## Performance Metrics

### Key Metrics

- **Throughput**: Requests per second
- **Response Time**: Time from request start to response end
  - Avg, P50, P95, P99, Min, Max
- **Error Rate**: Percentage of failed requests
- **Virtual Users**: Number of concurrent simulated users
- **Time Series**: Metrics snapshots every 10 seconds

### Threshold Rules

Rules can trigger `stop` (immediately halt test) or `alert` (record violation).

Supported metrics:
- `errorRate` — Percentage of failed requests (0-100)
- `p95Latency` — 95th percentile response time (milliseconds)
- `throughput` — Requests per second
- `avgLatency` — Average response time (milliseconds)

## Implementation Notes

### Virtual User Execution

Each virtual user:
1. Executes test scenario in a loop
2. Records metrics for each request
3. Applies think time between steps
4. Catches errors and continues (or stops if configured)

### Metrics Collection

- Metrics are recorded per-request
- Snapshots are generated every 10 seconds
- Time series data is retained for charts/graphs
- Full metric history available in results

### Load Profile Execution

Profiles are implemented using:
- **Ramp-up**: Linear interpolation from initial to max users
- **Spike**: Sudden increase, sustained, then sudden decrease
- **Step**: Discrete increments at fixed intervals
- **Constant**: No adjustment, maintain baseline

### Concurrency Limits

- Max 10 concurrent load tests per instance
- Max 10,000 virtual users per test
- Prevents resource exhaustion

## Future Enhancements

- WebSocket load testing
- Authentication/token management for secured endpoints
- Data parameterization (CSV, JSON sources)
- Custom assertion and extraction logic
- Webhook notifications on test completion
- Historical trend analysis and reporting
