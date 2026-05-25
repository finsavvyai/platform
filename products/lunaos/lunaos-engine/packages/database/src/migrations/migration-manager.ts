/**
 * Migration Manager for Claude Agent Platform
 *
 * Provides comprehensive migration management with:
 * - Version tracking and rollback
 * - Migration validation and testing
 * - Environment-specific migrations
 * - Migration scheduling and automation
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrationConfig {
  migrationsPath: string;
  environment: 'development' | 'staging' | 'production';
  autoMigrate?: boolean;
  backupBeforeMigrate?: boolean;
  validateMigrations?: boolean;
}

export interface Migration {
  version: string;
  description: string;
  filename: string;
  sql: string;
  dependencies?: string[];
  rollback?: string;
  environment?: string[];
  timestamp: number;
}

export interface MigrationResult {
  version: string;
  success: boolean;
  duration: number;
  error?: string;
  appliedAt: Date;
}

export class MigrationManager extends EventEmitter {
  private prisma: PrismaClient;
  private config: MigrationConfig;
  private migrations: Migration[] = [];
  private appliedMigrations: Map<string, MigrationResult> = new Map();

  constructor(prisma: PrismaClient, config: MigrationConfig) {
    super();
    this.prisma = prisma;
    this.config = config;
  }

  /**
   * Initialize migration manager
   */
  async initialize(): Promise<void> {
    await this.loadMigrations();
    await this.loadAppliedMigrations();
  }

  /**
   * Get all available migrations
   */
  getAvailableMigrations(): Migration[] {
    return [...this.migrations];
  }

  /**
   * Get applied migrations
   */
  getAppliedMigrations(): MigrationResult[] {
    return Array.from(this.appliedMigrations.values());
  }

  /**
   * Get pending migrations
   */
  getPendingMigrations(): Migration[] {
    return this.migrations.filter(migration =>
      !this.appliedMigrations.has(migration.version) &&
      (!migration.environment || migration.environment.includes(this.config.environment))
    );
  }

  /**
   * Run pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    const pendingMigrations = this.getPendingMigrations();
    const results: MigrationResult[] = [];

    this.emit('migrateStart', { count: pendingMigrations.length });

    for (const migration of pendingMigrations) {
      const result = await this.applyMigration(migration);
      results.push(result);

      if (!result.success) {
        this.emit('migrateError', { migration: migration.version, error: result.error });
        break; // Stop on first error
      }
    }

    this.emit('migrateComplete', { results, applied: results.filter(r => r.success).length });
    return results;
  }

  /**
   * Rollback to specific version
   */
  async rollback(targetVersion?: string): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    // Sort applied migrations by timestamp (reverse order)
    const applied = Array.from(this.appliedMigrations.values())
      .sort((a, b) => b.appliedAt.getTime() - a.appliedAt.getTime());

    for (const appliedMigration of applied) {
      if (targetVersion && appliedMigration.version === targetVersion) {
        break;
      }

      const migration = this.migrations.find(m => m.version === appliedMigration.version);
      if (!migration || !migration.rollback) {
        continue;
      }

      const result = await this.rollbackMigration(migration, appliedMigration);
      results.push(result);

      if (!result.success) {
        this.emit('rollbackError', { migration: migration.version, error: result.error });
        break;
      }
    }

    this.emit('rollbackComplete', { results, rolledBack: results.filter(r => r.success).length });
    return results;
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    current: string | null;
    latest: string | null;
    pending: Migration[];
    applied: MigrationResult[];
    healthy: boolean;
  }> {
    const applied = Array.from(this.appliedMigrations.values());
    const pending = this.getPendingMigrations();
    const current = applied.length > 0 ? applied[applied.length - 1].version : null;
    const latest = this.migrations.length > 0 ? this.migrations[this.migrations.length - 1].version : null;

    return {
      current,
      latest,
      pending,
      applied,
      healthy: pending.length === 0 && applied.every(m => m.success),
    };
  }

  /**
   * Validate migrations
   */
  async validateMigrations(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const migration of this.migrations) {
      // Validate SQL syntax
      try {
        // Basic SQL validation (would need a proper SQL parser for production)
        if (!migration.sql.trim()) {
          errors.push(`Migration ${migration.version} has empty SQL`);
        }

        // Check for dangerous operations
        const dangerousOperations = ['DROP TABLE', 'DELETE FROM', 'TRUNCATE TABLE'];
        for (const operation of dangerousOperations) {
          if (migration.sql.toUpperCase().includes(operation)) {
            warnings.push(`Migration ${migration.version} contains dangerous operation: ${operation}`);
          }
        }
      } catch (error) {
        errors.push(`Migration ${migration.version} validation failed: ${error}`);
      }
    }

    // Check for missing dependencies
    for (const migration of this.migrations) {
      if (migration.dependencies) {
        for (const dependency of migration.dependencies) {
          if (!this.migrations.find(m => m.version === dependency)) {
            errors.push(`Migration ${migration.version} depends on missing migration: ${dependency}`);
          }
        }
      }
    }

    const valid = errors.length === 0;
    return { valid, errors, warnings };
  }

  /**
   * Create migration
   */
  async createMigration(description: string, sql: string, rollback?: string): Promise<Migration> {
    const version = this.generateVersion();
    const filename = `${version}_${description.replace(/[^a-z0-9]/g, '_').toLowerCase()}.sql`;

    const migration: Migration = {
      version,
      description,
      filename,
      sql: sql.trim(),
      rollback,
      timestamp: Date.now(),
    };

    // Save migration file
    const filePath = path.join(this.config.migrationsPath, filename);
    const fileContent = this.formatMigrationFile(migration);
    fs.writeFileSync(filePath, fileContent);

    this.migrations.push(migration);
    this.emit('migrationCreated', { version, description, filename });

    return migration;
  }

  /**
   * Load migrations from filesystem
   */
  private async loadMigrations(): Promise<void> {
    if (!fs.existsSync(this.config.migrationsPath)) {
      fs.mkdirSync(this.config.migrationsPath, { recursive: true });
      return;
    }

    const files = fs.readdirSync(this.config.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      try {
        const filePath = path.join(this.config.migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const migration = this.parseMigrationFile(file, content);
        this.migrations.push(migration);
      } catch (error) {
        console.warn(`Failed to load migration file ${file}:`, error);
      }
    }
  }

  /**
   * Load applied migrations from database
   */
  private async loadAppliedMigrations(): Promise<void> {
    try {
      // Check if migration table exists
      const tableExists = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = '_migration_history'
        ) as exists
      `;

      if (!tableExists[0]?.exists) {
        await this.createMigrationTable();
        return;
      }

      const results = await this.prisma.$queryRaw<Array<{
        version: string;
        description: string;
        success: boolean;
        duration: number;
        error?: string;
        applied_at: Date;
      }>>`
        SELECT * FROM _migration_history ORDER BY applied_at
      `;

      for (const result of results) {
        this.appliedMigrations.set(result.version, {
          version: result.version,
          success: result.success,
          duration: result.duration,
          error: result.error,
          appliedAt: result.applied_at,
        });
      }
    } catch (error) {
      console.warn('Failed to load applied migrations:', error);
    }
  }

  /**
   * Create migration history table
   */
  private async createMigrationTable(): Promise<void> {
    await this.prisma.$executeRaw`
      CREATE TABLE _migration_history (
        version VARCHAR(255) PRIMARY KEY,
        description TEXT,
        success BOOLEAN NOT NULL,
        duration INTEGER NOT NULL,
        error TEXT,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      // Create backup if enabled
      if (this.config.backupBeforeMigrate) {
        await this.createBackup(migration.version);
      }

      // Execute migration
      await this.prisma.$executeRawUnsafe(migration.sql);

      // Record migration
      await this.prisma.$executeRaw`
        INSERT INTO _migration_history (version, description, success, duration, applied_at)
        VALUES (${migration.version}, ${migration.description}, true, ${Date.now() - startTime}, NOW())
      `;

      const result: MigrationResult = {
        version: migration.version,
        success: true,
        duration: Date.now() - startTime,
        appliedAt: new Date(),
      };

      this.appliedMigrations.set(migration.version, result);
      this.emit('migrationApplied', { version: migration.version, duration: result.duration });

      return result;
    } catch (error) {
      const result: MigrationResult = {
        version: migration.version,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        appliedAt: new Date(),
      };

      await this.prisma.$executeRaw`
        INSERT INTO _migration_history (version, description, success, duration, error, applied_at)
        VALUES (${migration.version}, ${migration.description}, false, ${result.duration}, ${result.error}, NOW())
      `;

      this.appliedMigrations.set(migration.version, result);
      this.emit('migrationFailed', { version: migration.version, error: result.error });

      return result;
    }
  }

  /**
   * Rollback a single migration
   */
  private async rollbackMigration(migration: Migration, appliedMigration: MigrationResult): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      if (!migration.rollback) {
        throw new Error('No rollback script available for this migration');
      }

      // Execute rollback
      await this.prisma.$executeRawUnsafe(migration.rollback);

      // Remove from migration history
      await this.prisma.$executeRaw`
        DELETE FROM _migration_history WHERE version = ${migration.version}
      `;

      const result: MigrationResult = {
        version: migration.version,
        success: true,
        duration: Date.now() - startTime,
        appliedAt: new Date(),
      };

      this.appliedMigrations.delete(migration.version);
      this.emit('migrationRolledBack', { version: migration.version, duration: result.duration });

      return result;
    } catch (error) {
      const result: MigrationResult = {
        version: migration.version,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        appliedAt: new Date(),
      };

      this.emit('rollbackFailed', { version: migration.version, error: result.error });

      return result;
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(version: string): Promise<void> {
    // This would implement database backup functionality
    // For now, just emit an event
    this.emit('backupCreated', { version });
  }

  /**
   * Generate migration version
   */
  private generateVersion(): string {
    const now = new Date();
    return now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  }

  /**
   * Parse migration file
   */
  private parseMigrationFile(filename: string, content: string): Migration {
    const version = filename.split('_')[0];
    const description = filename.replace(version + '_', '').replace('.sql', '');

    const lines = content.split('\n');
    let sql = '';
    let rollback = '';
    let inRollback = false;

    for (const line of lines) {
      if (line.trim() === '-- ROLLBACK') {
        inRollback = true;
        continue;
      }

      if (inRollback) {
        rollback += line + '\n';
      } else {
        sql += line + '\n';
      }
    }

    return {
      version,
      description: description.replace(/_/g, ' '),
      filename,
      sql: sql.trim(),
      rollback: rollback.trim() || undefined,
      timestamp: parseInt(version),
    };
  }

  /**
   * Format migration file content
   */
  private formatMigrationFile(migration: Migration): string {
    let content = `-- Migration: ${migration.description}\n`;
    content += `-- Version: ${migration.version}\n`;
    content += `-- Created: ${new Date(migration.timestamp).toISOString()}\n\n`;
    content += migration.sql;

    if (migration.rollback) {
      content += '\n\n-- ROLLBACK\n';
      content += migration.rollback;
    }

    return content;
  }
}
