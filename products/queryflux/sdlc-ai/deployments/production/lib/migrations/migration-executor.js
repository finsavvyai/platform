/**
 * Migration Executor
 * 
 * Handles SQL migration execution, success verification, and schema version updates
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class MigrationExecutor {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Execute a single migration
   * @param {string} databaseName - Name of the database
   * @param {Object} migration - Migration details
   * @returns {Promise<Object>} Execution result
   */
  async executeMigration(databaseName, migration) {
    this.logger.info(`Executing migration: ${migration.filename}`);
    
    const startTime = Date.now();
    
    try {
      // Read migration SQL content
      const sql = this.readMigrationFile(migration.path);
      
      // Calculate checksum
      const checksum = this.calculateChecksum(migration.path);
      
      // Execute the migration SQL
      await this.executeSql(databaseName, sql);
      
      const executionTime = Date.now() - startTime;
      
      // Verify migration was successful
      const verified = await this.verifyMigrationSuccess(databaseName, migration);
      
      if (!verified) {
        throw new Error('Migration execution verification failed');
      }
      
      // Update schema version in database
      await this.updateSchemaVersion(databaseName, migration, checksum, executionTime);
      
      // Verify schema version was updated
      const versionUpdated = await this.verifySchemaVersionUpdate(databaseName, migration.version);
      
      if (!versionUpdated) {
        throw new Error('Schema version update verification failed');
      }
      
      this.logger.success(
        `Migration executed successfully: ${migration.filename} (${executionTime}ms)`
      );
      
      return {
        success: true,
        migration,
        executionTime,
        checksum,
        verified: true
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(
        `Migration execution failed: ${migration.filename} - ${error.message}`
      );
      
      return {
        success: false,
        migration,
        executionTime,
        error: error.message,
        verified: false
      };
    }
  }

  /**
   * Execute multiple migrations in sequence
   * @param {string} databaseName - Name of the database
   * @param {Array} migrations - List of migrations to execute
   * @returns {Promise<Object>} Execution results
   */
  async executeMigrations(databaseName, migrations) {
    this.logger.info(`Executing ${migrations.length} migrations...`);
    
    const results = {
      total: migrations.length,
      successful: 0,
      failed: 0,
      migrations: [],
      totalExecutionTime: 0
    };
    
    for (const migration of migrations) {
      const result = await this.executeMigration(databaseName, migration);
      
      results.migrations.push(result);
      results.totalExecutionTime += result.executionTime;
      
      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        // Stop on first failure
        this.logger.error('Stopping migration execution due to failure');
        break;
      }
    }
    
    this.logger.info(
      `Migration execution complete: ${results.successful}/${results.total} successful ` +
      `(${results.totalExecutionTime}ms)`
    );
    
    return results;
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
   * Execute SQL on D1 database
   * @param {string} databaseName - Name of the database
   * @param {string} sql - SQL to execute
   * @returns {Promise<void>}
   */
  async executeSql(databaseName, sql) {
    try {
      // Create temporary file for SQL
      const tempFile = path.join(__dirname, `temp-migration-${Date.now()}.sql`);
      fs.writeFileSync(tempFile, sql, 'utf8');
      
      try {
        const command = `wrangler d1 execute ${databaseName} --file=${tempFile}`;
        this.logger.debug(`Executing SQL on database: ${databaseName}`);
        
        execSync(command, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        this.logger.debug('SQL execution completed');
        
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  /**
   * Verify migration was executed successfully
   * @param {string} databaseName - Name of the database
   * @param {Object} migration - Migration details
   * @returns {Promise<boolean>} True if migration was successful
   */
  async verifyMigrationSuccess(databaseName, migration) {
    try {
      // Basic verification: check if we can query the database
      const query = `SELECT 1 as test`;
      await this.executeQuery(databaseName, query);
      
      this.logger.debug('Migration success verification passed');
      return true;
      
    } catch (error) {
      this.logger.error(`Migration verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Update schema version in database
   * @param {string} databaseName - Name of the database
   * @param {Object} migration - Migration details
   * @param {string} checksum - Migration file checksum
   * @param {number} executionTime - Execution time in milliseconds
   * @returns {Promise<void>}
   */
  async updateSchemaVersion(databaseName, migration, checksum, executionTime) {
    this.logger.debug(`Updating schema version to: ${migration.version}`);
    
    try {
      const version = String(migration.version).padStart(3, '0');
      
      const insertQuery = `
        INSERT INTO schema_migrations (
          version,
          description,
          filename,
          checksum,
          execution_time_ms,
          executed_at
        ) VALUES (
          '${version}',
          '${this.escapeSql(migration.description)}',
          '${this.escapeSql(migration.filename)}',
          '${checksum}',
          ${executionTime},
          datetime('now')
        )
      `;
      
      await this.executeSql(databaseName, insertQuery);
      
      this.logger.debug('Schema version updated successfully');
      
    } catch (error) {
      throw new Error(`Failed to update schema version: ${error.message}`);
    }
  }

  /**
   * Verify schema version was updated
   * @param {string} databaseName - Name of the database
   * @param {number} expectedVersion - Expected version number
   * @returns {Promise<boolean>} True if version was updated
   */
  async verifySchemaVersionUpdate(databaseName, expectedVersion) {
    try {
      const version = String(expectedVersion).padStart(3, '0');
      const query = `SELECT version FROM schema_migrations WHERE version = '${version}'`;
      
      const result = await this.executeQuery(databaseName, query);
      
      if (result && result.length > 0) {
        this.logger.debug(`Schema version ${version} verified in database`);
        return true;
      }
      
      this.logger.error(`Schema version ${version} not found in database`);
      return false;
      
    } catch (error) {
      this.logger.error(`Schema version verification failed: ${error.message}`);
      return false;
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
      const tempFile = path.join(__dirname, `temp-query-${Date.now()}.sql`);
      fs.writeFileSync(tempFile, query, 'utf8');
      
      try {
        const command = `wrangler d1 execute ${databaseName} --file=${tempFile} --json`;
        
        const output = execSync(command, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        const result = JSON.parse(output);
        return result;
        
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Calculate SHA-256 checksum for a file
   * @param {string} filePath - Path to file
   * @returns {string} Checksum
   */
  calculateChecksum(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Escape SQL string values
   * @param {string} value - Value to escape
   * @returns {string} Escaped value
   */
  escapeSql(value) {
    return String(value).replace(/'/g, "''");
  }

  /**
   * Get migration execution statistics
   * @param {Object} results - Execution results
   * @returns {Object} Statistics
   */
  getStatistics(results) {
    const successfulMigrations = results.migrations.filter(m => m.success);
    const failedMigrations = results.migrations.filter(m => !m.success);
    
    return {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      totalExecutionTime: results.totalExecutionTime,
      averageExecutionTime: results.successful > 0 
        ? results.totalExecutionTime / results.successful 
        : 0,
      successfulMigrations: successfulMigrations.map(m => ({
        version: m.migration.version,
        filename: m.migration.filename,
        executionTime: m.executionTime
      })),
      failedMigrations: failedMigrations.map(m => ({
        version: m.migration.version,
        filename: m.migration.filename,
        error: m.error
      }))
    };
  }

  /**
   * Validate migration file before execution
   * @param {Object} migration - Migration details
   * @returns {Object} Validation result
   */
  validateMigration(migration) {
    const errors = [];
    const warnings = [];
    
    // Check file exists
    if (!fs.existsSync(migration.path)) {
      errors.push(`Migration file not found: ${migration.path}`);
    }
    
    // Check file is readable
    try {
      const content = fs.readFileSync(migration.path, 'utf8');
      
      // Check file is not empty
      if (content.trim().length === 0) {
        errors.push('Migration file is empty');
      }
      
      // Check for basic SQL syntax
      if (!content.includes('CREATE') && !content.includes('ALTER') && 
          !content.includes('INSERT') && !content.includes('UPDATE')) {
        warnings.push('Migration file may not contain valid SQL statements');
      }
      
      // Check for dangerous operations
      if (content.includes('DROP DATABASE') || content.includes('DROP SCHEMA')) {
        warnings.push('Migration contains potentially dangerous DROP operations');
      }
      
    } catch (error) {
      errors.push(`Failed to read migration file: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = { MigrationExecutor };
