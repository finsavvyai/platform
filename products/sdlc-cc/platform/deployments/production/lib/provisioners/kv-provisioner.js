/**
 * KV Namespace Provisioner
 * 
 * Handles creation and configuration of Cloudflare KV namespaces
 */

const { execSync } = require('child_process');

class KVProvisioner {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.createdNamespaces = [];
  }

  /**
   * Provision all KV namespaces
   * @returns {Promise<Object>} Cache resources
   */
  async provision() {
    this.logger.info('Provisioning KV namespaces...');

    const cache = this.config.cache || {};
    const resources = {
      cacheNamespace: null,
      sessionsNamespace: null,
      rateLimitsNamespace: null
    };

    // Provision cache namespace
    if (cache.cache) {
      const namespaceName = this.getNamespaceName(cache.cache.name);
      const exists = await this.namespaceExists(namespaceName);
      
      if (exists) {
        this.logger.info(`Namespace '${namespaceName}' already exists, skipping creation`);
        const namespaceId = await this.getNamespaceId(namespaceName);
        resources.cacheNamespace = { name: namespaceName, id: namespaceId };
      } else {
        const namespaceId = await this.createNamespace(namespaceName);
        resources.cacheNamespace = { name: namespaceName, id: namespaceId };
      }
      
      this.trackNamespace('cache', namespaceName, resources.cacheNamespace.id);
    }

    // Provision sessions namespace
    if (cache.sessions) {
      const namespaceName = this.getNamespaceName(cache.sessions.name);
      const exists = await this.namespaceExists(namespaceName);
      
      if (exists) {
        this.logger.info(`Namespace '${namespaceName}' already exists, skipping creation`);
        const namespaceId = await this.getNamespaceId(namespaceName);
        resources.sessionsNamespace = { name: namespaceName, id: namespaceId };
      } else {
        const namespaceId = await this.createNamespace(namespaceName);
        resources.sessionsNamespace = { name: namespaceName, id: namespaceId };
      }
      
      this.trackNamespace('sessions', namespaceName, resources.sessionsNamespace.id);
    }

    // Provision rate limits namespace
    if (cache.rateLimits) {
      const namespaceName = this.getNamespaceName(cache.rateLimits.name);
      const exists = await this.namespaceExists(namespaceName);
      
      if (exists) {
        this.logger.info(`Namespace '${namespaceName}' already exists, skipping creation`);
        const namespaceId = await this.getNamespaceId(namespaceName);
        resources.rateLimitsNamespace = { name: namespaceName, id: namespaceId };
      } else {
        const namespaceId = await this.createNamespace(namespaceName);
        resources.rateLimitsNamespace = { name: namespaceName, id: namespaceId };
      }
      
      this.trackNamespace('rate-limits', namespaceName, resources.rateLimitsNamespace.id);
    }

    this.logger.success(`Provisioned ${this.createdNamespaces.length} KV namespaces`);
    return resources;
  }

  /**
   * Check if namespace exists
   * @param {string} namespaceName - Namespace name
   * @returns {Promise<boolean>} True if namespace exists
   */
  async namespaceExists(namespaceName) {
    try {
      const output = this.executeWranglerCommand('kv:namespace list');
      return output.includes(namespaceName);
    } catch (error) {
      this.logger.debug(`Error checking namespace existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create KV namespace
   * @param {string} namespaceName - Namespace name
   * @returns {Promise<string>} Namespace ID
   */
  async createNamespace(namespaceName) {
    this.logger.info(`Creating KV namespace: ${namespaceName}`);
    
    try {
      const output = this.executeWranglerCommand(`kv:namespace create ${namespaceName}`);
      
      // Extract namespace ID from output
      const idMatch = output.match(/id\s*=\s*"([^"]+)"/);
      const namespaceId = idMatch ? idMatch[1] : null;
      
      if (!namespaceId) {
        throw new Error(`Failed to extract namespace ID from output`);
      }

      this.logger.success(`Created KV namespace: ${namespaceName} (${namespaceId})`);
      return namespaceId;

    } catch (error) {
      throw new Error(`Failed to create KV namespace '${namespaceName}': ${error.message}`);
    }
  }

  /**
   * Get namespace ID
   * @param {string} namespaceName - Namespace name
   * @returns {Promise<string>} Namespace ID
   */
  async getNamespaceId(namespaceName) {
    try {
      const output = this.executeWranglerCommand('kv:namespace list');
      
      // Parse JSON output
      const namespaces = JSON.parse(output);
      const namespace = namespaces.find(ns => ns.title === namespaceName);
      
      if (!namespace) {
        throw new Error(`Namespace not found: ${namespaceName}`);
      }
      
      return namespace.id;
    } catch (error) {
      throw new Error(`Failed to get namespace ID for '${namespaceName}': ${error.message}`);
    }
  }

  /**
   * Get namespace name with environment prefix
   * @param {string} baseName - Base namespace name
   * @returns {string} Full namespace name
   */
  getNamespaceName(baseName) {
    const env = this.config.environment;
    return `sdlc-${env}-${baseName}`;
  }

  /**
   * Track created namespace
   * @param {string} type - Namespace type (cache, sessions, rate-limits)
   * @param {string} name - Namespace name
   * @param {string} id - Namespace ID
   */
  trackNamespace(type, name, id) {
    this.createdNamespaces.push({
      type,
      name,
      id,
      createdAt: new Date()
    });
  }

  /**
   * Execute Wrangler command
   * @param {string} command - Wrangler command
   * @returns {string} Command output
   */
  executeWranglerCommand(command) {
    try {
      const fullCommand = `wrangler ${command}`;
      this.logger.debug(`Executing: ${fullCommand}`);
      
      const output = execSync(fullCommand, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return output;
    } catch (error) {
      throw new Error(`Wrangler command failed: ${error.message}`);
    }
  }

  /**
   * Get created namespaces
   * @returns {Array} List of created namespaces
   */
  getCreatedNamespaces() {
    return this.createdNamespaces;
  }

  /**
   * Cleanup created namespaces (for rollback)
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.warn('Cleaning up KV namespaces...');
    
    for (const namespace of this.createdNamespaces) {
      try {
        this.logger.info(`Deleting namespace: ${namespace.name}`);
        this.executeWranglerCommand(`kv:namespace delete --namespace-id=${namespace.id}`);
        this.logger.success(`Deleted namespace: ${namespace.name}`);
      } catch (error) {
        this.logger.error(`Failed to delete namespace '${namespace.name}': ${error.message}`);
      }
    }
  }
}

module.exports = { KVProvisioner };
