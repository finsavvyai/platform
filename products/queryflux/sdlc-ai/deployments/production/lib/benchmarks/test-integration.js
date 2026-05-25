/**
 * Integration Test for Performance Benchmarking System
 * 
 * This script demonstrates how to use the benchmarking system
 * and can be used to test the implementation.
 */

const { BenchmarkOrchestrator } = require('./index');
const logger = require('../logger');

async function runBenchmarkTest() {
  logger.info('Starting Benchmark Integration Test');
  logger.info('=====================================\n');

  try {
    // Initialize the orchestrator with test configuration
    const orchestrator = new BenchmarkOrchestrator({
      // Performance targets
      apiTargetLatency: 100,
      ragTargetLatency: 500,
      vectorTargetLatency: 150,
      
      // Test configuration
      iterations: 5,
      warmupIterations: 1,
      timeout: 5000,
      
      // Service URLs (these would be real URLs in production)
      gatewayUrl: process.env.GATEWAY_URL || 'https://gateway.example.com',
      ragUrl: process.env.RAG_URL || 'https://rag.example.com',
      vectorUrl: process.env.VECTOR_URL || 'https://vector.example.com'
    });

    // Define test endpoints
    const testEndpoints = [
      {
        url: `${orchestrator.config.gatewayUrl}/api/health`,
        method: 'GET',
        description: 'Gateway Health Check'
      }
    ];

    // Define test RAG queries
    const testQueries = [
      {
        query: 'What is the purpose of this system?',
        expectedKeywords: ['secure', 'data', 'learning', 'platform']
      },
      {
        query: 'How does the RAG service work?',
        expectedKeywords: ['retrieval', 'generation', 'vector']
      }
    ];

    // Execute benchmarks
    logger.info('Executing benchmarks...\n');
    const results = await orchestrator.executeBenchmarks({
      apiEndpoints: testEndpoints,
      ragQueries: testQueries,
      // Skip services that may not be available in test environment
      skipRAG: !process.env.RAG_URL,
      skipVector: !process.env.VECTOR_URL
    });

    // Display results
    logger.info('\n=====================================');
    logger.info('Benchmark Test Results');
    logger.info('=====================================\n');

    logger.info(`Overall Success: ${results.overallSuccess ? '✓ PASS' : '✗ FAIL'}`);
    logger.info(`Total Duration: ${(results.duration / 1000).toFixed(2)}s`);
    logger.info(`Timestamp: ${results.timestamp}\n`);

    // Display API results
    if (results.api) {
      logger.info('API Benchmarks:');
      logger.info(`  Total Endpoints: ${results.api.totalEndpoints}`);
      logger.info(`  Meeting Target: ${results.api.endpointsMeetingTarget}/${results.api.totalEndpoints}`);
      logger.info(`  Success Rate: ${results.api.averageSuccessRate}%\n`);
    }

    // Display RAG results
    if (results.rag) {
      logger.info('RAG Benchmarks:');
      logger.info(`  Total Queries: ${results.rag.totalBenchmarks}`);
      logger.info(`  Meeting Target: ${results.rag.benchmarksMeetingTarget}/${results.rag.totalBenchmarks}`);
      logger.info(`  Success Rate: ${results.rag.averageSuccessRate}%`);
      logger.info(`  Accuracy Rate: ${results.rag.averageAccuracyRate}%\n`);
    }

    // Display Vector results
    if (results.vector) {
      logger.info('Vector Search Benchmarks:');
      logger.info(`  Total Searches: ${results.vector.totalBenchmarks}`);
      logger.info(`  Meeting Target: ${results.vector.benchmarksMeetingTarget}/${results.vector.totalBenchmarks}`);
      logger.info(`  Success Rate: ${results.vector.averageSuccessRate}%`);
      logger.info(`  Quality Score: ${results.vector.averageQualityScore}\n`);
    }

    // Display recommendations
    if (results.recommendations && results.recommendations.length > 0) {
      logger.info('Recommendations:');
      results.recommendations.forEach((rec, index) => {
        logger.info(`  ${index + 1}. [${rec.severity.toUpperCase()}] ${rec.category}`);
        logger.info(`     ${rec.message}`);
        logger.info(`     → ${rec.suggestion}\n`);
      });
    }

    // Display errors
    if (results.errors && results.errors.length > 0) {
      logger.info('Errors:');
      results.errors.forEach((err, index) => {
        logger.info(`  ${index + 1}. ${err.type.toUpperCase()}: ${err.error}\n`);
      });
    }

    // Save results to file
    const resultsPath = './benchmark-test-results.json';
    await orchestrator.saveResults(resultsPath);
    logger.info(`\nResults saved to: ${resultsPath}`);

    logger.info('\n=====================================');
    logger.info('Benchmark Integration Test Complete');
    logger.info('=====================================\n');

    return results;
  } catch (error) {
    logger.error(`Benchmark test failed: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runBenchmarkTest()
    .then(() => {
      logger.info('Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed');
      process.exit(1);
    });
}

module.exports = { runBenchmarkTest };
