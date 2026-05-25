# Test Intelligence Engine - Integration Guide

## Setup Instructions

### 1. Mount Routes in Express App

In your main `server.ts` or `app.ts`:

```typescript
import testIntelligenceRoutes from './routes/test-intelligence.routes.js';

// Mount routes
app.use('/api/intelligence', testIntelligenceRoutes);
```

### 2. Database Schema

Add to your Drizzle schema to persist test data:

```typescript
import { pgTable, text, integer, timestamp, json } from 'drizzle-orm/pg-core';

export const testRuns = pgTable('test_runs', {
  id: text().primaryKey(),
  testId: text().notNull(),
  projectId: text().notNull(),
  status: text().$type<'pass' | 'fail' | 'skip'>().notNull(),
  duration: integer().notNull(),
  errorMessage: text(),
  screenshot: text(),
  executedAt: timestamp().notNull().defaultNow(),
  environment: json().$type<{
    os: string;
    browser?: string;
    node: string;
  }>(),
});

export const testMetadata = pgTable('test_metadata', {
  testId: text().primaryKey(),
  projectId: text().notNull(),
  name: text().notNull(),
  executionTime: integer().default(5000),
  businessCritical: integer().default(0),
});

export const codeChanges = pgTable('code_changes', {
  id: text().primaryKey(),
  projectId: text().notNull(),
  filePath: text().notNull(),
  added: json().$type<string[]>().default([]),
  removed: json().$type<string[]>().default([]),
  modified: json().$type<string[]>().default([]),
  testCoverage: json().$type<string[]>(),
  createdAt: timestamp().defaultNow(),
});
```

### 3. Create Service Layer

Wrap test intelligence in a service that handles database queries:

```typescript
import { db } from '../db.js';
import { testRuns, testMetadata } from '../schema.js';
import { FlakyDetector } from './test-intelligence/FlakyDetector.js';
import { TestRun } from './test-intelligence/types.js';

export class TestIntelligenceService {
  private flakyDetector = new FlakyDetector();

  async loadTestRunHistory(
    projectId: string
  ): Promise<Map<string, TestRun[]>> {
    const runs = await db
      .select()
      .from(testRuns)
      .where(eq(testRuns.projectId, projectId));

    const history = new Map<string, TestRun[]>();
    for (const run of runs) {
      if (!history.has(run.testId)) {
        history.set(run.testId, []);
      }
      history.get(run.testId)!.push({
        runId: run.id,
        testId: run.testId,
        status: run.status,
        duration: run.duration,
        errorMessage: run.errorMessage || undefined,
        executedAt: run.executedAt,
      });
    }
    return history;
  }

  async detectFlakyTests(projectId: string) {
    const testIds = await this.getProjectTestIds(projectId);
    const history = await this.loadTestRunHistory(projectId);

    return this.flakyDetector.detectFlakyTests(
      projectId,
      testIds,
      history
    );
  }

  private async getProjectTestIds(projectId: string): Promise<string[]> {
    const metadata = await db
      .select()
      .from(testMetadata)
      .where(eq(testMetadata.projectId, projectId));

    return metadata.map(m => m.testId);
  }
}
```

### 4. Update Routes to Use Service

```typescript
import { TestIntelligenceService } from '../services/TestIntelligenceService.js';

const intelligenceService = new TestIntelligenceService();

router.get('/flaky/:projectId', async (req, res) => {
  const report = await intelligenceService.detectFlakyTests(
    req.params.projectId
  );
  res.json(report);
});
```

### 5. Record Test Runs

When a test completes, save the run:

```typescript
import { testRuns } from '../schema.js';
import { randomUUID } from 'crypto';

async function recordTestRun(
  projectId: string,
  testId: string,
  result: {
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    errorMessage?: string;
    screenshot?: Buffer;
  }
) {
  await db.insert(testRuns).values({
    id: randomUUID(),
    projectId,
    testId,
    status: result.status,
    duration: result.duration,
    errorMessage: result.errorMessage,
    executedAt: new Date(),
    environment: {
      os: process.platform,
      node: process.version,
      browser: process.env.BROWSER || 'unknown',
    },
  });
}
```

### 6. Connect to Orchestrator

Integrate with test execution pipeline:

```typescript
import { TestIntelligenceService } from '../services/TestIntelligenceService.js';

async function runTestsWithIntelligence(
  projectId: string,
  allTests: string[]
) {
  const intelligenceService = new TestIntelligenceService();

  // Get prioritized test order
  const priorities = await intelligenceService.prioritizeTests(projectId, allTests);

  // Run tests in priority order
  for (const priority of priorities) {
    console.log(
      `Running ${priority.testName} (priority: ${priority.priority})`
    );

    const result = await runTest(priority.testId);

    // Record run
    await recordTestRun(projectId, priority.testId, result);
  }

  // Analyze results
  const flakyReport = await intelligenceService.detectFlakyTests(projectId);
  const predictions = await intelligenceService.predictFailures(projectId);

  return {
    flakyTests: flakyReport.flakyTests,
    predictions,
  };
}
```

