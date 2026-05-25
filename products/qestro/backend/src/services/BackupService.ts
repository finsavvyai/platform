/**
 * Backup and Disaster Recovery Service
 * Automated database backups, file storage, and disaster recovery procedures
 */

import { DatabaseService } from './DatabaseService.js';
import { logger } from '../utils/logger.js';
import { execSync } from 'child_process';
import { createWriteStream, createReadStream, promises as fs } from 'fs';
import { join, extname } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import S3 from 'aws-sdk/clients/s3.js';

export interface BackupConfig {
  retentionDays: number;
  backupFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  storageType: 'local' | 's3' | 'gcs' | 'azure';
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  validateIntegrity: boolean;
}

export interface BackupMetadata {
  id: string;
  type: 'database' | 'files' | 'configuration' | 'full';
  timestamp: Date;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  retentionDate: Date;
  location: string;
  status: 'creating' | 'completed' | 'failed' | 'expired';
  createdBy?: string;
  tags?: string[];
}

export interface BackupProgress {
  backupId: string;
  status: 'starting' | 'running' | 'verifying' | 'uploading' | 'completed' | 'failed';
  progress: number; // 0-100
  bytesProcessed: number;
  totalBytes: number;
  currentStep: string;
  startTime: Date;
  estimatedCompletion?: Date;
  error?: string;
}

export interface RecoveryPlan {
  id: string;
  name: string;
  description: string;
  rtoHours: number; // Recovery Time Objective
  rpoMinutes: number; // Recovery Point Objective
  backupIds: string[];
  recoverySteps: string[];
  validationTests: string[];
  lastTestDate?: Date;
  lastTestSuccess?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BackupService {
  private db: DatabaseService;
  private config: BackupConfig;
  private s3Client?: S3;
  private activeBackups: Map<string, BackupProgress> = new Map();
  private backupLocation: string;

  constructor(db: DatabaseService, config: Partial<BackupConfig> = {}) {
    this.db = db;
    this.config = {
      retentionDays: config.retentionDays || 30,
      backupFrequency: config.backupFrequency || 'daily',
      storageType: config.storageType || 'local',
      encryptionEnabled: config.encryptionEnabled !== false,
      compressionEnabled: config.compressionEnabled !== false,
      validateIntegrity: config.validateIntegrity !== false,
    };

    this.backupLocation = process.env.BACKUP_LOCATION || '/tmp/qestro-backups';

    // Initialize S3 client if configured
    if (this.config.storageType === 's3') {
      this.s3Client = new S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });
    }

