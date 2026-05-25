/**
 * LAM System Test Script
 * Test the integrated LAM system functionality
 */

import { LAMSystem } from './lam-system.js';

// Mock environment for testing
const mockEnv = {
  ENVIRONMENT: 'development',
  DEBUG: 'true',
  LAM_AUTONOMOUS_MODE: 'false',
  LEARNING_INTERVAL: '5m',
  LEARNING_BATCH_SIZE: '10',
  SHARING_MODE: 'disabled',
  PRIVACY_LEVEL: 'medium',
  POLICY_LEARNER: 'enabled',
  RISK_ASSESSOR: 'enabled',
  PROVIDER_ROUTER: 'enabled',
  VECTOR_STORE: null,
  EMBEDDING_MODEL: 'text-embedding-ada-002',
  POLICY_ENGINE: null
};

/**
 * Test the LAM system initialization
 */
async function testInitialization() {
  console.log('🧪 Testing LAM System Initialization...');

  try {
    const lamSystem = new LAMSystem({
      environment: 'development',
      debug: true
    });

    const initResult = await lamSystem.initialize(mockEnv);

    console.log('✅ Initialization successful:', initResult);
    return lamSystem;

  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    throw error;
  }
}

/**
 * Test basic request processing
 */
async function testRequestProcessing(lamSystem) {
  console.log('🧪 Testing Request Processing...');

  try {
    const testRequest = {
      id: 'test-001',
      type: 'compliance_check',
      data: {
        text: 'This is a test request for compliance checking',
        contentType: 'text',
        sensitivity: 'low'
      },
      target: '/api/v1/process'
    };

    const testContext = {
      userId: 'test-user-001',
      sessionId: 'test-session-001',
      framework: 'GDPR',
      region: 'US',
      industry: 'technology'
    };

    const result = await lamSystem.processRequest(testRequest, testContext);

    console.log('✅ Request processing successful:', {
      success: result.success,
      requestId: result.requestId,
      processingTime: result.systemMetrics.processingTime,
      hasLAMInsights: !!result.lamInsights
    });

    return result;

  } catch (error) {
    console.error('❌ Request processing failed:', error.message);
    throw error;
  }
}

/**
 * Test health monitoring
 */
async function testHealthMonitoring(lamSystem) {
  console.log('🧪 Testing Health Monitoring...');

  try {
    const health = await lamSystem.getHealthStatus();

    console.log('✅ Health monitoring successful:', {
      status: health.status,
      servicesCount: Object.keys(health.services).length,
      uptime: health.uptimeFormatted,
      metrics: {
        requestsProcessed: health.metrics.requestsProcessed,
        decisionsMade: health.metrics.decisionsMade
      }
    });

    return health;

  } catch (error) {
    console.error('❌ Health monitoring failed:', error.message);
    throw error;
  }
}

/**
 * Test statistics collection
 */
async function testStatistics(lamSystem) {
  console.log('🧪 Testing Statistics Collection...');

  try {
    const stats = lamSystem.getStatistics();

    console.log('✅ Statistics collection successful:', {
      uptime: stats.uptimeFormatted,
      requestsProcessed: stats.requestsProcessed,
      decisionsMade: stats.decisionsMade,
      servicesCount: Object.keys(stats.services).length
    });

    return stats;

  } catch (error) {
    console.error('❌ Statistics collection failed:', error.message);
    throw error;
  }
}

/**
 * Test multiple concurrent requests
 */
async function testConcurrentRequests(lamSystem, count = 5) {
  console.log(`🧪 Testing ${count} Concurrent Requests...`);

  try {
    const requests = [];

    for (let i = 0; i < count; i++) {
      const request = {
        id: `concurrent-test-${i}`,
        type: 'risk_assessment',
        data: {
          text: `Concurrent test request ${i}`,
          sensitivity: i % 2 === 0 ? 'low' : 'medium'
        }
      };

      const context = {
        userId: `user-${i}`,
        sessionId: `session-${i}`,
        framework: i % 2 === 0 ? 'GDPR' : 'HIPAA'
      };

      requests.push(lamSystem.processRequest(request, context));
    }

    const results = await Promise.allSettled(requests);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log('✅ Concurrent requests completed:', {
      total: count,
      successful,
      failed,
      successRate: `${((successful / count) * 100).toFixed(1)}%`
    });

    return { successful, failed, results };

  } catch (error) {
    console.error('❌ Concurrent requests failed:', error.message);
    throw error;
  }
}

/**
 * Test error handling
 */
async function testErrorHandling(lamSystem) {
  console.log('🧪 Testing Error Handling...');

  try {
    // Test invalid request
    const invalidRequest = {
      // Missing required fields
    };

    try {
      await lamSystem.processRequest(invalidRequest);
      console.log('⚠️ Expected error was not thrown');
    } catch (error) {
      console.log('✅ Invalid request error handled correctly:', error.message);
    }

    // Test uninitialized system
    const uninitializedSystem = new LAMSystem();
    try {
      await uninitializedSystem.processRequest({ type: 'test' });
      console.log('⚠️ Expected error was not thrown');
    } catch (error) {
      console.log('✅ Uninitialized system error handled correctly:', error.message);
    }

  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
    throw error;
  }
}

/**
 * Test system shutdown
 */
async function testShutdown(lamSystem) {
  console.log('🧪 Testing System Shutdown...');

  try {
    await lamSystem.shutdown();
    console.log('✅ System shutdown successful');

  } catch (error) {
    console.error('❌ System shutdown failed:', error.message);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting LAM System Integration Tests\n');

  const testResults = {
    initialization: false,
    requestProcessing: false,
    healthMonitoring: false,
    statistics: false,
    concurrentRequests: false,
    errorHandling: false,
    shutdown: false
  };

  let lamSystem = null;

  try {
    // Test initialization
    lamSystem = await testInitialization();
    testResults.initialization = true;

    // Wait a moment for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test request processing
    await testRequestProcessing(lamSystem);
    testResults.requestProcessing = true;

    // Test health monitoring
    await testHealthMonitoring(lamSystem);
    testResults.healthMonitoring = true;

    // Test statistics
    await testStatistics(lamSystem);
    testResults.statistics = true;

    // Test concurrent requests
    await testConcurrentRequests(lamSystem, 3);
    testResults.concurrentRequests = true;

    // Test error handling
    await testErrorHandling(lamSystem);
    testResults.errorHandling = true;

    // Test shutdown
    await testShutdown(lamSystem);
    testResults.shutdown = true;

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }

  // Print final results
  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  for (const [test, passed] of Object.entries(testResults)) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
  }

  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(Boolean).length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log('========================');
  console.log(`Total: ${totalTests}, Passed: ${passedTests}, Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${successRate}%`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! LAM System is ready for deployment.');
  } else {
    console.log('⚠️ Some tests failed. Please review the errors above.');
  }

  return testResults;
}

// Export test functions for individual testing
export {
  testInitialization,
  testRequestProcessing,
  testHealthMonitoring,
  testStatistics,
  testConcurrentRequests,
  testErrorHandling,
  testShutdown,
  runAllTests
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}