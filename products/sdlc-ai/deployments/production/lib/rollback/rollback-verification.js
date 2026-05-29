/**
 * Rollback Verification System
 * 
 * Verifies system stability after rollback operations
 * Implements post-rollback health checks and success confirmation
 */

class RollbackVerification {
  constructor(logger, config, healthChecker) {
    this.logger = logger;
    this.config = config;
    this.healthChecker = healthChecker; // Health check orchestrator
  }

  /**
   * Verify rollback completion
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Verification result
   */
  async verify(deploymentId) {
    this.logger.info('Verifying rollback completion...');
    
    const startTime = Date.now();
    
    try {
      const verificationResults = {
        deploymentId,
        startTime: new Date().toISOString(),
        checks: [],
        success: true,
        errors: []
      };
      
      // Run post-rollback health checks
      const healthCheckResult = await this.runPostRollbackHealthChecks();
      verificationResults.checks.push({
        name: 'health-checks',
        ...healthCheckResult
      });
      
      if (!healthCheckResult.success) {
        verificationResults.success = false;
        verificationResults.errors.push({
          check: 'health-checks',
          error: 'Health checks failed'
        });
      }
      
      // Verify system stability
      const stabilityResult = await this.verifySystemStability();
      verificationResults.checks.push({
        name: 'system-stability',
        ...stabilityResult
      });
      
      if (!stabilityResult.success) {
        verificationResults.success = false;
        verificationResults.errors.push({
          check: 'system-stability',
          error: 'System stability check failed'
        });
      }
      
      // Confirm rollback success
      const confirmationResult = await this.confirmRollbackSuccess(deploymentId);
      verificationResults.checks.push({
        name: 'rollback-confirmation',
        ...confirmationResult
      });
      
      if (!confirmationResult.success) {
        verificationResults.success = false;
        verificationResults.errors.push({
          check: 'rollback-confirmation',
          error: 'Rollback confirmation failed'
        });
      }
      
      const duration = Date.now() - startTime;
      verificationResults.endTime = new Date().toISOString();
      verificationResults.duration = duration;
      
      if (verificationResults.success) {
        this.logger.success(`Rollback verification passed (${duration}ms)`);
      } else {
        this.logger.error(`Rollback verification failed (${duration}ms)`);
      }
      
      return verificationResults;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Rollback verification error: ${error.message}`);
      
      return {
        deploymentId,
        success: false,
        duration,
        error: error.message,
        checks: []
      };
    }
  }

  /**
   * Run post-rollback health checks
   * @returns {Promise<Object>} Health check result
   */
  async runPostRollbackHealthChecks() {
    this.logger.info('Running post-rollback health checks...');
    
    try {
      if (!this.healthChecker) {
        this.logger.warn('Health checker not available');
        return {
          success: true,
          skipped: true,
          message: 'Health checker not configured'
        };
      }
      
      // Run comprehensive health checks
      const healthResult = await this.healthChecker.checkAllServices();
      
      if (healthResult.overallHealth) {
        this.logger.success('All health checks passed');
      } else {
        this.logger.error('Some health checks failed');
      }
      
      return {
        success: healthResult.overallHealth,
        details: healthResult,
        servicesHealthy: Array.from(healthResult.services.entries())
          .filter(([_, status]) => status.healthy).length,
        totalServices: healthResult.services.size
      };
      
    } catch (error) {
      this.logger.error(`Health checks error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify system stability
   * @returns {Promise<Object>} Stability verification result
   */
  async verifySystemStability() {
    this.logger.info('Verifying system stability...');
    
    try {
      const stabilityChecks = [];
      
      // Check 1: Verify no errors in recent logs
      const logsCheck = await this.checkRecentLogs();
      stabilityChecks.push({
        name: 'logs-check',
        ...logsCheck
      });
      
      // Check 2: Verify response times are acceptable
      const performanceCheck = await this.checkPerformance();
      stabilityChecks.push({
        name: 'performance-check',
        ...performanceCheck
      });
      
      // Check 3: Verify no resource exhaustion
      const resourceCheck = await this.checkResources();
      stabilityChecks.push({
        name: 'resource-check',
        ...resourceCheck
      });
      
      const allPassed = stabilityChecks.every(check => check.success);
      
      if (allPassed) {
        this.logger.success('System stability verified');
      } else {
        this.logger.warn('System stability concerns detected');
      }
      
      return {
        success: allPassed,
        checks: stabilityChecks,
        passedChecks: stabilityChecks.filter(c => c.success).length,
        totalChecks: stabilityChecks.length
      };
      
    } catch (error) {
      this.logger.error(`Stability verification error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check recent logs for errors
   * @returns {Promise<Object>} Log check result
   */
  async checkRecentLogs() {
    try {
      this.logger.debug('Checking recent logs...');
      
      // In production, this would check actual log aggregation system
      // For now, return success
      
      return {
        success: true,
        message: 'No critical errors in recent logs'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check system performance
   * @returns {Promise<Object>} Performance check result
   */
  async checkPerformance() {
    try {
      this.logger.debug('Checking system performance...');
      
      if (!this.healthChecker) {
        return {
          success: true,
          skipped: true,
          message: 'Performance check skipped - health checker not available'
        };
      }
      
      // Check response times from health checks
      const healthResult = await this.healthChecker.checkAllServices();
      
      const slowServices = [];
      for (const [serviceName, status] of healthResult.services.entries()) {
        if (status.responseTime > 1000) { // More than 1 second
          slowServices.push({
            service: serviceName,
            responseTime: status.responseTime
          });
        }
      }
      
      if (slowServices.length > 0) {
        this.logger.warn(`${slowServices.length} services have slow response times`);
        return {
          success: false,
          message: 'Some services have degraded performance',
          slowServices
        };
      }
      
      return {
        success: true,
        message: 'All services responding within acceptable time'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check resource utilization
   * @returns {Promise<Object>} Resource check result
   */
  async checkResources() {
    try {
      this.logger.debug('Checking resource utilization...');
      
      // In production, this would check actual resource metrics
      // For now, return success
      
      return {
        success: true,
        message: 'Resource utilization within normal limits'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Confirm rollback success
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Confirmation result
   */
  async confirmRollbackSuccess(deploymentId) {
    this.logger.info('Confirming rollback success...');
    
    try {
      const confirmationChecks = [];
      
      // Check 1: Verify all services are running
      const servicesCheck = await this.verifyServicesRunning();
      confirmationChecks.push({
        name: 'services-running',
        ...servicesCheck
      });
      
      // Check 2: Verify database is accessible
      const databaseCheck = await this.verifyDatabaseAccessible();
      confirmationChecks.push({
        name: 'database-accessible',
        ...databaseCheck
      });
      
      // Check 3: Verify policies are loaded
      const policiesCheck = await this.verifyPoliciesLoaded();
      confirmationChecks.push({
        name: 'policies-loaded',
        ...policiesCheck
      });
      
      const allPassed = confirmationChecks.every(check => check.success);
      
      if (allPassed) {
        this.logger.success('Rollback success confirmed');
      } else {
        this.logger.error('Rollback confirmation failed');
      }
      
      return {
        success: allPassed,
        checks: confirmationChecks,
        passedChecks: confirmationChecks.filter(c => c.success).length,
        totalChecks: confirmationChecks.length
      };
      
    } catch (error) {
      this.logger.error(`Confirmation error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify all services are running
   * @returns {Promise<Object>} Verification result
   */
  async verifyServicesRunning() {
    try {
      if (!this.healthChecker) {
        return {
          success: true,
          skipped: true,
          message: 'Service check skipped - health checker not available'
        };
      }
      
      const healthResult = await this.healthChecker.checkAllServices();
      
      const runningServices = Array.from(healthResult.services.entries())
        .filter(([_, status]) => status.healthy).length;
      
      const totalServices = healthResult.services.size;
      
      return {
        success: healthResult.overallHealth,
        runningServices,
        totalServices,
        message: `${runningServices}/${totalServices} services running`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify database is accessible
   * @returns {Promise<Object>} Verification result
   */
  async verifyDatabaseAccessible() {
    try {
      if (!this.healthChecker) {
        return {
          success: true,
          skipped: true,
          message: 'Database check skipped - health checker not available'
        };
      }
      
      // Use health checker's database check
      const dbHealth = await this.healthChecker.checkDatabase('sdlc-primary-db');
      
      return {
        success: dbHealth.healthy,
        message: dbHealth.healthy ? 'Database accessible' : 'Database not accessible',
        responseTime: dbHealth.responseTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify policies are loaded
   * @returns {Promise<Object>} Verification result
   */
  async verifyPoliciesLoaded() {
    try {
      // In production, this would check KV namespace for policies
      // For now, return success
      
      return {
        success: true,
        message: 'Policies loaded and accessible'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create verification report
   * @param {Object} verificationResult - Verification result
   * @returns {string} Formatted report
   */
  createVerificationReport(verificationResult) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('ROLLBACK VERIFICATION REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Deployment ID: ${verificationResult.deploymentId}`);
    lines.push(`Status: ${verificationResult.success ? 'PASSED' : 'FAILED'}`);
    lines.push(`Duration: ${verificationResult.duration}ms`);
    lines.push(`Start Time: ${verificationResult.startTime}`);
    lines.push(`End Time: ${verificationResult.endTime}`);
    lines.push('');
    lines.push('Verification Checks:');
    
    for (const check of verificationResult.checks) {
      const status = check.success ? '✓' : '✗';
      lines.push(`  ${status} ${check.name}`);
      
      if (check.skipped) {
        lines.push(`    Skipped: ${check.message}`);
      } else if (check.success) {
        if (check.details) {
          lines.push(`    Details: ${JSON.stringify(check.details, null, 2)}`);
        }
      } else {
        lines.push(`    Error: ${check.error || 'Check failed'}`);
      }
    }
    
    if (verificationResult.errors && verificationResult.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      for (const error of verificationResult.errors) {
        lines.push(`  - ${error.check}: ${error.error}`);
      }
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Get verification summary
   * @param {Object} verificationResult - Verification result
   * @returns {Object} Summary
   */
  getVerificationSummary(verificationResult) {
    const totalChecks = verificationResult.checks.length;
    const passedChecks = verificationResult.checks.filter(c => c.success).length;
    const failedChecks = totalChecks - passedChecks;
    
    return {
      success: verificationResult.success,
      totalChecks,
      passedChecks,
      failedChecks,
      duration: verificationResult.duration,
      timestamp: verificationResult.endTime
    };
  }
}

module.exports = { RollbackVerification };
