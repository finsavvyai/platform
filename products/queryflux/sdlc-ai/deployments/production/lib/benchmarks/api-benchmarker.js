/**
 * API Benchmarker
 * 
 * Measures API endpoint latency, calculates response time statistics,
 * and tracks success rates for deployed services.
 * 
 * Requirements: 14.2
 */

const logger = require('../logger');

class APIBenchmarker {
  constructor(config = {}) {
    this.config = {
      iterations: config.iterations || 10,
      timeout: config.timeout || 5000,
      warmupIterations: config.warmupIterations || 2,
      targetLatency: config.targetLatency || 100, // ms
      ...config
    };
    this.results = [];
  }

  /**
   * Benchmark a single API endpoint
   * @param {string} url - The endpoint URL to benchmark
   * @param {Object} options - Request options (method, headers, body)
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkEndpoint(url, options = {}) {
    logger.info(`Benchmarking API endpoint: ${url}`);
    
    const method = options.method || 'GET';
    const headers = options.headers || {};
    const body = options.body;

    // Warmup iterations
    logger.debug(`Running ${this.config.warmupIterations} warmup iterations...`);
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await this._makeRequest(url, method, headers, body);
      } catch (error) {
        logger.warn(`Warmup iteration ${i + 1} failed: ${error.message}`);
      }
    }

    // Actual benchmark iterations
    const measurements = [];
    let successCount = 0;
    let failureCount = 0;

    logger.debug(`Running ${this.config.iterations} benchmark iterations...`);
    for (let i = 0; i < this.config.iterations; i++) {
      try {
        const measurement = await this._measureRequest(url, method, headers, body);
        measurements.push(measurement);
        
        if (measurement.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        failureCount++;
        logger.warn(`Iteration ${i + 1} failed: ${error.message}`);
        measurements.push({
          latency: null,
          success: false,
          statusCode: null,
          error: error.message
        });
      }
    }

    // Calculate statistics
    const stats = this._calculateStatistics(measurements);
    const successRate = (successCount / this.config.iterations) * 100;

    const result = {
      url,
      method,
      iterations: this.config.iterations,
      successCount,
      failureCount,
      successRate,
      statistics: stats,
      meetsTarget: stats.p95 <= this.config.targetLatency,
      targetLatency: this.config.targetLatency,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    
    logger.info(`API Benchmark completed: ${url}`);
    logger.info(`  Success Rate: ${successRate.toFixed(2)}%`);
    logger.info(`  Average Latency: ${stats.average.toFixed(2)}ms`);
    logger.info(`  P95 Latency: ${stats.p95.toFixed(2)}ms`);
    logger.info(`  Meets Target: ${result.meetsTarget ? 'YES' : 'NO'}`);

    return result;
  }

  /**
   * Benchmark multiple API endpoints
   * @param {Array<Object>} endpoints - Array of endpoint configurations
   * @returns {Promise<Array<Object>>} Array of benchmark results
   */
  async benchmarkEndpoints(endpoints) {
    logger.info(`Benchmarking ${endpoints.length} API endpoints...`);
    
    const results = [];
    for (const endpoint of endpoints) {
      const result = await this.benchmarkEndpoint(
        endpoint.url,
        {
          method: endpoint.method,
          headers: endpoint.headers,
          body: endpoint.body
        }
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Make a single HTTP request
   * @private
   */
  async _makeRequest(url, method, headers, body) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Measure a single request with timing
   * @private
   */
  async _measureRequest(url, method, headers, body) {
    const startTime = Date.now();
    
    try {
      const response = await this._makeRequest(url, method, headers, body);
      const endTime = Date.now();
      const latency = endTime - startTime;

      return {
        latency,
        success: response.ok,
        statusCode: response.status,
        error: null
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      return {
        latency,
        success: false,
        statusCode: null,
        error: error.message
      };
    }
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
        totalEndpoints: 0,
        overallSuccess: true,
        message: 'No benchmarks have been run'
      };
    }

    const totalEndpoints = this.results.length;
    const endpointsMeetingTarget = this.results.filter(r => r.meetsTarget).length;
    const averageSuccessRate = this.results.reduce((acc, r) => acc + r.successRate, 0) / totalEndpoints;
    const overallSuccess = endpointsMeetingTarget === totalEndpoints && averageSuccessRate >= 99;

    return {
      totalEndpoints,
      endpointsMeetingTarget,
      endpointsFailingTarget: totalEndpoints - endpointsMeetingTarget,
      averageSuccessRate: averageSuccessRate.toFixed(2),
      overallSuccess,
      results: this.results,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = APIBenchmarker;