    // Ensure backup directory exists
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.backupLocation, { recursive: true });
      await fs.mkdir(join(this.backupLocation, 'database'), { recursive: true });
      await fs.mkdir(join(this.backupLocation, 'files'), { recursive: true });
      await fs.mkdir(join(this.backupLocation, 'config'), { recursive: true });
      logger.info(`Backup directory ready: ${this.backupLocation}`);
    } catch (error) {
      logger.error('Failed to create backup directories:', error);
      throw error;
    }
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `${type}-${timestamp}-${random}`;
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Compress file using gzip
   */
  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const gzip = createGzip();
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);

    await pipeline(source, gzip, destination);
  }

  /**
   * Encrypt file using AES-256
   */
  private async encryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('qestro-backup'));

    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);

    // Write IV at the beginning of the encrypted file
    await fs.writeFile(outputPath, iv);

    await pipeline(
      source,
      cipher,
      destination
    );

    // Append authentication tag
    const tag = cipher.getAuthTag();
    await fs.appendFile(outputPath, tag);
  }

  /**
   * Decrypt file using AES-256
   */
  private async decryptFile(inputPath: string, outputPath: string, key: string): Promise<void> {
    const algorithm = 'aes-256-gcm';
    const fileData = await fs.readFile(inputPath);

    const iv = fileData.slice(0, 16);
    const tag = fileData.slice(-16);
    const encryptedData = fileData.slice(16, -16);

    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('qestro-backup'));
    decipher.setAuthTag(tag);

    await fs.writeFile(outputPath, decipher.update(encryptedData));
    await fs.appendFile(outputPath, decipher.final());
  }

  /**
   * Create database backup
   */
  async createDatabaseBackup(options: {
    name?: string;
    createdBy?: string;
    tags?: string[];
  } = {}): Promise<BackupMetadata> {
    const backupId = options.name || this.generateBackupId('database');
    const timestamp = new Date();

    const progress: BackupProgress = {
      backupId,
      status: 'starting',
      progress: 0,
      bytesProcessed: 0,
      totalBytes: 0,
      currentStep: 'Initializing backup',
      startTime: timestamp,
    };

    this.activeBackups.set(backupId, progress);

    try {
      // Get database connection details
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Create backup file paths
      const rawBackupPath = join(this.backupLocation, 'database', `${backupId}.sql`);
      const finalBackupPath = this.config.compressionEnabled
        ? join(this.backupLocation, 'database', `${backupId}.sql.gz`)
        : rawBackupPath;

      // Update progress
      progress.status = 'running';
      progress.currentStep = 'Dumping database';
      progress.progress = 10;

      logger.info(`Starting database backup: ${backupId}`);

      // Create database dump using pg_dump
      const dumpCommand = `pg_dump "${dbUrl}" --no-owner --no-privileges --format=custom --file="${rawBackupPath}"`;
      execSync(dumpCommand, { stdio: 'pipe' });

      progress.progress = 40;
      progress.currentStep = 'Processing backup file';

      // Get file size
      const stats = await fs.stat(rawBackupPath);
      progress.totalBytes = stats.size;

      // Compress if enabled
      if (this.config.compressionEnabled) {
        progress.currentStep = 'Compressing backup';
        progress.progress = 60;

        await this.compressFile(rawBackupPath, finalBackupPath);
        await fs.unlink(rawBackupPath); // Remove uncompressed file

        const compressedStats = await fs.stat(finalBackupPath);
        progress.totalBytes = compressedStats.size;
      }

      // Encrypt if enabled
      let finalPath = finalBackupPath;
      if (this.config.encryptionEnabled) {
        progress.currentStep = 'Encrypting backup';
        progress.progress = 80;

        const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
        if (!encryptionKey) {
          throw new Error('BACKUP_ENCRYPTION_KEY environment variable is not set');
        }

        const encryptedPath = `${finalBackupPath}.enc`;
        await this.encryptFile(finalBackupPath, encryptedPath, encryptionKey);
        await fs.unlink(finalBackupPath);
        finalPath = encryptedPath;
      }

      // Calculate checksum
      progress.currentStep = 'Calculating checksum';
      progress.progress = 90;

      const checksum = await this.calculateChecksum(finalPath);
      const finalStats = await fs.stat(finalPath);

      // Create backup metadata
      const metadata: BackupMetadata = {
        id: backupId,
        type: 'database',
        timestamp,
        size: finalStats.size,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled,
        checksum,
        retentionDate: new Date(timestamp.getTime() + this.config.retentionDays * 24 * 60 * 60 * 1000),
        location: finalPath,
        status: 'completed',
        createdBy: options.createdBy,
        tags: options.tags,
      };

      // Validate integrity if enabled
      if (this.config.validateIntegrity) {
        progress.currentStep = 'Validating backup integrity';
        progress.progress = 95;

        const isValid = await this.validateBackupIntegrity(finalPath, checksum);
        if (!isValid) {
          throw new Error('Backup integrity validation failed');
        }
      }

      // Store metadata
      await this.storeBackupMetadata(metadata);

      // Update progress
      progress.status = 'completed';
      progress.progress = 100;
      progress.currentStep = 'Backup completed successfully';

      logger.info(`Database backup completed: ${backupId} (${finalStats.size} bytes)`);
      return metadata;

    } catch (error) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Database backup failed: ${backupId}`, error);
      throw error;

    } finally {
      // Clean up progress after delay
      setTimeout(() => {
        this.activeBackups.delete(backupId);
      }, 60000); // Keep progress for 1 minute
    }
  }

  /**
   * Create file storage backup
   */
  async createFilesBackup(sourcePaths: string[], options: {
    name?: string;
    createdBy?: string;
    tags?: string[];
  } = {}): Promise<BackupMetadata> {
    const backupId = options.name || this.generateBackupId('files');
    const timestamp = new Date();

    try {
      // Create tar archive
      const archivePath = join(this.backupLocation, 'files', `${backupId}.tar`);
      const tarCommand = `tar -cf "${archivePath}" ${sourcePaths.join(' ')}`;
      execSync(tarCommand, { stdio: 'pipe' });

      // Compress if enabled
      let finalPath = archivePath;
      if (this.config.compressionEnabled) {
        const compressedPath = `${archivePath}.gz`;
        await this.compressFile(archivePath, compressedPath);
        await fs.unlink(archivePath);
        finalPath = compressedPath;
      }

      // Encrypt if enabled
      if (this.config.encryptionEnabled) {
        const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
        if (!encryptionKey) {
          throw new Error('BACKUP_ENCRYPTION_KEY environment variable is not set');
        }

        const encryptedPath = `${finalPath}.enc`;
        await this.encryptFile(finalPath, encryptedPath, encryptionKey);
        await fs.unlink(finalPath);
        finalPath = encryptedPath;
      }

      // Calculate checksum and size
      const checksum = await this.calculateChecksum(finalPath);
      const stats = await fs.stat(finalPath);

      const metadata: BackupMetadata = {
        id: backupId,
        type: 'files',
        timestamp,
        size: stats.size,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled,
        checksum,
        retentionDate: new Date(timestamp.getTime() + this.config.retentionDays * 24 * 60 * 60 * 1000),
        location: finalPath,
        status: 'completed',
        createdBy: options.createdBy,
        tags: options.tags,
      };

      await this.storeBackupMetadata(metadata);
      logger.info(`Files backup completed: ${backupId} (${stats.size} bytes)`);
      return metadata;

    } catch (error) {
      logger.error(`Files backup failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Validate backup integrity
   */
  private async validateBackupIntegrity(filePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(filePath);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      logger.error('Failed to validate backup integrity:', error);
      return false;
    }
  }

  /**
   * Store backup metadata
   */
  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO backups (id, type, timestamp, size, compressed, encrypted, checksum,
         retention_date, location, status, created_by, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          metadata.id,
          metadata.type,
          metadata.timestamp,
          metadata.size,
          metadata.compressed,
          metadata.encrypted,
          metadata.checksum,
          metadata.retentionDate,
          metadata.location,
          metadata.status,
          metadata.createdBy || null,
          JSON.stringify(metadata.tags || []),
        ]
      );
    } catch (error) {
      logger.error('Failed to store backup metadata:', error);
      throw error;
    }
  }

  /**
   * Get backup metadata
   */
  async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM backups WHERE id = $1',
        [backupId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        timestamp: row.timestamp,
        size: row.size,
        compressed: row.compressed,
        encrypted: row.encrypted,
        checksum: row.checksum,
        retentionDate: row.retention_date,
        location: row.location,
        status: row.status,
        createdBy: row.created_by,
        tags: row.tags ? JSON.parse(row.tags) : [],
      };
    } catch (error) {
      logger.error(`Failed to get backup metadata: ${backupId}`, error);
      return null;
    }
  }

  /**
   * List available backups
   */
  async listBackups(options: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<BackupMetadata[]> {
    try {
      let query = 'SELECT * FROM backups WHERE 1=1';
      const params: any[] = [];

      if (options.type) {
        query += ' AND type = $' + (params.length + 1);
        params.push(options.type);
      }

      if (options.status) {
        query += ' AND status = $' + (params.length + 1);
        params.push(options.status);
      }

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ' LIMIT $' + (params.length + 1);
        params.push(options.limit);
      }

      if (options.offset) {
        query += ' OFFSET $' + (params.length + 1);
        params.push(options.offset);
      }

      const result = await this.db.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        timestamp: row.timestamp,
        size: row.size,
        compressed: row.compressed,
        encrypted: row.encrypted,
        checksum: row.checksum,
        retentionDate: row.retention_date,
        location: row.location,
        status: row.status,
        createdBy: row.created_by,
        tags: row.tags ? JSON.parse(row.tags) : [],
      }));
    } catch (error) {
      logger.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        return false;
      }

      // Delete file
      await fs.unlink(metadata.location);

      // Update database
      await this.db.query(
        'UPDATE backups SET status = $1 WHERE id = $2',
        ['deleted', backupId]
      );

      logger.info(`Backup deleted: ${backupId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to delete backup: ${backupId}`, error);
      return false;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string, targetDatabase?: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error('Backup not found');
      }

      if (metadata.status !== 'completed') {
        throw new Error('Backup is not in a completed state');
      }

      logger.info(`Starting restore from backup: ${backupId}`);

      let restorePath = metadata.location;

      // Decrypt if needed
      if (metadata.encrypted) {
        const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
        if (!encryptionKey) {
          throw new Error('BACKUP_ENCRYPTION_KEY environment variable is not set');
        }

        const decryptedPath = restorePath.replace('.enc', '');
        await this.decryptFile(restorePath, decryptedPath, encryptionKey);
        restorePath = decryptedPath;
      }

      // Decompress if needed
      if (metadata.compressed) {
        const decompressedPath = restorePath.replace('.gz', '');
        const gunzip = createGunzip();
        const source = createReadStream(restorePath);
        const destination = createWriteStream(decompressedPath);

        await pipeline(source, gunzip, destination);
        restorePath = decompressedPath;
      }

      // Restore database
      const targetDb = targetDatabase || process.env.DATABASE_URL;
      if (!targetDb) {
        throw new Error('Target database URL not specified');
      }

      const restoreCommand = `pg_restore --no-owner --no-privileges --clean --if-exists --dbname="${targetDb}" "${restorePath}"`;
      execSync(restoreCommand, { stdio: 'pipe' });

      // Cleanup temporary files
      if (metadata.encrypted && restorePath !== metadata.location) {
        await fs.unlink(restorePath);
      }
      if (metadata.compressed && restorePath.endsWith('.gz')) {
        await fs.unlink(restorePath);
      }

      logger.info(`Database restore completed: ${backupId}`);
      return true;

    } catch (error) {
      logger.error(`Database restore failed: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Get backup progress
   */
  getBackupProgress(backupId: string): BackupProgress | null {
    return this.activeBackups.get(backupId) || null;
  }

  /**
   * Cancel backup
   */
  async cancelBackup(backupId: string): Promise<boolean> {
    const progress = this.activeBackups.get(backupId);
    if (!progress) {
      return false;
    }

    progress.status = 'failed';
    progress.error = 'Backup cancelled by user';

    // Note: Actual cancellation of running processes would require more complex implementation
    this.activeBackups.delete(backupId);
    logger.info(`Backup cancelled: ${backupId}`);
    return true;
  }

  /**
   * Cleanup expired backups
   */
  async cleanupExpiredBackups(): Promise<number> {
    try {
      const result = await this.db.query(
        'SELECT id, location FROM backups WHERE retention_date < NOW() AND status = $1',
        ['completed']
      );

      let deletedCount = 0;

      for (const row of result.rows) {
        try {
          await fs.unlink(row.location);
          await this.db.query(
            'UPDATE backups SET status = $1 WHERE id = $2',
            ['expired', row.id]
          );
          deletedCount++;
        } catch (error) {
          logger.error(`Failed to delete expired backup: ${row.id}`, error);
        }
      }

      logger.info(`Cleaned up ${deletedCount} expired backups`);
      return deletedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired backups:', error);
      return 0;
    }
  }

  /**
   * Create backup schedule
   */
  async scheduleBackup(type: 'database' | 'files', frequency: string): Promise<void> {
    // This would integrate with a job scheduler like node-cron
    // For now, we'll just log the scheduling request
    logger.info(`Backup scheduled: ${type} backup with frequency ${frequency}`);
  }

  /**
   * Test backup and restore procedures
   */
  async testBackupRestore(backupId: string): Promise<{
    backupExists: boolean;
    backupIntegrity: boolean;
    restoreTest: boolean;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // Check if backup exists
      const metadata = await this.getBackupMetadata(backupId);
      const backupExists = !!metadata;

      if (!backupExists) {
        return {
          backupExists: false,
          backupIntegrity: false,
          restoreTest: false,
          duration: Date.now() - startTime,
        };
      }

      // Validate backup integrity
      const backupIntegrity = await this.validateBackupIntegrity(
        metadata.location,
        metadata.checksum
      );

      // Test restore to a temporary database
      const tempDatabase = process.env.TEST_DATABASE_URL;
      let restoreTest = false;

      if (tempDatabase) {
        try {
          await this.restoreFromBackup(backupId, tempDatabase);
          restoreTest = true;
        } catch (error) {
          logger.error('Restore test failed:', error);
        }
      }

      return {
        backupExists,
        backupIntegrity,
        restoreTest,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      logger.error('Backup test failed:', error);
      return {
        backupExists: false,
        backupIntegrity: false,
        restoreTest: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    completedBackups: number;
    failedBackups: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    retentionDays: number;
  }> {
    try {
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_backups,
          COALESCE(SUM(size), 0) as total_size,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_backups,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_backups,
          MIN(timestamp) as oldest_backup,
          MAX(timestamp) as newest_backup
        FROM backups
        WHERE status IN ('completed', 'failed', 'creating')
      `);

      const row = result.rows[0];

      return {
        totalBackups: parseInt(row.total_backups),
        totalSize: parseInt(row.total_size),
        completedBackups: parseInt(row.completed_backups),
        failedBackups: parseInt(row.failed_backups),
        oldestBackup: row.oldest_backup ? new Date(row.oldest_backup) : undefined,
        newestBackup: row.newest_backup ? new Date(row.newest_backup) : undefined,
        retentionDays: this.config.retentionDays,
      };

    } catch (error) {
      logger.error('Failed to get backup statistics:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        completedBackups: 0,
        failedBackups: 0,
        retentionDays: this.config.retentionDays,
      };
    }
  }
}

// Export singleton instance
export const backupService = new BackupService(
  DatabaseService.getInstance(),
  {
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    backupFrequency: (process.env.BACKUP_FREQUENCY as any) || 'daily',
    storageType: (process.env.BACKUP_STORAGE_TYPE as any) || 'local',
    encryptionEnabled: process.env.BACKUP_ENCRYPTION !== 'false',
    compressionEnabled: process.env.BACKUP_COMPRESSION !== 'false',
    validateIntegrity: process.env.BACKUP_VALIDATION !== 'false',
  }
);

export default backupService;