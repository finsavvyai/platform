/**
 * Database Backup Handler
 * 
 * Handles pre-migration backup creation, verification, and metadata storage
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class BackupHandler {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.backupsDir = path.join(__dirname, '..', '..', 'backups');
    this.createdBackups = [];
    
    // Ensure backups directory exists
    this.ensureBackupsDirectory();
  }

  /**
   * Ensure backups directory exists
   */
  ensureBackupsDirectory() {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
      this.logger.debug(`Created backups directory: ${this.backupsDir}`);
    }
  }

  /**
   * Create pre-migration backup of database
   * @param {string} databaseName - Name of the database to backup
   * @param {string} reason - Reason for backup (e.g., "pre-migration")
   * @returns {Promise<Object>} Backup information
   */
  async createBackup(databaseName, reason = 'pre-migration') {
    this.logger.info(`Creating backup for database: ${databaseName}`);
    
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = this.generateBackupId();
    const backupFilename = `${databaseName}-${timestamp}-${backupId}.sql`;
    const backupPath = path.join(this.backupsDir, backupFilename);
    
    try {
      // Export database to SQL file
      await this.exportDatabase(databaseName, backupPath);
      
      // Verify backup was created
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file was not created');
      }
      
      const backupSize = fs.statSync(backupPath).size;
      const executionTime = Date.now() - startTime;
      
      // Calculate checksum for verification
      const checksum = this.calculateChecksum(backupPath);
      
      // Create backup metadata
      const backupInfo = {
        backupId,
        databaseName,
        filename: backupFilename,
        path: backupPath,
        size: backupSize,
        checksum,
        reason,
        createdAt: new Date(),
        executionTime,
        verified: false
      };
      
      // Verify backup integrity
      const verified = await this.verifyBackup(backupInfo);
      backupInfo.verified = verified;
      
      if (!verified) {
        throw new Error('Backup verification failed');
      }
      
      // Store backup metadata
      await this.storeBackupMetadata(backupInfo);
      
      // Track created backup
      this.createdBackups.push(backupInfo);
      
      this.logger.success(
        `Backup created successfully: ${backupFilename} (${this.formatSize(backupSize)}, ${executionTime}ms)`
      );
      
      return backupInfo;
      
    } catch (error) {
      // Clean up failed backup file
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      throw new Error(`Failed to create backup for '${databaseName}': ${error.message}`);
    }
  }

  /**
   * Export database to SQL file
   * @param {string} databaseName - Name of the database
   * @param {string} outputPath - Path to output file
   * @returns {Promise<void>}
   */
  async exportDatabase(databaseName, outputPath) {
    try {
      // Use wrangler to export database
      // Note: D1 doesn't have a direct export command, so we'll query all tables
      this.logger.debug(`Exporting database: ${databaseName}`);
      
      // Get list of all tables
      const tablesQuery = `
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name;
      `;
      
      const tables = await this.executeQuery(databaseName, tablesQuery);
      
      let exportContent = `-- Database Backup: ${databaseName}\n`;
      exportContent += `-- Created: ${new Date().toISOString()}\n`;
      exportContent += `-- Tables: ${tables.length}\n\n`;
      
      // Export schema and data for each table
      for (const table of tables) {
        const tableName = table.name;
        
        // Get table schema
        const schemaQuery = `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}';`;
        const schemaResult = await this.executeQuery(databaseName, schemaQuery);
        
        if (schemaResult && schemaResult.length > 0) {
          exportContent += `-- Table: ${tableName}\n`;
          exportContent += `${schemaResult[0].sql};\n\n`;
        }
        
        // Get table data
        const dataQuery = `SELECT * FROM ${tableName};`;
        const dataResult = await this.executeQuery(databaseName, dataQuery);
        
        if (dataResult && dataResult.length > 0) {
          exportContent += `-- Data for table: ${tableName}\n`;
          
          for (const row of dataResult) {
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row)
              .map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
              .join(', ');
            
            exportContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
          }
          
          exportContent += '\n';
        }
      }
      
      // Write to file
      fs.writeFileSync(outputPath, exportContent, 'utf8');
      
    } catch (error) {
      throw new Error(`Database export failed: ${error.message}`);
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
      const tempFile = path.join(__dirname, `temp-backup-query-${Date.now()}.sql`);
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
   * Verify backup integrity
   * @param {Object} backupInfo - Backup information
   * @returns {Promise<boolean>} True if backup is valid
   */
  async verifyBackup(backupInfo) {
    this.logger.debug(`Verifying backup: ${backupInfo.filename}`);
    
    try {
      // Check file exists
      if (!fs.existsSync(backupInfo.path)) {
        this.logger.error('Backup file does not exist');
        return false;
      }
      
      // Check file size is reasonable (not empty, not too small)
      const stats = fs.statSync(backupInfo.path);
      if (stats.size < 100) {
        this.logger.error('Backup file is too small');
        return false;
      }
      
      // Verify checksum matches
      const currentChecksum = this.calculateChecksum(backupInfo.path);
      if (currentChecksum !== backupInfo.checksum) {
        this.logger.error('Backup checksum mismatch');
        return false;
      }
      
      // Verify SQL syntax (basic check)
      const content = fs.readFileSync(backupInfo.path, 'utf8');
      if (!content.includes('CREATE TABLE') && !content.includes('INSERT INTO')) {
        this.logger.warn('Backup may not contain valid SQL statements');
      }
      
      this.logger.debug('Backup verification successful');
      return true;
      
    } catch (error) {
      this.logger.error(`Backup verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Store backup metadata to JSON file
   * @param {Object} backupInfo - Backup information
   * @returns {Promise<void>}
   */
  async storeBackupMetadata(backupInfo) {
    const metadataFilename = `${backupInfo.backupId}.json`;
    const metadataPath = path.join(this.backupsDir, metadataFilename);
    
    try {
      const metadata = {
        backupId: backupInfo.backupId,
        databaseName: backupInfo.databaseName,
        filename: backupInfo.filename,
        size: backupInfo.size,
        checksum: backupInfo.checksum,
        reason: backupInfo.reason,
        createdAt: backupInfo.createdAt,
        executionTime: backupInfo.executionTime,
        verified: backupInfo.verified,
        environment: this.config.environment,
        version: await this.getDatabaseVersion(backupInfo.databaseName)
      };
      
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      this.logger.debug(`Backup metadata stored: ${metadataFilename}`);
      
    } catch (error) {
      this.logger.warn(`Failed to store backup metadata: ${error.message}`);
    }
  }

  /**
   * Get database version from schema_migrations table
   * @param {string} databaseName - Name of the database
   * @returns {Promise<string>} Database version
   */
  async getDatabaseVersion(databaseName) {
    try {
      const query = `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`;
      const result = await this.executeQuery(databaseName, query);
      
      if (result && result.length > 0) {
        return result[0].version;
      }
      
      return '000';
      
    } catch (error) {
      return 'unknown';
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
   * Generate unique backup ID
   * @returns {string} Backup ID
   */
  generateBackupId() {
    return crypto.randomBytes(8).toString('hex');
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

  /**
   * Get backup by ID
   * @param {string} backupId - Backup ID
   * @returns {Object|null} Backup information
   */
  getBackup(backupId) {
    return this.createdBackups.find(backup => backup.backupId === backupId);
  }

  /**
   * Get all created backups
   * @returns {Array} List of backups
   */
  getCreatedBackups() {
    return this.createdBackups;
  }

  /**
   * List all available backups
   * @returns {Array} List of backup metadata
   */
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupsDir);
      const metadataFiles = files.filter(file => file.endsWith('.json'));
      
      const backups = metadataFiles.map(file => {
        const metadataPath = path.join(this.backupsDir, file);
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        return metadata;
      });
      
      return backups.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
    } catch (error) {
      this.logger.warn(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean up old backups (keep last N backups)
   * @param {number} keepCount - Number of backups to keep
   * @returns {Promise<number>} Number of backups deleted
   */
  async cleanupOldBackups(keepCount = 30) {
    try {
      const backups = this.listBackups();
      
      if (backups.length <= keepCount) {
        this.logger.debug('No old backups to clean up');
        return 0;
      }
      
      const backupsToDelete = backups.slice(keepCount);
      let deletedCount = 0;
      
      for (const backup of backupsToDelete) {
        try {
          const backupPath = path.join(this.backupsDir, backup.filename);
          const metadataPath = path.join(this.backupsDir, `${backup.backupId}.json`);
          
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          
          if (fs.existsSync(metadataPath)) {
            fs.unlinkSync(metadataPath);
          }
          
          deletedCount++;
          
        } catch (error) {
          this.logger.warn(`Failed to delete backup ${backup.backupId}: ${error.message}`);
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

module.exports = { BackupHandler };
