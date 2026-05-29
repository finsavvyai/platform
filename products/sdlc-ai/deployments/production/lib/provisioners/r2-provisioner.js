/**
 * R2 Storage Provisioner
 * 
 * Handles creation and configuration of Cloudflare R2 buckets
 */

const { execSync } = require('child_process');

class R2Provisioner {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.createdBuckets = [];
  }

  /**
   * Provision all R2 buckets
   * @returns {Promise<Object>} Storage resources
   */
  async provision() {
    this.logger.info('Provisioning R2 storage buckets...');

    const storage = this.config.storage || {};
    const resources = {
      documentsBucket: null,
      embeddingsBucket: null,
      auditLogsBucket: null
    };

    // Provision documents bucket
    if (storage.documents) {
      const bucketName = this.getBucketName(storage.documents.name);
      const exists = await this.bucketExists(bucketName);
      
      if (exists) {
        this.logger.info(`Bucket '${bucketName}' already exists, skipping creation`);
      } else {
        await this.createBucket(bucketName);
      }
      
      resources.documentsBucket = { name: bucketName };
      this.trackBucket('documents', bucketName);
    }

    // Provision embeddings bucket
    if (storage.embeddings) {
      const bucketName = this.getBucketName(storage.embeddings.name);
      const exists = await this.bucketExists(bucketName);
      
      if (exists) {
        this.logger.info(`Bucket '${bucketName}' already exists, skipping creation`);
      } else {
        await this.createBucket(bucketName);
      }
      
      resources.embeddingsBucket = { name: bucketName };
      this.trackBucket('embeddings', bucketName);
    }

    // Provision audit logs bucket
    if (storage.auditLogs) {
      const bucketName = this.getBucketName(storage.auditLogs.name);
      const exists = await this.bucketExists(bucketName);
      
      if (exists) {
        this.logger.info(`Bucket '${bucketName}' already exists, skipping creation`);
      } else {
        await this.createBucket(bucketName);
      }
      
      resources.auditLogsBucket = { name: bucketName };
      this.trackBucket('audit-logs', bucketName);
    }

    this.logger.success(`Provisioned ${this.createdBuckets.length} R2 buckets`);
    return resources;
  }

  /**
   * Check if bucket exists
   * @param {string} bucketName - Bucket name
   * @returns {Promise<boolean>} True if bucket exists
   */
  async bucketExists(bucketName) {
    try {
      const output = this.executeWranglerCommand('r2 bucket list');
      return output.includes(bucketName);
    } catch (error) {
      this.logger.debug(`Error checking bucket existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create R2 bucket
   * @param {string} bucketName - Bucket name
   * @returns {Promise<void>}
   */
  async createBucket(bucketName) {
    this.logger.info(`Creating R2 bucket: ${bucketName}`);
    
    try {
      this.executeWranglerCommand(`r2 bucket create ${bucketName}`);
      this.logger.success(`Created R2 bucket: ${bucketName}`);
    } catch (error) {
      throw new Error(`Failed to create R2 bucket '${bucketName}': ${error.message}`);
    }
  }

  /**
   * Get bucket name with environment prefix
   * @param {string} baseName - Base bucket name
   * @returns {string} Full bucket name
   */
  getBucketName(baseName) {
    const env = this.config.environment;
    return `sdlc-${env}-${baseName}`;
  }

  /**
   * Track created bucket
   * @param {string} type - Bucket type (documents, embeddings, audit-logs)
   * @param {string} name - Bucket name
   */
  trackBucket(type, name) {
    this.createdBuckets.push({
      type,
      name,
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
   * Get created buckets
   * @returns {Array} List of created buckets
   */
  getCreatedBuckets() {
    return this.createdBuckets;
  }

  /**
   * Cleanup created buckets (for rollback)
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.warn('Cleaning up R2 buckets...');
    
    for (const bucket of this.createdBuckets) {
      try {
        this.logger.info(`Deleting bucket: ${bucket.name}`);
        this.executeWranglerCommand(`r2 bucket delete ${bucket.name}`);
        this.logger.success(`Deleted bucket: ${bucket.name}`);
      } catch (error) {
        this.logger.error(`Failed to delete bucket '${bucket.name}': ${error.message}`);
      }
    }
  }
}

module.exports = { R2Provisioner };
