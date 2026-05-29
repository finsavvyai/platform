/**
 * Policy Rollback Handler
 * 
 * Handles rollback of compliance policies to previous versions
 * Implements version identification, restoration, and verification
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PolicyRollback {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.policiesDir = path.join(__dirname, '..', '..', '..', '..', 'compliance-platform', 'policies');
    this.versionsDir = path.join(__dirname, '..', '..', '.deployment-state', 'policy-versions');
    
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
   * Rollback all policies to previous versions
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackPolicies(deploymentId) {
    this.logger.info('Rolling back policies...');
    
    const startTime = Date.now();
    
    try {
      // Get list of policy frameworks
      const frameworks = this.getPolicyFrameworks();
      
      const results = [];
      let allSuccessful = true;
      
      for (const framework of frameworks) {
        try {
          this.logger.info(`Rolling back policy: ${framework}`);
          
          const result = await this.rollbackPolicy(framework, deploymentId);
          results.push(result);
          
          if (!result.success) {
            allSuccessful = false;
            this.logger.error(`Failed to rollback ${framework}: ${result.error}`);
          } else {
            this.logger.success(`Successfully rolled back ${framework}`);
          }
          
        } catch (error) {
          allSuccessful = false;
          results.push({
            framework,
            success: false,
            error: error.message
          });
          this.logger.error(`Error rolling back ${framework}: ${error.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        success: allSuccessful,
        policies: results,
        totalPolicies: frameworks.length,
        successfulRollbacks: results.filter(r => r.success).length,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Policy rollback failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Get list of policy frameworks
   * @returns {Array<string>} Framework names
   */
  getPolicyFrameworks() {
    return ['hipaa', 'gdpr', 'pcidss', 'finra'];
  }

  /**
   * Rollback a single policy to previous version
   * @param {string} framework - Policy framework name
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackPolicy(framework, deploymentId) {
    const startTime = Date.now();
    
    try {
      // Identify previous version
      const previousVersion = await this.identifyPreviousVersion(framework, deploymentId);
      
      if (!previousVersion) {
        return {
          framework,
          success: false,
          error: 'No previous version found',
          duration: Date.now() - startTime
        };
      }
      
      this.logger.debug(`Previous version identified: ${previousVersion.versionId}`);
      
      // Restore policy to previous version
      const restored = await this.restorePolicyVersion(framework, previousVersion);
      
      if (!restored.success) {
        return {
          framework,
          success: false,
          error: restored.error,
          duration: Date.now() - startTime
        };
      }
      
      // Verify policy restoration
      const verified = await this.verifyPolicyRestoration(framework, previousVersion);
      
      const duration = Date.now() - startTime;
      
      return {
        framework,
        success: verified.success,
        previousVersion: previousVersion.versionId,
        verified: verified.success,
        duration,
        error: verified.success ? null : verified.error
      };
      
    } catch (error) {
      return {
        framework,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Identify previous version of a policy
   * @param {string} framework - Policy framework name
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object|null>} Previous version info
   */
  async identifyPreviousVersion(framework, deploymentId) {
    try {
      this.logger.debug(`Identifying previous version for ${framework}`);
      
      // Get version history
      const versions = this.getVersionHistory(framework);
      
      if (versions.length === 0) {
        this.logger.warn(`No version history found for ${framework}`);
        return null;
      }
      
      // Try to find version before this deployment
      const deploymentIndex = versions.findIndex(v => v.deploymentId === deploymentId);
      
      if (deploymentIndex > 0) {
        // Return the version before this deployment
        return versions[deploymentIndex - 1];
      } else if (versions.length >= 2) {
        // Return the second most recent version
        return versions[versions.length - 2];
      } else {
        // Only one version exists, return it
        return versions[0];
      }
      
    } catch (error) {
      this.logger.error(`Failed to identify previous version: ${error.message}`);
      return null;
    }
  }

  /**
   * Restore policy to a specific version
   * @param {string} framework - Policy framework name
   * @param {Object} version - Version to restore
   * @returns {Promise<Object>} Restoration result
   */
  async restorePolicyVersion(framework, version) {
    try {
      this.logger.info(`Restoring ${framework} to version ${version.versionId}`);
      
      // Load the policy content from version
      const policyContent = version.content;
      
      if (!policyContent) {
        throw new Error('Policy content not found in version');
      }
      
      // Store policy in KV namespace
      const stored = await this.storePolicyInKV(framework, policyContent, version.versionId);
      
      if (!stored) {
        throw new Error('Failed to store policy in KV');
      }
      
      this.logger.success(`Policy ${framework} restored to version ${version.versionId}`);
      
      return {
        success: true,
        framework,
        versionId: version.versionId
      };
      
    } catch (error) {
      this.logger.error(`Failed to restore policy version: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Store policy in KV namespace
   * @param {string} framework - Policy framework name
   * @param {Object} policyContent - Policy content
   * @param {string} versionId - Version ID
   * @returns {Promise<boolean>} True if successful
   */
  async storePolicyInKV(framework, policyContent, versionId) {
    try {
      // Create temporary file with policy content
      const tempFile = path.join(__dirname, `temp-policy-${framework}-${Date.now()}.json`);
      fs.writeFileSync(tempFile, JSON.stringify(policyContent, null, 2), 'utf8');
      
      try {
        // Store in KV using wrangler
        const kvNamespace = this.config.kvNamespaces?.policies || 'POLICIES';
        const key = `policy:${framework}`;
        
        const command = `wrangler kv:key put --namespace-id=${kvNamespace} "${key}" --path="${tempFile}"`;
        
        this.logger.debug(`Executing: ${command}`);
        
        execSync(command, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Store version metadata
        const versionKey = `policy:${framework}:version`;
        const versionCommand = `wrangler kv:key put --namespace-id=${kvNamespace} "${versionKey}" "${versionId}"`;
        
        execSync(versionCommand, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        this.logger.success(`Policy ${framework} stored in KV`);
        
        return true;
        
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to store policy in KV: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify policy restoration
   * @param {string} framework - Policy framework name
   * @param {Object} version - Version that was restored
   * @returns {Promise<Object>} Verification result
   */
  async verifyPolicyRestoration(framework, version) {
    try {
      this.logger.debug(`Verifying ${framework} policy restoration`);
      
      // Retrieve policy from KV
      const policy = await this.retrievePolicyFromKV(framework);
      
      if (!policy) {
        return {
          success: false,
          error: 'Policy not found in KV'
        };
      }
      
      // Verify policy structure
      if (!policy.framework || !policy.rules) {
        return {
          success: false,
          error: 'Invalid policy structure'
        };
      }
      
      // Verify framework matches
      if (policy.framework !== framework) {
        return {
          success: false,
          error: 'Policy framework mismatch'
        };
      }
      
      this.logger.success(`Policy ${framework} verification passed`);
      
      return {
        success: true,
        verified: true
      };
      
    } catch (error) {
      this.logger.error(`Policy verification error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve policy from KV namespace
   * @param {string} framework - Policy framework name
   * @returns {Promise<Object|null>} Policy content
   */
  async retrievePolicyFromKV(framework) {
    try {
      const kvNamespace = this.config.kvNamespaces?.policies || 'POLICIES';
      const key = `policy:${framework}`;
      
      const command = `wrangler kv:key get --namespace-id=${kvNamespace} "${key}"`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return JSON.parse(output);
      
    } catch (error) {
      this.logger.error(`Failed to retrieve policy from KV: ${error.message}`);
      return null;
    }
  }

  /**
   * Store policy version before deployment
   * @param {string} framework - Policy framework name
   * @param {Object} policyContent - Policy content
   * @param {string} deploymentId - Deployment ID
   */
  storePolicyVersion(framework, policyContent, deploymentId) {
    try {
      const versionFile = path.join(this.versionsDir, `${framework}.json`);
      
      let versions = [];
      if (fs.existsSync(versionFile)) {
        versions = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      }
      
      versions.push({
        versionId: `v${Date.now()}`,
        timestamp: new Date().toISOString(),
        deploymentId,
        content: policyContent
      });
      
      // Keep only last 10 versions
      if (versions.length > 10) {
        versions = versions.slice(-10);
      }
      
      fs.writeFileSync(versionFile, JSON.stringify(versions, null, 2), 'utf8');
      
      this.logger.debug(`Stored version for ${framework} policy`);
      
    } catch (error) {
      this.logger.error(`Failed to store policy version: ${error.message}`);
    }
  }

  /**
   * Get version history for a policy
   * @param {string} framework - Policy framework name
   * @returns {Array} Version history
   */
  getVersionHistory(framework) {
    try {
      const versionFile = path.join(this.versionsDir, `${framework}.json`);
      
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
   * Get policy rollback status
   * @param {string} framework - Policy framework name
   * @returns {Object} Rollback status
   */
  getPolicyRollbackStatus(framework) {
    const versions = this.getVersionHistory(framework);
    
    return {
      framework,
      availableVersions: versions.length,
      mostRecentVersion: versions.length > 0 ? versions[versions.length - 1] : null,
      canRollback: versions.length > 1
    };
  }

  /**
   * Verify all policies are accessible after rollback
   * @returns {Promise<Object>} Verification result
   */
  async verifyAllPolicies() {
    this.logger.info('Verifying all policies...');
    
    const frameworks = this.getPolicyFrameworks();
    const results = [];
    
    for (const framework of frameworks) {
      try {
        const policy = await this.retrievePolicyFromKV(framework);
        const accessible = policy !== null;
        
        results.push({
          framework,
          accessible,
          success: accessible
        });
        
        if (accessible) {
          this.logger.success(`${framework} policy is accessible`);
        } else {
          this.logger.error(`${framework} policy is not accessible`);
        }
        
      } catch (error) {
        results.push({
          framework,
          accessible: false,
          success: false,
          error: error.message
        });
        this.logger.error(`Error verifying ${framework}: ${error.message}`);
      }
    }
    
    const allAccessible = results.every(r => r.accessible);
    
    return {
      success: allAccessible,
      policies: results,
      totalPolicies: frameworks.length,
      accessiblePolicies: results.filter(r => r.accessible).length
    };
  }

  /**
   * Create policy rollback report
   * @param {Object} rollbackResult - Rollback result
   * @returns {string} Formatted report
   */
  createRollbackReport(rollbackResult) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('POLICY ROLLBACK REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Total Policies: ${rollbackResult.totalPolicies}`);
    lines.push(`Successful Rollbacks: ${rollbackResult.successfulRollbacks}`);
    lines.push(`Status: ${rollbackResult.success ? 'SUCCESS' : 'PARTIAL/FAILED'}`);
    lines.push(`Duration: ${rollbackResult.duration}ms`);
    lines.push('');
    lines.push('Policy Details:');
    
    for (const policy of rollbackResult.policies) {
      const status = policy.success ? '✓' : '✗';
      lines.push(`  ${status} ${policy.framework}`);
      
      if (policy.success) {
        lines.push(`    Previous Version: ${policy.previousVersion}`);
        lines.push(`    Verified: ${policy.verified ? 'Yes' : 'No'}`);
        lines.push(`    Duration: ${policy.duration}ms`);
      } else {
        lines.push(`    Error: ${policy.error}`);
      }
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }
}

module.exports = { PolicyRollback };
