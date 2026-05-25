#!/usr/bin/env node

/**
 * Cloudflare D1 Migration Runner
 *
 * This script handles database migrations for Cloudflare D1 across different environments.
 * It supports development, staging, and production environments with proper tracking
 * and rollback capabilities.
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface MigrationFile {
  filename: string;
  path: string;
  content: string;
  version: number;
}

interface MigrationRecord {
  id: string;
  filename: string;
  checksum: string;
  executed_at: number;
}

class MigrationRunner {
  private environment: string;
  private databaseId: string;
  private migrationsDir: string;

  constructor(environment: string = 'development') {
    this.environment = environment;
    this.migrationsDir = join(__dirname, 'migrations');
  }

  /**
   * Initialize the migrations table
   */
  async init(): Promise<void> {
    console.log(`🚀 Initializing migrations for ${this.environment} environment...`);

    const initSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        executed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename ON schema_migrations(filename);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at);
    `;

    try {
      await this.executeSQL(initSQL);
      console.log('✅ Migration table initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize migration table:', error);
      throw error;
    }
  }

  /**
   * Get all migration files sorted by version
   */
  private getMigrationFiles(): MigrationFile[] {
    const migrations: MigrationFile[] = [];

    const getAllFiles = (dir: string, basePath: string = ''): string[] => {
      const files: string[] = [];
      const items = readdirSync(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const relativePath = basePath ? join(basePath, item) : item;

        try {
          const stat = require('fs').statSync(fullPath);
          if (stat.isDirectory()) {
            files.push(...getAllFiles(fullPath, relativePath));
          } else if (item.endsWith('.sql')) {
            files.push(relativePath);
          }
        } catch (error) {
          // Skip files that can't be accessed
        }
      }

      return files;
    };

    const migrationFiles = getAllFiles(this.migrationsDir);

    for (const file of migrationFiles) {
      const filePath = join(this.migrationsDir, file);
      const content = readFileSync(filePath, 'utf8');
      const version = this.extractVersionFromFilename(file);

      migrations.push({
        filename: file,
        path: filePath,
        content,
        version
      });
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Extract version number from migration filename
   */
  private extractVersionFromFilename(filename: string): number {
    const match = filename.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get executed migrations from database
   */
  private async getExecutedMigrations(): Promise<MigrationRecord[]> {
    try {
      const result = await this.executeSQL('SELECT * FROM schema_migrations ORDER BY executed_at');
      return result.results || [];
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error.message.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Execute SQL using Wrangler
   */
  private async executeSQL(sql: string): Promise<any> {
    const command = `npx wrangler d1 execute ${this.databaseId} --env=${this.environment} --command="${sql.replace(/"/g, '\\"')}"`;

    try {
      const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      return JSON.parse(output);
    } catch (error) {
      console.error(`❌ SQL execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute migration file
   */
  private async executeMigration(migration: MigrationFile): Promise<void> {
    console.log(`📋 Executing migration: ${migration.filename}`);

    try {
      // Start transaction
      await this.executeSQL('BEGIN TRANSACTION');

      // Execute migration SQL
      await this.executeSQL(migration.content);

      // Record migration
      const checksum = this.calculateChecksum(migration.content);
      const recordSQL = `
        INSERT INTO schema_migrations (id, filename, checksum, executed_at)
        VALUES ('${migration.filename.replace(/[^a-zA-Z0-9]/g, '_')}', '${migration.filename}', '${checksum}', ${Date.now() / 1000})
      `;
      await this.executeSQL(recordSQL);

      // Commit transaction
      await this.executeSQL('COMMIT');

      console.log(`✅ Migration completed: ${migration.filename}`);
    } catch (error) {
      // Rollback on error
      try {
        await this.executeSQL('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Failed to rollback transaction:', rollbackError);
      }

      console.error(`❌ Migration failed: ${migration.filename}`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    console.log(`🔄 Starting migration process for ${this.environment} environment...`);

    await this.init();

    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const executedFilenames = new Set(executedMigrations.map(m => m.filename));

    const pendingMigrations = allMigrations.filter(m => !executedFilenames.has(m.filename));

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations found');
      return;
    }

    console.log(`📝 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('🎉 All migrations completed successfully');
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    console.log(`📊 Migration status for ${this.environment} environment...`);

    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const executedFilenames = new Set(executedMigrations.map(m => m.filename));

    console.log('\n📋 Migration Status:');
    console.log('─'.repeat(60));

    for (const migration of allMigrations) {
      const status = executedFilenames.has(migration.filename) ? '✅' : '⏳';
      const executedRecord = executedMigrations.find(m => m.filename === migration.filename);
      const executedAt = executedRecord ? new Date(executedRecord.executed_at * 1000).toISOString() : 'Pending';

      console.log(`${status} ${migration.filename.padEnd(40)} ${executedAt}`);
    }

    const pendingCount = allMigrations.filter(m => !executedFilenames.has(m.filename)).length;
    console.log('─'.repeat(60));
    console.log(`Total: ${allMigrations.length} | Pending: ${pendingCount} | Executed: ${executedMigrations.length}`);
  }

  /**
   * Create new migration file
   */
  async create(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const filename = `${timestamp}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.sql`;
    const filePath = join(this.migrationsDir, filename);

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: ${name}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id TEXT PRIMARY KEY,
--   created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
-- );

`;

    require('fs').writeFileSync(filePath, template);
    console.log(`✅ Migration file created: ${filename}`);
  }

  /**
   * Set database ID based on environment
   */
  setDatabaseId(databaseId: string): void {
    this.databaseId = databaseId;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1] || 'development';

  const runner = new MigrationRunner(environment);

  // Set database ID based on environment
  const databaseIds = {
    development: process.env.D1_DATABASE_ID_DEV || 'dev-database-placeholder',
    staging: process.env.D1_DATABASE_ID_STAGING || 'staging-database-placeholder',
    production: process.env.D1_DATABASE_ID_PROD || 'production-database-placeholder'
  };

  runner.setDatabaseId(databaseIds[environment]);

  try {
    switch (command) {
      case 'migrate':
        await runner.migrate();
        break;
      case 'status':
        await runner.status();
        break;
      case 'create':
        const migrationName = args[2];
        if (!migrationName) {
          console.error('❌ Migration name is required for create command');
          process.exit(1);
        }
        await runner.create(migrationName);
        break;
      default:
        console.log('📖 Cloudflare D1 Migration Runner');
        console.log('');
        console.log('Usage:');
        console.log('  node migrate.js <command> [environment] [options]');
        console.log('');
        console.log('Commands:');
        console.log('  migrate   Run all pending migrations');
        console.log('  status    Show migration status');
        console.log('  create    Create new migration file');
        console.log('');
        console.log('Environments:');
        console.log('  development (default)');
        console.log('  staging');
        console.log('  production');
        console.log('');
        console.log('Examples:');
        console.log('  node migrate.js migrate development');
        console.log('  node migrate.js status staging');
        console.log('  node migrate.js create add_user_profiles');
        break;
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MigrationRunner };
