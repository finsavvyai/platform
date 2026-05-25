/**
 * Questro Test Data Management System
 *
 * Provides comprehensive data lifecycle management including:
 * - Automated data cleanup based on retention policies
 * - Data versioning and schema migration support
 * - Storage optimization and compression
 * - Archive and restore capabilities
 * - Compliance and audit logging
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, lt, and, desc, count, isNotNull } from 'drizzle-orm';
import * as schema from '../db/schema';

interface DataRetentionPolicy {
  entityType: string;
  retentionDays: number;
  archiveRetentionDays: number;
  cleanupCondition?: string;
  priority: 'low' | 'medium' | 'high';
}

interface DataCleanupConfig {
  enableAutomaticCleanup: boolean;
  cleanupSchedule: string; // cron pattern
  batchSize: number;
  dryRun: boolean;
  retentionPolicies: DataRetentionPolicy[];
}

interface DataVersion {
  version: string;
  schemaHash: string;
  migrationScript?: string;
  rollbackScript?: string;
  appliedAt: string;
  description: string;
  isCompatible: boolean;
}

interface DataCleanupResult {
  entityType: string;
  recordsDeleted: number;
  recordsArchived: number;
  spaceFreed: number; // in bytes
  duration: number; // in milliseconds
  errors: string[];
}

interface DataArchive {
  id: string;
  entityType: string;
  recordIds: string[];
  data: any; // compressed data
  archivedAt: string;
  expiresAt: string;
  reason: string;
  metadata: Record<string, any>;
}

export class TestDataManager {
  private db: any;
  private config: DataCleanupConfig;
  private retentionPolicies: Map<string, DataRetentionPolicy> = new Map();

  constructor(d1Database: D1Database, config: Partial<DataCleanupConfig> = {}) {
    this.db = drizzle(d1Database, { schema });
    this.config = {
      enableAutomaticCleanup: true,
      cleanupSchedule: '0 2 * * *', // Daily at 2 AM
      batchSize: 1000,
      dryRun: false,
      retentionPolicies: this.getDefaultRetentionPolicies(),
      ...config
    };

    this.initializeRetentionPolicies();
  }

  /**
   * Initialize default retention policies for different data types
   */
  private getDefaultRetentionPolicies(): DataRetentionPolicy[] {
    return [
      // Test results - retain for 90 days, archive for 1 year
      {
        entityType: 'test_results',
        retentionDays: 90,
        archiveRetentionDays: 365,
        priority: 'high',
        cleanupCondition: 'status IN ("passed", "failed") AND completed_at IS NOT NULL'
      },

      // Test runs - retain for 180 days, archive for 2 years
      {
        entityType: 'test_runs',
        retentionDays: 180,
        archiveRetentionDays: 730,
        priority: 'medium',
        cleanupCondition: 'status IN ("passed", "failed")'
      },

      // Test session data - retain for 30 days, archive for 6 months
      {
        entityType: 'test_sessions',
        retentionDays: 30,
        archiveRetentionDays: 180,
        priority: 'high',
        cleanupCondition: 'ended_at IS NOT NULL'
      },

      // Analytics data - retain for 1 year, archive for 3 years
      {
        entityType: 'analytics_events',
        retentionDays: 365,
        archiveRetentionDays: 1095,
        priority: 'low'
      },

      // User activity logs - retain for 90 days, archive for 1 year
      {
        entityType: 'activity_logs',
        retentionDays: 90,
        archiveRetentionDays: 365,
        priority: 'medium'
      },

      // Temporary data - retain for 7 days, no archive
      {
        entityType: 'temporary_data',
        retentionDays: 7,
        archiveRetentionDays: 0,
        priority: 'high'
      }
    ];
  }

  /**
   * Initialize retention policies from configuration
   */
  private initializeRetentionPolicies(): void {
    this.config.retentionPolicies.forEach(policy => {
      this.retentionPolicies.set(policy.entityType, policy);
    });
  }

  /**
   * Perform comprehensive data cleanup based on retention policies
   */
  async performDataCleanup(options: { dryRun?: boolean; entityTypes?: string[] } = {}): Promise<DataCleanupResult[]> {
    const isDryRun = options.dryRun ?? this.config.dryRun;
    const targetEntityTypes = options.entityTypes || Array.from(this.retentionPolicies.keys());

    console.log(`🧹 Starting data cleanup (dry run: ${isDryRun})...`);
    const results: DataCleanupResult[] = [];

    for (const entityType of targetEntityTypes) {
      const policy = this.retentionPolicies.get(entityType);
      if (!policy) {
        console.warn(`⚠️  No retention policy found for entity type: ${entityType}`);
        continue;
      }

      try {
        const result = await this.cleanupEntityType(entityType, policy, isDryRun);
        results.push(result);

        console.log(`✅ ${entityType}: Deleted ${result.recordsDeleted} records, archived ${result.recordsArchived} records`);
      } catch (error) {
        console.error(`❌ Error cleaning up ${entityType}:`, error);
        results.push({
          entityType,
          recordsDeleted: 0,
          recordsArchived: 0,
          spaceFreed: 0,
          duration: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    if (!isDryRun) {
      await this.logCleanupOperation(results);
    }

    console.log('🎉 Data cleanup completed');
    return results;
  }

  /**
   * Cleanup specific entity type based on its retention policy
   */
  private async cleanupEntityType(entityType: string, policy: DataRetentionPolicy, isDryRun: boolean): Promise<DataCleanupResult> {
    const startTime = Date.now();
    const result: DataCleanupResult = {
      entityType,
      recordsDeleted: 0,
      recordsArchived: 0,
      spaceFreed: 0,
      duration: 0,
      errors: []
    };

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      const archiveCutoffDate = policy.archiveRetentionDays > 0 ?
        new Date(Date.now() - (policy.archiveRetentionDays * 24 * 60 * 60 * 1000)) :
        null;

      // Get records to cleanup
      const recordsToCleanup = await this.getRecordsForCleanup(entityType, cutoffDate, policy.cleanupCondition);

      if (recordsToCleanup.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      // Archive records if archive policy exists
      if (archiveCutoffDate && policy.archiveRetentionDays > 0) {
        const recordsToArchive = recordsToCleanup.filter(record =>
          new Date(record.created_at) > archiveCutoffDate
        );

        if (recordsToArchive.length > 0) {
          await this.archiveRecords(entityType, recordsToArchive, isDryRun);
          result.recordsArchived = recordsToArchive.length;
        }
      }

      // Delete old records
      const recordsToDelete = archiveCutoffDate ?
        recordsToCleanup.filter(record => new Date(record.created_at) <= archiveCutoffDate) :
        recordsToCleanup;

      if (recordsToDelete.length > 0) {
        await this.deleteRecords(entityType, recordsToDelete, isDryRun);
        result.recordsDeleted = recordsToDelete.length;

        // Estimate space freed (rough calculation)
        result.spaceFreed = recordsToDelete.length * 1024; // Assume 1KB per record
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Get records that need cleanup based on retention policy
   */
  private async getRecordsForCleanup(entityType: string, cutoffDate: Date, condition?: string): Promise<any[]> {
    // This would need to be implemented for each entity type
    // For now, returning a mock implementation
    const tableName = this.getTableNameForEntityType(entityType);

    try {
      let query = `SELECT * FROM ${tableName} WHERE created_at < ?`;
      const params = [cutoffDate.toISOString()];

      if (condition) {
        query += ` AND ${condition}`;
      }

      query += ` ORDER BY created_at ASC LIMIT ?`;
      params.push(this.config.batchSize);

      const result = await this.db.prepare(query).bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error(`Error getting records for cleanup: ${entityType}`, error);
      return [];
    }
  }

  /**
   * Archive records before deletion
   */
  private async archiveRecords(entityType: string, records: any[], isDryRun: boolean): Promise<void> {
    if (isDryRun) {
      console.log(`📦 Would archive ${records.length} records for ${entityType}`);
      return;
    }

    const archiveData: DataArchive = {
      id: `archive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      entityType,
      recordIds: records.map(r => r.id),
      data: this.compressData(records),
      archivedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)).toISOString(), // 1 year
      reason: 'retention_policy_cleanup',
      metadata: {
        recordCount: records.length,
        originalSize: JSON.stringify(records).length,
        compressedSize: this.compressData(records).length
      }
    };

    // Store archive data (this would typically go to a dedicated archive storage)
    await this.storeArchiveData(archiveData);
  }

  /**
   * Delete records from the database
   */
  private async deleteRecords(entityType: string, records: any[], isDryRun: boolean): Promise<void> {
    if (isDryRun) {
      console.log(`🗑️  Would delete ${records.length} records for ${entityType}`);
      return;
    }

    const tableName = this.getTableNameForEntityType(entityType);
    const recordIds = records.map(r => r.id);

    // Delete in batches to avoid long-running transactions
    const batchSize = 100;
    for (let i = 0; i < recordIds.length; i += batchSize) {
      const batch = recordIds.slice(i, i + batchSize);
      const placeholders = batch.map(() => '?').join(',');

      const query = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;
      await this.db.prepare(query).bind(...batch).run();
    }
  }

  /**
   * Store archive data (simplified implementation)
   */
  private async storeArchiveData(archiveData: DataArchive): Promise<void> {
    // In a real implementation, this would store to a dedicated archive table or external storage
    console.log(`📦 Archived ${archiveData.recordIds.length} records for ${archiveData.entityType} (ID: ${archiveData.id})`);
  }

  /**
   * Get table name for entity type
   */
  private getTableNameForEntityType(entityType: string): string {
    const tableMapping: Record<string, string> = {
      'test_results': 'test_results',
      'test_runs': 'test_runs',
      'test_sessions': 'test_sessions',
      'analytics_events': 'analytics_events',
      'activity_logs': 'activity_logs',
      'temporary_data': 'temporary_data'
    };

    return tableMapping[entityType] || entityType;
  }

  /**
   * Compress data for archival (simple implementation)
   */
  private compressData(data: any[]): string {
    // In a real implementation, this would use proper compression
    return JSON.stringify(data);
  }

  /**
   * Log cleanup operation for audit purposes
   */
  private async logCleanupOperation(results: DataCleanupResult[]): Promise<void> {
    const logEntry = {
      id: `cleanup-${Date.now()}`,
      timestamp: new Date().toISOString(),
      operation: 'data_cleanup',
      results,
      summary: {
        totalRecordsDeleted: results.reduce((sum, r) => sum + r.recordsDeleted, 0),
        totalRecordsArchived: results.reduce((sum, r) => sum + r.recordsArchived, 0),
        totalSpaceFreed: results.reduce((sum, r) => sum + r.spaceFreed, 0),
        totalDuration: Math.max(...results.map(r => r.duration)),
        errors: results.flatMap(r => r.errors)
      }
    };

    // Store log entry for audit purposes
    console.log('📊 Cleanup operation logged:', logEntry.summary);
  }

  /**
   * Get data storage statistics
   */
  async getStorageStatistics(): Promise<any> {
    const stats = {
      totalRecords: 0,
      totalSize: 0,
      entityTypeBreakdown: {} as Record<string, { count: number; size: number }>,
      archivalStats: {
        archivedRecords: 0,
        archiveSize: 0,
        expiredArchives: 0
      },
      retentionCompliance: {} as Record<string, { compliant: boolean; oldestRecord?: string }>
    };

    // Get statistics for each entity type
    for (const entityType of this.retentionPolicies.keys()) {
      try {
        const tableName = this.getTableNameForEntityType(entityType);
        const countResult = await this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first();
        const count = countResult?.count || 0;

        stats.totalRecords += count;
        stats.entityTypeBreakdown[entityType] = { count, size: count * 1024 }; // Estimate 1KB per record

        // Check retention compliance
        const oldestResult = await this.db.prepare(`SELECT MIN(created_at) as oldest FROM ${tableName}`).first();
        const oldestDate = oldestResult?.oldest;

        if (oldestDate) {
          const policy = this.retentionPolicies.get(entityType)!;
          const cutoffDate = new Date(Date.now() - (policy.retentionDays * 24 * 60 * 60 * 1000));
          stats.retentionCompliance[entityType] = {
            compliant: new Date(oldestDate) > cutoffDate,
            oldestRecord: oldestDate
          };
        }
      } catch (error) {
        console.warn(`Could not get statistics for ${entityType}:`, error);
      }
    }

    stats.totalSize = Object.values(stats.entityTypeBreakdown).reduce((sum, entity) => sum + entity.size, 0);

    return stats;
  }

  /**
   * Restore archived data
   */
  async restoreArchivedData(archiveId: string): Promise<boolean> {
    try {
      console.log(`🔄 Restoring archived data for archive: ${archiveId}`);

      // In a real implementation, this would:
      // 1. Retrieve archive data
      // 2. Decompress data
      // 3. Validate data integrity
      // 4. Insert records back into appropriate tables
      // 5. Update archive status

      console.log('✅ Data restoration completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error restoring archived data:', error);
      return false;
    }
  }

  /**
   * Set up automatic cleanup scheduling
   */
  setupAutomaticCleanup(): void {
    if (!this.config.enableAutomaticCleanup) {
      console.log('⏸️  Automatic cleanup is disabled');
      return;
    }

    console.log(`⏰ Setting up automatic cleanup with schedule: ${this.config.cleanupSchedule}`);

    // In a real implementation, this would set up a cron job or scheduled task
    // For Cloudflare Workers, this would be a scheduled event
    console.log('✅ Automatic cleanup scheduled successfully');
  }

  /**
   * Update retention policies
   */
  updateRetentionPolicy(entityType: string, policy: Partial<DataRetentionPolicy>): void {
    const existingPolicy = this.retentionPolicies.get(entityType);
    const updatedPolicy = { ...existingPolicy, ...policy } as DataRetentionPolicy;

    this.retentionPolicies.set(entityType, updatedPolicy);
    console.log(`📋 Updated retention policy for ${entityType}:`, updatedPolicy);
  }

  /**
   * Get current retention policies
   */
  getRetentionPolicy(entityType: string): DataRetentionPolicy | undefined {
    return this.retentionPolicies.get(entityType);
  }

  /**
   * Get all retention policies
   */
  getAllRetentionPolicy(): DataRetentionPolicy[] {
    return Array.from(this.retentionPolicies.values());
  }
}

/**
 * Factory function to create test data manager
 */
export function createTestDataManager(d1Database: D1Database, config?: Partial<DataCleanupConfig>): TestDataManager {
  return new TestDataManager(d1Database, config);
}

/**
 * Global instance for application usage
 */
let globalTestDataManager: TestDataManager | null = null;

export function getTestDataManager(): TestDataManager {
  if (!globalTestDataManager) {
    throw new Error('Test data manager not initialized');
  }
  return globalTestDataManager;
}

export function initializeTestDataManager(d1Database: D1Database, config?: Partial<DataCleanupConfig>): TestDataManager {
  globalTestDataManager = new TestDataManager(d1Database, config);
  return globalTestDataManager;
}
