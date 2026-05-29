/**
 * RAG Benchmarker
 * 
 * Measures RAG query latency, calculates response time statistics,
 * and verifies RAG accuracy for the deployed RAG service.
 * 
 * Requirements: 14.3
 */

const logger = require('../logger');

class RAGBenchmarker {
  constructor(config = {}) {
    this.config = {
      iterations: config.iterations || 10,
      timeout: config.timeout || 10000, // RAG queries take longer
      warmupIterations: config.warmupIterations || 2,
      targetLatency: config.targetLatency || 500, // ms
      ragEndpoint: config.ragEndpoint || '/api/rag/query',
      ...config
    };
    this.results = [];
  }

  /**
   * Benchmark RAG query performance
   * @param {string} baseUrl - The base URL of the RAG service
   * @param {Array<Object>} testQueries - Array of test queries with expected results
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkRAGQueries(baseUrl, testQueries) {
    logger.info(`Benchmarking RAG service at: ${baseUrl}`);
    
    if (!testQueries || testQueries.length === 0) {
      logger.warn('No test queries provided, using default queries');
      testQueries = this._getDefaultTestQueries();
    }

    const url = `${baseUrl}${this.config.ragEndpoint}`;
    const results = [];

    for (const testQuery of testQueries) {
      logger.debug(`Benchmarking query: "${testQuery.query}"`);
      const result = await this._benchmarkSingleQuery(url, testQuery);
      results.push(result);
    }

    // Aggregate results
    const aggregated = this._aggregateResults(results);
    this.results.push(aggregated);

    logger.info(`RAG Benchmark completed`);
    logger.info(`  Average Latency: ${aggregated.statistics.average.toFixed(2)}ms`);
    logger.info(`  P95 Latency: ${aggregated.statistics.p95.toFixed(2)}ms`);
    logger.info(`  Success Rate: ${aggregated.successRate.toFixed(2)}%`);
    logger.info(`  Accuracy Rate: ${aggregated.accuracyRate.toFixed(2)}%`);
    logger.info(`  Meets Target: ${aggregated.meetsTarget ? 'YES' : 'NO'}`);

    return aggregated;
  }

  /**
   * Benchmark a single RAG query
   * @private
   */
  async _benchmarkSingleQuery(url, testQuery) {
    const measurements = [];
    let successCount = 0;
    let failureCount = 0;
    let accurateCount = 0;

    // Warmup iterations
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await this._executeRAGQuery(url, testQuery.query);
      } catch (error) {
        logger.warn(`Warmup iteration ${i + 1} failed: ${error.message}`);
      }
    }

    // Actual benchmark iterations
    for (let i = 0; i < this.config.iterations; i++) {
      try {
        const measurement = await this._measureRAGQuery(url, testQuery);
        measurements.push(measurement);
        
        if (measurement.success) {
          successCount++;
          if (measurement.accurate) {
            accurateCount++;
          }
        } else {
          failureCount++;
        }
      } catch (error) {
        failureCount++;
        logger.warn(`Iteration ${i + 1} failed: ${error.message}`);
        measurements.push({
          latency: null,
          success: false,
          accurate: false,
          error: error.message
        });
      }
    }

    // Calculate statistics
    const stats = this._calculateStatistics(measurements);
    const successRate = (successCount / this.config.iterations) * 100;
    const accuracyRate = successCount > 0 ? (accurateCount / successCount) * 100 : 0;

    return {
      query: testQuery.query,
      iterations: this.config.iterations,
      successCount,
      failureCount,
      accurateCount,
      successRate,
      accuracyRate,
      statistics: stats,
      measurements
    };
  }

  /**
   * Execute a RAG query
   * @private
   */
  async _executeRAGQuery(url, query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Measure a single RAG query with timing and accuracy verification
   * @private
   */
  async _measureRAGQuery(url, testQuery) {
    const startTime = Date.now();
    
    try {
      const response = await this._executeRAGQuery(url, testQuery.query);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify accuracy if expected results are provided
      let accurate = true;
      if (testQuery.expectedKeywords && Array.isArray(testQuery.expectedKeywords)) {
        accurate = this._verifyAccuracy(response, testQuery.expectedKeywords);
      }

      return {
        latency,
        success: true,
        accurate,
        responseLength: JSON.stringify(response).length,
        error: null
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      return {
        latency,
        success: false,
        accurate: false,
        error: error.message
      };
    }
  }

  /**
   * Verify RAG response accuracy
   * @private
   */
  _verifyAccuracy(response, expectedKeywords) {
    if (!response || !response.answer) {
      return false;
    }

    const answer = response.answer.toLowerCase();
    const matchedKeywords = expectedKeywords.filter(keyword => 
      answer.includes(keyword.toLowerCase())
    );

    // Consider accurate if at least 50% of expected keywords are present
    const accuracyThreshold = 0.5;
    return (matchedKeywords.length / expectedKeywords.length) >= accuracyThreshold;
  }

  /**
   * Calculate response time statistics
   * @private
   */
  _calculateStatistics(measurements) {
    const successfulMeasurements = measurements
      .filter(m => m.success && m.latency !== null)
      .map(m => m.latency)
      .sort((a, b) => a - b);

    if (successfulMeasurements.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      };
    }

    const sum = successfulMeasurements.reduce((acc, val) => acc + val, 0);
    const average = sum / successfulMeasurements.length;

    const median = this._calculatePercentile(successfulMeasurements, 50);
    const p50 = median;
    const p95 = this._calculatePercentile(successfulMeasurements, 95);
    const p99 = this._calculatePercentile(successfulMeasurements, 99);

    const min = successfulMeasurements[0];
    const max = successfulMeasurements[successfulMeasurements.length - 1];

    // Calculate standard deviation
    const squaredDiffs = successfulMeasurements.map(val => Math.pow(val - average, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / successfulMeasurements.length;
    const stdDev = Math.sqrt(variance);

    return {
      average,
      median,
      min,
      max,
      p50,
      p95,
      p99,
      stdDev
    };
  }

  /**
   * Calculate percentile value
   * @private
   */
  _calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Aggregate results from multiple queries
   * @private
   */
  _aggregateResults(results) {
    const totalIterations = results.reduce((acc, r) => acc + r.iterations, 0);
    const totalSuccess = results.reduce((acc, r) => acc + r.successCount, 0);
    const totalAccurate = results.reduce((acc, r) => acc + r.accurateCount, 0);

    const allLatencies = results
      .flatMap(r => r.measurements)
      .filter(m => m.success && m.latency !== null)
      .map(m => m.latency)
      .sort((a, b) => a - b);

    const aggregatedStats = this._calculateStatisticsFromArray(allLatencies);
    const successRate = (totalSuccess / totalIterations) * 100;
    const accuracyRate = totalSuccess > 0 ? (totalAccurate / totalSuccess) * 100 : 0;

    return {
      totalQueries: results.length,
      totalIterations,
      successRate,
      accuracyRate,
      statistics: aggregatedStats,
      meetsTarget: aggregatedStats.p95 <= this.config.targetLatency,
      targetLatency: this.config.targetLatency,
      queryResults: results,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate statistics from array of latencies
   * @private
   */
  _calculateStatisticsFromArray(latencies) {
    if (latencies.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      };
    }

    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const average = sum / latencies.length;

    const median = this._calculatePercentile(latencies, 50);
    const p50 = median;
    const p95 = this._calculatePercentile(latencies, 95);
    const p99 = this._calculatePercentile(latencies, 99);

    const min = latencies[0];
    const max = latencies[latencies.length - 1];

    const squaredDiffs = latencies.map(val => Math.pow(val - average, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    return {
      average,
      median,
      min,
      max,
      p50,
      p95,
      p99,
      stdDev
    };
  }

  /**
   * Get default test queries
   * @private
   */
  _getDefaultTestQueries() {
    return [
      {
        query: 'What is the purpose of this system?',
        expectedKeywords: ['secure', 'data', 'learning', 'platform']
      },
      {
        query: 'How does the RAG service work?',
        expectedKeywords: ['retrieval', 'generation', 'vector', 'search']
      },
      {
        query: 'What compliance frameworks are supported?',
        expectedKeywords: ['HIPAA', 'GDPR', 'PCI', 'compliance']
      }
    ];
  }

  /**
   * Get all benchmark results
   */
  getResults() {
    return this.results;
  }

  /**
   * Clear all benchmark results
   */
  clearResults() {
    this.results = [];
  }

  /**
   * Generate a summary report
   */
  generateReport() {
    if (this.results.length === 0) {
      return {
        totalBenchmarks: 0,
        overallSuccess: true,
        message: 'No RAG benchmarks have been run'
      };
    }

    const totalBenchmarks = this.results.length;
    const benchmarksMeetingTarget = this.results.filter(r => r.meetsTarget).length;
    const averageSuccessRate = this.results.reduce((acc, r) => acc + r.successRate, 0) / totalBenchmarks;
    const averageAccuracyRate = this.results.reduce((acc, r) => acc + r.accuracyRate, 0) / totalBenchmarks;
    const overallSuccess = benchmarksMeetingTarget === totalBenchmarks && averageSuccessRate >= 95;

    return {
      totalBenchmarks,
      benchmarksMeetingTarget,
      benchmarksFailingTarget: totalBenchmarks - benchmarksMeetingTarget,
      averageSuccessRate: averageSuccessRate.toFixed(2),
      averageAccuracyRate: averageAccuracyRate.toFixed(2),
      overallSuccess,
      results: this.results,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = RAGBenchmarker;
