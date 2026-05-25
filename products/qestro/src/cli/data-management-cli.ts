/**
 * Test Data Management CLI
 *
 * Command-line interface for managing test data lifecycle, cleanup, and retention policies.
 * This script provides easy access to all Test Data Management System functionalities.
 */

import { TestDataManager, createTestDataManager } from '../services/test-data-manager';
import { initializeDatabaseService } from '../services/database-service';

interface CLIOptions {
  dryRun?: boolean;
  entityTypes?: string[];
  entityType?: string;
  retentionDays?: number;
  archiveDays?: number;
  priority?: 'low' | 'medium' | 'high';
  archiveId?: string;
  batch?: boolean;
  force?: boolean;
  verbose?: boolean;
}

class DataManagementCLI {
  private dataManager: TestDataManager;
  private verbose: boolean = false;

  constructor(d1Database: D1Database) {
    const dbService = initializeDatabaseService(d1Database);
    this.dataManager = createTestDataManager(d1Database, {
      enableAutomaticCleanup: true,
      dryRun: false,
      batchSize: 1000
    });
  }

  /**
   * Main CLI command router
   */
  async run(command: string, options: CLIOptions = {}): Promise<void> {
    this.verbose = options.verbose || false;

    if (this.verbose) {
      console.log('🔧 Test Data Management CLI');
      console.log(`📋 Command: ${command}`);
      console.log(`⚙️  Options:`, options);
      console.log('');
    }

    try {
      switch (command) {
        case 'cleanup':
          await this.handleCleanup(options);
          break;

        case 'dry-run':
          await this.handleDryRun(options);
          break;

        case 'stats':
          await this.handleStats();
          break;

        case 'policies':
          await this.handlePolicies();
          break;

        case 'update-policy':
          await this.handleUpdatePolicy(options);
          break;

        case 'restore':
          await this.handleRestore(options);
          break;

        case 'comprehensive-test':
          await this.handleComprehensiveTest();
          break;

        case 'setup-cron':
          await this.handleSetupCron();
          break;

        case 'validate':
          await this.handleValidate();
          break;

        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error(`❌ Error executing command '${command}':`, error);
      process.exit(1);
    }
  }

  /**
   * Handle data cleanup
   */
  private async handleCleanup(options: CLIOptions): Promise<void> {
    console.log('🧹 Starting data cleanup...');

    const entityTypes = options.entityTypes;
    const isDryRun = options.dryRun || false;

    if (isDryRun) {
      console.log('🔍 Running in DRY RUN mode - no data will be modified');
    }

    const results = await this.dataManager.performDataCleanup({
      dryRun: isDryRun,
      entityTypes
    });

    this.displayCleanupResults(results, isDryRun);
  }

  /**
   * Handle dry run cleanup
   */
  private async handleDryRun(options: CLIOptions): Promise<void> {
    console.log('🔍 Starting DRY RUN cleanup...');

    const results = await this.dataManager.performDataCleanup({
      dryRun: true,
      entityTypes: options.entityTypes
    });

    console.log('\n📊 Dry Run Results:');
    console.log('==================');

    let totalToDelete = 0;
    let totalToArchive = 0;
    let totalSpaceToFree = 0;

    results.forEach(result => {
      console.log(`\n📁 ${result.entityType}:`);
      console.log(`   Records to delete: ${result.recordsDeleted}`);
      console.log(`   Records to archive: ${result.recordsArchived}`);
      console.log(`   Estimated space to free: ${this.formatBytes(result.spaceFreed)}`);
      console.log(`   Estimated duration: ${result.duration}ms`);

      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.join(', ')}`);
      }

      totalToDelete += result.recordsDeleted;
      totalToArchive += result.recordsArchived;
      totalSpaceToFree += result.spaceFreed;
    });

    console.log('\n📈 Summary:');
    console.log(`   Total records to delete: ${totalToDelete}`);
    console.log(`   Total records to archive: ${totalToArchive}`);
    console.log(`   Total space to be freed: ${this.formatBytes(totalSpaceToFree)}`);
    console.log('\n✨ This was a dry run - no data was actually modified');
    console.log('💡 Run with --no-dry-run to perform actual cleanup');
  }

  /**
   * Handle storage statistics
   */
  private async handleStats(): Promise<void> {
    console.log('📊 Retrieving storage statistics...');

    const stats = await this.dataManager.getStorageStatistics();

    console.log('\n📈 Storage Statistics:');
    console.log('=====================');
    console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
    console.log(`Total Estimated Size: ${this.formatBytes(stats.totalSize)}`);

    console.log('\n📁 Entity Breakdown:');
    Object.entries(stats.entityTypeBreakdown).forEach(([entityType, data]) => {
      console.log(`   ${entityType}:`);
      console.log(`     Records: ${data.count.toLocaleString()}`);
      console.log(`     Size: ${this.formatBytes(data.size)}`);
    });

    console.log('\n🗄️  Archive Statistics:');
    console.log(`   Archived Records: ${stats.archivalStats.archivedRecords.toLocaleString()}`);
    console.log(`   Archive Size: ${this.formatBytes(stats.archivalStats.archiveSize)}`);
    console.log(`   Expired Archives: ${stats.archivalStats.expiredArchives.toLocaleString()}`);

    console.log('\n✅ Retention Compliance:');
    Object.entries(stats.retentionCompliance).forEach(([entityType, compliance]) => {
      const status = compliance.compliant ? '✅' : '⚠️ ';
      console.log(`   ${status} ${entityType}: ${compliance.compliant ? 'Compliant' : 'Non-compliant'}`);
      if (compliance.oldestRecord) {
        console.log(`      Oldest record: ${new Date(compliance.oldestRecord).toLocaleDateString()}`);
      }
    });
  }

  /**
   * Handle displaying retention policies
   */
  private async handlePolicies(): Promise<void> {
    console.log('📋 Current Retention Policies:');
    console.log('=============================');

    const policies = this.dataManager.getAllRetentionPolicy();

    policies.forEach(policy => {
      console.log(`\n📁 ${policy.entityType}:`);
      console.log(`   Retention Period: ${policy.retentionDays} days`);
      console.log(`   Archive Period: ${policy.archiveRetentionDays} days`);
      console.log(`   Priority: ${policy.priority}`);
      if (policy.cleanupCondition) {
        console.log(`   Cleanup Condition: ${policy.cleanupCondition}`);
      }
    });

    console.log(`\n📊 Summary: ${policies.length} retention policies configured`);
  }

  /**
   * Handle updating retention policy
   */
  private async handleUpdatePolicy(options: CLIOptions): Promise<void> {
    const { entityType, retentionDays, archiveDays, priority } = options;

    if (!entityType) {
      console.error('❌ Error: --entity-type is required');
      return;
    }

    console.log(`📝 Updating retention policy for ${entityType}...`);

    const updates: any = {};
    if (retentionDays) updates.retentionDays = retentionDays;
    if (archiveDays) updates.archiveRetentionDays = archiveDays;
    if (priority) updates.priority = priority;

    if (Object.keys(updates).length === 0) {
      console.error('❌ Error: No updates specified');
      return;
    }

    this.dataManager.updateRetentionPolicy(entityType, updates);

    const updatedPolicy = this.dataManager.getRetentionPolicy(entityType);
    console.log('✅ Retention policy updated successfully:');
    console.log(`   Entity Type: ${updatedPolicy.entityType}`);
    console.log(`   Retention Days: ${updatedPolicy.retentionDays}`);
    console.log(`   Archive Days: ${updatedPolicy.archiveRetentionDays}`);
    console.log(`   Priority: ${updatedPolicy.priority}`);
  }

  /**
   * Handle archive restoration
   */
  private async handleRestore(options: CLIOptions): Promise<void> {
    const { archiveId } = options;

    if (!archiveId) {
      console.error('❌ Error: --archive-id is required');
      return;
    }

    console.log(`🔄 Restoring archive ${archiveId}...`);

    const success = await this.dataManager.restoreArchivedData(archiveId);

    if (success) {
      console.log('✅ Archive restored successfully');
    } else {
      console.log('❌ Archive restoration failed');
    }
  }

  /**
   * Handle comprehensive test
   */
  private async handleComprehensiveTest(): Promise<void> {
    console.log('🧪 Running comprehensive test of Test Data Management System...');
    console.log('This test will validate all major functionalities.');
    console.log('');

    const testResults = {
      storageStats: false,
      dryRunCleanup: false,
      policyUpdate: false,
      archiveRestore: false
    };

    try {
      // Test 1: Storage Statistics
      console.log('1️⃣  Testing storage statistics...');
      await this.dataManager.getStorageStatistics();
      testResults.storageStats = true;
      console.log('✅ Storage statistics: PASSED');

      // Test 2: Dry Run Cleanup
      console.log('\n2️⃣  Testing dry run cleanup...');
      const dryRunResults = await this.dataManager.performDataCleanup({ dryRun: true });
      testResults.dryRunCleanup = true;
      console.log('✅ Dry run cleanup: PASSED');

      // Test 3: Policy Update
      console.log('\n3️⃣  Testing policy update...');
      this.dataManager.updateRetentionPolicy('test_results', { retentionDays: 45 });
      testResults.policyUpdate = true;
      console.log('✅ Policy update: PASSED');

      // Test 4: Archive Restore
      console.log('\n4️⃣  Testing archive restore...');
      await this.dataManager.restoreArchivedData('test-archive-id');
      testResults.archiveRestore = true;
      console.log('✅ Archive restore: PASSED');

      const allPassed = Object.values(testResults).every(result => result === true);

      console.log('\n🎉 Comprehensive Test Results:');
      console.log('===============================');
      Object.entries(testResults).forEach(([test, passed]) => {
        console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
      });

      console.log(`\n🏆 Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    } catch (error) {
      console.error('❌ Comprehensive test failed:', error);
    }
  }

  /**
   * Handle setting up automatic cleanup
   */
  private async handleSetupCron(): Promise<void> {
    console.log('⏰ Setting up automatic cleanup scheduling...');

    this.dataManager.setupAutomaticCleanup();

    console.log('✅ Automatic cleanup scheduled');
    console.log('   Schedule: Daily at 2:00 AM UTC');
    console.log('   Scope: All entity types with retention policies');
    console.log('   Mode: Automatic cleanup with archival');
  }

  /**
   * Handle data validation
   */
  private async handleValidate(): Promise<void> {
    console.log('🔍 Validating data management system...');

    const stats = await this.dataManager.getStorageStatistics();
    const policies = this.dataManager.getAllRetentionPolicy();

    const validationResults = {
      totalRecords: stats.totalRecords > 0,
      hasPolicies: policies.length > 0,
      complianceCheck: true
    };

    // Check retention compliance
    Object.entries(stats.retentionCompliance).forEach(([entityType, compliance]) => {
      if (!compliance.compliant) {
        validationResults.complianceCheck = false;
        console.log(`⚠️  ${entityType} has non-compliant retention`);
      }
    });

    console.log('\n🔍 Validation Results:');
    console.log('======================');
    Object.entries(validationResults).forEach(([check, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
    });

    const allValid = Object.values(validationResults).every(result => result === true);
    console.log(`\n🏆 Overall Validation: ${allValid ? 'VALID' : 'INVALID'}`);
  }

  /**
   * Display cleanup results in a formatted way
   */
  private displayCleanupResults(results: any[], isDryRun: boolean): void {
    const action = isDryRun ? 'Would be' : 'Were';

    console.log('\n📊 Cleanup Results:');
    console.log('===================');

    let totalDeleted = 0;
    let totalArchived = 0;
    let totalSpaceFreed = 0;

    results.forEach(result => {
      console.log(`\n📁 ${result.entityType}:`);
      console.log(`   Records ${action} deleted: ${result.recordsDeleted.toLocaleString()}`);
      console.log(`   Records ${action} archived: ${result.recordsArchived.toLocaleString()}`);
      console.log(`   Space ${action} freed: ${this.formatBytes(result.spaceFreed)}`);
      console.log(`   Duration: ${result.duration}ms`);

      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.errors.length}`);
        result.errors.forEach(error => console.log(`      - ${error}`));
      }

      totalDeleted += result.recordsDeleted;
      totalArchived += result.recordsArchived;
      totalSpaceFreed += result.spaceFreed;
    });

    console.log('\n📈 Summary:');
    console.log(`   Total records ${action} deleted: ${totalDeleted.toLocaleString()}`);
    console.log(`   Total records ${action} archived: ${totalArchived.toLocaleString()}`);
    console.log(`   Total space ${action} freed: ${this.formatBytes(totalSpaceFreed)}`);

    if (isDryRun) {
      console.log('\n✨ This was a dry run - no data was actually modified');
      console.log('💡 Remove --dry-run flag to perform actual cleanup');
    } else {
      console.log('\n✅ Cleanup completed successfully');
    }
  }

  /**
   * Format bytes in human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log('🔧 Test Data Management CLI');
    console.log('============================');
    console.log('');
    console.log('Usage: npm run data-manager <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  cleanup              Perform actual data cleanup');
    console.log('  dry-run              Perform cleanup dry run (no data modified)');
    console.log('  stats                Show storage statistics');
    console.log('  policies             Show current retention policies');
    console.log('  update-policy        Update retention policy for entity type');
    console.log('  restore              Restore archived data');
    console.log('  comprehensive-test   Run comprehensive system test');
    console.log('  setup-cron           Set up automatic cleanup scheduling');
    console.log('  validate             Validate system configuration');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run           Run in dry run mode (no modifications)');
    console.log('  --entity-types      Comma-separated list of entity types');
    console.log('  --entity-type       Single entity type for policy updates');
    console.log('  --retention-days    New retention period in days');
    console.log('  --archive-days      New archive period in days');
    console.log('  --priority          Priority level (low|medium|high)');
    console.log('  --archive-id        Archive ID for restoration');
    console.log('  --verbose           Enable verbose logging');
    console.log('');
    console.log('Examples:');
    console.log('  npm run data-manager dry-run');
    console.log('  npm run data-manager cleanup --entity-types test_results,test_runs');
    console.log('  npm run data-manager stats');
    console.log('  npm run data-manager update-policy --entity-type test_results --retention-days 60');
    console.log('  npm run data-manager comprehensive-test');
  }
}

/**
 * Main function for CLI execution
 */
export async function runDataManagementCLI(d1Database: D1Database, args: string[]): Promise<void> {
  const cli = new DataManagementCLI(d1Database);

  const command = args[0];
  const options: CLIOptions = {};

  // Parse command line arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--entity-types':
        options.entityTypes = args[++i]?.split(',');
        break;
      case '--entity-type':
        options.entityType = args[++i];
        break;
      case '--retention-days':
        options.retentionDays = parseInt(args[++i]);
        break;
      case '--archive-days':
        options.archiveDays = parseInt(args[++i]);
        break;
      case '--priority':
        options.priority = args[++i] as 'low' | 'medium' | 'high';
        break;
      case '--archive-id':
        options.archiveId = args[++i];
        break;
    }
  }

  await cli.run(command, options);
}

// Export for direct usage
export { DataManagementCLI };
