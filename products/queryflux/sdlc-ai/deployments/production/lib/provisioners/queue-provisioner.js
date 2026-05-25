/**
 * Queue Provisioner
 * 
 * Handles creation and configuration of Cloudflare Queues
 */

const { execSync } = require('child_process');

class QueueProvisioner {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.createdQueues = [];
  }

  /**
   * Provision all queues
   * @returns {Promise<Object>} Queue resources
   */
  async provision() {
    this.logger.info('Provisioning Cloudflare Queues...');

    const queues = this.config.queues || [];
    const resources = {
      processingQueue: null,
      queues: []
    };

    for (const queueConfig of queues) {
      const queueName = this.getQueueName(queueConfig.name);
      
      const exists = await this.queueExists(queueName);
      
      if (exists) {
        this.logger.info(`Queue '${queueName}' already exists, skipping creation`);
      } else {
        await this.createQueue(queueName);
      }
      
      const queueInfo = { name: queueName };
      resources.queues.push(queueInfo);
      
      if (queueConfig.name === 'processing') {
        resources.processingQueue = queueInfo;
      }
      
      this.trackQueue(queueConfig.name, queueName);
    }

    this.logger.success(`Provisioned ${this.createdQueues.length} queues`);
    return resources;
  }

  /**
   * Check if queue exists
   * @param {string} queueName - Queue name
   * @returns {Promise<boolean>} True if queue exists
   */
  async queueExists(queueName) {
    try {
      const output = this.executeWranglerCommand('queues list');
      return output.includes(queueName);
    } catch (error) {
      this.logger.debug(`Error checking queue existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create queue
   * @param {string} queueName - Queue name
   * @returns {Promise<void>}
   */
  async createQueue(queueName) {
    this.logger.info(`Creating queue: ${queueName}`);
    
    try {
      this.executeWranglerCommand(`queues create ${queueName}`);
      this.logger.success(`Created queue: ${queueName}`);
    } catch (error) {
      throw new Error(`Failed to create queue '${queueName}': ${error.message}`);
    }
  }

  /**
   * Get queue name with environment prefix
   * @param {string} baseName - Base queue name
   * @returns {string} Full queue name
   */
  getQueueName(baseName) {
    const env = this.config.environment;
    return `sdlc-${env}-${baseName}`;
  }

  /**
   * Track created queue
   * @param {string} type - Queue type (processing, etc.)
   * @param {string} name - Queue name
   */
  trackQueue(type, name) {
    this.createdQueues.push({
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
   * Get created queues
   * @returns {Array} List of created queues
   */
  getCreatedQueues() {
    return this.createdQueues;
  }

  /**
   * Cleanup created queues (for rollback)
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.warn('Cleaning up queues...');
    
    for (const queue of this.createdQueues) {
      try {
        this.logger.info(`Deleting queue: ${queue.name}`);
        this.executeWranglerCommand(`queues delete ${queue.name}`);
        this.logger.success(`Deleted queue: ${queue.name}`);
      } catch (error) {
        this.logger.error(`Failed to delete queue '${queue.name}': ${error.message}`);
      }
    }
  }
}

module.exports = { QueueProvisioner };
