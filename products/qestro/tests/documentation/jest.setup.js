/**
 * Jest Setup for Documentation Tests
 *
 * Global setup and configuration for documentation testing.
 */

// Set global test timeout for documentation tests
jest.setTimeout(60000);

// Global test configuration
global.DOCUMENTATION_TEST_CONFIG = {
  // Timeout settings
  LINK_VALIDATION_TIMEOUT: 10000,
  FILE_READ_TIMEOUT: 5000,
  EXTERNAL_REQUEST_TIMEOUT: 15000,

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,

  // Performance thresholds
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_LINK_VALIDATION_TIME: 30000, // 30s
  MAX_PROCESSING_TIME_PER_FILE: 5000, // 5s per file

  // Skip settings
  SKIP_EXTERNAL_LINKS: process.env.SKIP_EXTERNAL_LINKS === 'true',
  SKIP_SLOW_TESTS: process.env.SKIP_SLOW_TESTS === 'true',

  // CI/CD detection
  IS_CI: process.env.CI === 'true',
  IS_GITHUB_ACTIONS: process.env.GITHUB_ACTIONS === 'true',

  // Reporting
  GENERATE_DETAILED_REPORTS: process.env.GENERATE_DETAILED_REPORTS !== 'false',

  // Security settings
  SECURITY_SCAN_LEVEL: process.env.SECURITY_SCAN_LEVEL || 'standard',

  // Performance settings
  PARALLEL_PROCESSING: process.env.PARALLEL_PROCESSING !== 'false',
  MAX_PARALLEL_TESTS: parseInt(process.env.MAX_PARALLEL_TESTS || '5', 10)
};

// Mock fetch for external link testing
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console warnings in CI unless debugging
  if (process.env.CI === 'true' && process.env.DEBUG_DOCUMENTATION_TESTS !== 'true') {
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Add custom matchers for documentation testing
expect.extend({
  toBeValidDocumentation(received) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be a valid documentation object`,
        pass: false
      };
    }

    const hasRequiredFields = received.content &&
                            received.metadata &&
                            received.path;

    return {
      message: () => hasRequiredFields
        ? `Expected ${received} not to be a valid documentation object`
        : `Expected ${received} to be a valid documentation object with required fields`,
      pass: hasRequiredFields
    };
  },

  toBeValidLink(received) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be a valid link object`,
        pass: false
      };
    }

    const hasRequiredFields = received.url &&
                            typeof received.url === 'string' &&
                            received.type &&
                            ['internal', 'external'].includes(received.type);

    return {
      message: () => hasRequiredFields
        ? `Expected ${received} not to be a valid link object`
        : `Expected ${received} to be a valid link object with required fields`,
      pass: hasRequiredFields
    };
  },

  toBeWithinPerformanceThreshold(received, threshold) {
    if (typeof received !== 'number' || typeof threshold !== 'number') {
      return {
        message: () => `Expected ${received} and ${threshold} to be numbers`,
        pass: false
      };
    }

    const isWithinThreshold = received <= threshold;

    return {
      message: () => isWithinThreshold
        ? `Expected ${received}ms not to be within threshold of ${threshold}ms`
        : `Expected ${received}ms to be within threshold of ${threshold}ms`,
      pass: isWithinThreshold
    };
  },

  toHaveValidSecurityMeasures(received) {
    if (!received || typeof received !== 'object') {
      return {
        message: () => `Expected ${received} to be a security test result object`,
        pass: false
      };
    }

    const hasValidStructure = Array.isArray(received.issues) &&
                            received.issues.every(issue =>
                              issue.type &&
                              issue.severity &&
                              ['error', 'warning', 'info'].includes(issue.severity)
                            );

    return {
      message: () => hasValidStructure
        ? `Expected ${received} not to have valid security measures`
        : `Expected ${received} to have valid security measures with proper issue structure`,
      pass: hasValidStructure
    };
  }
});

