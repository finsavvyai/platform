/**
 * Database Rollback Handler
 * 
 * Handles database rollback operations
 * Implements backup identification, restoration, and schema verification
 */

const fs = require('fs');
const path = require('path');

class DatabaseRollback {
  constructor(logger, config, rollbackHandler) {
    this.logger = logger;
    this.config = config;
    this.rollbackHandler = rollbackHandler; // Migration rollback handler
    this.backupsDir = path.join(__dirname, '..', '..', 'backups');
  }

  /**
   * Rollback database to previous state
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object>} Rollback result
   */
  async rollbackDatabase(deploymentId) {
    this.logger.info('Rolling back database...');
    
    const startTime = Date.now();
    
    try {
      // Get list of databases to rollback
      const databases = this.getDatabaseList();
      
      const results = [];
      let allSuccessful = true;
      
      for (const databaseName of databases) {
        try {
          this.logger.info(`Rolling back database: ${databaseName}`);
          
          // Identify backup for this deployment
          const backup = await this.identifyBackup(databaseName, deploymentId);
          
          if (!backup) {
            this.logger.warn(`No backup found for ${databaseName}, skipping`);
            results.push({
              databaseName,
              success: true,
              skipped: true,
              reason: 'No backup found'
            });
            continue;
          }
          
          // Restore database from backup
          const restoreResult = await this.restoreDatabase(databaseName, backup);
          
          if (!restoreResult.success) {
            allSuccessful = false;
            this.logger.error(`Failed to restore ${databaseName}: ${restoreResult.error}`);
          } else {
            this.logger.success(`Successfully restored ${databaseName}`);
          }
          
          results.push({
            databaseName,
            ...restoreResult
          });
          
        } catch (error) {
          allSuccessful = false;
          results.push({
            databaseName,
            success: false,
            error: error.message
          });
          this.logger.error(`Error rolling back ${databaseName}: ${error.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        success: allSuccessful,
        databases: results,
        totalDatabases: databases.length,
        successfulRollbacks: results.filter(r => r.success).length,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`Database rollback failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Get list of databases to rollback
   * @returns {Array<string>} Database names
   */
  getDatabaseList() {
    // Return list of databases that need rollback
    return [
      'sdlc-primary-db',
      'sdlc-events-db'
    ];
  }

  /**
   * Identify backup for a specific deployment
   * @param {string} databaseName - Database name
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object|null>} Backup info
   */
  async identifyBackup(databaseName, deploymentId) {
    try {
      this.logger.debug(`Identifying backup for ${databaseName} (deployment: ${deploymentId})`);
      
      // Get all backups for this database
      const backups = this.listBackups(databaseName);
      
      if (backups.length === 0) {
        this.logger.warn(`No backups found for ${databaseName}`);
        return null;
      }
      
      // Try to find backup associated with this deployment
      let backup = backups.find(b => b.deploymentId === deploymentId);
      
      // If no backup for this deployment, use the most recent backup
      if (!backup) {
        this.logger.debug('No backup for this deployment, using most recent');
        backup = backups[0]; // Backups are sorted by date, most recent first
      }
      
      this.logger.debug(`Identified backup: ${backup.backupId}`);
      
      return backup;
      
    } catch (error) {
      this.logger.error(`Failed to identify backup: ${error.message}`);
      return null;
    }
  }

  /**
   * List all backups for a database
   * @param {string} databaseName - Database name
   * @returns {Array} List of backups
   */
  listBackups(databaseName) {
    try {
      if (!fs.existsSync(this.backupsDir)) {
        return [];
      }
      
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
   * Restore database from backup
   * @param {string} databaseName - Database name
   * @param {Object} backup - Backup info
   * @returns {Promise<Object>} Restoration result
   */
  async restoreDatabase(databaseName, backup) {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Restoring ${databaseName} from backup ${backup.backupId}`);
      
      // Use the migration rollback handler to perform the actual restoration
      const result = await this.rollbackHandler.rollback(databaseName, backup.backupId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          duration: Date.now() - startTime
        };
      }
      
      // Verify schema after restoration
      const schemaVerified = await this.verifySchema(databaseName, backup);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        backupId: backup.backupId,
        backupDate: backup.createdAt,
        schemaVerified,
        duration
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Verify database schema after restoration
   * @param {string} databaseName - Database name
   * @param {Object} backup - Backup info
   * @returns {Promise<boolean>} True if schema is valid
   */
  async verifySchema(databaseName, backup) {
    try {
      this.logger.debug(`Verifying schema for ${databaseName}`);
      
      // Use the rollback handler's verification
      const verified = await this.rollbackHandler.verifyRollback(databaseName, backup);
      
      if (verified) {
        this.logger.success(`Schema verification passed for ${databaseName}`);
      } else {
        this.logger.warn(`Schema verification failed for ${databaseName}`);
      }
      
      return verified;
      
    } catch (error) {
      this.logger.error(`Schema verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get database rollback status
   * @param {string} databaseName - Database name
   * @returns {Object} Rollback status
   */
  getDatabaseRollbackStatus(databaseName) {
    const backups = this.listBackups(databaseName);
    
    return {
      databaseName,
      availableBackups: backups.length,
      mostRecentBackup: backups.length > 0 ? backups[0] : null,
      canRollback: backups.length > 0
    };
  }

  /**
   * Verify all databases are accessible after rollback
   * @returns {Promise<Object>} Verification result
   */
  async verifyAllDatabases() {
    this.logger.info('Verifying all databases...');
    
    const databases = this.getDatabaseList();
    const results = [];
    
    for (const databaseName of databases) {
      try {
        const accessible = await this.verifyDatabaseAccessible(databaseName);
        
        results.push({
          databaseName,
          accessible,
          success: accessible
        });
        
        if (accessible) {
          this.logger.success(`${databaseName} is accessible`);
        } else {
          this.logger.error(`${databaseName} is not accessible`);
        }
        
      } catch (error) {
        results.push({
          databaseName,
          accessible: false,
          success: false,
          error: error.message
        });
        this.logger.error(`Error verifying ${databaseName}: ${error.message}`);
      }
    }
    
    const allAccessible = results.every(r => r.accessible);
    
    return {
      success: allAccessible,
      databases: results,
      totalDatabases: databases.length,
      accessibleDatabases: results.filter(r => r.accessible).length
    };
  }

  /**
   * Verify a database is accessible
   * @param {string} databaseName - Database name
   * @returns {Promise<boolean>} True if accessible
   */
  async verifyDatabaseAccessible(databaseName) {
    try {
      // Use the rollback handler to execute a simple query
      const testQuery = 'SELECT 1 as test';
      const result = await this.rollbackHandler.executeQuery(databaseName, testQuery);
      
      return result && result.length > 0;
      
    } catch (error) {
      this.logger.error(`Database accessibility check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get backup information
   * @param {string} backupId - Backup ID
   * @returns {Object|null} Backup information
   */
  getBackupInfo(backupId) {
    try {
      const metadataPath = path.join(this.backupsDir, `${backupId}.json`);
      
      if (!fs.existsSync(metadataPath)) {
        return null;
      }
      
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
    } catch (error) {
      this.logger.error(`Failed to get backup info: ${error.message}`);
      return null;
    }
  }

  /**
   * Create database rollback report
   * @param {Object} rollbackResult - Rollback result
   * @returns {string} Formatted report
   */
  createRollbackReport(rollbackResult) {
    const lines = [];
    
    lines.push('='.repeat(60));
    lines.push('DATABASE ROLLBACK REPORT');
    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`Total Databases: ${rollbackResult.totalDatabases}`);
    lines.push(`Successful Rollbacks: ${rollbackResult.successfulRollbacks}`);
    lines.push(`Status: ${rollbackResult.success ? 'SUCCESS' : 'PARTIAL/FAILED'}`);
    lines.push(`Duration: ${rollbackResult.duration}ms`);
    lines.push('');
    lines.push('Database Details:');
    
    for (const db of rollbackResult.databases) {
      const status = db.success ? '✓' : '✗';
      lines.push(`  ${status} ${db.databaseName}`);
      
      if (db.skipped) {
        lines.push(`    Skipped: ${db.reason}`);
      } else if (db.success) {
        lines.push(`    Backup ID: ${db.backupId}`);
        lines.push(`    Backup Date: ${db.backupDate}`);
        lines.push(`    Schema Verified: ${db.schemaVerified ? 'Yes' : 'No'}`);
        lines.push(`    Duration: ${db.duration}ms`);
      } else {
        lines.push(`    Error: ${db.error}`);
      }
    }
    
    lines.push('');
    lines.push('='.repeat(60));
    
    return lines.join('\n');
  }

  /**
   * Clean up old backups
   * @param {number} retentionDays - Number of days to retain backups
   * @returns {number} Number of backups deleted
   */
  cleanupOldBackups(retentionDays = 30) {
    try {
      this.logger.info(`Cleaning up backups older than ${retentionDays} days`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const files = fs.readdirSync(this.backupsDir);
      const metadataFiles = files.filter(file => file.endsWith('.json'));
      
      let deletedCount = 0;
      
      for (const file of metadataFiles) {
        try {
          const metadataPath = path.join(this.backupsDir, file);
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          
          const backupDate = new Date(metadata.createdAt);
          
          if (backupDate < cutoffDate) {
            // Delete metadata file
            fs.unlinkSync(metadataPath);
            
            // Delete backup file
            const backupPath = path.join(this.backupsDir, metadata.filename);
            if (fs.existsSync(backupPath)) {
              fs.unlinkSync(backupPath);
            }
            
            deletedCount++;
            this.logger.debug(`Deleted backup: ${metadata.backupId}`);
          }
          
        } catch (error) {
          this.logger.error(`Error processing backup file ${file}: ${error.message}`);
        }
      }
      
      this.logger.info(`Cleaned up ${deletedCount} old backups`);
      
      return deletedCount;
      
    } catch (error) {
      this.logger.error(`Backup cleanup failed: ${error.message}`);
      return 0;
    }
  }
}

module.exports = { DatabaseRollback };
