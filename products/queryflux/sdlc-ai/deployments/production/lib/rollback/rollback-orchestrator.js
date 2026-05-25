/**
 * Rollback Orchestrator
 * 
 * Coordinates rollback operations across all system components
 * Implements rollback trigger detection, phase coordination, and verification
 */

class RollbackOrchestrator {
  constructor(logger, stateManager, config) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.config = config;
    
    // Rollback handlers will be injected
    this.workerRollback = null;
    this.databaseRollback = null;
    this.policyRollback = null;
    this.verificationSystem = null;
    this.auditLogger = null;
  }

  /**
   * Set rollback handlers
   * @param {Object} handlers - Rollback handler instances
   */
  setHandlers(handlers) {
    this.workerRollback = handlers.workerRollback;
    this.databaseRollback = handlers.databaseRollback;
    this.policyRollback = handlers.policyRollback;
    this.verificationSystem = handlers.verificationSystem;
    this.auditLogger = handlers.auditLogger;
  }

  /**
   * Detect if rollback should be triggered
   * @param {string} deploymentId - Deployment ID
   * @param {Error} error - Error that occurred
   * @param {string} phase - Phase where error occurred
   * @returns {boolean} True if rollback should be triggered
   */
  shouldTriggerRollback(deploymentId, error, phase) {
    this.logger.debug(`Evaluating rollback trigger for phase: ${phase}`);
    
    // Phases that require rollback
    const rollbackPhases = [
      'service-deployment',
      'database-migration',
      'health-check',
      'policy-loading'
    ];
    
    // Check if phase requires rollback
    if (!rollbackPhases.includes(phase)) {
      this.logger.debug(`Phase ${phase} does not require rollback`);
      return false;
    }
    
    // Check if auto-rollback is enabled
    if (this.config.autoRollback === false) {
      this.logger.warn('Auto-rollback is disabled in configuration');
      return false;
    }
    
    // Check error severity
    const severity = this.classifyErrorSeverity(error);
    if (severity === 'LOW') {
      this.logger.debug('Error severity is low, rollback not required');
      return false;
    }
    
    this.logger.warn(`Rollback trigger detected: ${error.message}`);
    return true;
  }

  /**
   * Classify error severity
   * @param {Error} error - Error to classify
   * @returns {string} Severity level
   */
  classifyErrorSeverity(error) {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (message.includes('health check failed') ||
        message.includes('service unavailable') ||
        message.includes('database migration failed') ||
        message.includes('deployment failed')) {
      return 'CRITICAL';
    }
    
    // High severity errors
    if (message.includes('timeout') ||
        message.includes('connection refused') ||
        message.includes('authentication failed')) {
      return 'HIGH';
    }
    
    // Medium severity errors
    if (message.includes('warning') ||
        message.includes('deprecated')) {
      return 'MEDIUM';
    }
    
    // Low severity errors
    return 'LOW';
  }

  /**
   * Execute complete rollback process
   * @param {string} deploymentId - Deployment ID to rollback
   * @param {string} reason - Reason for rollback
   * @returns {Promise<Object>} Rollback result
   */
  async executeRollback(deploymentId, reason) {
    this.logger.phase('INITIATING ROLLBACK');
    this.logger.warn(`Reason: ${reason}`);
    
    const startTime = Date.now();
    
    try {
      // Update deployment state
      this.stateManager.startRollback(deploymentId);
      
      // Log rollback initiation
      if (this.auditLogger) {
        await this.auditLogger.logRollbackStart(deploymentId, reason);
      }
      
      // Get deployment details
      const deployment = this.stateManager.getDeploymentStatus(deploymentId);
      
      // Execute rollback phases in reverse order
      const rollbackPhases = [
        { name: 'workers', handler: this.workerRollback },
        { name: 'database', handler: this.databaseRollback },
        { name: 'policies', handler: this.policyRollback }
      ];
      
      const results = {
        deploymentId,
        reason,
        startTime: new Date().toISOString(),
        phases: [],
        success: true,
        errors: []
      };
      
      // Execute each rollback phase
      for (const phase of rollbackPhases) {
        try {
          this.logger.info(`Rolling back ${phase.name}...`);
          
          const phaseStartTime = Date.now();
          let phaseResult = null;
          
          if (phase.handler) {
            phaseResult = await this.executeRollbackPhase(
              phase.name,
              phase.handler,
              deployment
            );
          } else {
            this.logger.warn(`No handler configured for ${phase.name} rollback`);
            phaseResult = { success: true, skipped: true };
          }
          
          const phaseDuration = Date.now() - phaseStartTime;
          
          results.phases.push({
            name: phase.name,
            success: phaseResult.success,
            duration: phaseDuration,
            details: phaseResult
          });
          
          if (!phaseResult.success) {
            results.success = false;
            results.errors.push({
              phase: phase.name,
              error: phaseResult.error
            });
            this.logger.error(`${phase.name} rollback failed: ${phaseResult.error}`);
          } else {
            this.logger.success(`${phase.name} rollback completed`);
          }
          
        } catch (error) {
          results.success = false;
          results.errors.push({
            phase: phase.name,
            error: error.message
          });
          this.logger.error(`${phase.name} rollback error: ${error.message}`);
        }
      }
      
      // Verify rollback if verification system is available
      if (this.verificationSystem && results.success) {
        this.logger.info('Verifying rollback...');
        
        const verificationResult = await this.verificationSystem.verify(deploymentId);
        results.verified = verificationResult.success;
        results.verificationDetails = verificationResult;
        
        if (!verificationResult.success) {
          this.logger.error('Rollback verification failed');
          results.success = false;
        } else {
          this.logger.success('Rollback verification passed');
        }
      }
      
      const duration = Date.now() - startTime;
      results.endTime = new Date().toISOString();
      results.duration = duration;
      
      // Update deployment state
      if (results.success) {
        this.stateManager.completeRollback(deploymentId);
        this.logger.success(`Rollback completed successfully (${duration}ms)`);
      } else {
        this.logger.error(`Rollback completed with errors (${duration}ms)`);
      }
      
      // Log rollback completion
      if (this.auditLogger) {
        await this.auditLogger.logRollbackComplete(deploymentId, results);
      }
      
      return results;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Rollback orchestration failed: ${error.message}`);
      
      // Log rollback failure
      if (this.auditLogger) {
        await this.auditLogger.logRollbackError(deploymentId, error);
      }
      
      return {
        deploymentId,
        reason,
        success: false,
        duration,
        error: error.message,
        phases: []
      };
    }
  }

  /**
   * Execute a single rollback phase
   * @param {string} phaseName - Name of the phase
   * @param {Object} handler - Rollback handler
   * @param {Object} deployment - Deployment details
   * @returns {Promise<Object>} Phase result
   */
  async executeRollbackPhase(phaseName, handler, deployment) {
    try {
      let result;
      
      switch (phaseName) {
        case 'workers':
          result = await handler.rollbackWorkers(deployment.servicesDeployed);
          break;
          
        case 'database':
          result = await handler.rollbackDatabase(deployment.id);
          break;
          
        case 'policies':
          result = await handler.rollbackPolicies(deployment.id);
          break;
          
        default:
          throw new Error(`Unknown rollback phase: ${phaseName}`);
      }
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get rollback status
   * @param {string} deploymentId - Deployment ID
   * @returns {Object} Rollback status
   */
  getRollbackStatus(deploymentId) {
    const deployment = this.stateManager.getDeploymentStatus(deploymentId);
    
    return {
      deploymentId,
      status: deployment.status,
      isRollingBack: deployment.status === 'rolling-back',
      isRolledBack: deployment.status === 'rolled-back',
      rollbackStartTime: deployment.rollbackStartTime,
      rollbackEndTime: deployment.rollbackEndTime
    };
  }

  /**
   * Coordinate rollback phases
   * @param {string} deploymentId - Deployment ID
   * @param {Array<string>} phases - Phases to rollback
   * @returns {Promise<Object>} Coordination result
   */
  async coordinateRollbackPhases(deploymentId, phases) {
    this.logger.info(`Coordinating rollback for ${phases.length} phases`);
    
    const results = [];
    
    for (const phase of phases) {
      try {
        this.logger.info(`Coordinating ${phase} rollback...`);
        
        const handler = this.getHandlerForPhase(phase);
        if (!handler) {
          this.logger.warn(`No handler for phase: ${phase}`);
          continue;
        }
        
        const deployment = this.stateManager.getDeploymentStatus(deploymentId);
        const result = await this.executeRollbackPhase(phase, handler, deployment);
        
        results.push({
          phase,
          success: result.success,
          result
        });
        
      } catch (error) {
        this.logger.error(`Phase coordination failed: ${error.message}`);
        results.push({
          phase,
          success: false,
          error: error.message
        });
      }
    }
    
    const allSuccessful = results.every(r => r.success);
    
    return {
      success: allSuccessful,
      phases: results,
      totalPhases: phases.length,
      successfulPhases: results.filter(r => r.success).length
    };
  }

  /**
   * Get handler for specific phase
   * @param {string} phase - Phase name
   * @returns {Object|null} Handler instance
   */
  getHandlerForPhase(phase) {
    const handlers = {
      'workers': this.workerRollback,
      'database': this.databaseRollback,
      'policies': this.policyRollback
    };
    
    return handlers[phase] || null;
  }

  /**
   * Verify rollback completion
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Verification result
   */
  async verifyRollbackCompletion(deploymentId) {
    this.logger.info('Verifying rollback completion...');
    
    if (!this.verificationSystem) {
      this.logger.warn('No verification system configured');
      return {
        success: true,
        verified: false,
        message: 'Verification system not available'
      };
    }
    
    try {
      const result = await this.verificationSystem.verify(deploymentId);
      
      if (result.success) {
        this.logger.success('Rollback verification passed');
      } else {
        this.logger.error('Rollback verification failed');
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Verification error: ${error.message}`);
      return {
        success: false,
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Create rollback summary report
   * @param {Object} rollbackResult - Rollback result
   * @returns {string} Formatted report
   */
  createRollbackReport(rollbackResult) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('ROLLBACK SUMMARY REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Deployment ID: ${rollbackResult.deploymentId}`);
    lines.push(`Reason: ${rollbackResult.reason}`);
    lines.push(`Status: ${rollbackResult.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Duration: ${rollbackResult.duration}ms`);
    lines.push(`Start Time: ${rollbackResult.startTime}`);
    lines.push(`End Time: ${rollbackResult.endTime}`);
    
    if (rollbackResult.verified !== undefined) {
      lines.push(`Verified: ${rollbackResult.verified ? 'Yes' : 'No'}`);
    }
    
    lines.push('');
    lines.push('Rollback Phases:');
    
    for (const phase of rollbackResult.phases) {
      const status = phase.success ? '✓' : '✗';
      lines.push(`  ${status} ${phase.name} (${phase.duration}ms)`);
      
      if (!phase.success && phase.details && phase.details.error) {
        lines.push(`    Error: ${phase.details.error}`);
      }
    }
    
    if (rollbackResult.errors && rollbackResult.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      for (const error of rollbackResult.errors) {
        lines.push(`  - ${error.phase}: ${error.error}`);
      }
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
}

module.exports = { RollbackOrchestrator };
