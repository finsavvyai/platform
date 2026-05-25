# Comprehensive Testing Strategy

Complete testing approach for cloud platform, agent, and end-to-end workflows.

## Testing Overview

### Testing Pyramid
```
    E2E Tests (Slow, High Value)
         ↑
   Integration Tests (Medium)
         ↑
    Unit Tests (Fast, Low Cost)
```

### Test Categories
1. **Unit Tests** - Individual functions/components
2. **Integration Tests** - Service interactions
3. **API Tests** - REST/WebSocket endpoints
4. **Agent Tests** - Local agent functionality
5. **E2E Tests** - Full user workflows
6. **Performance Tests** - Load and stress testing
7. **Security Tests** - Authentication and authorization

## Backend Testing

### Unit Tests
```typescript
// backend/src/__tests__/services/RecordingService.test.ts
import { RecordingService } from '../../services/RecordingService.js';
import { jest } from '@jest/globals';

describe('RecordingService', () => {
  let recordingService: RecordingService;
  
  beforeEach(() => {
    recordingService = new RecordingService('./test-recordings');
  });
  
  afterEach(async () => {
    await recordingService.cleanup();
  });

  describe('startRecording', () => {
    it('should start a mobile recording session', async () => {
      const config = {
        type: 'mobile' as const,
        platform: 'ios',
        metadata: {
          deviceName: 'iPhone 15 Pro',
          appId: 'com.test.app'
        }
      };

      const session = await recordingService.startRecording(config);

      expect(session.id).toBeDefined();
      expect(session.type).toBe('mobile');
      expect(session.status).toBe('recording');
      expect(session.platform).toBe('ios');
    });

    it('should start a web recording session', async () => {
      const config = {
        type: 'web' as const,
        platform: 'chrome',
        metadata: {
          url: 'https://example.com',
          viewport: { width: 1920, height: 1080 }
        }
      };

      const session = await recordingService.startRecording(config);

      expect(session.type).toBe('web');
      expect(session.platform).toBe('chrome');
      expect(session.metadata.url).toBe('https://example.com');
    });

    it('should throw error for invalid configuration', async () => {
      const config = {
        type: 'invalid' as any,
        platform: 'unknown',
        metadata: {}
      };

      await expect(recordingService.startRecording(config))
        .rejects.toThrow();
    });
  });
});
```

### Integration Tests
```typescript
// backend/src/__tests__/integration/api.test.ts
import request from 'supertest';
import { app } from '../../app.js';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database.js';

describe('API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.token).toBeDefined();
    });

    it('should login existing user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });
  });

  describe('Recording API', () => {
    let authToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      authToken = loginResponse.body.token;
    });

    it('should start a recording session', async () => {
      const response = await request(app)
        .post('/api/recording/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'web',
          platform: 'chrome',
          metadata: {
            url: 'https://example.com'
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.session.id).toBeDefined();
      expect(response.body.session.status).toBe('recording');
    });
  });
});
```

## Frontend Testing

### Component Tests
```typescript
// frontend/src/components/__tests__/RecordingStudio.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingStudio } from '../RecordingStudio';
import { AuthProvider } from '../../contexts/AuthContext';
import { vi } from 'vitest';

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.WebSocket = vi.fn(() => mockWebSocket) as any;

describe('RecordingStudio', () => {
  const renderWithAuth = (component: React.ReactElement) => {
    return render(
      <AuthProvider>
        {component}
      </AuthProvider>
    );
  };

  it('should render recording controls', () => {
    renderWithAuth(<RecordingStudio />);
    
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
    expect(screen.getByText('Recording Type')).toBeInTheDocument();
  });

  it('should start recording when button clicked', async () => {
    renderWithAuth(<RecordingStudio />);
    
    const startButton = screen.getByText('Start Recording');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Stop Recording')).toBeInTheDocument();
    });
  });

  it('should display recording actions in real-time', async () => {
    renderWithAuth(<RecordingStudio />);
    
    // Simulate WebSocket message
    const messageHandler = mockWebSocket.addEventListener.mock.calls
      .find(call => call[0] === 'message')[1];
    
    messageHandler({
      data: JSON.stringify({
        type: 'action:recorded',
        action: {
          type: 'click',
          selector: '#button',
          timestamp: Date.now()
        }
      })
    });

    await waitFor(() => {
      expect(screen.getByText('click')).toBeInTheDocument();
      expect(screen.getByText('#button')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests with Playwright
```typescript
// e2e/tests/recording-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Recording Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create and execute a web recording', async ({ page }) => {
    // Navigate to recording studio
    await page.click('[data-testid=create-recording]');
    await expect(page).toHaveURL('/recording/new');

    // Configure recording
    await page.selectOption('[data-testid=recording-type]', 'web');
    await page.fill('[data-testid=target-url]', 'https://example.com');
    await page.click('[data-testid=start-recording]');

    // Wait for recording to start
    await expect(page.locator('[data-testid=recording-status]')).toHaveText('Recording');

    // Simulate some actions (this would be done in the target browser)
    await page.click('[data-testid=simulate-click]');
    await page.fill('[data-testid=simulate-input]', 'test input');

    // Stop recording
    await page.click('[data-testid=stop-recording]');

    // Verify recording was saved
    await expect(page.locator('[data-testid=recording-actions]')).toContainText('click');
    await expect(page.locator('[data-testid=recording-actions]')).toContainText('type');

    // Save recording
    await page.fill('[data-testid=recording-name]', 'My Test Recording');
    await page.click('[data-testid=save-recording]');

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid=recording-list]')).toContainText('My Test Recording');
  });

  test('should execute saved recording', async ({ page }) => {
    // Navigate to saved recording
    await page.click('[data-testid=recording-item]:first-child');
    await page.click('[data-testid=execute-recording]');

    // Wait for execution to complete
    await expect(page.locator('[data-testid=execution-status]')).toHaveText('Completed', { timeout: 30000 });

    // Verify results
    await expect(page.locator('[data-testid=execution-result]')).toHaveText('Passed');
    await expect(page.locator('[data-testid=execution-screenshots]')).toBeVisible();
  });
});
```

## Agent Testing

### Agent Unit Tests
```typescript
// agent/src/__tests__/AgentService.test.ts
import { QuestroAgent } from '../AgentService';
import { DeviceManager } from '../DeviceManager';
import { MaestroRunner } from '../MaestroRunner';

