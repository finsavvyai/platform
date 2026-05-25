/**
 * Migration Manager
 * 
 * Handles schema version tracking, pending migration detection, and migration execution logic
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class MigrationManager {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.migrationsDir = path.join(__dirname, '../../../../database/migrations');
    this.executedMigrations = [];
  }

  /**
   * Get current schema version from database
   * @param {string} databaseName - Name of the database
   * @returns {Promise<number>} Current schema version
   */
  async getCurrentVersion(databaseName) {
    this.logger.debug(`Getting current schema version for database: ${databaseName}`);
    
    try {
      // Query the schema_migrations table for the latest version
      const query = `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`;
      const result = await this.executeQuery(databaseName, query);
      
      if (result && result.length > 0) {
        const version = parseInt(result[0].version, 10);
        this.logger.debug(`Current schema version: ${version}`);
        return version;
      }
      
      // No migrations executed yet
      this.logger.debug('No migrations found, starting from version 0');
      return 0;
      
    } catch (error) {
      // If schema_migrations table doesn't exist, we're at version 0
      if (error.message.includes('no such table') || error.message.includes('does not exist')) {
        this.logger.debug('Schema migrations table does not exist, starting from version 0');
        return 0;
      }
      throw new Error(`Failed to get current schema version: ${error.message}`);
    }
  }

  /**
   * Get all migration files from the migrations directory
   * @returns {Promise<Array>} List of migration files
   */
  async getMigrationFiles() {
    this.logger.debug(`Reading migration files from: ${this.migrationsDir}`);
    
    try {
      const files = fs.readdirSync(this.migrationsDir);
      
      // Filter for SQL files and sort by version number
      const migrationFiles = files
        .filter(file => file.endsWith('.sql') && file.match(/^\d{3}_/))
        .sort((a, b) => {
          const versionA = parseInt(a.split('_')[0], 10);
          const versionB = parseInt(b.split('_')[0], 10);
          return versionA - versionB;
        })
        .map(file => {
          const version = parseInt(file.split('_')[0], 10);
          const description = file.split('_').slice(1).join('_').replace('.sql', '');
          
          return {
            version,
            filename: file,
            description,
            path: path.join(this.migrationsDir, file)
          };
        });
      
      this.logger.debug(`Found ${migrationFiles.length} migration files`);
      return migrationFiles;
      
    } catch (error) {
      throw new Error(`Failed to read migration files: ${error.message}`);
    }
  }

  /**
   * Detect pending migrations that need to be executed
   * @param {string} databaseName - Name of the database
   * @returns {Promise<Array>} List of pending migrations
   */
  async getPendingMigrations(databaseName) {
    this.logger.info('Detecting pending migrations...');
    
    try {
      const currentVersion = await this.getCurrentVersion(databaseName);
      const allMigrations = await this.getMigrationFiles();
      
      // Filter migrations that haven't been executed yet
      const pendingMigrations = allMigrations.filter(migration => 
        migration.version > currentVersion
      );
      
      if (pendingMigrations.length === 0) {
        this.logger.info('No pending migrations found');
      } else {
        this.logger.info(`Found ${pendingMigrations.length} pending migrations`);
        pendingMigrations.forEach(migration => {
          this.logger.debug(`  - ${migration.filename}: ${migration.description}`);
        });
      }
      
      return pendingMigrations;
      
    } catch (error) {
      throw new Error(`Failed to detect pending migrations: ${error.message}`);
    }
  }

  /**
   * Calculate checksum for a migration file
   * @param {string} filePath - Path to migration file
   * @returns {string} SHA-256 checksum
   */
  calculateChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Read migration file content
   * @param {string} filePath - Path to migration file
   * @returns {string} Migration SQL content
   */
  readMigrationFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read migration file '${filePath}': ${error.message}`);
    }
  }

  /**
   * Execute SQL query on D1 database
   * @param {string} databaseName - Name of the database
   * @param {string} query - SQL query to execute
   * @returns {Promise<Array>} Query results
   */
  async executeQuery(databaseName, query) {
    try {
      // Create a temporary file for the query
      const tempFile = path.join(__dirname, `temp-query-${Date.now()}.sql`);
      fs.writeFileSync(tempFile, query, 'utf8');
      
      try {
        const command = `wrangler d1 execute ${databaseName} --file=${tempFile} --json`;
        this.logger.debug(`Executing query on database: ${databaseName}`);
        
        const output = execSync(command, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Parse JSON output
        const result = JSON.parse(output);
        return result;
        
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Verify migration was executed successfully
   * @param {string} databaseName - Name of the database
   * @param {number} version - Migration version
   * @returns {Promise<boolean>} True if migration was recorded
   */
  async verifyMigrationExecuted(databaseName, version) {
    try {
      const query = `SELECT version FROM schema_migrations WHERE version = '${String(version).padStart(3, '0')}'`;
      const result = await this.executeQuery(databaseName, query);
      
      return result && result.length > 0;
      
    } catch (error) {
      this.logger.warn(`Failed to verify migration execution: ${error.message}`);
      return false;
    }
  }

  /**
   * Track executed migration
   * @param {Object} migration - Migration details
   * @param {number} executionTime - Execution time in milliseconds
   */
  trackMigration(migration, executionTime) {
    this.executedMigrations.push({
      version: migration.version,
      filename: migration.filename,
      description: migration.description,
      executionTime,
      executedAt: new Date()
    });
  }

  /**
   * Get list of executed migrations
   * @returns {Array} List of executed migrations
   */
  getExecutedMigrations() {
    return this.executedMigrations;
  }

  /**
   * Get migration statistics
   * @returns {Object} Migration statistics
   */
  getStatistics() {
    const totalExecutionTime = this.executedMigrations.reduce(
      (sum, migration) => sum + migration.executionTime,
      0
    );
    
    return {
      totalMigrations: this.executedMigrations.length,
      totalExecutionTime,
      averageExecutionTime: this.executedMigrations.length > 0 
        ? totalExecutionTime / this.executedMigrations.length 
        : 0,
      migrations: this.executedMigrations
    };
  }
}

module.exports = { MigrationManager };
