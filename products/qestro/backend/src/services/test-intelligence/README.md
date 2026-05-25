# AI Test Intelligence Engine

Smart flaky test detection, auto-fix suggestions, test prioritization, and predictive analytics for the Qestro platform.

## Overview

The Test Intelligence Engine provides four core capabilities:

1. **Flaky Test Detection** - Identifies unreliable tests using statistical analysis
2. **Test Prioritization** - Orders tests by risk for faster CI feedback
3. **Auto-Fix Engine** - Suggests and applies automatic fixes for failures
4. **Predictive Analytics** - Predicts failures and project health

## Architecture

```
test-intelligence/
├── types.ts                    # Type definitions
├── FlakyDetector.ts           # Flakiness scoring & pattern detection
├── TestPrioritizer.ts         # Risk-based test ordering
├── AutoFixEngine.ts           # Fix suggestion & application
└── PredictiveAnalytics.ts     # Failure prediction & health scoring
```

## Services

### 1. FlakyDetector

Identifies flaky tests using statistical analysis on run history.

**Key Methods:**
- `detectFlakyTests(projectId, testIds, history)` - Find all flaky tests
- `calculateFlakinessScore(testId, runs)` - Score 0-100 (higher = flakier)
- `classifyFailurePattern(testId, runs)` - Identify root cause

**Algorithm:**
- Weighted moving average (recent runs weighted more)
- Coefficient of variation on execution times
- Pass/fail flip rate analysis
- Pass rate volatility in sliding windows

**Failure Patterns Detected:**
- `timing` - Timeout/visibility issues
- `environment` - OS/browser specific
- `data_dependent` - Data-related failures
- `race_condition` - Random failures
- `resource_exhaustion` - Memory/timeout limits
- `network` - Connection issues
- `selector_change` - DOM changes
- `assertion_logic` - Logic errors
- `unknown` - Inconclusive

### 2. TestPrioritizer

Orders tests by risk to maximize feedback speed in CI.

**Key Methods:**
- `prioritizeTests(tests, changes, history, metadata)` - Get ordered test list
- `calculateRiskScore(testId, changeContext, runs)` - Risk 0-1
- `getFailureProbability(testId, runs)` - Failure likelihood
- `estimateExecutionTime(testIds, metadata)` - Total run time
- `getFastFeedbackPlan(tests, changes, history, metadata, timeLimit)` - Tests for fast feedback

**Risk Scoring (weighted):**
- Code change impact (40%) - overlaps with recent changes
- Historical failure rate (35%) - past behavior
- Business criticality (25%) - importance of test

**Priority Levels:**
- `critical` - risk score >= 0.75
- `high` - risk score 0.5-0.75
- `medium` - risk score 0.25-0.5
- `low` - risk score < 0.25

### 3. AutoFixEngine

Suggests and validates automatic fixes for test failures.

**Key Methods:**
- `suggestFixes(testId, code, failure)` - Get fix suggestions
- `applyFix(testId, fixedCode, original)` - Apply and validate
- `validateFix(testId, code)` - Check syntax & semantics
- `estimateSuccessRate(category, failureType)` - Success likelihood

**Fix Categories:**
- `selector_update` - Update element selectors
- `timing_adjustment` - Increase timeouts
- `assertion_correction` - Fix expected values
- `data_refresh` - Add test fixtures
- `environment_config` - Handle OS differences
- `retry_logic` - Add retry handling
- `wait_strategy` - Use explicit waits

**Fix Generation:**
- Analyzes error messages to identify issue type
- Generates multiple alternatives ranked by confidence
- Validates syntax and semantic correctness
- Estimates success probability (0-1)

### 4. PredictiveAnalytics

Predicts test failures and calculates project health.

**Key Methods:**
- `predictFailures(projectId, testIds, history)` - Get failure predictions
- `getTrendAnalysis(projectId, history, days)` - Trend over time
- `getHealthScore(projectId, history)` - Overall health 0-100
- `estimateExecutionTime(testIds, history)` - Execution estimate

**Health Score Components:**
- Pass rate (25%) - % tests passing
- Flakiness (25%) - 100 - average flakiness
- Execution time (20%) - speed of suite
- Coverage (15%) - number of tests
- Maintenance (15%) - maintainability

**Predictions Use:**
- Historical pass rates (weighted by recency)
- Failure pattern consistency
- Trend analysis over 30 days
- Per-test failure probability

