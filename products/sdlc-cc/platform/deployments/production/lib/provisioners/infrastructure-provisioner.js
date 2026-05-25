/**
 * Infrastructure Provisioner
 * 
 * Main orchestrator for provisioning all Cloudflare infrastructure resources
 */

const { D1Provisioner } = require('./d1-provisioner');
const { R2Provisioner } = require('./r2-provisioner');
const { KVProvisioner } = require('./kv-provisioner');
const { VectorizeProvisioner } = require('./vectorize-provisioner');
const { QueueProvisioner } = require('./queue-provisioner');

class InfrastructureProvisioner {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    
    // Initialize individual provisioners
    this.d1Provisioner = new D1Provisioner(logger, config);
    this.r2Provisioner = new R2Provisioner(logger, config);
    this.kvProvisioner = new KVProvisioner(logger, config);
    this.vectorizeProvisioner = new VectorizeProvisioner(logger, config);
    this.queueProvisioner = new QueueProvisioner(logger, config);
    
    this.resources = {};
  }

  /**
   * Provision all infrastructure resources
   * @returns {Promise<Object>} All provisioned resources
   */
  async provision() {
    this.logger.info('Starting infrastructure provisioning...');
    
    try {
      // Provision D1 databases
      this.logger.phase('Provisioning D1 Databases');
      this.resources.databases = await this.d1Provisioner.provision();
      
      // Provision R2 storage
      this.logger.phase('Provisioning R2 Storage');
      this.resources.storage = await this.r2Provisioner.provision();
      
      // Provision KV namespaces
      this.logger.phase('Provisioning KV Namespaces');
      this.resources.cache = await this.kvProvisioner.provision();
      
      // Provision Vectorize indexes
      this.logger.phase('Provisioning Vectorize Indexes');
      this.resources.vectorize = await this.vectorizeProvisioner.provision();
      
      // Provision Queues
      this.logger.phase('Provisioning Queues');
      this.resources.queues = await this.queueProvisioner.provision();
      
      this.logger.success('Infrastructure provisioning completed successfully');
      
      return this.resources;
      
    } catch (error) {
      this.logger.error(`Infrastructure provisioning failed: ${error.message}`);
      
      // Attempt cleanup on failure
      await this.cleanup();
      
      throw error;
    }
  }

  /**
   * Get provisioned resources
   * @returns {Object} All provisioned resources
   */
  getResources() {
    return this.resources;
  }

  /**
   * Get resource summary
   * @returns {Object} Summary of provisioned resources
   */
  getResourceSummary() {
    return {
      databases: this.d1Provisioner.getCreatedDatabases().length,
      buckets: this.r2Provisioner.getCreatedBuckets().length,
      namespaces: this.kvProvisioner.getCreatedNamespaces().length,
      indexes: this.vectorizeProvisioner.getCreatedIndexes().length,
      queues: this.queueProvisioner.getCreatedQueues().length,
      total: 
        this.d1Provisioner.getCreatedDatabases().length +
        this.r2Provisioner.getCreatedBuckets().length +
        this.kvProvisioner.getCreatedNamespaces().length +
        this.vectorizeProvisioner.getCreatedIndexes().length +
        this.queueProvisioner.getCreatedQueues().length
    };
  }

  /**
   * Cleanup all provisioned resources (for rollback)
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.warn('Cleaning up infrastructure resources...');
    
    const cleanupPromises = [];
    
    // Cleanup in reverse order of creation
    cleanupPromises.push(this.queueProvisioner.cleanup());
    cleanupPromises.push(this.vectorizeProvisioner.cleanup());
    cleanupPromises.push(this.kvProvisioner.cleanup());
    cleanupPromises.push(this.r2Provisioner.cleanup());
    cleanupPromises.push(this.d1Provisioner.cleanup());
    
    await Promise.allSettled(cleanupPromises);
    
    this.logger.info('Infrastructure cleanup completed');
  }
}

module.exports = { InfrastructureProvisioner };
