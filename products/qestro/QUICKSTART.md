# AI Test Intelligence Engine - Quick Start

## Installation

All files are already created in the codebase:

```
backend/src/services/test-intelligence/
├── types.ts                    # Type definitions
├── FlakyDetector.ts           # Detect flaky tests
├── TestPrioritizer.ts         # Prioritize tests
├── AutoFixEngine.ts           # Auto-fix suggestions
├── PredictiveAnalytics.ts     # Predictions
├── index.ts                   # Central exports
├── example.ts                 # Usage examples
├── README.md                  # Documentation
└── INTEGRATION.md             # Integration guide

backend/src/routes/
└── test-intelligence.routes.ts # API endpoints
```

## Quick Usage

### 1. Import Services

```typescript
import {
  FlakyDetector,
  TestPrioritizer,
  AutoFixEngine,
  PredictiveAnalytics,
} from './services/test-intelligence/index.js';
```

Or use the factory:

```typescript
import { TestIntelligenceEngineFactory } from './services/test-intelligence/index.js';

const { flaky, prioritizer, autoFix, analytics } =
  TestIntelligenceEngineFactory.createAll();
```

### 2. Detect Flaky Tests

```typescript
const detector = new FlakyDetector();

const report = await detector.detectFlakyTests(
  'project-123',
  ['test-login', 'test-checkout'],
  testRunHistory // Map<string, TestRun[]>
);

console.log(`Found ${report.flakyTests.length} flaky tests`);
report.flakyTests.forEach(test => {
  console.log(`${test.testName}: ${test.flakinessScore}/100`);
});
```

### 3. Prioritize Tests

```typescript
const prioritizer = new TestPrioritizer();

const priorities = await prioritizer.prioritizeTests(
  testIds,
  codeChanges,
  testRunHistory,
  testMetadata
);

// Run tests in priority order
for (const test of priorities) {
  console.log(`${test.executionOrder}. ${test.testName} (${test.priority})`);
}
```

### 4. Get Auto-Fix Suggestions

```typescript
const fixer = new AutoFixEngine();

const suggestions = await fixer.suggestFixes(
  'test-id',
  testCode,
  failure // TestFailure
);

if (suggestions.length > 0) {
  const bestFix = suggestions[0];
  console.log(`Fix: ${bestFix.description}`);
  console.log(`Confidence: ${bestFix.confidence * 100}%`);
}
```

### 5. Predict Failures

```typescript
const analytics = new PredictiveAnalytics();

const predictions = await analytics.predictFailures(
  'project-123',
  testIds,
  testRunHistory
);

predictions.forEach(insight => {
  if (insight.predictedToFail) {
    console.log(`WARNING: ${insight.testName} may fail`);
    console.log(`Probability: ${insight.failureProbability * 100}%`);
  }
});
```

### 6. Get Project Health

```typescript
const health = await analytics.getHealthScore(
  'project-123',
  testRunHistory
);

console.log(`Overall Health: ${health.overallHealth}/100`);
console.log(`Trend: ${health.trend}`);
console.log('Recommendations:');
health.recommendations.forEach(rec => console.log(`- ${rec}`));
```

## API Endpoints

Mount routes in Express:

```typescript
import testIntelligenceRoutes from './routes/test-intelligence.routes.js';

app.use('/api/intelligence', testIntelligenceRoutes);
```

Available endpoints:

```
GET  /api/intelligence/flaky/:projectId
GET  /api/intelligence/prioritize?projectId=:projectId
POST /api/intelligence/auto-fix/:testId
POST /api/intelligence/auto-fix/:testId/apply
GET  /api/intelligence/predict/:projectId
GET  /api/intelligence/health/:projectId
GET  /api/intelligence/trends/:projectId
```

## Example: Complete Workflow

