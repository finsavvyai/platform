/**
 * Vectorize Index Provisioner
 * 
 * Handles creation and configuration of Cloudflare Vectorize indexes
 */

const { execSync } = require('child_process');

class VectorizeProvisioner {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.createdIndexes = [];
  }

  /**
   * Provision Vectorize index
   * @returns {Promise<Object>} Vector resources
   */
  async provision() {
    this.logger.info('Provisioning Vectorize indexes...');

    const vectorize = this.config.vectorize || {};
    const resources = {
      vectorIndex: null
    };

    if (vectorize.name) {
      const indexName = this.getIndexName(vectorize.name);
      const dimensions = vectorize.dimensions || 1536;
      const metric = vectorize.metric || 'cosine';
      
      const exists = await this.indexExists(indexName);
      
      if (exists) {
        this.logger.info(`Index '${indexName}' already exists, skipping creation`);
        resources.vectorIndex = { name: indexName, dimensions, metric };
      } else {
        await this.createIndex(indexName, dimensions, metric);
        resources.vectorIndex = { name: indexName, dimensions, metric };
      }
      
      this.trackIndex(indexName, dimensions, metric);
    }

    this.logger.success(`Provisioned ${this.createdIndexes.length} Vectorize indexes`);
    return resources;
  }

  /**
   * Check if index exists
   * @param {string} indexName - Index name
   * @returns {Promise<boolean>} True if index exists
   */
  async indexExists(indexName) {
    try {
      const output = this.executeWranglerCommand('vectorize list');
      return output.includes(indexName);
    } catch (error) {
      this.logger.debug(`Error checking index existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create Vectorize index
   * @param {string} indexName - Index name
   * @param {number} dimensions - Vector dimensions
   * @param {string} metric - Distance metric (cosine, euclidean, dot-product)
   * @returns {Promise<void>}
   */
  async createIndex(indexName, dimensions, metric) {
    this.logger.info(`Creating Vectorize index: ${indexName} (${dimensions} dimensions, ${metric} metric)`);
    
    try {
      const command = `vectorize create ${indexName} --dimensions=${dimensions} --metric=${metric}`;
      this.executeWranglerCommand(command);
      
      this.logger.success(`Created Vectorize index: ${indexName}`);
    } catch (error) {
      throw new Error(`Failed to create Vectorize index '${indexName}': ${error.message}`);
    }
  }

  /**
   * Get index name with environment prefix
   * @param {string} baseName - Base index name
   * @returns {string} Full index name
   */
  getIndexName(baseName) {
    const env = this.config.environment;
    return `sdlc-${env}-${baseName}`;
  }

  /**
   * Track created index
   * @param {string} name - Index name
   * @param {number} dimensions - Vector dimensions
   * @param {string} metric - Distance metric
   */
  trackIndex(name, dimensions, metric) {
    this.createdIndexes.push({
      name,
      dimensions,
      metric,
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
   * Get created indexes
   * @returns {Array} List of created indexes
   */
  getCreatedIndexes() {
    return this.createdIndexes;
  }

  /**
   * Cleanup created indexes (for rollback)
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.warn('Cleaning up Vectorize indexes...');
    
    for (const index of this.createdIndexes) {
      try {
        this.logger.info(`Deleting index: ${index.name}`);
        this.executeWranglerCommand(`vectorize delete ${index.name}`);
        this.logger.success(`Deleted index: ${index.name}`);
      } catch (error) {
        this.logger.error(`Failed to delete index '${index.name}': ${error.message}`);
      }
    }
  }
}

module.exports = { VectorizeProvisioner };
