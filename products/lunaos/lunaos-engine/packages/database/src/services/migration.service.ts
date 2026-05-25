import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { dbConnectionManager } from '../connection';

export interface Migration {
  id: string;
  name: string;
  timestamp: string;
  up: string;
  down: string;
  dependencies?: string[];
}

export interface MigrationResult {
  migration: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface RollbackResult {
  migration: string;
  success: boolean;
  error?: string;
  duration: number;
}

export class MigrationService {
  private prisma: PrismaClient;
  private migrationsPath: string;

  constructor(migrationsPath: string = 'migrations') {
    this.migrationsPath = migrationsPath;
    this.prisma = dbConnectionManager.getPrismaClient();
  }

  public async initialize(): Promise<void> {
    try {
      // Ensure migrations directory exists
      await fs.mkdir(this.migrationsPath, { recursive: true });

      // Create migrations table if it doesn't exist
      await this.ensureMigrationsTable();

      logger.info('Migration service initialized');
    } catch (error) {
      logger.error('Failed to initialize migration service:', error);
      throw error;
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    try {
      // Check if migrations table exists
      const tableExists = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '_migrations'
        )
      `;

      if (tableExists[0]?.exists) {
        return;
      }

      // Create migrations table
      await this.prisma.$executeRaw`
        CREATE TABLE "_migrations" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL,
          success BOOLEAN NOT NULL DEFAULT TRUE,
          error_message TEXT,
          execution_time_ms INTEGER
        )
      `;

      // Create indexes
      await this.prisma.$executeRaw`
        CREATE INDEX "_migrations_name_idx" ON "_migrations" (name)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX "_migrations_timestamp_idx" ON "_migrations" (timestamp)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX "_migrations_executed_at_idx" ON "_migrations" (executed_at)
      `;

      logger.info('Created migrations table');
    } catch (error) {
      logger.error('Failed to create migrations table:', error);
      throw error;
    }
  }

  public async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    const migrationId = `${timestamp}_${name}`;

    const upContent = `-- Migration: ${migrationId}
-- Up migration
BEGIN;

-- Add your migration SQL here

COMMIT;
`;

    const downContent = `-- Migration: ${migrationId}
-- Down migration
BEGIN;

-- Add your rollback SQL here

COMMIT;
`;

    const migrationFile = join(this.migrationsPath, `${migrationId}.sql`);
    await fs.writeFile(migrationFile, `${upContent}\n\n-- Down Migration\n${downContent}`);

    logger.info(`Created migration: ${migrationId}`);
    return migrationId;
  }

  public async createCustomMigration(
    name: string,
    upSql: string,
    downSql: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    const migrationId = `${timestamp}_${name}`;

    const content = `-- Migration: ${migrationId}
-- Up migration
BEGIN;

${upSql}

COMMIT;

-- Down Migration
BEGIN;

${downSql}

COMMIT;
`;

    const migrationFile = join(this.migrationsPath, `${migrationId}.sql`);
    await fs.writeFile(migrationFile, content);

    logger.info(`Created custom migration: ${migrationId}`);
    return migrationId;
  }

  public async listMigrations(): Promise<Migration[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files.filter(file => file.endsWith('.sql'));

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const content = await fs.readFile(join(this.migrationsPath, file), 'utf-8');
        const migration = this.parseMigration(file, content);
        migrations.push(migration);
      }

      return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      logger.error('Failed to list migrations:', error);
      throw error;
    }
  }

  public async getExecutedMigrations(): Promise<Array<{
    id: number;
    name: string;
    timestamp: string;
    executed_at: string;
    checksum: string;
    success: boolean;
    error_message?: string;
    execution_time_ms?: number;
  }>> {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT * FROM "_migrations" ORDER BY timestamp ASC
      `;

      return result as any[];
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      return [];
    }
  }

