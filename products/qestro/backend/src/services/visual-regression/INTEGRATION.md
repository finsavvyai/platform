# Visual Regression Testing - Integration Guide

## Quick Start

### 1. Register Routes in Express App

In your main backend file (typically `src/app.ts` or `src/server.ts`):

```typescript
import visualRegressionRoutes from './routes/visual-regression.routes.js';

// Add to Express app
app.use('/api/visual', visualRegressionRoutes);
```

### 2. Install Dependencies

```bash
npm install playwright uuid
```

These should already be in your `package.json`, but verify:
```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "uuid": "^9.0.0",
    "express": "^4.18.0"
  }
}
```

### 3. Create Baseline Directory (Optional)

```bash
mkdir -p ./baselines
```

Or specify a custom path via environment variable:
```bash
export VISUAL_BASELINE_PATH=/var/qestro/baselines
```

## Usage in Test Execution Pipeline

### Integrate with Test Execution Engine

In `orchestrator/src/runners/playwright.ts` or your test runner:

```typescript
import { getVisualRegressionEngine } from '../../../backend/src/services/visual-regression/VisualRegressionEngine.js';

class PlaywrightTestRunner {
  private visualEngine = getVisualRegressionEngine();

  async executeTest(testCase: TestCase): Promise<TestResult> {
    // ... normal test execution ...

    // Capture visual checkpoints
    if (testCase.visualCheckpoints) {
      for (const checkpoint of testCase.visualCheckpoints) {
        const visualResult = await this.visualEngine.runVisualTest({
          projectId: testCase.projectId,
          url: this.currentUrl,
          baselineName: checkpoint.name,
          captureOptions: {
            waitSelector: checkpoint.waitSelector,
            waitTime: checkpoint.waitTime,
          },
          comparisonOptions: {
            threshold: checkpoint.threshold || 0.1,
          },
          createIfMissing: true,
        });

        testCase.visualResults = testCase.visualResults || [];
        testCase.visualResults.push(visualResult);

        if (!visualResult.comparison?.passed) {
          // Visual regression detected
          throw new Error(`Visual regression: ${checkpoint.name}`);
        }
      }
    }
  }
}
```

### Define Visual Checkpoints in Test Code

Users can add visual checks to their Playwright tests:

```typescript
// test-creation-flow.spec.ts
test('capture login page visual baseline', async ({ page }) => {
  await page.goto('https://app.example.com/login');
  await page.waitForLoadState('networkidle');

  // Request visual test via API
  const response = await fetch('http://localhost:3000/api/visual/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'proj-123',
      url: 'https://app.example.com/login',
      baselineName: 'login-page',
      captureOptions: {
        viewport: { width: 1280, height: 720 },
        waitTime: 500,
      },
      createIfMissing: true,
    }),
  });

  const result = await response.json();
  expect(result.success).toBe(true);
  expect(result.data.status).toMatch(/passed|baseline-created/);
});
```

## API Client Examples

### JavaScript/TypeScript Client