// Export utilities for use in tests
global.documentationTestUtils = {
  createMockDocumentation: (content = '# Test Content\n\nThis is test documentation.') => ({
    path: '/test/path.md',
    content,
    metadata: {
      size: Buffer.byteLength(content, 'utf8'),
      lastModified: new Date(),
      type: '.md'
    }
  }),

  createMockLink: (url, type = 'external', line = 1) => ({
    url,
    type,
    line
  }),

  createMockLinkValidation: (url, status = 'valid') => ({
    url,
    status,
    statusCode: status === 'valid' ? 200 : undefined,
    error: status === 'valid' ? undefined : 'Test error',
    responseTime: status === 'valid' ? 150 : undefined
  }),

  createMockSecurityIssue: (type = 'test', severity = 'warning') => ({
    type,
    severity,
    message: `Test ${type} issue`,
    line: 1,
    column: 1
  })
};

// Environment-specific setup
if (process.env.NODE_ENV === 'test') {
  // Test environment specific setup
  console.log('📚 Running documentation tests in test environment');
}

if (process.env.GITHUB_ACTIONS === 'true') {
  console.log('🤖 Running documentation tests in GitHub Actions');

  // Adjust timeouts for CI environment
  global.DOCUMENTATION_TEST_CONFIG.LINK_VALIDATION_TIMEOUT = 20000;
  global.DOCUMENTATION_TEST_CONFIG.EXTERNAL_REQUEST_TIMEOUT = 30000;

  // Reduce parallelism in CI to avoid resource exhaustion
  global.DOCUMENTATION_TEST_CONFIG.MAX_PARALLEL_TESTS = 3;
}

// Performance monitoring
if (process.env.MEASURE_TEST_PERFORMANCE === 'true') {
  const performanceObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      console.log(`⏱️ ${entry.name}: ${entry.duration.toFixed(2)}ms`);
    });
  });

  performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });

  // Make performance observer globally available
  global.testPerformanceObserver = performanceObserver;
}

// Test cleanup utilities
global.testCleanup = {
  clearFetchMocks: () => {
    if (global.fetch && jest.isMockFunction(global.fetch)) {
      global.fetch.mockClear();
    }
  },

  resetTestConfig: () => {
    global.DOCUMENTATION_TEST_CONFIG.SKIP_EXTERNAL_LINKS = false;
    global.DOCUMENTATION_TEST_CONFIG.SKIP_SLOW_TESTS = false;
    global.DOCUMENTATION_TEST_CONFIG.PARALLEL_PROCESSING = true;
  }
};

// Console helper for test debugging
global.debugLog = (message, data = null) => {
  if (process.env.DEBUG_DOCUMENTATION_TESTS === 'true') {
    console.log(`🐛 [DEBUG] ${message}`, data || '');
  }
};

// Test result collection
global.testResults = {
  accuracy: { passed: 0, failed: 0, skipped: 0 },
  completeness: { passed: 0, failed: 0, skipped: 0 },
  links: { passed: 0, failed: 0, skipped: 0 },
  performance: { passed: 0, failed: 0, skipped: 0 },
  security: { passed: 0, failed: 0, skipped: 0 },

  addResult: (category, result) => {
    if (global.testResults[category]) {
      if (result.status === 'passed') global.testResults[category].passed++;
      else if (result.status === 'failed') global.testResults[category].failed++;
      else if (result.status === 'skipped') global.testResults[category].skipped++;
    }
  },

  getSummary: () => {
    const total = Object.values(global.testResults).reduce(
      (sum, cat) => sum + cat.passed + cat.failed + cat.skipped, 0
    );
    const passed = Object.values(global.testResults).reduce(
      (sum, cat) => sum + cat.passed, 0
    );

    return {
      total,
      passed,
      failed: total - passed,
      categories: global.testResults
    };
  }
};

// Final cleanup
afterEach(() => {
  // Clean up any test-specific state
  global.testCleanup.clearFetchMocks();

  // Log test progress in verbose mode
  if (process.env.VERBOSE_TESTS === 'true') {
    const currentTest = expect.getState();
    if (currentTest && currentTest.currentTestName) {
      console.log(`✅ Completed: ${currentTest.currentTestName}`);
    }
  }
});

console.log('📋 Documentation test environment initialized');
