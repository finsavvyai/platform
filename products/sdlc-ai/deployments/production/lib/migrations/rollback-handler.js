/**
 * Migration Rollback Handler
 * 
 * Handles backup restoration, rollback verification, and error handling
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RollbackHandler {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.backupsDir = path.join(__dirname, '..', '..', 'backups');
  }

  /**
   * Rollback database to a previous backup
   * @param {string} databaseName - Name of the database
   * @param {string} backupId - Backup ID to restore from
   * @returns {Promise<Object>} Rollback result
   */
  async rollback(databaseName, backupId) {
    this.logger.warn(`Initiating rollback for database: ${databaseName}`);
    
    const startTime = Date.now();
    
    try {
      // Load backup metadata
      const backupInfo = await this.loadBackupMetadata(backupId);
      
      if (!backupInfo) {
        throw new Error(`Backup not found: ${backupId}`);
      }
      
      // Verify backup exists and is valid
      const backupValid = await this.verifyBackupBeforeRestore(backupInfo);
      
      if (!backupValid) {
        throw new Error('Backup validation failed, cannot proceed with rollback');
      }
      
      // Restore database from backup
      await this.restoreFromBackup(databaseName, backupInfo);
      
      const executionTime = Date.now() - startTime;
      
      // Verify rollback was successful
      const verified = await this.verifyRollback(databaseName, backupInfo);
      
      if (!verified) {
        throw new Error('Rollback verification failed');
      }
      
      this.logger.success(
        `Rollback completed successfully: ${databaseName} restored to backup ${backupId} (${executionTime}ms)`
      );
      
      return {
        success: true,
        databaseName,
        backupId,
        backupInfo,
        executionTime,
        verified: true
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Rollback failed: ${error.message}`);
      
      return {
        success: false,
        databaseName,
        backupId,
        executionTime,
        error: error.message,
        verified: false
      };
    }
  }

  /**
   * Restore database from backup file
   * @param {string} databaseName - Name of the database
   * @param {Object} backupInfo - Backup information
   * @returns {Promise<void>}
   */
  async restoreFromBackup(databaseName, backupInfo) {
    this.logger.info(`Restoring database from backup: ${backupInfo.filename}`);
    
    try {
      const backupPath = path.join(this.backupsDir, backupInfo.filename);
      
      // Verify backup file exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }
      
      // Read backup SQL content
      const sql = fs.readFileSync(backupPath, 'utf8');
      
      // Drop all existing tables (clean slate)
      await this.dropAllTables(databaseName);
      
      // Execute backup SQL to restore database
      await this.executeSql(databaseName, sql);
      
      this.logger.success('Database restored from backup');
      
    } catch (error) {
      throw new Error(`Backup restoration failed: ${error.message}`);
    }
  }

  /**
   * Drop all tables in database
   * @param {string} databaseName - Name of the database
   * @returns {Promise<void>}
   */
  async dropAllTables(databaseName) {
    this.logger.debug('Dropping all tables in database');
    
    try {
      // Get list of all tables
      const tablesQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `;
      
      const tables = await this.executeQuery(databaseName, tablesQuery);
      
      if (!tables || tables.length === 0) {
        this.logger.debug('No tables to drop');
        return;
      }
      
      // Drop each table
      for (const table of tables) {
        const dropQuery = `DROP TABLE IF EXISTS ${table.name};`;
        await this.executeSql(databaseName, dropQuery);
        this.logger.debug(`Dropped table: ${table.name}`);
      }
      
      this.logger.debug(`Dropped ${tables.length} tables`);
      
    } catch (error) {
      throw new Error(`Failed to drop tables: ${error.message}`);
    }
  }

  /**
   * Verify backup before restoration
   * @param {Object} backupInfo - Backup information
   * @returns {Promise<boolean>} True if backup is valid
   */
  async verifyBackupBeforeRestore(backupInfo) {
    this.logger.debug('Verifying backup before restoration');
    
    try {
      const backupPath = path.join(this.backupsDir, backupInfo.filename);
      
      // Check file exists
      if (!fs.existsSync(backupPath)) {
        this.logger.error('Backup file does not exist');
        return false;
      }
      
      // Check file size matches metadata
      const stats = fs.statSync(backupPath);
      if (stats.size !== backupInfo.size) {
        this.logger.error('Backup file size mismatch');
        return false;
      }
      
      // Verify checksum
      const crypto = require('crypto');
      const content = fs.readFileSync(backupPath);
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      
      if (checksum !== backupInfo.checksum) {
        this.logger.error('Backup checksum mismatch');
        return false;
      }
      
      // Verify SQL content
      const sql = fs.readFileSync(backupPath, 'utf8');
      if (sql.trim().length === 0) {
        this.logger.error('Backup file is empty');
        return false;
      }
      
      this.logger.debug('Backup verification successful');
      return true;
      
    } catch (error) {
      this.logger.error(`Backup verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify rollback was successful
   * @param {string} databaseName - Name of the database
   * @param {Object} backupInfo - Backup information
   * @returns {Promise<boolean>} True if rollback was successful
   */
  async verifyRollback(databaseName, backupInfo) {
    this.logger.debug('Verifying rollback success');
    
    try {
      // Check database is accessible
      const testQuery = `SELECT 1 as test`;
      await this.executeQuery(databaseName, testQuery);
      
      // Check schema_migrations table exists
      const tablesQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='schema_migrations'
      `;
      const tables = await this.executeQuery(databaseName, tablesQuery);
      
      if (!tables || tables.length === 0) {
        this.logger.warn('schema_migrations table not found after rollback');
        // This might be expected if rolling back to before migrations were tracked
      }
      
      // Verify we can query the database
      const countQuery = `
        SELECT COUNT(*) as count FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `;
      const result = await this.executeQuery(databaseName, countQuery);
      
      if (result && result.length > 0) {
        const tableCount = result[0].count;
        this.logger.debug(`Database has ${tableCount} tables after rollback`);
      }
      
      this.logger.debug('Rollback verification successful');
      return true;
      
    } catch (error) {
      this.logger.error(`Rollback verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Load backup metadata from file
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object|null>} Backup metadata
   */
  async loadBackupMetadata(backupId) {
    try {
      const metadataPath = path.join(this.backupsDir, `${backupId}.json`);
      
      if (!fs.existsSync(metadataPath)) {
        this.logger.error(`Backup metadata not found: ${backupId}`);
        return null;
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata;
      
    } catch (error) {
      this.logger.error(`Failed to load backup metadata: ${error.message}`);
      return null;
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
      const tempFile = path.join(__dirname, `temp-rollback-${Date.now()}.sql`);
      fs.writeFileSync(tempFile, sql, 'utf8');
      
      try {
        const command = `wrangler d1 execute ${databaseName} --file=${tempFile}`;
        
        execSync(command, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
      
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
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
      const tempFile = path.join(__dirname, `temp-rollback-query-${Date.now()}.sql`);
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
   * Handle rollback errors with appropriate recovery actions
   * @param {Error} error - Error that occurred during rollback
   * @param {string} databaseName - Name of the database
   * @param {string} backupId - Backup ID
   * @returns {Object} Error handling result
   */
  handleRollbackError(error, databaseName, backupId) {
    this.logger.error(`Rollback error occurred: ${error.message}`);
    
    const errorType = this.classifyError(error);
    const recovery = this.getRecoveryAction(errorType);
    
    this.logger.warn(`Error type: ${errorType}`);
    this.logger.warn(`Recommended recovery: ${recovery.action}`);
    
    return {
      error: error.message,
      errorType,
      recovery,
      databaseName,
      backupId,
      timestamp: new Date()
    };
  }

  /**
   * Classify error type
   * @param {Error} error - Error to classify
   * @returns {string} Error type
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('backup not found') || message.includes('file not found')) {
      return 'BACKUP_NOT_FOUND';
    }
    
    if (message.includes('checksum') || message.includes('corrupted')) {
      return 'BACKUP_CORRUPTED';
    }
    
    if (message.includes('permission') || message.includes('access denied')) {
      return 'PERMISSION_ERROR';
    }
    
    if (message.includes('disk') || message.includes('space')) {
      return 'DISK_SPACE_ERROR';
    }
    
    if (message.includes('syntax') || message.includes('sql')) {
      return 'SQL_ERROR';
    }
    
    if (message.includes('timeout') || message.includes('connection')) {
      return 'CONNECTION_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Get recovery action for error type
   * @param {string} errorType - Type of error
   * @returns {Object} Recovery action
   */
  getRecoveryAction(errorType) {
    const recoveryActions = {
      BACKUP_NOT_FOUND: {
        action: 'Verify backup ID and try with a different backup',
        severity: 'HIGH',
        retryable: false
      },
      BACKUP_CORRUPTED: {
        action: 'Use an earlier backup or restore from external backup',
        severity: 'CRITICAL',
        retryable: false
      },
      PERMISSION_ERROR: {
        action: 'Check file permissions and Cloudflare authentication',
        severity: 'HIGH',
        retryable: true
      },
      DISK_SPACE_ERROR: {
        action: 'Free up disk space and retry',
        severity: 'HIGH',
        retryable: true
      },
      SQL_ERROR: {
        action: 'Review backup SQL for syntax errors',
        severity: 'MEDIUM',
        retryable: false
      },
      CONNECTION_ERROR: {
        action: 'Check network connectivity and retry',
        severity: 'MEDIUM',
        retryable: true
      },
      UNKNOWN_ERROR: {
        action: 'Review error logs and contact support if needed',
        severity: 'MEDIUM',
        retryable: true
      }
    };
    
    return recoveryActions[errorType] || recoveryActions.UNKNOWN_ERROR;
  }

  /**
   * List available backups for a database
   * @param {string} databaseName - Name of the database
   * @returns {Array} List of available backups
   */
  listAvailableBackups(databaseName) {
    try {
      const files = fs.readdirSync(this.backupsDir);
      const metadataFiles = files.filter(file => file.endsWith('.json'));
      
      const backups = metadataFiles
        .map(file => {
          try {
            const metadataPath = path.join(this.backupsDir, file);
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            return metadata;
          } catch (error) {
            return null;
          }
        })
        .filter(backup => backup && backup.databaseName === databaseName)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return backups;
      
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the most recent backup for a database
   * @param {string} databaseName - Name of the database
   * @returns {Object|null} Most recent backup metadata
   */
  getMostRecentBackup(databaseName) {
    const backups = this.listAvailableBackups(databaseName);
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Create rollback report
   * @param {Object} rollbackResult - Rollback result
   * @returns {string} Formatted report
   */
  createRollbackReport(rollbackResult) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('DATABASE ROLLBACK REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Database: ${rollbackResult.databaseName}`);
    lines.push(`Backup ID: ${rollbackResult.backupId}`);
    lines.push(`Status: ${rollbackResult.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Execution Time: ${rollbackResult.executionTime}ms`);
    lines.push(`Verified: ${rollbackResult.verified ? 'Yes' : 'No'}`);
    lines.push(`Timestamp: ${new Date().toISOString()}`);
    
    if (rollbackResult.backupInfo) {
      lines.push('');
      lines.push('Backup Information:');
      lines.push(`  Created: ${rollbackResult.backupInfo.createdAt}`);
      lines.push(`  Size: ${this.formatSize(rollbackResult.backupInfo.size)}`);
      lines.push(`  Version: ${rollbackResult.backupInfo.version}`);
    }
    
    if (rollbackResult.error) {
      lines.push('');
      lines.push('Error:');
      lines.push(`  ${rollbackResult.error}`);
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

module.exports = { RollbackHandler };
