/**
 * Database Migration System
 * 
 * Exports all migration system components
 */

const { MigrationManager } = require('./migration-manager');
const { BackupHandler } = require('./backup-handler');
const { MigrationExecutor } = require('./migration-executor');
const { RollbackHandler } = require('./rollback-handler');

/**
 * Database Migration Orchestrator
 * 
 * Coordinates the entire migration process including backup, execution, and rollback
 */
class DatabaseMigrationSystem {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    
    // Initialize components
    this.migrationManager = new MigrationManager(logger, config);
    this.backupHandler = new BackupHandler(logger, config);
    this.migrationExecutor = new MigrationExecutor(logger, config);
    this.rollbackHandler = new RollbackHandler(logger, config);
  }

  /**
   * Execute complete migration process
   * @param {string} databaseName - Name of the database
   * @returns {Promise<Object>} Migration result
   */
  async migrate(databaseName) {
    this.logger.phase('Database Migration');
    
    const startTime = Date.now();
    let backupInfo = null;
    
    try {
      // Step 1: Get current version and pending migrations
      const currentVersion = await this.migrationManager.getCurrentVersion(databaseName);
      this.logger.info(`Current schema version: ${currentVersion}`);
      
      const pendingMigrations = await this.migrationManager.getPendingMigrations(databaseName);
      
      if (pendingMigrations.length === 0) {
        this.logger.success('Database is up to date, no migrations needed');
        return {
          success: true,
          databaseName,
          currentVersion,
          migrationsExecuted: 0,
          duration: Date.now() - startTime
        };
      }
      
      // Step 2: Create backup before migration
      this.logger.info('Creating pre-migration backup...');
      backupInfo = await this.backupHandler.createBackup(databaseName, 'pre-migration');
      
      // Step 3: Execute migrations
      this.logger.info(`Executing ${pendingMigrations.length} pending migrations...`);
      const executionResults = await this.migrationExecutor.executeMigrations(
        databaseName,
        pendingMigrations
      );
      
      // Step 4: Check if all migrations succeeded
      if (executionResults.failed > 0) {
        throw new Error(
          `Migration failed: ${executionResults.failed} of ${executionResults.total} migrations failed`
        );
      }
      
      // Step 5: Get new version
      const newVersion = await this.migrationManager.getCurrentVersion(databaseName);
      
      const duration = Date.now() - startTime;
      
      this.logger.success(
        `Migration completed successfully: ${currentVersion} → ${newVersion} ` +
        `(${executionResults.successful} migrations, ${duration}ms)`
      );
      
      return {
        success: true,
        databaseName,
        previousVersion: currentVersion,
        currentVersion: newVersion,
        migrationsExecuted: executionResults.successful,
        backupId: backupInfo.backupId,
        duration,
        executionResults
      };
      
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`);
      
      // Attempt rollback if backup exists
      if (backupInfo) {
        this.logger.warn('Attempting to rollback to pre-migration backup...');
        
        try {
          const rollbackResult = await this.rollbackHandler.rollback(
            databaseName,
            backupInfo.backupId
          );
          
          if (rollbackResult.success) {
            this.logger.success('Rollback completed successfully');
          } else {
            this.logger.error('Rollback failed, manual intervention required');
          }
          
          return {
            success: false,
            databaseName,
            error: error.message,
            backupId: backupInfo.backupId,
            rollbackResult,
            duration: Date.now() - startTime
          };
          
        } catch (rollbackError) {
          this.logger.error(`Rollback failed: ${rollbackError.message}`);
          
          return {
            success: false,
            databaseName,
            error: error.message,
            rollbackError: rollbackError.message,
            backupId: backupInfo.backupId,
            duration: Date.now() - startTime
          };
        }
      }
      
      return {
        success: false,
        databaseName,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Rollback database to a specific backup
   * @param {string} databaseName - Name of the database
   * @param {string} backupId - Backup ID (optional, uses most recent if not provided)
   * @returns {Promise<Object>} Rollback result
   */
  async rollback(databaseName, backupId = null) {
    this.logger.phase('Database Rollback');
    
    try {
      // If no backup ID provided, use most recent
      if (!backupId) {
        const recentBackup = this.rollbackHandler.getMostRecentBackup(databaseName);
        
        if (!recentBackup) {
          throw new Error(`No backups found for database: ${databaseName}`);
        }
        
        backupId = recentBackup.backupId;
        this.logger.info(`Using most recent backup: ${backupId}`);
      }
      
      // Execute rollback
      const result = await this.rollbackHandler.rollback(databaseName, backupId);
      
      // Generate rollback report
      const report = this.rollbackHandler.createRollbackReport(result);
      this.logger.info('\n' + report);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Rollback failed: ${error.message}`);
      
      return {
        success: false,
        databaseName,
        backupId,
        error: error.message
      };
    }
  }

  /**
   * Get migration status for a database
   * @param {string} databaseName - Name of the database
   * @returns {Promise<Object>} Migration status
   */
  async getStatus(databaseName) {
    try {
      const currentVersion = await this.migrationManager.getCurrentVersion(databaseName);
      const pendingMigrations = await this.migrationManager.getPendingMigrations(databaseName);
      const availableBackups = this.rollbackHandler.listAvailableBackups(databaseName);
      
      return {
        databaseName,
        currentVersion,
        pendingMigrations: pendingMigrations.length,
        availableBackups: availableBackups.length,
        upToDate: pendingMigrations.length === 0,
        migrations: pendingMigrations,
        backups: availableBackups
      };
      
    } catch (error) {
      return {
        databaseName,
        error: error.message
      };
    }
  }
}

module.exports = {
  DatabaseMigrationSystem,
  MigrationManager,
  BackupHandler,
  MigrationExecutor,
  RollbackHandler
};
