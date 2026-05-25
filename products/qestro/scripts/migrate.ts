#!/usr/bin/env node

/**
 * Qestro Database Migration CLI
 *
 * Command-line interface for managing database migrations:
 * - npm run migrate status - Show current migration status
 * - npm run migrate plan - Create migration plan
 * - npm run migrate up - Execute pending migrations
 * - npm run migrate down <version> - Rollback specific migration
 * - npm run migrate validate - Validate database state
 * - npm run migrate history - Show migration history
 */

import { DatabaseMigrationService } from '../src/services/database-migration';

// Mock D1Database for CLI usage
class MockD1Database {
  // This would be replaced with actual D1 database connection
  // For now, we'll provide a mock interface
}

interface CLIOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  targetVersion?: string;
  environment?: string;
  verbose?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  try {
    // Parse options
    const options = parseOptions(args.slice(1));

    // Initialize migration service
    const d1Database = new MockD1Database() as any; // Would be actual D1 instance
    const migrationService = new DatabaseMigrationService(d1Database, {
      enableAutoBackup: options.backup !== false,
      requireApproval: !options.force
    });

    console.log(`🔄 Qestro Database Migration CLI`);
    console.log(`📍 Environment: ${options.environment || process.env.ENVIRONMENT || 'development'}`);
    console.log('');

    switch (command) {
      case 'status':
        await handleStatus(migrationService, options);
        break;

      case 'plan':
        await handlePlan(migrationService, options);
        break;

      case 'up':
        await handleUp(migrationService, options);
        break;

      case 'down':
        await handleDown(migrationService, options);
        break;

      case 'validate':
        await handleValidate(migrationService, options);
        break;

      case 'history':
        await handleHistory(migrationService, options);
        break;

      case 'list':
        await handleList(migrationService, options);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }

  } catch (error) {
    console.error(`💥 Command failed:`, error);
    process.exit(1);
  }
}

/**
 * Show migration status
 */