describe('QuestroAgent', () => {
  let agent: QuestroAgent;
  let mockDeviceManager: jest.Mocked<DeviceManager>;
  let mockMaestroRunner: jest.Mocked<MaestroRunner>;

  beforeEach(() => {
    mockDeviceManager = {
      scanDevices: jest.fn(),
      getConnectedDevices: jest.fn()
    } as any;

    mockMaestroRunner = {
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      executeTest: jest.fn()
    } as any;

    agent = new QuestroAgent(mockDeviceManager, mockMaestroRunner);
  });

  it('should connect to cloud successfully', async () => {
    const connectSpy = jest.spyOn(agent, 'connectToCloud');
    
    await agent.start();
    
    expect(connectSpy).toHaveBeenCalled();
    expect(mockDeviceManager.scanDevices).toHaveBeenCalled();
  });

  it('should handle recording start command', async () => {
    const mockRecording = { id: 'rec-123', status: 'recording' };
    mockMaestroRunner.startRecording.mockResolvedValue(mockRecording);

    await agent.handleCloudMessage({
      type: 'START_RECORDING',
      payload: {
        sessionId: 'session-123',
        deviceId: 'device-123',
        appId: 'com.test.app'
      }
    });

    expect(mockMaestroRunner.startRecording).toHaveBeenCalledWith({
      deviceId: 'device-123',
      appId: 'com.test.app',
      outputFormat: 'yaml'
    });
  });
});
```

## Performance Testing

### Load Testing with Artillery
```yaml
# performance/load-test.yml
config:
  target: 'https://api.questro.app'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  variables:
    testEmail: 'load-test-{{ $randomString() }}@example.com'
    testPassword: 'password123'

scenarios:
  - name: 'User Registration and Recording'
    weight: 70
    flow:
      - post:
          url: '/api/auth/register'
          json:
            email: '{{ testEmail }}'
            password: '{{ testPassword }}'
            name: 'Load Test User'
          capture:
            - json: '$.token'
              as: 'authToken'
      
      - post:
          url: '/api/recording/start'
          headers:
            Authorization: 'Bearer {{ authToken }}'
          json:
            type: 'web'
            platform: 'chrome'
            metadata:
              url: 'https://example.com'
          capture:
            - json: '$.session.id'
              as: 'sessionId'
      
      - think: 5
      
      - post:
          url: '/api/recording/stop'
          headers:
            Authorization: 'Bearer {{ authToken }}'
          json:
            sessionId: '{{ sessionId }}'

  - name: 'API Health Check'
    weight: 30
    flow:
      - get:
          url: '/api/health'
```

### Stress Testing
```typescript
// performance/stress-test.ts
import { performance } from 'perf_hooks';
import axios from 'axios';

interface StressTestConfig {
  baseUrl: string;
  concurrentUsers: number;
  testDuration: number; // seconds
  rampUpTime: number; // seconds
}

class StressTest {
  private config: StressTestConfig;
  private results: TestResult[] = [];