## Frontend Integration

### Display Flaky Tests Dashboard

```typescript
// Frontend component example
import { useEffect, useState } from 'react';

export function FlakyTestsDashboard({ projectId }: { projectId: string }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch(`/api/intelligence/flaky/${projectId}`)
      .then(r => r.json())
      .then(setReport);
  }, [projectId]);

  if (!report) return <div>Loading...</div>;

  return (
    <div>
      <h2>Flaky Tests: {report.flakyTests.length}</h2>
      <p>Trend: {report.trend}</p>

      {report.flakyTests.map(test => (
        <div key={test.testId}>
          <h3>{test.testName}</h3>
          <p>Flakiness Score: {test.flakinessScore}/100</p>
          <p>Pattern: {test.failurePattern.type}</p>
          <p>{test.recommendedAction}</p>
        </div>
      ))}
    </div>
  );
}
```

### Display Health Score

```typescript
export function ProjectHealth({ projectId }: { projectId: string }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(`/api/intelligence/health/${projectId}`)
      .then(r => r.json())
      .then(setHealth);
  }, [projectId]);

  if (!health) return null;

  const getColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };

  return (
    <div>
      <h2>Project Health: <span style={{ color: getColor(health.overallHealth) }}>
        {health.overallHealth}/100
      </span></h2>

      <div>Flakiness: {health.flakinessScore}/100</div>
      <div>Coverage: {health.coverageScore}/100</div>
      <div>Speed: {health.executionTimeScore}/100</div>

      <h3>Recommendations:</h3>
      <ul>
        {health.recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
    </div>
  );
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Intelligence Analysis

on: [pull_request, push]

jobs:
  test-intelligence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests
        run: npm test
        continue-on-error: true

      - name: Upload test results
        run: |
          curl -X POST http://localhost:3000/api/intelligence/projects/${{ github.event.repository.name }}/run \
            -H "Content-Type: application/json" \
            -d @test-results.json

      - name: Get flaky tests
        run: |
          curl http://localhost:3000/api/intelligence/flaky/${{ github.event.repository.name }} \
            | jq . > flaky-report.json

      - name: Comment on PR
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('flaky-report.json'));
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Test Intelligence Report\n\n**Flaky Tests:** ${report.flakyTests.length}\n**Trend:** ${report.trend}`
            });
```

### GitLab CI Example

```yaml
test-intelligence:
  script:
    - npm test
  after_script:
    - curl -X POST http://localhost:3000/api/intelligence/projects/$CI_PROJECT_NAME/run -d @test-results.json
  artifacts:
    reports:
      junit: test-results.xml
```

## Monitoring & Debugging

### Enable Verbose Logging

```typescript
// Add to services
class FlakyDetector {
  private debug = process.env.DEBUG_INTELLIGENCE === 'true';

  detectFlakyTests(...) {
    if (this.debug) {
      console.log('Analyzing flakiness for tests:', testIds);
      console.log('Historical runs available:', testRunHistory.size);
    }
    // ...
  }
}
```

### Health Checks

```typescript
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    services: {
      flakyDetector: true,
      testPrioritizer: true,
      autoFixEngine: true,
      predictiveAnalytics: true,
    },
  });
});
```

## Performance Optimization

### Cache Results

```typescript
const cache = new Map<string, { data: any; expiry: number }>();

async function getCachedFlaky(projectId: string) {
  const cached = cache.get(`flaky-${projectId}`);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const data = await flakyDetector.detectFlakyTests(...);
  cache.set(`flaky-${projectId}`, {
    data,
    expiry: Date.now() + 5 * 60 * 1000, // 5 minute TTL
  });

  return data;
}
```

### Batch Processing

```typescript
async function analyzeMultipleProjects(projectIds: string[]) {
  return Promise.all(
    projectIds.map(projectId =>
      intelligenceService.detectFlakyTests(projectId)
    )
  );
}
```

## Troubleshooting

### Issue: Not enough data for predictions
**Solution:** Minimum 5 runs required per test. Ensure tests are executed regularly.

### Issue: High false positive rate
**Solution:** Adjust confidence thresholds in type definitions or add more historical data.

### Issue: Slow analysis
**Solution:** Implement caching, reduce historical window, or use batch processing.

## Next Steps

1. Set up database schema and migrations
2. Create TestIntelligenceService wrapper
3. Integrate with test execution pipeline
4. Add frontend dashboard components
5. Enable CI/CD integrations
6. Monitor and tune thresholds
