/**
 * Policy Manager
 * 
 * Main orchestrator for policy loading system.
 * Coordinates policy loading, validation, and storage operations.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

const PolicyLoader = require('./policy-loader');
const PolicyValidator = require('./policy-validator');
const PolicyStorage = require('./policy-storage');

class PolicyManager {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = config;
    
    // Initialize components
    this.loader = new PolicyLoader(logger, config);
    this.validator = new PolicyValidator(logger);
    this.storage = new PolicyStorage(logger, config);
    
    this.loadedPolicies = new Map();
  }

  /**
   * Execute complete policy loading workflow
   * Load, validate, and store all compliance policies
   * @returns {Promise<Object>} Workflow result
   */
  async loadAndStorePolicies() {
    this.logger.info('='.repeat(60));
    this.logger.info('Starting Policy Loading System');
    this.logger.info('='.repeat(60));

    const result = {
      success: true,
      loaded: [],
      validated: [],
      stored: [],
      errors: [],
      warnings: []
    };

    try {
      // Step 1: Load all policies
      this.logger.info('\n📂 Step 1: Loading policies from filesystem...');
      const loadResult = await this.loader.loadAllPolicies();
      
      if (!loadResult.success) {
        result.success = false;
        result.errors.push(...loadResult.errors);
        this.logger.error('Policy loading failed');
        return result;
      }
      
      result.loaded = Object.keys(loadResult.policies);
      this.logger.success(`✓ Loaded ${result.loaded.length} policies`);

      // Step 2: Validate all policies
      this.logger.info('\n✓ Step 2: Validating policy structure and rules...');
      const policies = Object.values(loadResult.policies);
      const validationResult = this.validator.validateAll(policies);
      
      if (!validationResult.valid) {
        result.success = false;
        result.errors.push(...validationResult.errors);
        this.logger.error('Policy validation failed');
        return result;
      }
      
      result.validated = Object.keys(validationResult.policies);
      result.warnings.push(...validationResult.warnings);
      this.logger.success(`✓ Validated ${result.validated.length} policies`);

      // Step 3: Store all policies in KV
      this.logger.info('\n💾 Step 3: Storing policies in KV storage...');
      const storageResult = await this.storage.storeAll(loadResult.policies);
      
      if (!storageResult.success) {
        result.success = false;
        result.errors.push(...storageResult.errors);
        this.logger.error('Policy storage failed');
        return result;
      }
      
      result.stored = storageResult.stored.map(s => s.framework);
      this.logger.success(`✓ Stored ${result.stored.length} policies`);

      // Step 4: Verify storage
      this.logger.info('\n🔍 Step 4: Verifying policy storage...');
      const verificationResult = await this.storage.verifyAll(result.stored);
      
      if (!verificationResult.success) {
        result.success = false;
        result.errors.push(`Verification failed for: ${verificationResult.failed.join(', ')}`);
        this.logger.error('Policy verification failed');
        return result;
      }
      
      this.logger.success(`✓ Verified ${verificationResult.verified.length} policies`);

      // Success summary
      this.logger.info('\n' + '='.repeat(60));
      this.logger.success('✓ Policy Loading System Completed Successfully');
      this.logger.info('='.repeat(60));
      this.logger.info(`Policies loaded: ${result.loaded.join(', ')}`);
      this.logger.info(`Total warnings: ${result.warnings.length}`);

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error(`Policy loading system failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Load and store a single policy
   * @param {string} framework - Framework name
   * @returns {Promise<Object>} Operation result
   */
  async loadAndStorePolicy(framework) {
    this.logger.info(`Processing ${framework} policy...`);

    const result = {
      success: true,
      framework,
      errors: [],
      warnings: []
    };

    try {
      // Load policy
      const policy = await this.loader.loadPolicy(framework);
      
      // Validate policy
      const validationResult = this.validator.validatePolicy(policy);
      if (!validationResult.valid) {
        result.success = false;
        result.errors.push(...validationResult.errors);
        return result;
      }
      result.warnings.push(...validationResult.warnings);
      
      // Store policy
      const storageResult = await this.storage.storePolicy(framework, policy);
      if (!storageResult.success) {
        result.success = false;
        result.errors.push('Storage failed');
        return result;
      }
      
      // Verify storage
      const verified = await this.storage.verifyStorage(framework);
      if (!verified) {
        result.success = false;
        result.errors.push('Verification failed');
        return result;
      }

      this.logger.success(`✓ ${framework} policy processed successfully`);
      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error(`Failed to process ${framework} policy: ${error.message}`);
      return result;
    }
  }

  /**
   * Retrieve a policy from storage
   * @param {string} framework - Framework name
   * @param {string} version - Optional version
   * @returns {Promise<Object|null>} Policy object
   */
  async getPolicy(framework, version = null) {
    return this.storage.retrievePolicy(framework, version);
  }

  /**
   * List all available policies
   * @returns {Promise<Array>} Array of policy metadata
   */
  async listPolicies() {
    return this.loader.listAvailablePolicies();
  }

  /**
   * List versions for a policy
   * @param {string} framework - Framework name
   * @returns {Promise<Array>} Array of versions
   */
  async listVersions(framework) {
    return this.storage.listVersions(framework);
  }

  /**
   * Validate a policy without storing
   * @param {Object} policy - Policy object
   * @returns {Object} Validation result
   */
  validatePolicy(policy) {
    return this.validator.validatePolicy(policy);
  }

  /**
   * Delete a policy from storage
   * @param {string} framework - Framework name
   * @returns {Promise<boolean>} True if deleted
   */
  async deletePolicy(framework) {
    return this.storage.deletePolicy(framework);
  }

  /**
   * Get system statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      loader: {
        cached: this.loader.getAllLoadedPolicies().size,
        supported: this.loader.config.supportedFrameworks
      },
      storage: this.storage.getStorageStats()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.loader.clearCache();
    this.storage.clearCache();
    this.loadedPolicies.clear();
    this.logger.debug('Policy manager cleanup complete');
  }
}

module.exports = PolicyManager;
