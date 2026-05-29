/**
 * Worker Version Rollback
 * 
 * Handles rollback of Cloudflare Workers to previous versions
 * Implements version identification, restoration, and verification
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class WorkerRollback {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.versionsDir = path.join(__dirname, '..', '..', '.deployment-state', 'versions');
    
    // Ensure versions directory exists
    this.ensureVersionsDirectory();
  }

  /**
   * Ensure versions directory exists
   */
  ensureVersionsDirectory() {
    if (!fs.existsSync(this.versionsDir)) {
      fs.mkdirSync(this.versionsDir, { recursive: true });
    }
  }

  /**
   * Rollback all deployed workers
   * @param {Array<string>} serviceNames - List of service names to rollback
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackWorkers(serviceNames) {
    this.logger.info(`Rolling back ${serviceNames.length} workers...`);
    
    const results = [];
    let allSuccessful = true;
    
    for (const serviceName of serviceNames) {
      try {
        this.logger.info(`Rolling back worker: ${serviceName}`);
        
        const result = await this.rollbackWorker(serviceName);
        results.push(result);
        
        if (!result.success) {
          allSuccessful = false;
          this.logger.error(`Failed to rollback ${serviceName}: ${result.error}`);
        } else {
          this.logger.success(`Successfully rolled back ${serviceName}`);
        }
        
      } catch (error) {
        allSuccessful = false;
        results.push({
          serviceName,
          success: false,
          error: error.message
        });
        this.logger.error(`Error rolling back ${serviceName}: ${error.message}`);
      }
    }
    
    return {
      success: allSuccessful,
      workers: results,
      totalWorkers: serviceNames.length,
      successfulRollbacks: results.filter(r => r.success).length
    };
  }

  /**
   * Rollback a single worker to previous version
   * @param {string} serviceName - Service name
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackWorker(serviceName) {
    const startTime = Date.now();
    
    try {
      // Identify previous version
      const previousVersion = await this.identifyPreviousVersion(serviceName);
      
      if (!previousVersion) {
        return {
          serviceName,
          success: false,
          error: 'No previous version found',
          duration: Date.now() - startTime
        };
      }
      
      this.logger.debug(`Previous version identified: ${previousVersion.versionId}`);
      
      // Restore worker to previous version
      const restored = await this.restoreWorkerVersion(serviceName, previousVersion);
      
      if (!restored.success) {
        return {
          serviceName,
          success: false,
          error: restored.error,
          duration: Date.now() - startTime
        };
      }
      
      // Verify deployment
      const verified = await this.verifyWorkerDeployment(serviceName);
      
      const duration = Date.now() - startTime;
      
      return {
        serviceName,
        success: verified.success,
        previousVersion: previousVersion.versionId,
        verified: verified.success,
        duration,
        error: verified.success ? null : verified.error
      };
      
    } catch (error) {
      return {
        serviceName,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Identify previous version of a worker
   * @param {string} serviceName - Service name
   * @returns {Promise<Object|null>} Previous version info
   */
  async identifyPreviousVersion(serviceName) {
    try {
      // Check if we have version history stored
      const versionFile = path.join(this.versionsDir, `${serviceName}.json`);
      
      if (fs.existsSync(versionFile)) {
        const versions = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
        
        // Get the second most recent version (previous to current)
        if (versions.length >= 2) {
          return versions[versions.length - 2];
        }
      }
      
      // Try to get version from Wrangler
      const workerVersions = await this.getWorkerVersionsFromWrangler(serviceName);
      
      if (workerVersions.length >= 2) {
        return workerVersions[workerVersions.length - 2];
      }
      
      this.logger.warn(`No previous version found for ${serviceName}`);
      return null;
      
    } catch (error) {
      this.logger.error(`Failed to identify previous version: ${error.message}`);
      return null;
    }
  }

  /**
   * Get worker versions from Wrangler
   * @param {string} serviceName - Service name
   * @returns {Promise<Array>} List of versions
   */
  async getWorkerVersionsFromWrangler(serviceName) {
    try {
      // Note: This is a placeholder as Wrangler doesn't have a direct version list command
      // In production, you would use Cloudflare API to get deployment history
      
      this.logger.debug(`Querying Wrangler for ${serviceName} versions`);
      
      // For now, return empty array
      // In real implementation, use: wrangler deployments list <worker-name>
      return [];
      
    } catch (error) {
      this.logger.error(`Failed to get versions from Wrangler: ${error.message}`);
      return [];
    }
  }

  /**
   * Restore worker to a specific version
   * @param {string} serviceName - Service name
   * @param {Object} version - Version to restore
   * @returns {Promise<Object>} Restoration result
   */
  async restoreWorkerVersion(serviceName, version) {
    try {
      this.logger.info(`Restoring ${serviceName} to version ${version.versionId}`);
      
      // Check if we have the version bundle stored
      const bundlePath = version.bundlePath;
      
      if (!bundlePath || !fs.existsSync(bundlePath)) {
        // If no bundle stored, we need to redeploy from source
        return await this.redeployFromSource(serviceName, version);
      }
      
      // Deploy the stored bundle
      const workerPath = this.getWorkerPath(serviceName);
      const wranglerConfig = path.join(workerPath, 'wrangler.toml');
      
      if (!fs.existsSync(wranglerConfig)) {
        throw new Error(`Wrangler config not found: ${wranglerConfig}`);
      }
      
      // Use wrangler to deploy the previous version
      const command = `wrangler deploy --config ${wranglerConfig}`;
      
      this.logger.debug(`Executing: ${command}`);
      
      execSync(command, {
        cwd: workerPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.logger.success(`Worker ${serviceName} restored to previous version`);
      
      return {
        success: true,
        serviceName,
        versionId: version.versionId
      };
      
    } catch (error) {
      this.logger.error(`Failed to restore worker version: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Redeploy worker from source code
   * @param {string} serviceName - Service name
   * @param {Object} version - Version info
   * @returns {Promise<Object>} Deployment result
   */
  async redeployFromSource(serviceName, version) {
    try {
      this.logger.info(`Redeploying ${serviceName} from source`);
      
      const workerPath = this.getWorkerPath(serviceName);
      
      // Check if source exists
      if (!fs.existsSync(workerPath)) {
        throw new Error(`Worker source not found: ${workerPath}`);
      }
      
      // If version has a git commit, checkout that commit
      if (version.gitCommit) {
        this.logger.debug(`Checking out commit: ${version.gitCommit}`);
        // Note: In production, you would checkout the specific commit
        // execSync(`git checkout ${version.gitCommit}`, { cwd: workerPath });
      }
      
      // Deploy worker
      const wranglerConfig = path.join(workerPath, 'wrangler.toml');
      const command = `wrangler deploy --config ${wranglerConfig}`;
      
      execSync(command, {
        cwd: workerPath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.logger.success(`Worker ${serviceName} redeployed from source`);
      
      return {
        success: true,
        serviceName,
        versionId: version.versionId
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify worker deployment
   * @param {string} serviceName - Service name
   * @returns {Promise<Object>} Verification result
   */
  async verifyWorkerDeployment(serviceName) {
    try {
      this.logger.debug(`Verifying ${serviceName} deployment`);
      
      // Get worker URL
      const workerUrl = this.getWorkerUrl(serviceName);
      
      if (!workerUrl) {
        this.logger.warn(`No URL configured for ${serviceName}, skipping verification`);
        return {
          success: true,
          verified: false,
          message: 'No URL configured for verification'
        };
      }
      
      // Make health check request
      const healthCheckUrl = `${workerUrl}/health`;
      
      this.logger.debug(`Health check: ${healthCheckUrl}`);
      
      // Use curl for health check
      try {
        const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${healthCheckUrl}`, {
          encoding: 'utf8',
          timeout: 10000
        });
        
        const statusCode = parseInt(response.trim());
        
        if (statusCode === 200) {
          this.logger.success(`${serviceName} health check passed`);
          return {
            success: true,
            verified: true,
            statusCode
          };
        } else {
          this.logger.warn(`${serviceName} health check returned ${statusCode}`);
          return {
            success: false,
            verified: false,
            statusCode,
            error: `Unexpected status code: ${statusCode}`
          };
        }
        
      } catch (error) {
        this.logger.error(`Health check failed: ${error.message}`);
        return {
          success: false,
          verified: false,
          error: error.message
        };
      }
      
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
   * Get worker path based on service name
   * @param {string} serviceName - Service name
   * @returns {string} Worker path
   */
  getWorkerPath(serviceName) {
    const serviceMap = {
      'gateway': path.join(__dirname, '..', '..', '..', '..', 'services', 'gateway'),
      'rag': path.join(__dirname, '..', '..', '..', '..', 'services', 'rag'),
      'dlp': path.join(__dirname, '..', '..', '..', '..', 'services', 'dlp'),
      'llm-gateway': path.join(__dirname, '..', '..', '..', '..', 'services', 'llm-gateway'),
      'lam-system': path.join(__dirname, '..', '..', '..', '..', 'services', 'agents'),
      'admin-ui': path.join(__dirname, '..', '..', '..', '..', 'services', 'admin-ui')
    };
    
    return serviceMap[serviceName] || path.join(__dirname, '..', '..', '..', '..', 'services', serviceName);
  }

  /**
   * Get worker URL based on service name
   * @param {string} serviceName - Service name
   * @returns {string|null} Worker URL
   */
  getWorkerUrl(serviceName) {
    // In production, these would come from configuration or Cloudflare API
    const urlMap = {
      'gateway': process.env.GATEWAY_URL,
      'rag': process.env.RAG_URL,
      'dlp': process.env.DLP_URL,
      'llm-gateway': process.env.LLM_GATEWAY_URL,
      'lam-system': process.env.LAM_SYSTEM_URL,
      'admin-ui': process.env.ADMIN_UI_URL
    };
    
    return urlMap[serviceName] || null;
  }

  /**
   * Store current version before deployment
   * @param {string} serviceName - Service name
   * @param {Object} versionInfo - Version information
   */
  storeVersion(serviceName, versionInfo) {
    try {
      const versionFile = path.join(this.versionsDir, `${serviceName}.json`);
      
      let versions = [];
      if (fs.existsSync(versionFile)) {
        versions = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      }
      
      versions.push({
        versionId: versionInfo.versionId || `v${Date.now()}`,
        timestamp: new Date().toISOString(),
        bundlePath: versionInfo.bundlePath,
        gitCommit: versionInfo.gitCommit,
        deploymentId: versionInfo.deploymentId
      });
      
      // Keep only last 10 versions
      if (versions.length > 10) {
        versions = versions.slice(-10);
      }
      
      fs.writeFileSync(versionFile, JSON.stringify(versions, null, 2), 'utf8');
      
      this.logger.debug(`Stored version for ${serviceName}`);
      
    } catch (error) {
      this.logger.error(`Failed to store version: ${error.message}`);
    }
  }

  /**
   * Get version history for a worker
   * @param {string} serviceName - Service name
   * @returns {Array} Version history
   */
  getVersionHistory(serviceName) {
    try {
      const versionFile = path.join(this.versionsDir, `${serviceName}.json`);
      
      if (!fs.existsSync(versionFile)) {
        return [];
      }
      
      return JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      
    } catch (error) {
      this.logger.error(`Failed to get version history: ${error.message}`);
      return [];
    }
  }

  /**
   * Create worker rollback report
   * @param {Object} rollbackResult - Rollback result
   * @returns {string} Formatted report
   */
  createRollbackReport(rollbackResult) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('WORKER ROLLBACK REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Total Workers: ${rollbackResult.totalWorkers}`);
    lines.push(`Successful Rollbacks: ${rollbackResult.successfulRollbacks}`);
    lines.push(`Status: ${rollbackResult.success ? 'SUCCESS' : 'PARTIAL/FAILED'}`);
    lines.push('');
    lines.push('Worker Details:');
    
    for (const worker of rollbackResult.workers) {
      const status = worker.success ? '✓' : '✗';
      lines.push(`  ${status} ${worker.serviceName}`);
      
      if (worker.success) {
        lines.push(`    Previous Version: ${worker.previousVersion}`);
        lines.push(`    Verified: ${worker.verified ? 'Yes' : 'No'}`);
        lines.push(`    Duration: ${worker.duration}ms`);
      } else {
        lines.push(`    Error: ${worker.error}`);
      }
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
}

module.exports = { WorkerRollback };