```typescript
import {
  FlakyDetector,
  TestPrioritizer,
  AutoFixEngine,
  PredictiveAnalytics,
} from './services/test-intelligence/index.js';

async function analyzeAndOptimizeTests(projectId: string) {
  const flaky = new FlakyDetector();
  const prioritizer = new TestPrioritizer();
  const fixer = new AutoFixEngine();
  const analytics = new PredictiveAnalytics();

  // Load test data (from database)
  const testIds = await getProjectTests(projectId);
  const runHistory = await loadTestHistory(projectId);
  const changes = await getRecentCodeChanges(projectId);
  const metadata = await loadTestMetadata(projectId);

  // 1. Find flaky tests
  console.log('Finding flaky tests...');
  const flakyReport = await flaky.detectFlakyTests(
    projectId,
    testIds,
    runHistory
  );

  // 2. Prioritize for next run
  console.log('Prioritizing tests...');
  const priorities = await prioritizer.prioritizeTests(
    testIds,
    changes,
    runHistory,
    metadata
  );

  // 3. Predict which will fail
  console.log('Predicting failures...');
  const predictions = await analytics.predictFailures(
    projectId,
    testIds,
    runHistory
  );

  // 4. Get project health
  console.log('Assessing project health...');
  const health = await analytics.getHealthScore(projectId, runHistory);

  return {
    flaky: flakyReport,
    priorities: priorities.slice(0, 10), // First 10 tests
    predictions: predictions.filter(p => p.predictedToFail),
    health,
  };
}
```

## Data Structures

### TestRun
```typescript
interface TestRun {
  runId: string;
  testId: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number; // milliseconds
  executedAt: Date;
  errorMessage?: string;
  screenshot?: string;
}
```

### CodeChange
```typescript
interface CodeChange {
  filePath: string;
  added: string[];
  removed: string[];
  modified: string[];
  testCoverage?: string[]; // Test IDs covering this file
}
```

### TestFailure
```typescript
interface TestFailure {
  testId: string;
  failureMessage: string;
  stackTrace: string;
  screenshot?: Buffer;
  environment: {
    os: string;
    browser?: string;
    node: string;
  };
  timestamp: Date;
}
```

## Configuration

All thresholds are configurable via constants in each service:

**FlakyDetector:**
- `MIN_RUNS_FOR_ANALYSIS = 5`
- `RECENT_RUNS_WINDOW = 30` (days)
- `FLAKINESS_THRESHOLD = 0.25`

**TestPrioritizer:**
- Risk weights: code impact (40%), failure rate (35%), criticality (25%)

**AutoFixEngine:**
- Confidence scores per fix category
- Success rate estimates

**PredictiveAnalytics:**
- Prediction confidence thresholds
- Health score weights

## Testing

Run examples:

```bash
npx ts-node backend/src/services/test-intelligence/example.ts
```

## Next Steps

1. **Database Integration**
   - Add Drizzle schema for test runs
   - Load historical data

2. **Frontend Dashboard**
   - Display flaky tests
   - Show health score
   - Render trend charts

3. **CI/CD Integration**
   - Record test runs automatically
   - Prioritize tests in pipeline
   - Comment on PRs with insights

4. **Unit Tests**
   - Test each algorithm
   - Mock data for testing
   - Achieve 85%+ coverage

## Troubleshooting

### "Not enough data"
Need at least 5 runs per test. Ensure tests are executed regularly.

### "Predictions not accurate"
More historical data improves accuracy. Wait for 30+ days of history.

### "Performance issues"
Enable caching for results. Cache keys: `flaky-${projectId}`, `health-${projectId}`

## Files Reference

- **types.ts** - All type definitions
- **FlakyDetector.ts** - Flakiness scoring and pattern detection
- **TestPrioritizer.ts** - Risk-based test ordering
- **AutoFixEngine.ts** - Fix suggestion and validation
- **PredictiveAnalytics.ts** - Failure prediction and health scoring
- **README.md** - Detailed documentation
- **INTEGRATION.md** - Step-by-step integration
- **example.ts** - Complete working examples
- **index.ts** - Central exports and factory
- **test-intelligence.routes.ts** - Express API routes

## Support

For more details, see:
- `README.md` - Complete service documentation
- `INTEGRATION.md` - Database and frontend integration
- `example.ts` - Working code examples
- `IMPLEMENTATION_SUMMARY.md` - Overall project summary
