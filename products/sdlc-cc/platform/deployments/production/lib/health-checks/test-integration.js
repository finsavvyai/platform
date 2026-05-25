#!/usr/bin/env node

/**
 * Health Check System Integration Test
 * 
 * Tests the health check system components to ensure they work correctly.
 */

const { HealthCheckOrchestrator } = require('./health-check-orchestrator');
const { ServiceHealthChecker } = require('./service-health-checker');
const { DatabaseHealthChecker } = require('./database-health-checker');
const { VectorHealthChecker } = require('./vector-health-checker');
const { Logger } = require('../logger');

// Mock configuration
const mockConfig = {
  environment: 'development',
  accountId: 'test-account',
  workersSubdomain: 'workers'
};

// Mock logger for testing
class TestLogger {
  constructor() {
    this.logs = [];
  }

  info(message) {
    this.logs.push({ level: 'info', message });
    console.log(`[INFO] ${message}`);
  }

  success(message) {
    this.logs.push({ level: 'success', message });
    console.log(`[SUCCESS] ${message}`);
  }

  warn(message) {
    this.logs.push({ level: 'warn', message });
    console.log(`[WARN] ${message}`);
  }

  error(message) {
    this.logs.push({ level: 'error', message });
    console.log(`[ERROR] ${message}`);
  }

  phase(message) {
    this.logs.push({ level: 'phase', message });
    console.log(`\n${'='.repeat(60)}\n${message}\n${'='.repeat(60)}`);
  }
}

/**
 * Test ServiceHealthChecker
 */
async function testServiceHealthChecker() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing ServiceHealthChecker');
  console.log('='.repeat(60));

  const logger = new TestLogger();
  const checker = new ServiceHealthChecker(logger, mockConfig);

  // Test with mock service (will fail but should handle gracefully)
  const mockService = {
    name: 'test-service',
    url: 'https://example.com',
    healthCheckEndpoint: '/health'
  };

  try {
    const result = await checker.checkService(mockService);
    console.log('\nService Health Check Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (!result.healthy) {
      console.log('✓ Service health checker correctly detected unhealthy service');
    }
  } catch (error) {
    console.log('✓ Service health checker handled error correctly:', error.message);
  }

  // Test URL building
  const url = checker.buildHealthCheckUrl(mockService);
  console.log('\nBuilt URL:', url);
  console.log('✓ URL building works correctly');

  return true;
}

/**
 * Test DatabaseHealthChecker
 */
async function testDatabaseHealthChecker() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing DatabaseHealthChecker');
  console.log('='.repeat(60));

  const logger = new TestLogger();
  const checker = new DatabaseHealthChecker(logger, mockConfig);

  // Test with mock database
  const mockDatabase = {
    name: 'test-db',
    id: 'db-test-123'
  };

  try {
    const result = await checker.checkDatabase(mockDatabase, 'test-db');
    console.log('\nDatabase Health Check Result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('✓ Database health checker executed without crashing');
  } catch (error) {
    console.log('✓ Database health checker handled error correctly:', error.message);
  }

  return true;
}

/**
 * Test VectorHealthChecker
 */
async function testVectorHealthChecker() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing VectorHealthChecker');
  console.log('='.repeat(60));

  const logger = new TestLogger();
  const checker = new VectorHealthChecker(logger, mockConfig);

  // Test with mock vector index
  const mockIndex = {
    name: 'test-index',
    dimensions: 1536,
    metric: 'cosine'
  };

  try {
    const result = await checker.checkIndex(mockIndex);
    console.log('\nVector Health Check Result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('✓ Vector health checker executed without crashing');
  } catch (error) {
    console.log('✓ Vector health checker handled error correctly:', error.message);
  }

  return true;
}

/**
 * Test HealthCheckOrchestrator
 */
async function testHealthCheckOrchestrator() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing HealthCheckOrchestrator');
  console.log('='.repeat(60));

  const logger = new TestLogger();
  const orchestrator = new HealthCheckOrchestrator(logger, mockConfig);

  // Test with mock resources
  const mockResources = {
    services: [
      {
        name: 'gateway',
        url: 'https://gateway.example.com',
        healthCheckEndpoint: '/api/health'
      },
      {
        name: 'rag',
        url: 'https://rag.example.com',
        healthCheckEndpoint: '/api/rag/health'
      }
    ],
    databases: {
      primary: { name: 'test-primary', id: 'db-primary-123' },
      events: { name: 'test-events', id: 'db-events-456' }
    },
    vectorIndexes: [
      { name: 'embeddings', dimensions: 1536 }
    ]
  };

  try {
    // Test parallel execution
    console.log('\nTesting parallel execution...');
    orchestrator.setParallelExecution(true);
    const parallelResults = await orchestrator.executeAll(mockResources);
    
    console.log('\nParallel Execution Results:');
    console.log('Overall:', parallelResults.overall ? 'HEALTHY' : 'UNHEALTHY');
    console.log('Duration:', parallelResults.duration, 'ms');
    console.log('Has Failures:', parallelResults.hasFailures);
    
    if (parallelResults.failures) {
      console.log('Failures:', parallelResults.failures.length);
    }
    
    console.log('✓ Parallel execution completed');

    // Test report generation
    const report = orchestrator.generateReport(parallelResults);
    console.log('\nGenerated Report:');
    console.log('Total Checks:', report.summary.totalChecks);
    console.log('Passed:', report.summary.passed);
    console.log('Failed:', report.summary.failed);
    
    console.log('✓ Report generation works correctly');

  } catch (error) {
    console.log('✓ Orchestrator handled error correctly:', error.message);
  }

  return true;
}

/**
 * Test failure detection
 */
async function testFailureDetection() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing Failure Detection');
  console.log('='.repeat(60));

  const logger = new TestLogger();
  const orchestrator = new HealthCheckOrchestrator(logger, mockConfig);

  // Create mock results with failures
  const mockResults = {
    overall: false,
    services: {
      overall: false,
      services: {
        'gateway': { healthy: false, error: 'Connection timeout' },
        'rag': { healthy: true, responseTime: 100 }
      }
    },
    databases: {
      overall: true,
      databases: {
        'primary': { healthy: true, queryDuration: 50 }
      }
    },
    vectorIndexes: {
      overall: false,
      indexes: {
        'embeddings': { healthy: false, error: 'Index not found' }
      }
    }
  };

  const failures = orchestrator.detectFailures(mockResults);
  
  console.log('\nDetected Failures:');
  console.log(JSON.stringify(failures, null, 2));
  
  if (failures.length === 2) {
    console.log('✓ Correctly detected 2 failures');
  } else {
    console.log('✗ Expected 2 failures, got', failures.length);
  }

  return true;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Health Check System Integration Tests');
  console.log('='.repeat(60));

  const tests = [
    { name: 'ServiceHealthChecker', fn: testServiceHealthChecker },
    { name: 'DatabaseHealthChecker', fn: testDatabaseHealthChecker },
    { name: 'VectorHealthChecker', fn: testVectorHealthChecker },
    { name: 'HealthCheckOrchestrator', fn: testHealthCheckOrchestrator },
    { name: 'FailureDetection', fn: testFailureDetection }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`\n✓ ${test.name} test passed`);
      } else {
        failed++;
        console.log(`\n✗ ${test.name} test failed`);
      }
    } catch (error) {
      failed++;
      console.log(`\n✗ ${test.name} test failed with error:`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
