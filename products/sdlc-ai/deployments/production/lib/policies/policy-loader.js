/**
 * Policy Loader
 * 
 * Loads compliance policy files from the filesystem and prepares them for storage.
 * Supports HIPAA, GDPR, PCI DSS, and FINRA compliance frameworks.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const fs = require('fs').promises;
const path = require('path');

class PolicyLoader {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = {
      policiesDir: config.policiesDir || path.join(__dirname, '../../../../compliance-platform/policies'),
      supportedFrameworks: ['HIPAA', 'GDPR', 'PCI-DSS', 'FINRA'],
      ...config
    };
    
    this.loadedPolicies = new Map();
  }

  /**
   * Load a specific policy by framework name
   * @param {string} framework - Framework name (HIPAA, GDPR, PCI-DSS, FINRA)
   * @returns {Promise<Object>} Loaded policy object
   */
  async loadPolicy(framework) {
    const frameworkUpper = framework.toUpperCase();
    
    if (!this.config.supportedFrameworks.includes(frameworkUpper)) {
      throw new Error(`Unsupported framework: ${framework}. Supported: ${this.config.supportedFrameworks.join(', ')}`);
    }

    this.logger.info(`Loading ${frameworkUpper} policy...`);

    try {
      const policyPath = this._getPolicyPath(frameworkUpper);
      const policyContent = await this._readPolicyFile(policyPath);
      const policy = this._parsePolicy(policyContent, frameworkUpper);
      
      this.loadedPolicies.set(frameworkUpper, policy);
      
      this.logger.success(`✓ ${frameworkUpper} policy loaded successfully`);
      this.logger.info(`  Version: ${policy.version}`);
      this.logger.info(`  Rules: ${policy.rules?.length || 0}`);
      
      return policy;
    } catch (error) {
      this.logger.error(`Failed to load ${frameworkUpper} policy: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load HIPAA compliance policy
   * @returns {Promise<Object>} HIPAA policy object
   */
  async loadHIPAAPolicy() {
    return this.loadPolicy('HIPAA');
  }

  /**
   * Load GDPR compliance policy
   * @returns {Promise<Object>} GDPR policy object
   */
  async loadGDPRPolicy() {
    return this.loadPolicy('GDPR');
  }

  /**
   * Load PCI DSS compliance policy
   * @returns {Promise<Object>} PCI DSS policy object
   */
  async loadPCIDSSPolicy() {
    return this.loadPolicy('PCI-DSS');
  }

  /**
   * Load FINRA compliance policy
   * @returns {Promise<Object>} FINRA policy object
   */
  async loadFINRAPolicy() {
    return this.loadPolicy('FINRA');
  }

  /**
   * Load all supported policies
   * @returns {Promise<Object>} Object with all loaded policies
   */
  async loadAllPolicies() {
    this.logger.info('Loading all compliance policies...');
    
    const results = {
      success: true,
      policies: {},
      errors: [],
      warnings: []
    };

    for (const framework of this.config.supportedFrameworks) {
      try {
        const policy = await this.loadPolicy(framework);
        results.policies[framework] = policy;
      } catch (error) {
        results.success = false;
        results.errors.push(`${framework}: ${error.message}`);
        this.logger.warn(`⚠ Skipping ${framework} policy due to error`);
      }
    }

    if (results.success) {
      this.logger.success(`✓ All policies loaded successfully (${Object.keys(results.policies).length})`);
    } else {
      this.logger.warn(`⚠ Some policies failed to load (${results.errors.length} errors)`);
    }

    return results;
  }

  /**
   * Get a loaded policy from cache
   * @param {string} framework - Framework name
   * @returns {Object|null} Cached policy or null
   */
  getLoadedPolicy(framework) {
    return this.loadedPolicies.get(framework.toUpperCase()) || null;
  }

  /**
   * Get all loaded policies
   * @returns {Map} Map of all loaded policies
   */
  getAllLoadedPolicies() {
    return this.loadedPolicies;
  }

  /**
   * Clear loaded policies from memory
   */
  clearCache() {
    this.loadedPolicies.clear();
    this.logger.debug('Policy cache cleared');
  }

  /**
   * Get policy file path for a framework
   * @private
   */
  _getPolicyPath(framework) {
    const filename = framework.toLowerCase().replace('-', '') + '.json';
    return path.join(this.config.policiesDir, filename);
  }

  /**
   * Read policy file from filesystem
   * @private
   */
  async _readPolicyFile(policyPath) {
    try {
      const content = await fs.readFile(policyPath, 'utf8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Policy file not found: ${policyPath}`);
      }
      throw new Error(`Failed to read policy file: ${error.message}`);
    }
  }

  /**
   * Parse policy JSON content
   * @private
   */
  _parsePolicy(content, framework) {
    try {
      const policy = JSON.parse(content);
      
      // Ensure framework matches
      if (policy.framework && policy.framework.toUpperCase() !== framework) {
        this.logger.warn(`Policy framework mismatch: expected ${framework}, got ${policy.framework}`);
      }
      
      // Add metadata
      policy.loadedAt = new Date().toISOString();
      policy.framework = framework;
      
      return policy;
    } catch (error) {
      throw new Error(`Failed to parse policy JSON: ${error.message}`);
    }
  }

  /**
   * Check if a policy file exists
   * @param {string} framework - Framework name
   * @returns {Promise<boolean>} True if file exists
   */
  async policyExists(framework) {
    try {
      const policyPath = this._getPolicyPath(framework.toUpperCase());
      await fs.access(policyPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get policy metadata without loading full content
   * @param {string} framework - Framework name
   * @returns {Promise<Object>} Policy metadata
   */
  async getPolicyMetadata(framework) {
    const frameworkUpper = framework.toUpperCase();
    const policyPath = this._getPolicyPath(frameworkUpper);
    
    try {
      const content = await this._readPolicyFile(policyPath);
      const policy = JSON.parse(content);
      
      return {
        framework: frameworkUpper,
        name: policy.name,
        version: policy.version,
        description: policy.description,
        riskLevel: policy.risk_level,
        rulesCount: policy.rules?.length || 0,
        exists: true
      };
    } catch (error) {
      return {
        framework: frameworkUpper,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * List all available policy files
   * @returns {Promise<Array>} Array of available policy metadata
   */
  async listAvailablePolicies() {
    const policies = [];
    
    for (const framework of this.config.supportedFrameworks) {
      const metadata = await this.getPolicyMetadata(framework);
      policies.push(metadata);
    }
    
    return policies;
  }
}

module.exports = PolicyLoader;