async function handleStatus(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  console.log('📊 Migration Status');
  console.log('==================');

  const currentVersion = await service.getCurrentVersion();
  const pendingMigrations = await service.getPendingMigrations(options.targetVersion);
  const validation = await service.validateDatabase();

  console.log(`Current Version: ${currentVersion}`);
  console.log(`Pending Migrations: ${pendingMigrations.length}`);
  console.log(`Database Valid: ${validation.isValid ? '✅' : '❌'}`);

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (validation.issues.length > 0) {
    console.log('\n❌ Issues:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  if (pendingMigrations.length > 0) {
    console.log('\n📋 Pending Migrations:');
    pendingMigrations.forEach((migration, index) => {
      console.log(`  ${index + 1}. ${migration.version} - ${migration.name}`);
      console.log(`     Type: ${migration.type}, Priority: ${migration.priority}`);
      if (migration.estimate.downtime) {
        console.log(`     ⚠️  Requires downtime`);
      }
    });
  }

  console.log('\n💡 Run "npm run migrate plan" to see detailed execution plan');
}

/**
 * Create migration plan
 */
async function handlePlan(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  console.log('📋 Migration Plan');
  console.log('=================');

  const plan = await service.createMigrationPlan({
    targetVersion: options.targetVersion,
    dryRun: options.dryRun !== false,
    force: options.force
  });

  if (plan.migrations.length === 0) {
    console.log('✅ No pending migrations to execute');
    return;
  }

  console.log(`Migrations to Execute: ${plan.migrations.length}`);
  console.log(`Estimated Duration: ${Math.round(plan.totalDuration / 1000)}s`);
  console.log(`Requires Downtime: ${plan.requiresDowntime ? 'Yes' : 'No'}`);
  console.log(`Total Impact: ${plan.totalImpact}`);

  if (plan.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    plan.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  console.log('\n📝 Execution Order:');
  plan.migrations.forEach((migration, index) => {
    console.log(`  ${index + 1}. ${migration.version} - ${migration.name}`);
    console.log(`     Description: ${migration.description}`);
    console.log(`     Type: ${migration.type}, Priority: ${migration.priority}`);
    console.log(`     Estimated: ${Math.round(migration.estimate.duration / 1000)}s, Impact: ${migration.estimate.impact}`);
    if (migration.dependencies.length > 0) {
      console.log(`     Dependencies: ${migration.dependencies.join(', ')}`);
    }
    console.log('');
  });

  if (options.dryRun) {
    console.log('🔍 This is a dry run. Use "npm run migrate up" to execute.');
  } else {
    console.log('💡 Ready to execute. Use "npm run migrate up" to run migrations.');
  }
}

/**
 * Execute migrations
 */
async function handleUp(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  console.log('🚀 Executing Migrations');
  console.log('=======================');

  if (process.env.ENVIRONMENT === 'production' && !options.force) {
    console.log('❌ Production environment detected. Use --force to confirm execution.');
    console.log('💡 This protects against accidental production migrations.');
    return;
  }

  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Auto Backup: ${options.backup !== false ? 'Enabled' : 'Disabled'}`);
  console.log('');

  const results = await service.executeMigrations({
    targetVersion: options.targetVersion,
    dryRun: options.dryRun !== false,
    force: options.force,
    backup: options.backup !== false
  });

  const summary = {
    total: results.length,
    completed: results.filter(r => r.status === 'completed').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'pending').length
  };

  console.log('\n📊 Execution Summary:');
  console.log(`Total: ${summary.total}`);
  console.log(`✅ Completed: ${summary.completed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⏭️  Skipped: ${summary.skipped}`);

  if (summary.failed > 0) {
    console.log('\n❌ Failed Migrations:');
    results
      .filter(r => r.status === 'failed')
      .forEach(result => {
        console.log(`  - ${result.migration.version}: ${result.error}`);
      });
  }

  if (options.dryRun) {
    console.log('\n🔍 Dry run completed. No changes were made.');
  } else if (summary.completed > 0) {
    console.log('\n✅ Migration execution completed successfully!');
  }
}

/**
 * Rollback migration
 */
async function handleDown(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  const version = process.argv[3];

  if (!version) {
    console.error('❌ Migration version required for rollback');
    console.log('Usage: npm run migrate down <version> [options]');
    return;
  }

  console.log(`⬇️ Rolling Back Migration: ${version}`);
  console.log('==================================');

  if (process.env.ENVIRONMENT === 'production' && !options.force) {
    console.log('❌ Production environment detected. Use --force to confirm rollback.');
    return;
  }

  const result = await service.rollbackMigration(version, {
    force: options.force,
    reason: 'Manual rollback via CLI'
  });

  if (result.status === 'completed') {
    console.log(`✅ Migration ${version} rolled back successfully`);
    console.log(`Duration: ${result.duration}ms`);
    if (result.rollbackReason) {
      console.log(`Reason: ${result.rollbackReason}`);
    }
  } else {
    console.log(`❌ Rollback failed: ${result.error}`);
  }
}

/**
 * Validate database
 */
async function handleValidate(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  console.log('🔍 Validating Database');
  console.log('=======================');

  const validation = await service.validateDatabase();

  console.log(`Database Valid: ${validation.isValid ? '✅' : '❌'}`);

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (validation.issues.length > 0) {
    console.log('\n❌ Issues:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  if (validation.metrics) {
    console.log('\n📊 Metrics:');
    Object.entries(validation.metrics).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  }

  if (validation.isValid) {
    console.log('\n✅ Database validation passed!');
  } else {
    console.log('\n❌ Database validation failed!');
    process.exit(1);
  }
}

/**
 * Show migration history
 */
async function handleHistory(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  console.log('📚 Migration History');
  console.log('====================');

  // This would use the API to get history
  console.log('Feature not yet implemented in CLI');
  console.log('💡 Use the API endpoints or web interface to view migration history');
}

/**
 * List available migrations
 */
async function handleList(service: DatabaseMigrationService, options: CLIOptions): Promise<void> {
  console.log('📋 Available Migrations');
  console.log('=======================');

  const currentVersion = await service.getCurrentVersion();
  const pendingMigrations = await service.getPendingMigrations(options.targetVersion);
  const allMigrations = service['migrations'] as Map<string, any>;

  console.log(`Current Version: ${currentVersion}\n`);

  console.log('📜 All Migrations:');
  Array.from(allMigrations.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .forEach(([version, migration]) => {
      const isApplied = service['compareVersions'](version, currentVersion) <= 0;
      const isPending = pendingMigrations.some(m => m.version === version);

      const status = isApplied ? '✅ Applied' : isPending ? '⏳ Pending' : '🔵 Future';
      console.log(`  ${status} ${version} - ${migration.name}`);
      console.log(`    ${migration.description}`);
      console.log(`    Type: ${migration.type}, Priority: ${migration.priority}`);
      console.log('');
    });
}

/**
 * Parse command line options
 */
function parseOptions(args: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--no-backup':
        options.backup = false;
        break;
      case '--target':
      case '-t':
        options.targetVersion = args[++i];
        break;
      case '--environment':
      case '-e':
        options.environment = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
🔄 Qestro Database Migration CLI

Usage: npm run migrate <command> [options]

Commands:
  status      Show current migration status
  plan        Create migration execution plan
  up          Execute pending migrations
  down <ver>  Rollback specific migration
  validate    Validate database state
  history     Show migration history
  list        List all available migrations
  help        Show this help message

Options:
  --dry-run, -n     Show what would be done without executing
  --force, -f       Force execution in production environment
  --no-backup       Disable automatic backup creation
  --target <ver>, -t Target version for migration
  --environment <e> Set environment (development|staging|production)
  --verbose, -v     Enable verbose output

Examples:
  npm run migrate status                    # Show current status
  npm run migrate plan                      # Create execution plan
  npm run migrate up --dry-run              # Dry run execution
  npm run migrate up --force                # Force execution
  npm run migrate down 1.2.0 --force        # Rollback version 1.2.0
  npm run migrate validate                  # Validate database

Environment Variables:
  ENVIRONMENT       Current environment (development|staging|production)
  D1_DATABASE_URL   D1 database connection string
`);
}

// Execute CLI
if (require.main === module) {
  main().catch(error => {
    console.error('💥 CLI execution failed:', error);
    process.exit(1);
  });
}

export { main };
