# Cross-Browser Test Matrix

## Overview

The Browser Matrix Engine enables comprehensive cross-browser testing by executing tests across multiple browser types and device configurations in parallel, ensuring consistent behavior across platforms.

## Architecture

### Core Components

1. **BrowserMatrixEngine** (182 lines) — Main orchestrator
   - Creates matrix entries from browsers and device presets
   - Orchestrates parallel test execution
   - Generates summary reports
   - Tracks pass/fail rates and failure details

2. **DevicePresets** (133 lines) — Device configuration library
   - 18 pre-configured device profiles
   - Desktop: Full HD, HD, WXGA, 4K
   - Tablet: iPad, iPad Pro, Samsung Tab S7
   - Mobile: iPhone 15, iPhone 14 Pro, Pixel 8, Galaxy S24, Galaxy A50
   - Each profile includes viewport, user agent, device scale factor

3. **Routes** (131 lines) — Express.js API endpoints
   - POST /api/browser-matrix/run — Execute test matrix
   - GET /api/browser-matrix/results/:id — Get matrix results
   - GET /api/browser-matrix/devices — List device presets
   - GET /api/browser-matrix/browsers — List supported browsers

## Device Presets

### Desktop Presets

| Name | Width | Height | Scale |
|------|-------|--------|-------|
| Desktop Full HD | 1920 | 1080 | 1.0 |
| Desktop HD | 1440 | 900 | 1.0 |
| Desktop WXGA | 1366 | 768 | 1.0 |
| Desktop 4K | 3840 | 2160 | 1.0 |

### Tablet Presets

| Name | Width | Height | Scale | Touch |
|------|-------|--------|-------|-------|
| iPad (5th Gen) | 768 | 1024 | 2.0 | Yes |
| iPad Pro | 1024 | 1366 | 2.0 | Yes |
| Samsung Galaxy Tab S7 | 800 | 1280 | 2.0 | Yes |

### Mobile Presets

| Name | Width | Height | Scale | Touch |
|------|-------|--------|-------|-------|
| iPhone 15 | 393 | 852 | 3.0 | Yes |
| iPhone 14 Pro | 390 | 844 | 3.0 | Yes |
| Google Pixel 8 | 412 | 915 | 2.75 | Yes |
| Samsung Galaxy S24 | 360 | 800 | 3.0 | Yes |
| Samsung Galaxy A50 | 360 | 800 | 2.0 | Yes |

## Usage Example

### Creating and Running a Matrix

```bash
curl -X POST http://localhost:8000/api/browser-matrix/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token" \
  -d '{
    "testId": "550e8400-e29b-41d4-a716-446655440000",
    "projectId": "550e8400-e29b-41d4-a716-446655440001",
    "browsers": [
      { "type": "chromium" },
      { "type": "firefox" },
      { "type": "webkit" }
    ],
    "devicePresets": [
      "desktop-fullhd",
      "mobile-iphone15",
      "tablet-ipad"
    ],
    "parallel": true,
    "maxConcurrency": 4,
    "timeoutMs": 30000
  }'
```

Response:
```json
{
  "totalEntries": 9,
  "passedEntries": 8,
  "failedEntries": 1,
  "skippedEntries": 0,
  "passRate": 88.89,
  "totalDurationMs": 45000,
  "startTime": 1712500000000,
  "endTime": 1712500045000,
  "failureDetails": [
    {
      "browser": "firefox",
      "error": "Element not found after 5 seconds"
    }
  ],
  "results": [
    {
      "entryId": "entry_1",
      "testId": "550e8400-e29b-41d4-a716-446655440000",
      "browser": "chromium",
      "deviceName": "desktop-fullhd",
      "viewport": { "width": 1920, "height": 1080 },
      "startTime": 1712500000000,
      "endTime": 1712500005000,
      "durationMs": 5000,
      "passed": true,
      "status": "passed",
      "screenshotPath": "/screenshots/entry_1.png",
      "logs": [
        "Navigating to test URL with chromium on desktop-fullhd",
        "Executing test steps...",
        "Test passed"
      ],
      "assertions": [
        {
          "name": "Page title visible",
          "expected": true,
          "actual": true,
          "passed": true
        }
      ]
    }
  ]
}
```

