/**
 * Health Check Orchestrator
 * 
 * Coordinates parallel execution of all health checks across services, databases,
 * and vector indexes. Aggregates results and detects failures.
 * 
 * Requirements: 7.1, 7.8
 */

const { ServiceHealthChecker } = require('./service-health-checker');
const { DatabaseHealthChecker } = require('./database-health-checker');
const { VectorHealthChecker } = require('./vector-health-checker');

class HealthCheckOrchestrator {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    
    // Initialize health checkers
    this.serviceChecker = new ServiceHealthChecker(logger, config);
    this.databaseChecker = new DatabaseHealthChecker(logger, config);
    this.vectorChecker = new VectorHealthChecker(logger, config);
    
    this.parallelExecution = true;
    this.failFast = false;
  }

  /**
   * Execute all health checks
   * @param {Object} resources - Deployed resources (services, databases, indexes)
   * @returns {Promise<Object>} Aggregated health check results
   */
  async executeAll(resources) {
    this.logger.phase('Health Check Phase');
    this.logger.info('Executing comprehensive health checks...');
    
    const startTime = Date.now();
    
    try {
      let results;
      
      if (this.parallelExecution) {
        results = await this.executeParallel(resources);
      } else {
        results = await this.executeSequential(resources);
      }

      const duration = Date.now() - startTime;
      results.duration = duration;
      results.timestamp = new Date().toISOString();

      // Detect failures
      const failures = this.detectFailures(results);
      results.failures = failures;
      results.hasFailures = failures.length > 0;

      // Log summary
      this.logSummary(results);

      return results;

    } catch (error) {
      this.logger.error(`Health check execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute health checks in parallel
   * @param {Object} resources - Deployed resources
   * @returns {Promise<Object>} Health check results
   */
  async executeParallel(resources) {
    this.logger.info('Running health checks in parallel...');
    
    const checks = [];

    // Service health checks
    if (resources.services && resources.services.length > 0) {
      checks.push(
        this.serviceChecker.checkAllServices(resources.services)
          .then(result => ({ type: 'services', result }))
          .catch(error => ({ type: 'services', error: error.message }))
      );
    }

    // Database health checks
    if (resources.databases) {
      checks.push(
        this.databaseChecker.checkAllDatabases(resources.databases)
          .then(result => ({ type: 'databases', result }))
          .catch(error => ({ type: 'databases', error: error.message }))
      );
    }

    // Vector index health checks
    if (resources.vectorIndexes) {
      checks.push(
        this.vectorChecker.checkAllIndexes(resources.vectorIndexes)
          .then(result => ({ type: 'vectorIndexes', result }))
          .catch(error => ({ type: 'vectorIndexes', error: error.message }))
      );
    }

    // Execute all checks in parallel
    const checkResults = await Promise.all(checks);

    // Aggregate results
    const aggregated = {
      overall: true,
      services: null,
      databases: null,
      vectorIndexes: null
    };

    for (const check of checkResults) {
      if (check.error) {
        aggregated[check.type] = {
          overall: false,
          error: check.error
        };
        aggregated.overall = false;
      } else {
        aggregated[check.type] = check.result;
        if (!check.result.overall) {
          aggregated.overall = false;
        }
      }
    }

    return aggregated;
  }

  /**
   * Execute health checks sequentially
   * @param {Object} resources - Deployed resources
   * @returns {Promise<Object>} Health check results
   */
  async executeSequential(resources) {
    this.logger.info('Running health checks sequentially...');
    
    const results = {
      overall: true,
      services: null,
      databases: null,
      vectorIndexes: null
    };

    try {
      // Check services
      if (resources.services && resources.services.length > 0) {
        results.services = await this.serviceChecker.checkAllServices(resources.services);
        
        if (!results.services.overall) {
          results.overall = false;
          if (this.failFast) {
            return results;
          }
        }
      }

      // Check databases
      if (resources.databases) {
        results.databases = await this.databaseChecker.checkAllDatabases(resources.databases);
        
        if (!results.databases.overall) {
          results.overall = false;
          if (this.failFast) {
            return results;
          }
        }
      }

      // Check vector indexes
      if (resources.vectorIndexes) {
        results.vectorIndexes = await this.vectorChecker.checkAllIndexes(resources.vectorIndexes);
        
        if (!results.vectorIndexes.overall) {
          results.overall = false;
          if (this.failFast) {
            return results;
          }
        }
      }

    } catch (error) {
      results.overall = false;
      results.error = error.message;
    }

    return results;
  }

  /**
   * Detect failures in health check results
   * @param {Object} results - Health check results
   * @returns {Array<Object>} Array of failures
   */
  detectFailures(results) {
    const failures = [];

    // Check service failures
    if (results.services && results.services.services) {
      for (const [serviceName, health] of Object.entries(results.services.services)) {
        if (!health.healthy) {
          failures.push({
            type: 'service',
            name: serviceName,
            error: health.error || 'Health check failed',
            details: health
          });
        }
      }
    }

    // Check database failures
    if (results.databases && results.databases.databases) {
      for (const [dbName, health] of Object.entries(results.databases.databases)) {
        if (!health.healthy) {
          failures.push({
            type: 'database',
            name: dbName,
            error: health.error || 'Health check failed',
            details: health
          });
        }
      }
    }

    // Check vector index failures
    if (results.vectorIndexes && results.vectorIndexes.indexes) {
      for (const [indexName, health] of Object.entries(results.vectorIndexes.indexes)) {
        if (!health.healthy) {
          failures.push({
            type: 'vectorIndex',
            name: indexName,
            error: health.error || 'Health check failed',
            details: health
          });
        }
      }
    }

    return failures;
  }

  /**
   * Log health check summary
   * @param {Object} results - Health check results
   */
  logSummary(results) {
    this.logger.info('\n' + '='.repeat(60));
    this.logger.info('Health Check Summary');
    this.logger.info('='.repeat(60));

    // Overall status
    if (results.overall) {
      this.logger.success(`✓ Overall Status: HEALTHY`);
    } else {
      this.logger.error(`✗ Overall Status: UNHEALTHY`);
    }

    this.logger.info(`Duration: ${(results.duration / 1000).toFixed(2)}s`);
    this.logger.info('');

    // Service health
    if (results.services) {
      this.logServiceHealth(results.services);
    }

    // Database health
    if (results.databases) {
      this.logDatabaseHealth(results.databases);
    }

    // Vector index health
    if (results.vectorIndexes) {
      this.logVectorHealth(results.vectorIndexes);
    }

    // Failures
    if (results.hasFailures) {
      this.logger.error('\nFailures Detected:');
      for (const failure of results.failures) {
        this.logger.error(`  ✗ ${failure.type}: ${failure.name} - ${failure.error}`);
      }
    }

    this.logger.info('='.repeat(60) + '\n');
  }

  /**
   * Log service health details
   * @param {Object} serviceResults - Service health results
   */
  logServiceHealth(serviceResults) {
    this.logger.info('Services:');
    
    if (serviceResults.services) {
      for (const [name, health] of Object.entries(serviceResults.services)) {
        if (health.healthy) {
          this.logger.success(`  ✓ ${name}: healthy (${health.responseTime}ms)`);
        } else {
          this.logger.error(`  ✗ ${name}: unhealthy - ${health.error}`);
        }
      }
    }
    
    this.logger.info('');
  }

  /**
   * Log database health details
   * @param {Object} databaseResults - Database health results
   */
  logDatabaseHealth(databaseResults) {
    this.logger.info('Databases:');
    
    if (databaseResults.databases) {
      for (const [name, health] of Object.entries(databaseResults.databases)) {
        if (health.healthy) {
          this.logger.success(`  ✓ ${name}: healthy (query: ${health.queryDuration}ms)`);
        } else {
          this.logger.error(`  ✗ ${name}: unhealthy - ${health.error}`);
        }
      }
    }
    
    this.logger.info('');
  }

  /**
   * Log vector index health details
   * @param {Object} vectorResults - Vector index health results
   */
  logVectorHealth(vectorResults) {
    this.logger.info('Vector Indexes:');
    
    if (vectorResults.indexes) {
      for (const [name, health] of Object.entries(vectorResults.indexes)) {
        if (health.healthy) {
          const searchInfo = health.searchable ? 
            `searchable (${health.searchDuration}ms)` : 
            'available (empty)';
          this.logger.success(`  ✓ ${name}: ${searchInfo}`);
        } else {
          this.logger.error(`  ✗ ${name}: unhealthy - ${health.error}`);
        }
      }
    }
    
    this.logger.info('');
  }

  /**
   * Generate health check report
   * @param {Object} results - Health check results
   * @returns {Object} Formatted report
   */
  generateReport(results) {
    const report = {
      timestamp: results.timestamp,
      duration: results.duration,
      overall: results.overall,
      summary: {
        totalChecks: 0,
        passed: 0,
        failed: 0
      },
      details: {
        services: [],
        databases: [],
        vectorIndexes: []
      },
      failures: results.failures || []
    };

    // Count services
    if (results.services && results.services.services) {
      for (const [name, health] of Object.entries(results.services.services)) {
        report.summary.totalChecks++;
        if (health.healthy) {
          report.summary.passed++;
        } else {
          report.summary.failed++;
        }
        
        report.details.services.push({
          name,
          healthy: health.healthy,
          responseTime: health.responseTime,
          error: health.error
        });
      }
    }

    // Count databases
    if (results.databases && results.databases.databases) {
      for (const [name, health] of Object.entries(results.databases.databases)) {
        report.summary.totalChecks++;
        if (health.healthy) {
          report.summary.passed++;
        } else {
          report.summary.failed++;
        }
        
        report.details.databases.push({
          name,
          healthy: health.healthy,
          queryDuration: health.queryDuration,
          error: health.error
        });
      }
    }

    // Count vector indexes
    if (results.vectorIndexes && results.vectorIndexes.indexes) {
      for (const [name, health] of Object.entries(results.vectorIndexes.indexes)) {
        report.summary.totalChecks++;
        if (health.healthy) {
          report.summary.passed++;
        } else {
          report.summary.failed++;
        }
        
        report.details.vectorIndexes.push({
          name,
          healthy: health.healthy,
          searchable: health.searchable,
          error: health.error
        });
      }
    }

    return report;
  }

  /**
   * Set parallel execution mode
   * @param {boolean} enabled - Whether to enable parallel execution
   */
  setParallelExecution(enabled) {
    this.parallelExecution = enabled;
  }

  /**
   * Set fail-fast mode
   * @param {boolean} enabled - Whether to enable fail-fast
   */
  setFailFast(enabled) {
    this.failFast = enabled;
  }

  /**
   * Get service health checker
   * @returns {ServiceHealthChecker} Service health checker instance
   */
  getServiceChecker() {
    return this.serviceChecker;
  }

  /**
   * Get database health checker
   * @returns {DatabaseHealthChecker} Database health checker instance
   */
  getDatabaseChecker() {
    return this.databaseChecker;
  }

  /**
   * Get vector health checker
   * @returns {VectorHealthChecker} Vector health checker instance
   */
  getVectorChecker() {
    return this.vectorChecker;
  }
}

module.exports = { HealthCheckOrchestrator };
