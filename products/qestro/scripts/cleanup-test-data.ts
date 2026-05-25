#!/usr/bin/env tsx

/**
 * Test Data Cleanup Script
 *
 * This script provides automated test data cleanup capabilities:
 * - Environment-specific cleanup (development, staging, test)
 * - Selective data removal by entity type
 * - Performance monitoring and reporting
 * - Safe cleanup with confirmation prompts
 * - Integration with Questro test data management system
 *
 * Usage:
 *   tsx scripts/cleanup-test-data.ts [options]
 *
 * Options:
 *   --environment <env>    Target environment (dev/staging/test)
 *   --entity-types <types> Comma-separated list of entity types
 *   --dry-run             Preview cleanup without executing
 *   --force               Skip confirmation prompts
 *   --batch-size <size>   Number of records per batch (default: 1000)
 *   --verbose             Enable detailed logging
 *   --retention-days <days> Override retention period
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { TestDataManager } from '../src/services/test-data-manager';
import { getDatabaseService } from '../src/services/database-service';

interface CleanupOptions {
  environment: 'development' | 'staging' | 'test';
  entityTypes: string[];
  dryRun: boolean;
  force: boolean;
  batchSize: number;
  verbose: boolean;
  retentionDays?: number;
  outputFormat: 'console' | 'json' | 'csv';
}

interface CleanupReport {
  timestamp: string;
  environment: string;
  options: CleanupOptions;
  results: Array<{
    entityType: string;
    recordsDeleted: number;
    recordsArchived: number;
    spaceFreed: number;
    duration: number;
    errors: string[];
  }>;
  summary: {
    totalRecordsDeleted: number;
    totalRecordsArchived: number;
    totalSpaceFreed: number;
    totalDuration: number;
    errorsCount: number;
    success: boolean;
  };
  performance: {
    recordsPerSecond: number;
    averageCleanupTime: number;
    throughput: string;
  };
}

class TestDataCleanupScript {
  private options: CleanupOptions;
  private testDataManager: TestDataManager;
  private startTime: number;

  constructor(options: Partial<CleanupOptions> = {}) {
    this.options = {
      environment: 'development',
      entityTypes: [], // Empty means all entity types
      dryRun: false,
      force: false,
      batchSize: 1000,
      verbose: false,
      outputFormat: 'console',
      ...options
    };

    this.startTime = Date.now();
  }

  /**
   * Execute the cleanup process
   */
  async execute(): Promise<CleanupReport> {
    this.logHeader();

    try {
      // Initialize test data manager
      await this.initializeTestDataManager();

      // Validate environment
      await this.validateEnvironment();

      // Show cleanup preview
      if (!this.options.force) {
        await this.showCleanupPreview();
      }

      // Perform cleanup
      const results = await this.performCleanup();

      // Generate report
      const report = this.generateReport(results);

      // Display results
      this.displayResults(report);

      return report;

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Initialize the test data manager
   */
  private async initializeTestDataManager(): Promise<void> {
    this.log('🔧 Initializing test data manager...');

    try {
      // Get database service (this will be properly initialized in production)
      const dbService = getDatabaseService();

      // Create test data manager with configuration
      this.testDataManager = new TestDataManager(dbService as any, {
        enableAutomaticCleanup: false, // Manual mode for script
        batchSize: this.options.batchSize,
        dryRun: this.options.dryRun
      });

      // Update retention policies if custom retention days provided
      if (this.options.retentionDays) {
        this.updateRetentionPolicies(this.options.retentionDays);
      }

      this.log('✅ Test data manager initialized');

    } catch (error) {
      throw new Error(`Failed to initialize test data manager: ${error}`);
    }
  }

  /**
   * Validate the target environment
   */
  private async validateEnvironment(): Promise<void> {
    this.log(`🔍 Validating environment: ${this.options.environment}`);

    const validEnvironments = ['development', 'staging', 'test'];
    if (!validEnvironments.includes(this.options.environment)) {
      throw new Error(`Invalid environment: ${this.options.environment}. Valid options: ${validEnvironments.join(', ')}`);
    }

    // Safety check for production
    if (process.env.NODE_ENV === 'production' && this.options.environment !== 'test') {
      throw new Error('❌ SAFETY ERROR: Cannot run cleanup script in production environment unless explicitly targeting test data');
    }

    // Check database connectivity
    try {
      const healthCheck = await this.testDataManager.getStorageStatistics();
      this.log(`✅ Database connection verified (found ${healthCheck.totalRecords} total records)`);
    } catch (error) {
      throw new Error(`Database connectivity check failed: ${error}`);
    }

    this.log('✅ Environment validation completed');
  }

  /**
   * Show cleanup preview before execution
   */
  private async showCleanupPreview(): Promise<void> {
    this.log('\n📋 Cleanup Preview');
    this.log('==================');

    try {
      // Get storage statistics
      const stats = await this.testDataManager.getStorageStatistics();

      this.log(`Environment: ${this.options.environment}`);
      this.log(`Dry Run: ${this.options.dryRun ? 'Yes' : 'No'}`);
      this.log(`Batch Size: ${this.options.batchSize}`);
      this.log(`Entity Types: ${this.options.entityTypes.length > 0 ? this.options.entityTypes.join(', ') : 'All types'}`);

      this.log('\nCurrent Storage Statistics:');
      this.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
      this.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

      this.log('\nEntity Type Breakdown:');
      Object.entries(stats.entityTypeBreakdown).forEach(([entityType, data]) => {
        const sizeMB = (data.size / 1024 / 1024).toFixed(2);
        this.log(`  ${entityType}: ${data.count.toLocaleString()} records (${sizeMB} MB)`);
      });

      // Show retention policies
      this.log('\nRetention Policies:');
      const policies = this.testDataManager.getAllRetentionPolicy();
      policies.filter(p =>
        this.options.entityTypes.length === 0 || this.options.entityTypes.includes(p.entityType)
      ).forEach(policy => {
        this.log(`  ${policy.entityType}: ${policy.retentionDays} days (archive: ${policy.archiveRetentionDays} days)`);
      });

      this.log('\n⚠️  This operation will permanently delete data. Review carefully before proceeding.');

      // Ask for confirmation
      if (!this.options.force) {
        await this.requestConfirmation();
      }

    } catch (error) {
      this.log(`⚠️  Could not generate preview: ${error}`);
      this.log('Proceeding with cleanup based on configuration...');
    }
  }

  /**
   * Request user confirmation before cleanup
   */
  private async requestConfirmation(): Promise<void> {
    if (this.options.dryRun) {
      this.log('\n🔍 DRY RUN MODE - No data will be deleted');
      return;
    }

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('\nDo you want to proceed with cleanup? (yes/no): ', (answer: string) => {
        rl.close();

        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          this.log('✅ Confirmation received. Proceeding with cleanup...');
          resolve();
        } else {
          this.log('❌ Cleanup cancelled by user');
          process.exit(0);
        }
      });
    });
  }

  /**
   * Perform the actual cleanup operation
   */
  private async performCleanup(): Promise<any[]> {
    this.log('\n🧹 Starting data cleanup...');

    const cleanupOptions = {
      dryRun: this.options.dryRun,
      entityTypes: this.options.entityTypes.length > 0 ? this.options.entityTypes : undefined
    };

    const startTime = Date.now();
    const results = await this.testDataManager.performDataCleanup(cleanupOptions);
    const duration = Date.now() - startTime;

    this.log(`✅ Cleanup completed in ${duration}ms`);

    return results;
  }

  /**
   * Generate comprehensive cleanup report
   */
  private generateReport(results: any[]): CleanupReport {
    const summary = {
      totalRecordsDeleted: results.reduce((sum, r) => sum + r.recordsDeleted, 0),
      totalRecordsArchived: results.reduce((sum, r) => sum + r.recordsArchived, 0),
      totalSpaceFreed: results.reduce((sum, r) => sum + r.spaceFreed, 0),
      totalDuration: Math.max(...results.map(r => r.duration)),
      errorsCount: results.reduce((sum, r) => sum + r.errors.length, 0),
      success: results.every(r => r.errors.length === 0)
    };

    const performance = {
      recordsPerSecond: Math.round((summary.totalRecordsDeleted / summary.totalDuration) * 1000),
      averageCleanupTime: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      throughput: `${(summary.totalSpaceFreed / 1024 / 1024).toFixed(2)} MB freed in ${(summary.totalDuration / 1000).toFixed(2)}s`
    };

    return {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      options: this.options,
      results,
      summary,
      performance
    };
  }

  /**
   * Display cleanup results
   */
  private displayResults(report: CleanupReport): void {
    this.log('\n📊 Cleanup Results');
    this.log('==================');

    if (this.options.outputFormat === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    // Summary
    this.log(`Status: ${report.summary.success ? '✅ Success' : '⚠️ Completed with errors'}`);
    this.log(`Records Deleted: ${report.summary.totalRecordsDeleted.toLocaleString()}`);
    this.log(`Records Archived: ${report.summary.totalRecordsArchived.toLocaleString()}`);
    this.log(`Space Freed: ${(report.summary.totalSpaceFreed / 1024 / 1024).toFixed(2)} MB`);
    this.log(`Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    this.log(`Errors: ${report.summary.errorsCount}`);

    // Performance metrics
    this.log('\nPerformance Metrics:');
    this.log(`Throughput: ${report.performance.throughput}`);
    this.log(`Records/Second: ${report.performance.recordsPerSecond.toLocaleString()}`);
    this.log(`Average Cleanup Time: ${report.performance.averageCleanupTime.toFixed(2)}ms`);

    // Entity type details
    if (this.options.verbose) {
      this.log('\nEntity Type Details:');
      report.results.forEach(result => {
        const status = result.errors.length === 0 ? '✅' : '⚠️';
        this.log(`${status} ${result.entityType}:`);
        this.log(`    Deleted: ${result.recordsDeleted.toLocaleString()}`);
        this.log(`    Archived: ${result.recordsArchived.toLocaleString()}`);
        this.log(`    Duration: ${result.duration}ms`);

        if (result.errors.length > 0) {
          this.log(`    Errors: ${result.errors.join(', ')}`);
        }
      });
    }

    // Recommendations
    this.generateRecommendations(report);
  }

  /**
   * Generate cleanup recommendations
   */
  private generateRecommendations(report: CleanupReport): void {
    this.log('\n💡 Recommendations:');

    if (report.summary.totalSpaceFreed === 0) {
      this.log('• No cleanup was needed - all data is within retention policies');
    } else {
      this.log(`• Consider scheduling automatic cleanup to prevent accumulation of ${report.summary.totalSpaceFreed / 1024 / 1024:.2f} MB of old data`);
    }

    if (report.summary.errorsCount > 0) {
      this.log('• Review and fix errors before next cleanup run');
    }

    if (report.performance.recordsPerSecond < 100) {
      this.log('• Consider increasing batch size for better performance');
    }

    if (report.summary.totalRecordsArchived > 0) {
      this.log('• Monitor archive storage usage and set up archive retention policies');
    }
  }

  /**
   * Update retention policies with custom retention days
   */
  private updateRetentionPolicies(retentionDays: number): void {
    this.log(`📋 Updating retention policies to ${retentionDays} days`);

    const policies = this.testDataManager.getAllRetentionPolicy();
    policies.forEach(policy => {
      this.testDataManager.updateRetentionPolicy(policy.entityType, {
        retentionDays
      });
    });

    this.log('✅ Retention policies updated');
  }

  /**
   * Log messages with optional timestamp
   */
  private log(message: string): void {
    if (this.options.verbose) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ${message}`);
    } else {
      console.log(message);
    }
  }

  /**
   * Log script header
   */
  private logHeader(): void {
    console.log('🧹 Questro Test Data Cleanup Script');
    console.log('====================================');
    console.log(`Environment: ${this.options.environment}`);
    console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
    console.log(`Started: ${new Date().toLocaleString()}`);
    console.log('');
  }

  /**
   * Handle errors during cleanup
   */
  private handleError(error: any): void {
    console.error('\n❌ Cleanup failed:', error instanceof Error ? error.message : error);

    if (this.options.verbose) {
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    }

    console.error('\nTroubleshooting:');
    console.error('• Check database connectivity');
    console.error('• Verify environment permissions');
    console.error('• Review retention policy configuration');
    console.error('• Ensure sufficient storage space for archives');

    process.exit(1);
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): Partial<CleanupOptions> {
  const args = process.argv.slice(2);
  const options: Partial<CleanupOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--environment':
        options.environment = args[++i] as any;
        break;
      case '--entity-types':
        options.entityTypes = args[++i].split(',').map(s => s.trim());
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--retention-days':
        options.retentionDays = parseInt(args[++i], 10);
        break;
      case '--output-format':
        options.outputFormat = args[++i] as any;
        break;
      case '--help':
        console.log(`
Questro Test Data Cleanup Script

Usage: tsx scripts/cleanup-test-data.ts [options]

Options:
  --environment <env>     Target environment (development|staging|test) [default: development]
  --entity-types <types>  Comma-separated list of entity types [default: all types]
  --dry-run              Preview cleanup without executing
  --force                Skip confirmation prompts
  --batch-size <size>    Number of records per batch [default: 1000]
  --verbose              Enable detailed logging
  --retention-days <days> Override retention period
  --output-format <fmt>  Output format (console|json|csv) [default: console]
  --help                 Show this help message

Examples:
  # Preview cleanup for development environment
  tsx scripts/cleanup-test-data.ts --dry-run --verbose

  # Cleanup test results and test runs in staging
  tsx scripts/cleanup-test-data.ts --environment staging --entity-types test_results,test_runs

  # Force cleanup with custom retention period
  tsx scripts/cleanup-test-data.ts --force --retention-days 30

  # Generate JSON report
  tsx scripts/cleanup-test-data.ts --output-format json --dry-run
        `);
        process.exit(0);
        break;
      default:
        if (args[i].startsWith('--')) {
          console.error(`Unknown option: ${args[i]}`);
          console.error('Use --help for available options');
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const options = parseArguments();
    const cleanupScript = new TestDataCleanupScript(options);
    const report = await cleanupScript.execute();

    // Exit with appropriate code
    process.exit(report.summary.success ? 0 : 1);

  } catch (error) {
    console.error('Script execution failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { TestDataCleanupScript, CleanupOptions, CleanupReport };