### Getting Device Presets

```bash
curl -X GET http://localhost:8000/api/browser-matrix/devices \
  -H "Authorization: Bearer token"
```

Response:
```json
{
  "devices": [
    {
      "id": "desktop-fullhd",
      "name": "Desktop Full HD",
      "type": "desktop",
      "viewport": { "width": 1920, "height": 1080 },
      "isMobile": false,
      "hasTouch": false
    },
    {
      "id": "mobile-iphone15",
      "name": "iPhone 15",
      "type": "mobile",
      "viewport": { "width": 393, "height": 852 },
      "isMobile": true,
      "hasTouch": true
    }
  ],
  "total": 18
}
```

### Getting Supported Browsers

```bash
curl -X GET http://localhost:8000/api/browser-matrix/browsers \
  -H "Authorization: Bearer token"
```

Response:
```json
{
  "browsers": [
    {
      "type": "chromium",
      "name": "Google Chrome",
      "versions": ["latest", "119", "118", "117"]
    },
    {
      "type": "firefox",
      "name": "Mozilla Firefox",
      "versions": ["latest", "120", "119", "118"]
    },
    {
      "type": "webkit",
      "name": "Safari",
      "versions": ["latest", "17", "16", "15"]
    }
  ]
}
```

## Matrix Execution

### Matrix Creation Algorithm

For each browser × device combination:
1. Create matrix entry with unique ID
2. Apply device preset configuration to browser
3. Store entry in execution queue

Example: 3 browsers × 3 device presets = 9 entries

### Parallel Execution

- Concurrent workers process matrix entries
- Default max concurrency: 4
- Configurable per request
- Each entry runs in isolated context

### Result Collection

Each matrix entry produces:
- Browser type and version
- Device preset name and viewport
- Execution time (start, end, duration)
- Pass/fail status
- Error messages and logs
- Screenshot paths
- Assertion results

## Implementation Notes

### Virtual User Management

The matrix engine:
- Creates execution plan upfront (deterministic)
- Assigns entries to worker threads
- Collects results in order
- Generates summary report

### Device Emulation

Device presets include:
- **viewport**: Browser window dimensions
- **userAgent**: Custom user agent string
- **deviceScaleFactor**: Device pixel ratio
- **isMobile**: Mobile-specific behaviors
- **hasTouch**: Touch event support

### Failure Handling

Failures are captured and categorized:
- Browser-specific failures
- Device-specific failures
- Timeout failures
- Assertion failures

### Result Aggregation

Summary includes:
- Total entries (count)
- Pass/fail/skip counts
- Overall pass rate (%)
- Total execution time
- Failure details with browser info

## API Contracts

### CreateMatrix Request

```typescript
interface MatrixRequest {
  testId: string;                    // UUID of test
  projectId: string;                 // UUID of project
  userId: string;                    // UUID of user
  browsers: BrowserConfig[];         // Browser configurations
  devicePresets?: string[];          // Device preset IDs
  parallel?: boolean;                // Default: true
  maxConcurrency?: number;           // Default: 4
  timeoutMs?: number;                // Timeout per entry
}
```

### MatrixResult Entry

```typescript
interface MatrixResult {
  entryId: string;
  testId: string;
  browser: BrowserType;
  deviceName?: string;
  viewport?: ViewportSize;
  startTime: number;
  endTime: number;
  durationMs: number;
  passed: boolean;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  screenshotPath?: string;
  errorMessage?: string;
  logs?: string[];
  assertions?: AssertionResult[];
}
```

## Future Enhancements

- Cloud device farm integration (BrowserStack, Sauce Labs)
- Visual regression detection across browsers
- Performance metrics per browser
- Custom device profile creation
- Headless mode configuration
- Network throttling profiles
- Geolocation simulation
- Cookie/storage management
- Authentication flow support across browsers