```typescript
class QestroVisualClient {
  constructor(private baseUrl: string, private authToken: string) {}

  async runTest(options: {
    projectId: string;
    url: string;
    baselineName: string;
  }) {
    const response = await fetch(`${this.baseUrl}/api/visual/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(options),
    });

    return response.json();
  }

  async runBatch(projectId: string, tests: Array<{ url: string; name: string }>) {
    const response = await fetch(`${this.baseUrl}/api/visual/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({ projectId, tests }),
    });

    return response.json();
  }

  async approveChange(resultId: string) {
    const response = await fetch(`${this.baseUrl}/api/visual/baselines/proj-123/${resultId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    return response.json();
  }

  async getDiffImage(resultId: string): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/api/visual/results/${resultId}/diff`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    return response.buffer();
  }
}

// Usage
const client = new QestroVisualClient('http://localhost:3000', process.env.AUTH_TOKEN);
const result = await client.runTest({
  projectId: 'proj-123',
  url: 'https://example.com',
  baselineName: 'homepage',
});
```

### cURL Examples

```bash
# Run single visual test
curl -X POST http://localhost:3000/api/visual/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "projectId": "proj-123",
    "url": "https://example.com",
    "baselineName": "homepage",
    "createIfMissing": true
  }'

# List baselines
curl http://localhost:3000/api/visual/baselines/proj-123 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Approve change
curl -X PUT http://localhost:3000/api/visual/baselines/proj-123/result-id/approve \
  -H "Authorization: Bearer YOUR_TOKEN"

# Download diff image
curl http://localhost:3000/api/visual/results/result-id/diff \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o diff.png
```

## Frontend Integration

### React Component for Baseline Approval

```typescript
// frontend/src/components/VisualRegressionResults.tsx
import { useState } from 'react';

interface VisualTestResult {
  id: string;
  testName: string;
  status: 'passed' | 'failed' | 'baseline-created';
  mismatchPercentage?: number;
  duration: number;
}

export function VisualRegressionResults({ result }: { result: VisualTestResult }) {
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await fetch(`/api/visual/baselines/proj-123/${result.id}/approve`, {
        method: 'PUT',
      });
      if (response.ok) {
        alert('Baseline updated');
      }
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="visual-test-result">
      <h3>{result.testName}</h3>
      <p>Status: <strong>{result.status}</strong></p>

      {result.status === 'failed' && (
        <>
          <p>Mismatch: <strong>{result.mismatchPercentage?.toFixed(2)}%</strong></p>
          <img src={`/api/visual/results/${result.id}/diff`} alt="Diff" />
          <button onClick={handleApprove} disabled={approving}>
            {approving ? 'Approving...' : 'Approve Changes'}
          </button>
        </>
      )}

      {result.status === 'baseline-created' && (
        <p className="info">New baseline created</p>
      )}

      <p className="muted">Duration: {result.duration}ms</p>
    </div>
  );
}
```

## Testing

### Unit Test Setup

Create `backend/__tests__/services/visual-regression.test.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ScreenshotService } from '../../src/services/visual-regression/ScreenshotService';
import { ImageComparator } from '../../src/services/visual-regression/ImageComparator';
import { BaselineManager } from '../../src/services/visual-regression/BaselineManager';

describe('Visual Regression Services', () => {
  describe('ScreenshotService', () => {
    it('should capture screenshot', async () => {
      const service = new ScreenshotService();
      // Note: requires running web server
      const screenshot = await service.captureScreenshot({
        url: 'https://example.com',
        viewport: { width: 1280, height: 720 },
        timeout: 10000,
      });

      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(0);
      expect(screenshot.slice(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); // PNG signature
    });
  });

  describe('ImageComparator', () => {
    it('should detect identical images as match', async () => {
      const comparator = new ImageComparator();
      const testImage = Buffer.from([
        // Simplified test image data (placeholder)
      ]);

      const result = await comparator.compareImages(testImage, testImage, {
        threshold: 0.1,
      });

      expect(result.mismatchCount).toBe(0);
      expect(result.passed).toBe(true);
    });
  });

  describe('BaselineManager', () => {
    it('should save and retrieve baseline', async () => {
      const manager = new BaselineManager({ basePath: './test-baselines' });
      const testScreenshot = Buffer.from('test-image-data');

      const baseline = await manager.saveBaseline('proj-123', 'test-page', testScreenshot);
      expect(baseline.id).toBeDefined();
      expect(baseline.metadata.version).toBe(1);

      const retrieved = await manager.getBaseline('proj-123', 'test-page');
      expect(retrieved).toEqual(testScreenshot);

      // Cleanup
      await manager.deleteBaseline('proj-123', baseline.id);
    });
  });
});
```

### E2E Test Setup

Create `tests/visual-regression.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Testing', () => {
  test('should create baseline on first run', async ({ request }) => {
    const response = await request.post('/api/visual/test', {
      data: {
        projectId: 'test-proj',
        url: 'https://example.com',
        baselineName: 'homepage',
        createIfMissing: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.data.status).toBe('baseline-created');
  });

  test('should detect visual changes', async ({ request, page }) => {
    // Run test twice, modify page between runs
    const firstRun = await request.post('/api/visual/test', {
      data: {
        projectId: 'test-proj',
        url: 'https://example.com',
        baselineName: 'homepage',
        createIfMissing: true,
      },
    });
    const firstResult = await firstRun.json();

    // Modify visual element
    await page.goto('https://example.com');
    await page.evaluate(() => {
      document.body.style.backgroundColor = 'red';
    });

    const secondRun = await request.post('/api/visual/test', {
      data: {
        projectId: 'test-proj',
        url: 'https://example.com',
        baselineName: 'homepage',
      },
    });
    const secondResult = await secondRun.json();

    expect(secondResult.data.status).toBe('failed');
    expect(secondResult.data.mismatchPercentage).toBeGreaterThan(0);
  });
});
```

## Performance Tuning

### Browser Pool Configuration

Adjust pool size based on your infrastructure:

```typescript
import { getScreenshotService } from './services/visual-regression/ScreenshotService';

// For small deployments (default)
const service = getScreenshotService({
  maxSize: 2,
  idleTimeout: 20000,
});

// For high-load deployments
const service = getScreenshotService({
  maxSize: 10,
  idleTimeout: 60000,
});
```

### Comparison Thresholds

Adjust sensitivity for different test types:

```typescript
// Strict comparison (pixel-perfect)
comparisonOptions: {
  threshold: 0.01, // 0.01% mismatch tolerance
  antiAlias: false,
}

// Lenient comparison (ignore minor rendering differences)
comparisonOptions: {
  threshold: 1.0, // 1% mismatch tolerance
  antiAlias: true,
  scale: 8, // higher sensitivity
}
```

## Troubleshooting

### Issue: Browser launch fails
**Solution**: Install system dependencies
```bash
npx playwright install
npx playwright install-deps
```

### Issue: Screenshots are blank/corrupted
**Solution**: Increase wait times
```typescript
captureOptions: {
  waitTime: 1000, // Wait 1 second after page load
  waitSelector: '.content-loaded', // Wait for specific element
}
```

### Issue: Memory usage grows over time
**Solution**: Ensure cleanup is called
```typescript
// On app shutdown
process.on('exit', async () => {
  const visualEngine = getVisualRegressionEngine();
  await visualEngine.cleanup();
});
```

### Issue: S3 uploads not working
**Solution**: Configure AWS credentials and enable S3
```bash
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export VISUAL_S3_ENABLED=true
export VISUAL_S3_BUCKET=my-bucket
export VISUAL_S3_REGION=us-east-1
```

## Monitoring & Logging

Check logs for visual regression operations:

```bash
# See all visual regression operations
grep "visual" backend/logs/*.log | grep -E "captured|comparison|baseline|approved"

# Monitor performance
grep "Image comparison complete" backend/logs/*.log | tail -10
```

## Security Notes

- All routes require `authenticateUser` middleware
- Baselines are stored in private directories
- Image downloads require authentication token
- No user data is logged in diff images
- Consider rate-limiting `/api/visual/batch` endpoint for production

## Next Steps

1. Integrate visual checks into your test definition editor
2. Add visual regression approval workflow to dashboard
3. Connect to CI/CD pipelines for automated checks
4. Set up baseline storage on S3/cloud provider
5. Create visual regression reports in test results UI
