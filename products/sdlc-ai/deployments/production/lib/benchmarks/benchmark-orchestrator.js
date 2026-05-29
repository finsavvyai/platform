/**
 * Benchmark Orchestrator
 * 
 * Coordinates execution of all benchmarks, aggregates results,
 * and compares performance against targets.
 * 
 * Requirements: 14.1, 14.5
 */

const logger = require('../logger');
const APIBenchmarker = require('./api-benchmarker');
const RAGBenchmarker = require('./rag-benchmarker');
const VectorSearchBenchmarker = require('./vector-search-benchmarker');

class BenchmarkOrchestrator {
  constructor(config = {}) {
    this.config = {
      // Performance targets from requirements
      apiTargetLatency: config.apiTargetLatency || 100, // ms (Requirement 14.2)
      ragTargetLatency: config.ragTargetLatency || 500, // ms (Requirement 14.3)
      vectorTargetLatency: config.vectorTargetLatency || 150, // ms (Requirement 14.4)
      
      // Benchmark configuration
      iterations: config.iterations || 10,
      warmupIterations: config.warmupIterations || 2,
      timeout: config.timeout || 10000,
      
      // Service URLs
      gatewayUrl: config.gatewayUrl,
      ragUrl: config.ragUrl,
      vectorUrl: config.vectorUrl,
      
      ...config
    };

    // Initialize benchmarkers
    this.apiBenchmarker = new APIBenchmarker({
      iterations: this.config.iterations,
      warmupIterations: this.config.warmupIterations,
      targetLatency: this.config.apiTargetLatency,
      timeout: this.config.timeout
    });

    this.ragBenchmarker = new RAGBenchmarker({
      iterations: this.config.iterations,
      warmupIterations: this.config.warmupIterations,
      targetLatency: this.config.ragTargetLatency,
      timeout: this.config.timeout
    });

    this.vectorBenchmarker = new VectorSearchBenchmarker({
      iterations: this.config.iterations,
      warmupIterations: this.config.warmupIterations,
      targetLatency: this.config.vectorTargetLatency,
      timeout: this.config.timeout
    });

    this.results = {
      api: null,
      rag: null,
      vector: null,
      overall: null
    };
  }

