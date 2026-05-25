# Qestro Performance Testing Suite

## Overview

The Performance Testing Suite adds comprehensive load testing and cross-browser testing capabilities to Qestro, enabling teams to validate application performance, reliability, and compatibility across multiple platforms.

## Components

### 1. Load Testing Engine
**Location**: `backend/src/services/load-testing/`

Simulates realistic user load to measure application performance under stress.

**Capabilities**:
- Multiple load profiles (constant, ramp-up, spike, step)
- Real-time metrics collection (throughput, latency, error rate)
- Virtual user management (spawn, ramp-up, ramp-down)
- Threshold-based alerting and test stopping
- Time-series metrics for trend analysis
- Support for custom headers, body, think time

**API Endpoints**:
```
POST   /api/load-test/start           Start load test
POST   /api/load-test/stop/:runId     Stop running test
GET    /api/load-test/results/:runId  Get complete results
GET    /api/load-test/metrics/:runId  Get live metrics
GET    /api/load-test/history         List past tests
```

**Files**:
- `types.ts` (107 lines) — Type definitions
- `LoadTestEngine.ts` (200 lines) — Main orchestrator
- `VirtualUserPool.ts` (149 lines) — User management
- `MetricsCollector.ts` (82 lines) — Metrics aggregation
- `load-testing.routes.ts` (129 lines) — API routes
- `index.ts` (16 lines) — Exports
- `LOAD_TESTING.md` — Full documentation

### 2. Browser Matrix Engine
**Location**: `backend/src/services/browser-matrix/`

Executes tests across multiple browsers and device configurations in parallel.

**Capabilities**:
- 3 browser engines (Chromium, Firefox, WebKit)
- 18 pre-configured device profiles
- Parallel execution with configurable concurrency
- Device emulation (viewport, user agent, scale factor)
- Comprehensive result aggregation with pass rates
- Failure categorization and error tracking

**API Endpoints**:
```
POST   /api/browser-matrix/run        Execute test matrix
GET    /api/browser-matrix/results/:id Get matrix results
GET    /api/browser-matrix/devices    List device presets
GET    /api/browser-matrix/browsers   List browsers
```

**Device Presets** (18 total):
- **Desktop** (4): Full HD, HD, WXGA, 4K
- **Tablet** (3): iPad, iPad Pro, Samsung Tab S7
- **Mobile** (5): iPhone 15, iPhone 14 Pro, Pixel 8, Galaxy S24, Galaxy A50

**Files**:
- `types.ts` (80 lines) — Type definitions
- `DevicePresets.ts` (133 lines) — Device library
- `BrowserMatrixEngine.ts` (182 lines) — Main orchestrator
- `browser-matrix.routes.ts` (131 lines) — API routes
- `index.ts` (14 lines) — Exports
- `BROWSER_MATRIX.md` — Full documentation

## Architecture

### Load Testing Pipeline

```
1. User initiates test
   ↓
2. LoadTestEngine creates VirtualUserPool
   ↓
3. VirtualUserPool spawns virtual users
   ↓
4. Each VU executes test scenario in loop
   ↓
5. MetricsCollector records all requests
   ↓
6. Load profile adjusts user count dynamically
   ↓
7. Threshold rules trigger stop/alert if violated
   ↓
8. Results stored and reported to user
```

### Browser Matrix Pipeline

```
1. User defines browsers and device presets
   ↓
2. BrowserMatrixEngine creates matrix (N×M entries)
   ↓
3. Matrix entries queued for execution
   ↓
4. Worker threads execute entries in parallel
   ↓
5. Each entry runs test with browser + device config
   ↓
6. Results collected (pass/fail, screenshots, logs)
   ↓
7. Summary report generated with pass rate
   ↓
8. Results stored and reported to user
```

## Code Organization

### Max 200 Lines Per File

All files strictly adhere to the 200-line limit for maintainability:

**Load Testing**:
- LoadTestEngine.ts: 200 lines (max)
- VirtualUserPool.ts: 149 lines
- MetricsCollector.ts: 82 lines
- load-testing.routes.ts: 129 lines
- types.ts: 107 lines
- index.ts: 16 lines

**Browser Matrix**:
- BrowserMatrixEngine.ts: 182 lines
- DevicePresets.ts: 133 lines
- browser-matrix.routes.ts: 131 lines
- types.ts: 80 lines
- index.ts: 14 lines

### No `any` Types

All TypeScript code uses strict typing:
- All parameters have explicit types
- All return types are specified
- Union types for variants (LoadProfile, BrowserType)
- Generic types for flexibility

### Local Import Extensions

All imports use `.js` extensions for ES modules:
```typescript
import { logger } from '../../utils/logger.js';
import { MetricsCollector } from './MetricsCollector.js';
```

## Integration with Qestro

### Route Registration

Routes are automatically mounted in `backend/src/index.production.ts`:

```typescript
{ path: '/api/load-test', file: './services/load-testing/load-testing.routes', exportName: 'loadTestingRouter' },
{ path: '/api/browser-matrix', file: './services/browser-matrix/browser-matrix.routes', exportName: 'browserMatrixRouter' },
```

### Authentication

Both services require authentication via the `authenticateUser` middleware:

```typescript
loadTestingRouter.use(authenticateUser);
browserMatrixRouter.use(authenticateUser);
```

