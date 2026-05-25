/**
 * D1 Database Provisioner
 * 
 * Handles creation and configuration of Cloudflare D1 databases
 */

const { execSync } = require('child_process');

class D1Provisioner {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.createdDatabases = [];
  }

  /**
   * Provision all D1 databases
   * @returns {Promise<Object>} Database resources
   */
  async provision() {
    this.logger.info('Provisioning D1 databases...');

    const databases = this.config.databases || [];
    const resources = {
      primaryDb: null,
      eventsDb: null,
      readReplicas: []
    };

    for (const dbConfig of databases) {
      const dbName = this.getDatabaseName(dbConfig.name);
      
      // Check if database exists
      const exists = await this.databaseExists(dbName);
      
      if (exists) {
        this.logger.info(`Database '${dbName}' already exists, skipping creation`);
        const dbId = await this.getDatabaseId(dbName);
        this.trackDatabase(dbConfig.name, dbName, dbId);
      } else {
        // Create database
        const dbId = await this.createDatabase(dbName);
        this.trackDatabase(dbConfig.name, dbName, dbId);
      }

      // Map to resource structure
      const dbInfo = { name: dbName, id: await this.getDatabaseId(dbName) };
      
      if (dbConfig.name === 'primary') {
        resources.primaryDb = dbInfo;
      } else if (dbConfig.name === 'events') {
        resources.eventsDb = dbInfo;
      } else if (dbConfig.name.includes('replica')) {
        resources.readReplicas.push(dbInfo);
      }
    }

    this.logger.success(`Provisioned ${this.createdDatabases.length} D1 databases`);
    return resources;
  }

  /**
   * Check if database exists
   * @param {string} dbName - Database name
   * @returns {Promise<boolean>} True if database exists
   */
  async databaseExists(dbName) {
    try {
      const output = this.executeWranglerCommand('d1 list');
      return output.includes(dbName);
    } catch (error) {
      this.logger.debug(`Error checking database existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Create D1 database
   * @param {string} dbName - Database name
   * @returns {Promise<string>} Database ID
   */
  async createDatabase(dbName) {
    this.logger.info(`Creating D1 database: ${dbName}`);
    
    try {
      const output = this.executeWranglerCommand(`d1 create ${dbName}`);
      
      // Extract database ID from output
      const idMatch = output.match(/database_id\s*=\s*"([^"]+)"/);
      const dbId = idMatch ? idMatch[1] : null;
      
      if (!dbId) {
        throw new Error(`Failed to extract database ID from output`);
      }

      this.logger.success(`Created D1 database: ${dbName} (${dbId})`);
      return dbId;

    } catch (error) {
      throw new Error(`Failed to create D1 database '${dbName}': ${error.message}`);
    }
  }

  /**
   * Get database ID
   * @param {string} dbName - Database name
   * @returns {Promise<string>} Database ID
   */
  async getDatabaseId(dbName) {
    try {
      const output = this.executeWranglerCommand('d1 list');
      
      // Parse the output to find the database ID
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes(dbName)) {
          // Extract ID from the line (format varies, try to find UUID pattern)
          const idMatch = line.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          if (idMatch) {
            return idMatch[1];
          }
        }
      }
      
      throw new Error(`Database ID not found for '${dbName}'`);
    } catch (error) {
      throw new Error(`Failed to get database ID for '${dbName}': ${error.message}`);
    }
  }

  /**
   * Get database name with environment prefix
   * @param {string} baseName - Base database name
   * @returns {string} Full database name
   */
  getDatabaseName(baseName) {
    const env = this.config.environment;
    return `sdlc-${env}-${baseName}`;
  }

  /**
   * Track created database
   * @param {string} type - Database type (primary, events, replica)
   * @param {string} name - Database name
   * @param {string} id - Database ID
   */
  trackDatabase(type, name, id) {
    this.createdDatabases.push({
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
   * Get created databases
   * @returns {Array} List of created databases
   */
  getCreatedDatabases() {
    return this.createdDatabases;
  }

  /**
   * Cleanup created databases (for rollback)
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.logger.warn('Cleaning up D1 databases...');
    
    for (const db of this.createdDatabases) {
      try {
        this.logger.info(`Deleting database: ${db.name}`);
        this.executeWranglerCommand(`d1 delete ${db.name} --skip-confirmation`);
        this.logger.success(`Deleted database: ${db.name}`);
      } catch (error) {
        this.logger.error(`Failed to delete database '${db.name}': ${error.message}`);
      }
    }
  }
}

module.exports = { D1Provisioner };
