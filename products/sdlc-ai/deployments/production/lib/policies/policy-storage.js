/**
 * Policy Storage Handler
 * 
 * Handles storage of compliance policies in Cloudflare KV with versioning support.
 * Provides storage, retrieval, and verification capabilities.
 * 
 * Requirements: 6.6
 */

const { execSync } = require('child_process');

class PolicyStorage {
  constructor(logger, config = {}) {
    this.logger = logger;
    this.config = {
      kvNamespace: config.kvNamespace || 'policies',
      kvNamespaceId: config.kvNamespaceId,
      accountId: config.accountId || process.env.CLOUDFLARE_ACCOUNT_ID,
      environment: config.environment || 'production',
      enableVersioning: config.enableVersioning !== false,
      ...config
    };
    
    this.storedPolicies = new Map();
  }

  /**
   * Store a policy in KV storage
   * @param {string} framework - Framework name (HIPAA, GDPR, etc.)
   * @param {Object} policy - Policy object to store
   * @returns {Promise<Object>} Storage result
   */
  async storePolicy(framework, policy) {
    const frameworkUpper = framework.toUpperCase();
    
    this.logger.info(`Storing ${frameworkUpper} policy in KV...`);

    try {
      // Generate version if versioning is enabled
      const version = this.config.enableVersioning 
        ? this._generateVersion(policy)
        : policy.version;

      // Prepare policy for storage
      const storedPolicy = {
        ...policy,
        framework: frameworkUpper,
        storedVersion: version,
        storedAt: new Date().toISOString(),
        environment: this.config.environment
      };

      // Store current version
      const currentKey = this._getPolicyKey(frameworkUpper);
      await this._storeInKV(currentKey, storedPolicy);

      // Store versioned copy if versioning enabled
      if (this.config.enableVersioning) {
        const versionedKey = this._getVersionedPolicyKey(frameworkUpper, version);
        await this._storeInKV(versionedKey, storedPolicy);
      }

      // Update version metadata
      await this._updateVersionMetadata(frameworkUpper, version);

      // Cache in memory
      this.storedPolicies.set(frameworkUpper, storedPolicy);

      this.logger.success(`✓ ${frameworkUpper} policy stored successfully`);
      this.logger.info(`  Key: ${currentKey}`);
      this.logger.info(`  Version: ${version}`);

      return {
        success: true,
        framework: frameworkUpper,
        version: version,
        key: currentKey
      };
    } catch (error) {
      this.logger.error(`Failed to store ${frameworkUpper} policy: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store multiple policies
   * @param {Object} policies - Object with framework keys and policy values
   * @returns {Promise<Object>} Storage results
   */
  async storeAll(policies) {
    this.logger.info(`Storing ${Object.keys(policies).length} policies...`);
    
    const results = {
      success: true,
      stored: [],
      errors: [],
      warnings: []
    };

    for (const [framework, policy] of Object.entries(policies)) {
      try {
        const result = await this.storePolicy(framework, policy);
        results.stored.push(result);
      } catch (error) {
        results.success = false;
        results.errors.push(`${framework}: ${error.message}`);
        this.logger.warn(`⚠ Failed to store ${framework} policy`);
      }
    }

    if (results.success) {
      this.logger.success(`✓ All policies stored successfully (${results.stored.length})`);
    } else {
      this.logger.warn(`⚠ Some policies failed to store (${results.errors.length} errors)`);
    }

    return results;
  }

  /**
   * Verify a policy was stored correctly
   * @param {string} framework - Framework name
   * @returns {Promise<boolean>} True if verified
   */
  async verifyStorage(framework) {
    const frameworkUpper = framework.toUpperCase();
    
    this.logger.debug(`Verifying ${frameworkUpper} policy storage...`);

    try {
      const key = this._getPolicyKey(frameworkUpper);
      const stored = await this._retrieveFromKV(key);

      if (!stored) {
        this.logger.warn(`⚠ ${frameworkUpper} policy not found in KV`);
        return false;
      }

      // Verify framework matches
      if (stored.framework !== frameworkUpper) {
        this.logger.warn(`⚠ Framework mismatch for ${frameworkUpper}`);
        return false;
      }

      // Verify has required fields
      if (!stored.version || !stored.rules) {
        this.logger.warn(`⚠ ${frameworkUpper} policy missing required fields`);
        return false;
      }

      this.logger.success(`✓ ${frameworkUpper} policy verified in KV`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to verify ${frameworkUpper} policy: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify all stored policies
   * @param {Array<string>} frameworks - Array of framework names to verify
   * @returns {Promise<Object>} Verification results
   */
  async verifyAll(frameworks) {
    this.logger.info(`Verifying ${frameworks.length} policies...`);
    
    const results = {
      success: true,
      verified: [],
      failed: []
    };

    for (const framework of frameworks) {
      const verified = await this.verifyStorage(framework);
      
      if (verified) {
        results.verified.push(framework);
      } else {
        results.success = false;
        results.failed.push(framework);
      }
    }

    if (results.success) {
      this.logger.success(`✓ All policies verified (${results.verified.length})`);
    } else {
      this.logger.warn(`⚠ Some policies failed verification (${results.failed.length})`);
    }

    return results;
  }

  /**
   * Retrieve a policy from KV storage
   * @param {string} framework - Framework name
   * @param {string} version - Optional specific version
   * @returns {Promise<Object|null>} Policy object or null
   */
  async retrievePolicy(framework, version = null) {
    const frameworkUpper = framework.toUpperCase();
    
    try {
      const key = version 
        ? this._getVersionedPolicyKey(frameworkUpper, version)
        : this._getPolicyKey(frameworkUpper);

      const policy = await this._retrieveFromKV(key);
      
      if (policy) {
        this.logger.debug(`Retrieved ${frameworkUpper} policy from KV`);
      }
      
      return policy;
    } catch (error) {
      this.logger.error(`Failed to retrieve ${frameworkUpper} policy: ${error.message}`);
      return null;
    }
  }

  /**
   * List all policy versions for a framework
   * @param {string} framework - Framework name
   * @returns {Promise<Array>} Array of version strings
   */
  async listVersions(framework) {
    const frameworkUpper = framework.toUpperCase();
    
    try {
      const metadataKey = this._getVersionMetadataKey(frameworkUpper);
      const metadata = await this._retrieveFromKV(metadataKey);
      
      return metadata?.versions || [];
    } catch (error) {
      this.logger.error(`Failed to list versions for ${frameworkUpper}: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete a policy from KV storage
   * @param {string} framework - Framework name
   * @returns {Promise<boolean>} True if deleted
   */
  async deletePolicy(framework) {
    const frameworkUpper = framework.toUpperCase();
    
    this.logger.info(`Deleting ${frameworkUpper} policy from KV...`);

    try {
      const key = this._getPolicyKey(frameworkUpper);
      await this._deleteFromKV(key);
      
      this.storedPolicies.delete(frameworkUpper);
      
      this.logger.success(`✓ ${frameworkUpper} policy deleted`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete ${frameworkUpper} policy: ${error.message}`);
      return false;
    }
  }

  /**
   * Get policy key for KV storage
   * @private
   */
  _getPolicyKey(framework) {
    return `policy:${framework.toLowerCase()}:current`;
  }

  /**
   * Get versioned policy key
   * @private
   */
  _getVersionedPolicyKey(framework, version) {
    return `policy:${framework.toLowerCase()}:v${version}`;
  }

  /**
   * Get version metadata key
   * @private
   */
  _getVersionMetadataKey(framework) {
    return `policy:${framework.toLowerCase()}:versions`;
  }

  /**
   * Generate version string for policy
   * @private
   */
  _generateVersion(policy) {
    const baseVersion = policy.version || '1.0.0';
    const timestamp = Date.now();
    return `${baseVersion}-${timestamp}`;
  }

  /**
   * Update version metadata
   * @private
   */
  async _updateVersionMetadata(framework, version) {
    const metadataKey = this._getVersionMetadataKey(framework);
    
    try {
      let metadata = await this._retrieveFromKV(metadataKey) || {
        framework,
        versions: []
      };

      if (!metadata.versions.includes(version)) {
        metadata.versions.push(version);
        metadata.latestVersion = version;
        metadata.updatedAt = new Date().toISOString();
        
        await this._storeInKV(metadataKey, metadata);
      }
    } catch (error) {
      this.logger.warn(`Failed to update version metadata: ${error.message}`);
    }
  }

  /**
   * Store data in KV using Wrangler CLI
   * @private
   */
  async _storeInKV(key, value) {
    const valueJson = JSON.stringify(value);
    
    try {
      // Use wrangler kv:key put command
      const command = this._buildWranglerCommand('put', key, valueJson);
      
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.logger.debug(`Stored key: ${key}`);
    } catch (error) {
      throw new Error(`KV storage failed: ${error.message}`);
    }
  }

  /**
   * Retrieve data from KV using Wrangler CLI
   * @private
   */
  async _retrieveFromKV(key) {
    try {
      const command = this._buildWranglerCommand('get', key);
      
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      if (!output || output.trim() === '') {
        return null;
      }
      
      return JSON.parse(output);
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw new Error(`KV retrieval failed: ${error.message}`);
    }
  }

  /**
   * Delete data from KV using Wrangler CLI
   * @private
   */
  async _deleteFromKV(key) {
    try {
      const command = this._buildWranglerCommand('delete', key);
      
      execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.logger.debug(`Deleted key: ${key}`);
    } catch (error) {
      throw new Error(`KV deletion failed: ${error.message}`);
    }
  }

  /**
   * Build Wrangler CLI command
   * @private
   */
  _buildWranglerCommand(operation, key, value = null) {
    const parts = ['wrangler', 'kv:key', operation];
    
    // Add key
    parts.push(`"${key}"`);
    
    // Add value for put operation
    if (operation === 'put' && value) {
      parts.push(`'${value.replace(/'/g, "\\'")}'`);
    }
    
    // Add namespace binding
    if (this.config.kvNamespaceId) {
      parts.push('--namespace-id', this.config.kvNamespaceId);
    } else {
      parts.push('--binding', this.config.kvNamespace);
    }
    
    // Add environment if not production
    if (this.config.environment && this.config.environment !== 'production') {
      parts.push('--env', this.config.environment);
    }
    
    return parts.join(' ');
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  getStorageStats() {
    return {
      cached: this.storedPolicies.size,
      frameworks: Array.from(this.storedPolicies.keys()),
      versioningEnabled: this.config.enableVersioning,
      environment: this.config.environment
    };
  }

  /**
   * Clear cached policies
   */
  clearCache() {
    this.storedPolicies.clear();
    this.logger.debug('Policy storage cache cleared');
  }
}

module.exports = PolicyStorage;
