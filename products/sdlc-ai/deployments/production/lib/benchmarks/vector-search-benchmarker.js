/**
 * Vector Search Benchmarker
 * 
 * Measures vector search latency, verifies search result quality,
 * and calculates search performance statistics for Vectorize.
 * 
 * Requirements: 14.4
 */

const logger = require('../logger');

class VectorSearchBenchmarker {
  constructor(config = {}) {
    this.config = {
      iterations: config.iterations || 10,
      timeout: config.timeout || 5000,
      warmupIterations: config.warmupIterations || 2,
      targetLatency: config.targetLatency || 150, // ms
      vectorSearchEndpoint: config.vectorSearchEndpoint || '/api/vector/search',
      topK: config.topK || 5,
      ...config
    };
    this.results = [];
  }

  /**
   * Benchmark vector search performance
   * @param {string} baseUrl - The base URL of the vector search service
   * @param {Array<Object>} testVectors - Array of test vectors with expected results
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkVectorSearch(baseUrl, testVectors) {
    logger.info(`Benchmarking vector search at: ${baseUrl}`);
    
    if (!testVectors || testVectors.length === 0) {
      logger.warn('No test vectors provided, using default test vectors');
      testVectors = this._getDefaultTestVectors();
    }

    const url = `${baseUrl}${this.config.vectorSearchEndpoint}`;
    const results = [];

    for (const testVector of testVectors) {
      logger.debug(`Benchmarking vector search: "${testVector.description}"`);
      const result = await this._benchmarkSingleSearch(url, testVector);
      results.push(result);
    }

    // Aggregate results
    const aggregated = this._aggregateResults(results);
    this.results.push(aggregated);

    logger.info(`Vector Search Benchmark completed`);
    logger.info(`  Average Latency: ${aggregated.statistics.average.toFixed(2)}ms`);
    logger.info(`  P95 Latency: ${aggregated.statistics.p95.toFixed(2)}ms`);
    logger.info(`  Success Rate: ${aggregated.successRate.toFixed(2)}%`);
    logger.info(`  Quality Score: ${aggregated.averageQualityScore.toFixed(2)}`);
    logger.info(`  Meets Target: ${aggregated.meetsTarget ? 'YES' : 'NO'}`);

    return aggregated;
  }

  /**
   * Benchmark a single vector search
   * @private
   */
  async _benchmarkSingleSearch(url, testVector) {
    const measurements = [];
    let successCount = 0;
    let failureCount = 0;
    let totalQualityScore = 0;

    // Warmup iterations
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await this._executeVectorSearch(url, testVector.vector);
      } catch (error) {
        logger.warn(`Warmup iteration ${i + 1} failed: ${error.message}`);
      }
    }

    // Actual benchmark iterations
    for (let i = 0; i < this.config.iterations; i++) {
      try {
        const measurement = await this._measureVectorSearch(url, testVector);
        measurements.push(measurement);
        
        if (measurement.success) {
          successCount++;
          totalQualityScore += measurement.qualityScore;
        } else {
          failureCount++;
        }
      } catch (error) {
        failureCount++;
        logger.warn(`Iteration ${i + 1} failed: ${error.message}`);
        measurements.push({
          latency: null,
          success: false,
          qualityScore: 0,
          error: error.message
        });
      }
    }

    // Calculate statistics
    const stats = this._calculateStatistics(measurements);
    const successRate = (successCount / this.config.iterations) * 100;
    const averageQualityScore = successCount > 0 ? totalQualityScore / successCount : 0;

    return {
      description: testVector.description,
      iterations: this.config.iterations,
      successCount,
      failureCount,
      successRate,
      averageQualityScore,
      statistics: stats,
      measurements
    };
  }

  /**
   * Execute a vector search
   * @private
   */
  async _executeVectorSearch(url, vector) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vector,
          topK: this.config.topK
        }),
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
   * Measure a single vector search with timing and quality verification
   * @private
   */
  async _measureVectorSearch(url, testVector) {
    const startTime = Date.now();
    
    try {
      const response = await this._executeVectorSearch(url, testVector.vector);
      const endTime = Date.now();
      const latency = endTime - startTime;

      // Verify search result quality
      const qualityScore = this._verifySearchQuality(response, testVector);

      return {
        latency,
        success: true,
        qualityScore,
        resultCount: response.results ? response.results.length : 0,
        error: null
      };
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      return {
        latency,
        success: false,
        qualityScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Verify search result quality
   * @private
   */
  _verifySearchQuality(response, testVector) {
    if (!response || !response.results || !Array.isArray(response.results)) {
      return 0;
    }

    const results = response.results;
    
    // Quality metrics:
    // 1. Number of results returned (should be close to topK)
    // 2. Relevance scores (should be above threshold)
    // 3. Expected results present (if provided)

    let qualityScore = 0;

    // Check result count (max 30 points)
    const expectedCount = this.config.topK;
    const actualCount = results.length;
    const countScore = Math.min(actualCount / expectedCount, 1) * 30;
    qualityScore += countScore;

    // Check relevance scores (max 40 points)
    if (results.length > 0) {
      const relevanceScores = results
        .filter(r => r.score !== undefined)
        .map(r => r.score);
      
      if (relevanceScores.length > 0) {
        const avgRelevance = relevanceScores.reduce((acc, s) => acc + s, 0) / relevanceScores.length;
        // Assuming scores are between 0 and 1
        const relevanceScore = avgRelevance * 40;
        qualityScore += relevanceScore;
      }
    }

    // Check for expected results (max 30 points)
    if (testVector.expectedIds && Array.isArray(testVector.expectedIds)) {
      const resultIds = results.map(r => r.id);
      const matchedIds = testVector.expectedIds.filter(id => resultIds.includes(id));
      const expectedScore = (matchedIds.length / testVector.expectedIds.length) * 30;
      qualityScore += expectedScore;
    } else {
      // If no expected IDs, give full points if we got results
      qualityScore += results.length > 0 ? 30 : 0;
    }

    return qualityScore;
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
   * Aggregate results from multiple searches
   * @private
   */
  _aggregateResults(results) {
    const totalIterations = results.reduce((acc, r) => acc + r.iterations, 0);
    const totalSuccess = results.reduce((acc, r) => acc + r.successCount, 0);

    const allLatencies = results
      .flatMap(r => r.measurements)
      .filter(m => m.success && m.latency !== null)
      .map(m => m.latency)
      .sort((a, b) => a - b);

    const aggregatedStats = this._calculateStatisticsFromArray(allLatencies);
    const successRate = (totalSuccess / totalIterations) * 100;
    
    // Calculate average quality score
    const totalQualityScore = results.reduce((acc, r) => 
      acc + (r.averageQualityScore * r.successCount), 0
    );
    const averageQualityScore = totalSuccess > 0 ? totalQualityScore / totalSuccess : 0;

    return {
      totalSearches: results.length,
      totalIterations,
      successRate,
      averageQualityScore,
      statistics: aggregatedStats,
      meetsTarget: aggregatedStats.p95 <= this.config.targetLatency,
      targetLatency: this.config.targetLatency,
      searchResults: results,
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
   * Get default test vectors
   * @private
   */
  _getDefaultTestVectors() {
    // Generate random test vectors (1536 dimensions for OpenAI embeddings)
    const generateRandomVector = () => {
      const vector = [];
      for (let i = 0; i < 1536; i++) {
        vector.push(Math.random() * 2 - 1); // Random values between -1 and 1
      }
      return vector;
    };

    return [
      {
        description: 'Random vector search 1',
        vector: generateRandomVector()
      },
      {
        description: 'Random vector search 2',
        vector: generateRandomVector()
      },
      {
        description: 'Random vector search 3',
        vector: generateRandomVector()
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
        message: 'No vector search benchmarks have been run'
      };
    }

    const totalBenchmarks = this.results.length;
    const benchmarksMeetingTarget = this.results.filter(r => r.meetsTarget).length;
    const averageSuccessRate = this.results.reduce((acc, r) => acc + r.successRate, 0) / totalBenchmarks;
    const averageQualityScore = this.results.reduce((acc, r) => acc + r.averageQualityScore, 0) / totalBenchmarks;
    const overallSuccess = benchmarksMeetingTarget === totalBenchmarks && averageSuccessRate >= 95;

    return {
      totalBenchmarks,
      benchmarksMeetingTarget,
      benchmarksFailingTarget: totalBenchmarks - benchmarksMeetingTarget,
      averageSuccessRate: averageSuccessRate.toFixed(2),
      averageQualityScore: averageQualityScore.toFixed(2),
      overallSuccess,
      results: this.results,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = VectorSearchBenchmarker;