**Risk Assessment:**
- Risk level: critical / high / medium / low
- Impact score breakdown (business, blocker, user scope, cost)
- Mitigation strategies
- Estimated resolution time

## Data Types

### Core Types

```typescript
// Test run record
interface TestRun {
  runId: string;
  testId: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number; // ms
  executedAt: Date;
  errorMessage?: string;
  screenshot?: string;
}

// Code change context
interface CodeChange {
  filePath: string;
  added: string[];
  removed: string[];
  modified: string[];
  testCoverage?: string[]; // test IDs covering this
}

// Test failure details
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

See `/types.ts` for complete type definitions.

## API Routes

### Flaky Detection
```
GET /api/intelligence/flaky/:projectId
```
Returns: `FlakyTestReport` with flaky tests, trend, recommendations

### Test Prioritization
```
GET /api/intelligence/prioritize?projectId=:projectId
```
Returns: `TestPriority[]` ordered by risk score

### Auto-Fix Suggestions
```
POST /api/intelligence/auto-fix/:testId
Body: { testCode: string, failure: TestFailure }
```
Returns: `AutoFixSuggestion[]` ranked by confidence

### Apply Auto-Fix
```
POST /api/intelligence/auto-fix/:testId/apply
Body: { fixedCode: string, originalCode: string }
```
Returns: `ApplyResult`

### Failure Predictions
```
GET /api/intelligence/predict/:projectId
```
Returns: `PredictiveInsight[]` with failure predictions

### Project Health
```
GET /api/intelligence/health/:projectId
```
Returns: `TestHealthScore` with component scores and recommendations

### Trend Analysis
```
GET /api/intelligence/trends/:projectId?days=30
```
Returns: `TestTrend` with pass rate, flakiness, and execution time history

## Usage Examples

### Detect Flaky Tests
```typescript
const flakyReport = await flakyDetector.detectFlakyTests(
  'project-1',
  ['test-login', 'test-checkout', 'test-api'],
  testRunHistory
);

console.log(`${flakyReport.flakyTests.length} flaky tests detected`);
console.log(`Trend: ${flakyReport.trend}`);
```

### Prioritize Tests for CI
```typescript
const priorities = await testPrioritizer.prioritizeTests(
  allTestIds,
  recentCodeChanges,
  testRunHistory,
  testMetadata
);

// Run critical tests first
const criticalTests = priorities
  .filter(p => p.priority === 'critical')
  .map(p => p.testId);
```

### Get Auto-Fix Suggestions
```typescript
const suggestions = await autoFixEngine.suggestFixes(
  'test-login',
  testCode,
  {
    testId: 'test-login',
    failureMessage: 'Timeout: timed out waiting for locator',
    stackTrace: '...',
    environment: { os: 'linux', browser: 'chromium', node: '18' },
    timestamp: new Date()
  }
);

// Apply highest confidence fix
const bestFix = suggestions[0];
const result = await autoFixEngine.applyFix(
  'test-login',
  bestFix.suggestedCode,
  testCode
);
```

### Analyze Project Health
```typescript
const health = await predictiveAnalytics.getHealthScore(
  'project-1',
  testRunHistory
);

console.log(`Overall health: ${health.overallHealth}/100`);
console.log(`Recommendations: ${health.recommendations.join('\n')}`);
```

## Implementation Notes

### Weighted Moving Average
Recent runs are weighted more heavily (exponential decay) to emphasize current test behavior over historical patterns. This helps detect improvements or regressions quickly.

### Coefficient of Variation
Used to detect timing-related flakiness. High CV (duration varies significantly) suggests timeout-dependent tests.

### Pass/Fail Flip Rate
Measures how often test status changes between runs. High flip rate indicates a flaky test.

### Risk Score Composition
- Code changes that overlap with test coverage increase risk
- High historical failure rate increases risk
- Business critical tests weighted higher
- Recent runs emphasized more than overall history

### Confidence Scoring
Predictions have confidence scores based on:
- Sample size (more runs = higher confidence)
- Consistency of patterns (stable patterns = higher confidence)
- Data freshness (recent data = higher confidence)

## Performance Considerations

- Min 5 runs required for reliable flakiness detection
- Recent 30-day window analyzed for trends
- Weighted averaging reduces computational complexity
- Time series aggregated daily for trend analysis

## Future Enhancements

1. Machine learning for better pattern detection
2. Integration with CI/CD systems for automatic analysis
3. Custom threshold configuration per project
4. Visual regression detection
5. Load test failure prediction
6. Cross-browser flakiness analysis