Users must provide valid JWT tokens in `Authorization: Bearer <token>` headers.

### Logging

Comprehensive logging via project logger:

```typescript
import { logger } from '../../utils/logger.js';

logger.info(`Load test started: ${runId}`, { testId: config.testId });
logger.error(`Load test error: ${runId}`, { error: error.message });
```

## Example Workflows

### Load Test Workflow

1. User visits Analytics Dashboard
2. Selects "Run Load Test"
3. Configures test (URL, method, load profile)
4. Selects threshold rules
5. Clicks "Start Test"
6. Backend creates LoadTestEngine instance
7. Virtual users spawn and start executing requests
8. Metrics collected in real-time
9. Frontend polls `/api/load-test/metrics/:runId` for live updates
10. Test completes or user stops manually
11. Results displayed with graphs and summary

### Browser Matrix Workflow

1. User creates test case (e.g., checkout flow)
2. Selects "Run Cross-Browser Tests"
3. Chooses browsers: Chromium, Firefox, WebKit
4. Selects device presets: Desktop FHD, iPhone 15, iPad
5. Clicks "Execute Matrix"
6. Backend creates 9 matrix entries (3 browsers × 3 presets)
7. Workers execute entries in parallel (4 at a time)
8. Each entry runs with appropriate browser + device config
9. Results collected: pass/fail, screenshots, execution logs
10. Summary shows pass rate and failures
11. User can drill down into specific failures

## Performance Characteristics

### Load Testing

- Max 10 concurrent load tests
- Max 10,000 virtual users per test
- Metrics snapshots every 10 seconds
- Time series data retention for full test duration
- Sub-millisecond latency measurement

### Browser Matrix

- Parallel execution (configurable concurrency)
- Default 4 concurrent browser instances
- Per-entry timeout configurable
- Screenshot capture per result
- Result aggregation in O(n) time

## Database Schema (Future)

When database storage is added:

```sql
CREATE TABLE load_tests (
  id UUID PRIMARY KEY,
  test_id UUID NOT NULL,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE load_test_results (
  id UUID PRIMARY KEY,
  load_test_id UUID NOT NULL REFERENCES load_tests(id),
  total_requests INT,
  successful_requests INT,
  failed_requests INT,
  error_rate DECIMAL(5,2),
  throughput DECIMAL(10,2),
  avg_latency INT,
  p95_latency INT,
  p99_latency INT,
  peak_virtual_users INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE browser_matrix_runs (
  id UUID PRIMARY KEY,
  test_id UUID NOT NULL,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_entries INT,
  passed_entries INT,
  failed_entries INT,
  pass_rate DECIMAL(5,2),
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE matrix_results (
  id UUID PRIMARY KEY,
  matrix_run_id UUID NOT NULL REFERENCES browser_matrix_runs(id),
  browser VARCHAR(50) NOT NULL,
  device_name VARCHAR(255),
  viewport_width INT,
  viewport_height INT,
  passed BOOLEAN NOT NULL,
  error_message TEXT,
  screenshot_path VARCHAR(512),
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Testing Strategy

### Unit Tests (Future)

```typescript
// Load Testing
describe('LoadTestEngine', () => {
  it('should start load test with correct config');
  it('should ramp up virtual users');
  it('should stop load test');
  it('should check thresholds');
});

describe('MetricsCollector', () => {
  it('should calculate percentiles correctly');
  it('should track throughput');
  it('should update snapshots every 10 seconds');
});

// Browser Matrix
describe('BrowserMatrixEngine', () => {
  it('should create correct number of matrix entries');
  it('should execute matrix in parallel');
  it('should aggregate results correctly');
});

describe('DevicePresets', () => {
  it('should return all desktop presets');
  it('should return mobile presets with correct viewports');
});
```

### Integration Tests (Future)

```typescript
// Load Test Flow
test('Load test: constant profile', async () => {
  const runId = await startLoadTest(constantConfig);
  await waitForCompletion(runId, 30000);
  const results = await getResults(runId);
  expect(results.finalMetrics.throughput).toBeGreaterThan(0);
});

// Browser Matrix Flow
test('Browser matrix: chromium + firefox', async () => {
  const summary = await executeMatrix(matrixRequest);
  expect(summary.totalEntries).toBe(2);
  expect(summary.passRate).toBeGreaterThan(0);
});
```

## Monitoring & Alerting

### Metrics to Monitor

- **Engine Health**: Active tests, virtual user count
- **Performance**: Avg/p95/p99 latencies, throughput
- **Errors**: Error rate, threshold violations
- **Resources**: Memory usage, CPU, concurrent connections

### Alert Triggers

- Threshold violations during load test
- Engine crashes or recoveries
- Test timeouts
- Resource exhaustion warnings

## Future Enhancements

### Phase 1 (Next Sprint)
- Database storage for historical results
- Result charts and trends
- Detailed failure analysis
- Test result export (CSV, JSON, PDF)

### Phase 2
- WebSocket load testing
- Authentication token management
- Data parameterization (CSV sources)
- Custom assertions and validations
- Webhook notifications

### Phase 3
- Cloud device farm integration
- Visual regression detection
- Performance profiling (CPU, memory)
- Network throttling profiles
- Advanced analytics and ML-driven insights