  constructor(config: StressTestConfig) {
    this.config = config;
  }

  async run(): Promise<StressTestResults> {
    console.log(`Starting stress test with ${this.config.concurrentUsers} concurrent users`);
    
    const promises: Promise<void>[] = [];
    const startTime = performance.now();

    // Ramp up users gradually
    for (let i = 0; i < this.config.concurrentUsers; i++) {
      const delay = (i / this.config.concurrentUsers) * this.config.rampUpTime * 1000;
      
      promises.push(
        new Promise(resolve => {
          setTimeout(() => {
            this.simulateUser(i).finally(resolve);
          }, delay);
        })
      );
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return this.analyzeResults(totalTime);
  }

  private async simulateUser(userId: number): Promise<void> {
    const userResults: TestResult[] = [];
    const endTime = Date.now() + (this.config.testDuration * 1000);

    while (Date.now() < endTime) {
      try {
        // Register user
        const registerStart = performance.now();
        const registerResponse = await axios.post(`${this.config.baseUrl}/api/auth/register`, {
          email: `stress-test-${userId}-${Date.now()}@example.com`,
          password: 'password123',
          name: `Stress Test User ${userId}`
        });
        const registerEnd = performance.now();

        userResults.push({
          operation: 'register',
          duration: registerEnd - registerStart,
          success: registerResponse.status === 201,
          statusCode: registerResponse.status
        });

        const token = registerResponse.data.token;

        // Start recording
        const recordingStart = performance.now();
        const recordingResponse = await axios.post(
          `${this.config.baseUrl}/api/recording/start`,
          {
            type: 'web',
            platform: 'chrome',
            metadata: { url: 'https://example.com' }
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const recordingEnd = performance.now();

        userResults.push({
          operation: 'start_recording',
          duration: recordingEnd - recordingStart,
          success: recordingResponse.status === 201,
          statusCode: recordingResponse.status
        });

        // Wait a bit then stop recording
        await new Promise(resolve => setTimeout(resolve, 2000));

        const stopStart = performance.now();
        const stopResponse = await axios.post(
          `${this.config.baseUrl}/api/recording/stop`,
          { sessionId: recordingResponse.data.session.id },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const stopEnd = performance.now();

        userResults.push({
          operation: 'stop_recording',
          duration: stopEnd - stopStart,
          success: stopResponse.status === 200,
          statusCode: stopResponse.status
        });

      } catch (error) {
        userResults.push({
          operation: 'error',
          duration: 0,
          success: false,
          statusCode: error.response?.status || 0,
          error: error.message
        });
      }

      // Wait before next iteration
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.results.push(...userResults);
  }

  private analyzeResults(totalTime: number): StressTestResults {
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const durations = this.results.filter(r => r.success).map(r => r.duration);
    const avgResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxResponseTime = Math.max(...durations);
    const minResponseTime = Math.min(...durations);

    // Calculate percentiles
    const sortedDurations = durations.sort((a, b) => a - b);
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)];

    const requestsPerSecond = totalRequests / (totalTime / 1000);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: (successfulRequests / totalRequests) * 100,
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      requestsPerSecond,
      totalTime,
      errors: this.results.filter(r => !r.success).map(r => r.error).filter(Boolean)
    };
  }
}

// Run stress test
const stressTest = new StressTest({
  baseUrl: 'https://api.questro.app',
  concurrentUsers: 100,
  testDuration: 300, // 5 minutes
  rampUpTime: 60 // 1 minute ramp up
});

stressTest.run().then(results => {
  console.log('Stress Test Results:', results);
}).catch(error => {
  console.error('Stress test failed:', error);
});
```

## Security Testing

### Authentication Tests
```typescript
// security/auth-security.test.ts
import request from 'supertest';
import { app } from '../src/app';

describe('Authentication Security', () => {
  describe('JWT Token Security', () => {
    it('should reject requests with invalid tokens', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject requests with expired tokens', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Expired token
      
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should reject requests without tokens', async () => {
      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject SQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin'; DROP TABLE users; --",
          password: 'password'
        });

      expect(response.status).toBe(400);
    });

    it('should reject XSS attempts', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: '<script>alert("xss")</script>'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
```

## Test Automation and CI/CD

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: questro_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        npm ci
        cd backend && npm ci
        cd ../frontend && npm ci
        cd ../agent && npm ci
    
    - name: Run backend tests
      run: cd backend && npm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/questro_test
    
    - name: Run frontend tests
      run: cd frontend && npm test
    
    - name: Run agent tests
      run: cd agent && npm test

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run integration tests
      run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright
      run: npx playwright install
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install Artillery
      run: npm install -g artillery
    
    - name: Run load tests
      run: artillery run performance/load-test.yml
```

## Test Data Management

### Test Database Setup
```typescript
// backend/src/__tests__/helpers/database.ts
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let testPool: Pool;

export async function setupTestDatabase(): Promise<void> {
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/questro_test'
  });

  // Run schema
  const schema = readFileSync(join(__dirname, '../../schema.sql'), 'utf8');
  await testPool.query(schema);

  // Insert test data
  await seedTestData();
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.query('TRUNCATE TABLE users, recordings, sessions CASCADE');
    await testPool.end();
  }
}

export async function seedTestData(): Promise<void> {
  // Insert test users
  await testPool.query(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES 
      ('test@example.com', '$2b$10$hash', 'Test User', 'user'),
      ('admin@example.com', '$2b$10$hash', 'Admin User', 'admin')
  `);

  // Insert test recordings
  await testPool.query(`
    INSERT INTO recordings (user_id, name, type, platform, metadata)
    VALUES 
      ((SELECT id FROM users WHERE email = 'test@example.com'), 'Test Recording', 'web', 'chrome', '{}')
  `);
}

export function getTestPool(): Pool {
  return testPool;
}
```

## Test Reporting and Analytics

### Test Results Dashboard
```typescript
// scripts/test-reporter.ts
import { writeFileSync } from 'fs';
import { join } from 'path';

interface TestResults {
  unit: TestSuiteResult;
  integration: TestSuiteResult;
  e2e: TestSuiteResult;
  performance: PerformanceTestResult;
}

interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: CoverageResult;
}

class TestReporter {
  generateReport(results: TestResults): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(results),
      details: results,
      recommendations: this.generateRecommendations(results)
    };

