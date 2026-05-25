# 🧪 FinSavvyAI Testing Guide

## Overview

FinSavvyAI uses Playwright for functional testing of the cluster API, CLI, and desktop app.

## Setup

### Install Dependencies
```bash
npm install
npx playwright install
```

### Start Services
Before running tests, start the cluster:
```bash
./start_cluster.sh
```

Or start services individually:
```bash
./start_master.sh &
./start_worker.sh &
./start_gateway.sh &
```

## Running Tests

### Run All Tests
```bash
npm test
# or
./tests/run_tests.sh
```

### Run Specific Test Suite
```bash
# API tests only
npx playwright test tests/functional/cluster-api.spec.js

# CLI tests only
npx playwright test tests/functional/cli.spec.js

# Desktop app tests only
npx playwright test tests/functional/desktop-app.spec.js
```

### Run with UI
```bash
npm run test:ui
```

### Run in Headed Mode
```bash
npm run test:headed
```

### Debug Tests
```bash
npm run test:debug
```

### View Test Report
```bash
npm run test:report
```

## Test Suites

### 1. Cluster API Tests (`cluster-api.spec.js`)
Tests the core cluster functionality:
- Master server health checks
- Cluster status endpoints
- Node management
- Worker node operations
- API Gateway routing
- Chat completions
- Node registration
- Heartbeat mechanism

### 2. CLI Tests (`cli.spec.js`)
Tests the command-line interface:
- Help command
- Cluster status commands
- Service status
- Version information

### 3. Desktop App Tests (`desktop-app.spec.js`)
Tests the desktop application:
- App loading
- Navigation
- Cluster status display
- API connections

## Test Configuration

Configuration is in `tests/playwright.config.js`:
- Base URL: `http://localhost:8080`
- Browsers: Chromium, Firefox, WebKit
- Retries: 2 in CI, 0 locally
- Screenshots: On failure
- Videos: Retained on failure

## Continuous Integration

Tests are configured to run in CI environments:
- Automatic retries on failure
- Single worker for stability
- HTML report generation
- Artifact collection

## Writing New Tests

### Example Test
```javascript
const { test, expect } = require('@playwright/test');

test('My new test', async ({ request }) => {
  const response = await request.get('http://localhost:8000/health');
  expect(response.ok()).toBeTruthy();
  
  const data = await response.json();
  expect(data.status).toBe('healthy');
});
```

### Best Practices
1. Use descriptive test names
2. Test one thing per test
3. Clean up after tests
4. Use appropriate timeouts
5. Handle async operations properly

## Troubleshooting

### Tests Fail Because Services Aren't Running
```bash
# Start services first
./start_cluster.sh
```

### Port Conflicts
```bash
# Check what's using ports
lsof -i :8000
lsof -i :8001
lsof -i :8080

# Kill processes if needed
pkill -f start_master.py
pkill -f worker_node.py
```

### Playwright Not Installed
```bash
npx playwright install
```

### Browser Issues
```bash
# Reinstall browsers
npx playwright install --force
```

## Test Coverage

Current test coverage:
- ✅ Master server API
- ✅ Worker node API
- ✅ API Gateway
- ✅ CLI commands
- ✅ Desktop app UI
- ✅ Node registration
- ✅ Heartbeat mechanism
- ✅ Chat completions

## Adding More Tests

To add new tests:
1. Create test file in `tests/functional/`
2. Follow existing test patterns
3. Add to appropriate test suite
4. Update this guide

## Performance Testing

For performance tests, use:
```bash
npx playwright test --grep "performance"
```

## Visual Regression Testing

For visual tests:
```bash
npx playwright test --grep "visual"
```