  public async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.listMigrations();
    const executedMigrations = await this.getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map(m => m.name));

    return allMigrations.filter(migration => !executedNames.has(migration.id));
  }

  public async migrate(
    options: {
      target?: string;
      dryRun?: boolean;
      force?: boolean;
    } = {}
  ): Promise<MigrationResult[]> {
    const pendingMigrations = await this.getPendingMigrations();
    const results: MigrationResult[] = [];

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations to run');
      return results;
    }

    // Filter migrations if target specified
    let migrationsToRun = pendingMigrations;
    if (options.target) {
      migrationsToRun = pendingMigrations.filter(m =>
        m.id <= options.target!
      );
    }

    logger.info(`Running ${migrationsToRun.length} migrations`);

    for (const migration of migrationsToRun) {
      const result = await this.runMigration(migration, options);
      results.push(result);

      if (!result.success && !options.force) {
        logger.error(`Migration ${migration.id} failed. Stopping migration process.`);
        break;
      }
    }

    return results;
  }

  public async rollback(
    steps: number = 1,
    options: {
      dryRun?: boolean;
      force?: boolean;
    } = {}
  ): Promise<RollbackResult[]> {
    const executedMigrations = await this.getExecutedMigrations();
    const successfulMigrations = executedMigrations
      .filter(m => m.success)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (successfulMigrations.length === 0) {
      logger.info('No migrations to rollback');
      return [];
    }

    const migrationsToRollback = successfulMigrations.slice(0, steps);
    const results: RollbackResult[] = [];

    logger.info(`Rolling back ${migrationsToRollback.length} migrations`);

    for (const migrationRecord of migrationsToRollback) {
      const migration = await this.getMigrationFile(migrationRecord.name);
      if (!migration) {
        const result: RollbackResult = {
          migration: migrationRecord.name,
          success: false,
          error: 'Migration file not found',
          duration: 0,
        };
        results.push(result);
        continue;
      }

      const result = await this.runRollback(migration, migrationRecord, options);
      results.push(result);

      if (!result.success && !options.force) {
        logger.error(`Rollback of ${migration.id} failed. Stopping rollback process.`);
        break;
      }
    }

    return results;
  }

  private async runMigration(
    migration: Migration,
    options: { dryRun?: boolean; force?: boolean }
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      if (options.dryRun) {
        logger.info(`[DRY RUN] Would execute migration: ${migration.id}`);
        return {
          migration: migration.id,
          success: true,
          duration: Date.now() - startTime,
        };
      }

      logger.info(`Running migration: ${migration.id}`);

      // Calculate checksum
      const checksum = await this.calculateChecksum(migration.up);

      // Start transaction
      await this.prisma.$executeRaw`BEGIN`;

      try {
        // Execute migration
        await this.prisma.$executeRawUnsafe(migration.up);

        // Record migration
        await this.prisma.$executeRaw`
          INSERT INTO "_migrations" (name, timestamp, checksum, success, execution_time_ms)
          VALUES (${migration.id}, ${migration.timestamp}, ${checksum}, true, ${Date.now() - startTime})
        `;

        await this.prisma.$executeRaw`COMMIT`;

        const duration = Date.now() - startTime;
        logger.info(`Migration ${migration.id} completed successfully in ${duration}ms`);

        return {
          migration: migration.id,
          success: true,
          duration,
        };
      } catch (error) {
        await this.prisma.$executeRaw`ROLLBACK`;
        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Migration ${migration.id} failed:`, errorMessage);

      // Record failed migration if not dry run
      if (!options.dryRun) {
        try {
          await this.prisma.$executeRaw`
            INSERT INTO "_migrations" (name, timestamp, checksum, success, error_message, execution_time_ms)
            VALUES (${migration.id}, ${migration.timestamp}, '', false, ${errorMessage}, ${duration})
          `;
        } catch (recordError) {
          logger.error('Failed to record migration failure:', recordError);
        }
      }

      return {
        migration: migration.id,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  private async runRollback(
    migration: Migration,
    migrationRecord: any,
    options: { dryRun?: boolean; force?: boolean }
  ): Promise<RollbackResult> {
    const startTime = Date.now();

    try {
      if (options.dryRun) {
        logger.info(`[DRY RUN] Would rollback migration: ${migration.id}`);
        return {
          migration: migration.id,
          success: true,
          duration: Date.now() - startTime,
        };
      }

      logger.info(`Rolling back migration: ${migration.id}`);

      // Start transaction
      await this.prisma.$executeRaw`BEGIN`;

      try {
        // Execute rollback
        await this.prisma.$executeRawUnsafe(migration.down);

        // Remove migration record
        await this.prisma.$executeRaw`
          DELETE FROM "_migrations" WHERE name = ${migration.id}
        `;

        await this.prisma.$executeRaw`COMMIT`;

        const duration = Date.now() - startTime;
        logger.info(`Rollback of ${migration.id} completed successfully in ${duration}ms`);

        return {
          migration: migration.id,
          success: true,
          duration,
        };
      } catch (error) {
        await this.prisma.$executeRaw`ROLLBACK`;
        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Rollback of ${migration.id} failed:`, errorMessage);

      return {
        migration: migration.id,
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  private parseMigration(filename: string, content: string): Migration {
    const id = filename.replace('.sql', '');
    const parts = id.split('_', 2);
    const timestamp = parts[0];
    const name = parts[1] || id;

    // Extract up and down migrations
    const upMatch = content.match(/-- Up migration\s*\nBEGIN;\s*\n([\s\S]*?)\s*COMMIT;/i);
    const downMatch = content.match(/-- Down migration\s*\nBEGIN;\s*\n([\s\S]*?)\s*COMMIT;/i);

    const up = upMatch ? upMatch[1].trim() : '';
    const down = downMatch ? downMatch[1].trim() : '';

    return {
      id,
      name,
      timestamp,
      up,
      down,
    };
  }

  private async getMigrationFile(migrationId: string): Promise<Migration | null> {
    try {
      const filename = `${migrationId}.sql`;
      const content = await fs.readFile(join(this.migrationsPath, filename), 'utf-8');
      return this.parseMigration(filename, content);
    } catch (error) {
      logger.error(`Failed to read migration file ${migrationId}:`, error);
      return null;
    }
  }

  private async calculateChecksum(sql: string): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  public async validateMigrations(): Promise<{
    valid: boolean;
    issues: Array<{
      migration: string;
      issue: string;
      severity: 'error' | 'warning';
    }>;
  }> {
    const issues: Array<{
      migration: string;
      issue: string;
      severity: 'error' | 'warning';
    }> = [];

    try {
      // Check for migrations table
      const tableExists = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '_migrations'
        )
      `;

      if (!tableExists[0]?.exists) {
        issues.push({
          migration: 'system',
          issue: 'Migrations table does not exist',
          severity: 'error',
        });
      }

      // Check for orphaned migration records
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = await this.listMigrations();
      const availableIds = new Set(availableMigrations.map(m => m.id));

      for (const executed of executedMigrations) {
        if (!availableIds.has(executed.name)) {
          issues.push({
            migration: executed.name,
            issue: 'Migration record exists but file not found',
            severity: 'warning',
          });
        }
      }

      // Check for failed migrations
      const failedMigrations = executedMigrations.filter(m => !m.success);
      for (const failed of failedMigrations) {
        issues.push({
          migration: failed.name,
          issue: `Migration failed: ${failed.error_message}`,
          severity: 'error',
        });
      }

      return {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        issues,
      };
    } catch (error) {
      logger.error('Failed to validate migrations:', error);
      return {
        valid: false,
        issues: [{
          migration: 'system',
          issue: `Validation failed: ${error}`,
          severity: 'error',
        }],
      };
    }
  }

  public async resetDatabase(): Promise<void> {
    logger.warn('Resetting database - this will delete all data');

    // Drop all tables except migrations
    await this.prisma.$executeRaw`
      DO $$
      DECLARE
        table_record RECORD;
      BEGIN
        FOR table_record IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_migrations')
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(table_record.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `;

    // Clear migrations table
    await this.prisma.$executeRaw`TRUNCATE TABLE "_migrations"`;

    logger.info('Database reset completed');
  }

  public async getMigrationStatus(): Promise<{
    pending: number;
    executed: number;
    failed: number;
    latest: string | null;
  }> {
    const [pending, executed] = await Promise.all([
      this.getPendingMigrations(),
      this.getExecutedMigrations(),
    ]);

    const failed = executed.filter(m => !m.success).length;
    const successful = executed.filter(m => m.success);
    const latest = successful.length > 0
      ? successful[successful.length - 1].name
      : null;

    return {
      pending: pending.length,
      executed: successful.length,
      failed,
      latest,
    };
  }
}

// Export singleton instance
export const migrationService = new MigrationService();