    // Save to file
    writeFileSync(
      join(process.cwd(), 'test-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate HTML report
    this.generateHTMLReport(report);

    console.log('Test Report Generated:', report.summary);
  }

  private generateSummary(results: TestResults) {
    const totalTests = results.unit.total + results.integration.total + results.e2e.total;
    const totalPassed = results.unit.passed + results.integration.passed + results.e2e.passed;
    const totalFailed = results.unit.failed + results.integration.failed + results.e2e.failed;

    return {
      totalTests,
      totalPassed,
      totalFailed,
      successRate: (totalPassed / totalTests) * 100,
      overallStatus: totalFailed === 0 ? 'PASSED' : 'FAILED'
    };
  }

  private generateRecommendations(results: TestResults): string[] {
    const recommendations: string[] = [];

    if (results.unit.coverage && results.unit.coverage.percentage < 80) {
      recommendations.push('Increase unit test coverage to at least 80%');
    }

    if (results.e2e.failed > 0) {
      recommendations.push('Fix failing E2E tests before deployment');
    }

    if (results.performance.avgResponseTime > 1000) {
      recommendations.push('Optimize API response times');
    }

    return recommendations;
  }

  private generateHTMLReport(report: any): void {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Questro Test Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Questro Test Report</h1>
      <div class="summary">
        <h2>Summary</h2>
        <p>Status: <span class="${report.summary.overallStatus.toLowerCase()}">${report.summary.overallStatus}</span></p>
        <p>Total Tests: ${report.summary.totalTests}</p>
        <p>Passed: <span class="passed">${report.summary.totalPassed}</span></p>
        <p>Failed: <span class="failed">${report.summary.totalFailed}</span></p>
        <p>Success Rate: ${report.summary.successRate.toFixed(2)}%</p>
      </div>
      
      <div class="section">
        <h2>Test Results</h2>
        <table>
          <tr><th>Suite</th><th>Total</th><th>Passed</th><th>Failed</th><th>Duration</th></tr>
          <tr><td>Unit Tests</td><td>${report.details.unit.total}</td><td>${report.details.unit.passed}</td><td>${report.details.unit.failed}</td><td>${report.details.unit.duration}ms</td></tr>
          <tr><td>Integration Tests</td><td>${report.details.integration.total}</td><td>${report.details.integration.passed}</td><td>${report.details.integration.failed}</td><td>${report.details.integration.duration}ms</td></tr>
          <tr><td>E2E Tests</td><td>${report.details.e2e.total}</td><td>${report.details.e2e.passed}</td><td>${report.details.e2e.failed}</td><td>${report.details.e2e.duration}ms</td></tr>
        </table>
      </div>
      
      <div class="section">
        <h2>Recommendations</h2>
        <ul>
          ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
      </div>
    </body>
    </html>
    `;

    writeFileSync(join(process.cwd(), 'test-report.html'), html);
  }
}

export { TestReporter };
```

This comprehensive testing strategy ensures that Questro maintains high quality across all components while providing fast feedback to developers and reliable deployments to production.