  /**
   * Execute all benchmarks
   * @param {Object} options - Benchmark execution options
   * @returns {Promise<Object>} Aggregated benchmark results
   */
  async executeBenchmarks(options = {}) {
    logger.info('='.repeat(60));
    logger.info('Starting Performance Benchmarking');
    logger.info('='.repeat(60));

    const startTime = Date.now();
    const benchmarkResults = {
      api: null,
      rag: null,
      vector: null,
      errors: []
    };

    try {
      // Execute API benchmarks
      if (options.skipAPI !== true) {
        logger.info('\n--- API Endpoint Benchmarks ---');
        try {
          benchmarkResults.api = await this._executeAPIBenchmarks(options.apiEndpoints);
        } catch (error) {
          logger.error(`API benchmarks failed: ${error.message}`);
          benchmarkResults.errors.push({
            type: 'api',
            error: error.message
          });
        }
      }

      // Execute RAG benchmarks
      if (options.skipRAG !== true) {
        logger.info('\n--- RAG Service Benchmarks ---');
        try {
          benchmarkResults.rag = await this._executeRAGBenchmarks(options.ragQueries);
        } catch (error) {
          logger.error(`RAG benchmarks failed: ${error.message}`);
          benchmarkResults.errors.push({
            type: 'rag',
            error: error.message
          });
        }
      }

      // Execute Vector Search benchmarks
      if (options.skipVector !== true) {
        logger.info('\n--- Vector Search Benchmarks ---');
        try {
          benchmarkResults.vector = await this._executeVectorBenchmarks(options.vectorTests);
        } catch (error) {
          logger.error(`Vector search benchmarks failed: ${error.message}`);
          benchmarkResults.errors.push({
            type: 'vector',
            error: error.message
          });
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Aggregate and compare results
      const aggregatedResults = this._aggregateResults(benchmarkResults, duration);
      this.results = aggregatedResults;

      // Display summary
      this._displaySummary(aggregatedResults);

      logger.info('\n' + '='.repeat(60));
      logger.info('Performance Benchmarking Complete');
      logger.info('='.repeat(60));

      return aggregatedResults;
    } catch (error) {
      logger.error(`Benchmark orchestration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute API endpoint benchmarks
   * @private
   */
  async _executeAPIBenchmarks(customEndpoints) {
    const endpoints = customEndpoints || this._getDefaultAPIEndpoints();
    
    if (endpoints.length === 0) {
      logger.warn('No API endpoints configured for benchmarking');
      return null;
    }

    const results = await this.apiBenchmarker.benchmarkEndpoints(endpoints);
    return this.apiBenchmarker.generateReport();
  }

  /**
   * Execute RAG service benchmarks
   * @private
   */
  async _executeRAGBenchmarks(customQueries) {
    if (!this.config.ragUrl) {
      logger.warn('RAG service URL not configured, skipping RAG benchmarks');
      return null;
    }

    const result = await this.ragBenchmarker.benchmarkRAGQueries(
      this.config.ragUrl,
      customQueries
    );
    
    return this.ragBenchmarker.generateReport();
  }

  /**
   * Execute vector search benchmarks
   * @private
   */
  async _executeVectorBenchmarks(customVectors) {
    if (!this.config.vectorUrl) {
      logger.warn('Vector service URL not configured, skipping vector benchmarks');
      return null;
    }

    const result = await this.vectorBenchmarker.benchmarkVectorSearch(
      this.config.vectorUrl,
      customVectors
    );
    
    return this.vectorBenchmarker.generateReport();
  }

  /**
   * Get default API endpoints for benchmarking
   * @private
   */
  _getDefaultAPIEndpoints() {
    const endpoints = [];

    if (this.config.gatewayUrl) {
      endpoints.push(
        {
          url: `${this.config.gatewayUrl}/api/health`,
          method: 'GET',
          description: 'Gateway Health Check'
        },
        {
          url: `${this.config.gatewayUrl}/api/status`,
          method: 'GET',
          description: 'Gateway Status'
        }
      );
    }

    if (this.config.ragUrl) {
      endpoints.push({
        url: `${this.config.ragUrl}/api/health`,
        method: 'GET',
        description: 'RAG Service Health Check'
      });
    }

    if (this.config.vectorUrl) {
      endpoints.push({
        url: `${this.config.vectorUrl}/api/health`,
        method: 'GET',
        description: 'Vector Service Health Check'
      });
    }

    return endpoints;
  }

  /**
   * Aggregate benchmark results and compare against targets
   * @private
   */
  _aggregateResults(benchmarkResults, duration) {
    const results = {
      api: benchmarkResults.api,
      rag: benchmarkResults.rag,
      vector: benchmarkResults.vector,
      errors: benchmarkResults.errors,
      duration,
      timestamp: new Date().toISOString()
    };

    // Compare against performance targets
    const targetComparison = this._compareAgainstTargets(benchmarkResults);
    results.targetComparison = targetComparison;

    // Determine overall success
    results.overallSuccess = this._determineOverallSuccess(benchmarkResults, targetComparison);

    // Generate recommendations
    results.recommendations = this._generateRecommendations(benchmarkResults, targetComparison);

    return results;
  }

  /**
   * Compare results against performance targets
   * @private
   */
  _compareAgainstTargets(benchmarkResults) {
    const comparison = {
      api: null,
      rag: null,
      vector: null
    };

    // API comparison
    if (benchmarkResults.api && benchmarkResults.api.results) {
      const apiResults = benchmarkResults.api.results;
      const meetingTarget = apiResults.filter(r => r.meetsTarget).length;
      const total = apiResults.length;
      
      comparison.api = {
        target: this.config.apiTargetLatency,
        meetingTarget,
        total,
        percentage: total > 0 ? (meetingTarget / total) * 100 : 0,
        success: meetingTarget === total
      };
    }

    // RAG comparison
    if (benchmarkResults.rag && benchmarkResults.rag.results) {
      const ragResults = benchmarkResults.rag.results;
      const meetingTarget = ragResults.filter(r => r.meetsTarget).length;
      const total = ragResults.length;
      
      comparison.rag = {
        target: this.config.ragTargetLatency,
        meetingTarget,
        total,
        percentage: total > 0 ? (meetingTarget / total) * 100 : 0,
        success: meetingTarget === total
      };
    }

    // Vector comparison
    if (benchmarkResults.vector && benchmarkResults.vector.results) {
      const vectorResults = benchmarkResults.vector.results;
      const meetingTarget = vectorResults.filter(r => r.meetsTarget).length;
      const total = vectorResults.length;
      
      comparison.vector = {
        target: this.config.vectorTargetLatency,
        meetingTarget,
        total,
        percentage: total > 0 ? (meetingTarget / total) * 100 : 0,
        success: meetingTarget === total
      };
    }

    return comparison;
  }

  /**
   * Determine overall benchmark success
   * @private
   */
  _determineOverallSuccess(benchmarkResults, targetComparison) {
    // Check if any benchmarks failed to run
    if (benchmarkResults.errors && benchmarkResults.errors.length > 0) {
      return false;
    }

    // Check API targets
    if (targetComparison.api && !targetComparison.api.success) {
      return false;
    }

    // Check RAG targets
    if (targetComparison.rag && !targetComparison.rag.success) {
      return false;
    }

    // Check Vector targets
    if (targetComparison.vector && !targetComparison.vector.success) {
      return false;
    }

    // Check success rates
    if (benchmarkResults.api && parseFloat(benchmarkResults.api.averageSuccessRate) < 99) {
      return false;
    }

    if (benchmarkResults.rag && parseFloat(benchmarkResults.rag.averageSuccessRate) < 95) {
      return false;
    }

    if (benchmarkResults.vector && parseFloat(benchmarkResults.vector.averageSuccessRate) < 95) {
      return false;
    }

    return true;
  }

  /**
   * Generate performance recommendations
   * @private
   */
  _generateRecommendations(benchmarkResults, targetComparison) {
    const recommendations = [];

    // API recommendations
    if (targetComparison.api && !targetComparison.api.success) {
      recommendations.push({
        category: 'API Performance',
        severity: 'warning',
        message: `${targetComparison.api.total - targetComparison.api.meetingTarget} API endpoint(s) exceed target latency of ${this.config.apiTargetLatency}ms`,
        suggestion: 'Consider optimizing slow endpoints, adding caching, or reviewing database queries'
      });
    }

    // RAG recommendations
    if (targetComparison.rag && !targetComparison.rag.success) {
      recommendations.push({
        category: 'RAG Performance',
        severity: 'warning',
        message: `RAG queries exceed target latency of ${this.config.ragTargetLatency}ms`,
        suggestion: 'Consider optimizing vector search, improving embedding quality, or adjusting retrieval parameters'
      });
    }

    // Vector recommendations
    if (targetComparison.vector && !targetComparison.vector.success) {
      recommendations.push({
        category: 'Vector Search Performance',
        severity: 'warning',
        message: `Vector searches exceed target latency of ${this.config.vectorTargetLatency}ms`,
        suggestion: 'Consider optimizing index configuration, reducing vector dimensions, or adjusting topK parameter'
      });
    }

    // Success rate recommendations
    if (benchmarkResults.api && parseFloat(benchmarkResults.api.averageSuccessRate) < 99) {
      recommendations.push({
        category: 'API Reliability',
        severity: 'error',
        message: `API success rate (${benchmarkResults.api.averageSuccessRate}%) is below 99% target`,
        suggestion: 'Investigate failing requests, check error logs, and improve error handling'
      });
    }

    if (benchmarkResults.rag && parseFloat(benchmarkResults.rag.averageSuccessRate) < 95) {
      recommendations.push({
        category: 'RAG Reliability',
        severity: 'error',
        message: `RAG success rate (${benchmarkResults.rag.averageSuccessRate}%) is below 95% target`,
        suggestion: 'Check RAG service health, verify vector database connectivity, and review error logs'
      });
    }

    if (benchmarkResults.vector && parseFloat(benchmarkResults.vector.averageSuccessRate) < 95) {
      recommendations.push({
        category: 'Vector Search Reliability',
        severity: 'error',
        message: `Vector search success rate (${benchmarkResults.vector.averageSuccessRate}%) is below 95% target`,
        suggestion: 'Verify Vectorize index health, check network connectivity, and review timeout settings'
      });
    }

    // Quality recommendations
    if (benchmarkResults.rag && parseFloat(benchmarkResults.rag.averageAccuracyRate) < 70) {
      recommendations.push({
        category: 'RAG Quality',
        severity: 'warning',
        message: `RAG accuracy rate (${benchmarkResults.rag.averageAccuracyRate}%) could be improved`,
        suggestion: 'Review embedding model quality, improve document chunking strategy, or adjust retrieval parameters'
      });
    }

    if (benchmarkResults.vector && parseFloat(benchmarkResults.vector.averageQualityScore) < 60) {
      recommendations.push({
        category: 'Vector Search Quality',
        severity: 'warning',
        message: `Vector search quality score (${benchmarkResults.vector.averageQualityScore}) could be improved`,
        suggestion: 'Review index configuration, improve embedding quality, or adjust similarity thresholds'
      });
    }

    return recommendations;
  }

  /**
   * Display benchmark summary
   * @private
   */
  _displaySummary(results) {
    logger.info('\n' + '='.repeat(60));
    logger.info('BENCHMARK SUMMARY');
    logger.info('='.repeat(60));

    // API Summary
    if (results.api) {
      logger.info('\nAPI Benchmarks:');
      logger.info(`  Endpoints Tested: ${results.api.totalEndpoints}`);
      logger.info(`  Meeting Target: ${results.api.endpointsMeetingTarget}/${results.api.totalEndpoints}`);
      logger.info(`  Average Success Rate: ${results.api.averageSuccessRate}%`);
      logger.info(`  Status: ${results.targetComparison.api?.success ? '✓ PASS' : '✗ FAIL'}`);
    }

    // RAG Summary
    if (results.rag) {
      logger.info('\nRAG Benchmarks:');
      logger.info(`  Queries Tested: ${results.rag.totalBenchmarks}`);
      logger.info(`  Meeting Target: ${results.rag.benchmarksMeetingTarget}/${results.rag.totalBenchmarks}`);
      logger.info(`  Average Success Rate: ${results.rag.averageSuccessRate}%`);
      logger.info(`  Average Accuracy: ${results.rag.averageAccuracyRate}%`);
      logger.info(`  Status: ${results.targetComparison.rag?.success ? '✓ PASS' : '✗ FAIL'}`);
    }

    // Vector Summary
    if (results.vector) {
      logger.info('\nVector Search Benchmarks:');
      logger.info(`  Searches Tested: ${results.vector.totalBenchmarks}`);
      logger.info(`  Meeting Target: ${results.vector.benchmarksMeetingTarget}/${results.vector.totalBenchmarks}`);
      logger.info(`  Average Success Rate: ${results.vector.averageSuccessRate}%`);
      logger.info(`  Average Quality Score: ${results.vector.averageQualityScore}`);
      logger.info(`  Status: ${results.targetComparison.vector?.success ? '✓ PASS' : '✗ FAIL'}`);
    }

    // Overall Status
    logger.info('\n' + '-'.repeat(60));
    logger.info(`Overall Status: ${results.overallSuccess ? '✓ ALL TARGETS MET' : '✗ SOME TARGETS NOT MET'}`);
    logger.info(`Total Duration: ${(results.duration / 1000).toFixed(2)}s`);

    // Recommendations
    if (results.recommendations && results.recommendations.length > 0) {
      logger.info('\n' + '-'.repeat(60));
      logger.info('RECOMMENDATIONS:');
      results.recommendations.forEach((rec, index) => {
        logger.info(`\n${index + 1}. [${rec.severity.toUpperCase()}] ${rec.category}`);
        logger.info(`   ${rec.message}`);
        logger.info(`   → ${rec.suggestion}`);
      });
    }

    // Errors
    if (results.errors && results.errors.length > 0) {
      logger.info('\n' + '-'.repeat(60));
      logger.info('ERRORS:');
      results.errors.forEach((err, index) => {
        logger.info(`\n${index + 1}. ${err.type.toUpperCase()} Benchmark Error`);
        logger.info(`   ${err.error}`);
      });
    }
  }

  /**
   * Get benchmark results
   */
  getResults() {
    return this.results;
  }

  /**
   * Export results to JSON
   */
  exportResults() {
    return JSON.stringify(this.results, null, 2);
  }

  /**
   * Save results to file
   */
  async saveResults(filepath) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const dir = path.dirname(filepath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filepath, this.exportResults(), 'utf8');
      logger.info(`Benchmark results saved to: ${filepath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save benchmark results: ${error.message}`);
      return false;
    }
  }
}

module.exports = BenchmarkOrchestrator;
