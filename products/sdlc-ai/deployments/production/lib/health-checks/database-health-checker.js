/**
 * Database Health Checker
 * 
 * Verifies D1 database connectivity and functionality by executing test queries
 * and checking connection pool status.
 * 
 * Requirements: 7.6
 */

const { execSync } = require('child_process');

class DatabaseHealthChecker {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.timeout = 10000; // 10 second timeout for database operations
  }

  /**
   * Check health of all databases
   * @param {Object} databases - Database configurations
   * @returns {Promise<Object>} Health check results
   */
  async checkAllDatabases(databases) {
    this.logger.info('Checking health of all databases...');
    
    const results = {
      overall: true,
      databases: {},
      timestamp: new Date().toISOString()
    };

    // Check primary database
    if (databases.primary) {
      const health = await this.checkDatabase(databases.primary, 'primary');
      results.databases.primary = health;
      
      if (!health.healthy) {
        results.overall = false;
      }
    }

    // Check events database
    if (databases.events) {
      const health = await this.checkDatabase(databases.events, 'events');
      results.databases.events = health;
      
      if (!health.healthy) {
        results.overall = false;
      }
    }

    // Check read replicas
    if (databases.readReplicas && databases.readReplicas.length > 0) {
      for (let i = 0; i < databases.readReplicas.length; i++) {
        const replica = databases.readReplicas[i];
        const health = await this.checkDatabase(replica, `read-replica-${i + 1}`);
        results.databases[`read-replica-${i + 1}`] = health;
        
        if (!health.healthy) {
          results.overall = false;
        }
      }
    }

    return results;
  }

  /**
   * Check health of a single database
   * @param {Object} database - Database configuration
   * @param {string} name - Database name
   * @returns {Promise<Object>} Health status
   */
  async checkDatabase(database, name) {
    this.logger.info(`Checking database health: ${name}`);
    
    try {
      // Check D1 connectivity
      const connectivity = await this.checkConnectivity(database);
      
      if (!connectivity.connected) {
        this.logger.error(`✗ ${name} connectivity check failed`);
        return {
          healthy: false,
          connected: false,
          error: connectivity.error,
          database: name
        };
      }

      // Execute test query
      const queryTest = await this.executeTestQuery(database);
      
      if (!queryTest.success) {
        this.logger.error(`✗ ${name} query execution failed`);
        return {
          healthy: false,
          connected: true,
          queryExecuted: false,
          error: queryTest.error,
          database: name
        };
      }

      // Verify connection pool (if applicable)
      const poolStatus = await this.verifyConnectionPool(database);

      this.logger.success(`✓ ${name} is healthy (query: ${queryTest.duration}ms)`);
      
      return {
        healthy: true,
        connected: true,
        queryExecuted: true,
        queryDuration: queryTest.duration,
        poolStatus: poolStatus,
        database: name
      };

    } catch (error) {
      this.logger.error(`✗ ${name} health check failed: ${error.message}`);
      
      return {
        healthy: false,
        error: error.message,
        database: name
      };
    }
  }

  /**
   * Check D1 database connectivity
   * @param {Object} database - Database configuration
   * @returns {Promise<Object>} Connectivity status
   */
  async checkConnectivity(database) {
    try {
      // Use Wrangler CLI to check if database exists and is accessible
      const command = `wrangler d1 list`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Check if our database is in the list
      const databaseId = database.id || database.name;
      const isListed = output.includes(databaseId);

      if (!isListed) {
        return {
          connected: false,
          error: `Database ${databaseId} not found in account`
        };
      }

      return {
        connected: true
      };

    } catch (error) {
      return {
        connected: false,
        error: `Connectivity check failed: ${error.message}`
      };
    }
  }

  /**
   * Execute a test query on the database
   * @param {Object} database - Database configuration
   * @returns {Promise<Object>} Query execution result
   */
  async executeTestQuery(database) {
    try {
      const startTime = Date.now();
      
      // Simple SELECT query to test database functionality
      const query = 'SELECT 1 as test';
      const command = `wrangler d1 execute ${database.name} --command="${query}"`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const duration = Date.now() - startTime;

      // Check if query executed successfully
      const success = !output.toLowerCase().includes('error');

      if (!success) {
        return {
          success: false,
          error: 'Query execution returned error',
          output: output
        };
      }

      return {
        success: true,
        duration: duration,
        output: output
      };

    } catch (error) {
      return {
        success: false,
        error: `Query execution failed: ${error.message}`
      };
    }
  }

  /**
   * Verify connection pool status
   * @param {Object} database - Database configuration
   * @returns {Promise<Object>} Connection pool status
   */
  async verifyConnectionPool(database) {
    try {
      // D1 manages connection pooling automatically
      // We can verify by checking if we can execute multiple queries
      const query = 'SELECT sqlite_version() as version';
      const command = `wrangler d1 execute ${database.name} --command="${query}"`;
      
      execSync(command, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return {
        available: true,
        status: 'operational'
      };

    } catch (error) {
      return {
        available: false,
        status: 'unavailable',
        error: error.message
      };
    }
  }

  /**
   * Check database schema version
   * @param {Object} database - Database configuration
   * @returns {Promise<Object>} Schema version info
   */
  async checkSchemaVersion(database) {
    try {
      const query = 'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1';
      const command = `wrangler d1 execute ${database.name} --command="${query}"`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Parse version from output
      const versionMatch = output.match(/version.*?(\d+)/i);
      const version = versionMatch ? parseInt(versionMatch[1]) : 0;

      return {
        success: true,
        version: version
      };

    } catch (error) {
      return {
        success: false,
        error: `Schema version check failed: ${error.message}`
      };
    }
  }

  /**
   * Check database size and statistics
   * @param {Object} database - Database configuration
   * @returns {Promise<Object>} Database statistics
   */
  async getDatabaseStats(database) {
    try {
      // Get table count
      const tableQuery = "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'";
      const tableCommand = `wrangler d1 execute ${database.name} --command="${tableQuery}"`;
      
      const tableOutput = execSync(tableCommand, {
        encoding: 'utf8',
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const tableMatch = tableOutput.match(/count.*?(\d+)/i);
      const tableCount = tableMatch ? parseInt(tableMatch[1]) : 0;

      return {
        success: true,
        tableCount: tableCount
      };

    } catch (error) {
      return {
        success: false,
        error: `Stats retrieval failed: ${error.message}`
      };
    }
  }

  /**
   * Perform comprehensive database health check
   * @param {Object} database - Database configuration
   * @param {string} name - Database name
   * @returns {Promise<Object>} Comprehensive health status
   */
  async performComprehensiveCheck(database, name) {
    this.logger.info(`Performing comprehensive health check: ${name}`);
    
    const results = {
      database: name,
      timestamp: new Date().toISOString()
    };

    // Basic health check
    const health = await this.checkDatabase(database, name);
    Object.assign(results, health);

    if (!health.healthy) {
      return results;
    }

    // Additional checks
    const schemaVersion = await this.checkSchemaVersion(database);
    results.schemaVersion = schemaVersion;

    const stats = await this.getDatabaseStats(database);
    results.stats = stats;

    return results;
  }

  /**
   * Set timeout for database operations
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.timeout = timeout;
  }
}

module.exports = { DatabaseHealthChecker };
