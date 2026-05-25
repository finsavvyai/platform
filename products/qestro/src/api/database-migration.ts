/**
 * Database Migration API Endpoints
 *
 * REST API for managing database migrations including:
 * - Migration planning and execution
 * - Rollback operations and backup management
 * - Migration status monitoring and analytics
 * - Database validation and health checks
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  createDatabaseMigrationService,
  DatabaseMigrationService
} from '../services/database-migration';

export class DatabaseMigrationAPI {
  private db: any;
  private migrationService: DatabaseMigrationService;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database, { schema });
    this.migrationService = createDatabaseMigrationService(d1Database);
  }

  /**
   * Get migration status and current version
   */
  async getMigrationStatus(request: Request, env: any): Promise<Response> {
    try {
      const currentVersion = await this.migrationService.getCurrentVersion();
      const pendingMigrations = await this.migrationService.getPendingMigrations();
      const plan = await this.migrationService.createMigrationPlan({ dryRun: true });
      const validation = await this.migrationService.validateDatabase();

      // Get recent migration history
      const recentMigrations = await this.db.select()
        .from(schema.appliedMigrations)
        .orderBy(desc(schema.appliedMigrations.createdAt))
        .limit(10);

      // Get migration statistics
      const stats = await this.getMigrationStatistics();

      return Response.json({
        success: true,
        status: {
          currentVersion,
          pendingMigrations: pendingMigrations.length,
          totalMigrations: this.migrationService['migrations'].size,
          lastMigration: recentMigrations[0] || null,
          validation,
          plan: {
            migrations: plan.migrations.length,
            estimatedDuration: plan.totalDuration,
            requiresDowntime: plan.requiresDowntime,
            warnings: plan.warnings,
            impact: plan.totalImpact
          }
        },
        history: recentMigrations.map(migration => ({
          version: migration.version,
          name: migration.name,
          status: migration.status,
          duration: migration.duration,
          executedBy: migration.executedBy,
          createdAt: new Date(migration.createdAt).toISOString(),
          completedAt: migration.completedAt ? new Date(migration.completedAt).toISOString() : null
        })),
        statistics: stats
      });

    } catch (error) {
      console.error('Get migration status failed:', error);

      return Response.json({
        error: 'Failed to get migration status',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan(request: Request, env: any): Promise<Response> {
    try {
      const body = await request.json();
      const {
        targetVersion,
        dryRun = true,
        force = false
      } = body;

      const plan = await this.migrationService.createMigrationPlan({
        targetVersion,
        dryRun,
        force
      });

      // Get detailed migration information
      const detailedMigrations = plan.migrations.map(migration => ({
        version: migration.version,
        name: migration.name,
        description: migration.description,
        type: migration.type,
        priority: migration.priority,
        dependencies: migration.dependencies,
        estimate: migration.estimate
      }));

      return Response.json({
        success: true,
        plan: {
          migrations: detailedMigrations,
          order: plan.order,
          totalDuration: plan.totalDuration,
          totalImpact: plan.totalImpact,
          requiresDowntime: plan.requiresDowntime,
          warnings: plan.warnings,
          prerequisites: plan.prerequisites
        },
        metadata: {
          targetVersion,
          dryRun,
          force,
          createdAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Create migration plan failed:', error);

      return Response.json({
        error: 'Failed to create migration plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Execute migrations
   */
  async executeMigrations(request: Request, env: any): Promise<Response> {
    try {
      const body = await request.json();
      const {
        targetVersion,
        dryRun = false,
        force = false,
        backup = true
      } = body;

      // Validate request for production environment
      if (process.env.ENVIRONMENT === 'production' && !force) {
        return Response.json({
          error: 'Migration execution requires explicit force flag in production',
          code: 'PRODUCTION_PROTECTION'
        }, { status: 403 });
      }

      console.log(`🚀 Starting migration execution (dryRun: ${dryRun})`);

      const results = await this.migrationService.executeMigrations({
        targetVersion,
        dryRun,
        force,
        backup
      });

      // Calculate summary
      const summary = {
        total: results.length,
        completed: results.filter(r => r.status === 'completed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'pending').length,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
      };

      const success = summary.failed === 0;

      return Response.json({
        success,
        dryRun,
        summary,
        results: results.map(result => ({
          version: result.migration.version,
          name: result.migration.name,
          status: result.status,
          duration: result.duration,
          error: result.error,
          rollbackReason: result.rollbackReason,
          metrics: result.metrics
        })),
        metadata: {
          targetVersion,
          executedAt: new Date().toISOString(),
          batchId: `batch_${Date.now()}`
        }
      });

    } catch (error) {
      console.error('Execute migrations failed:', error);

      return Response.json({
        error: 'Failed to execute migrations',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(request: Request, env: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const version = url.pathname.split('/').pop();
      const body = await request.json();
      const {
        force = false,
        reason
      } = body;

      if (!version) {
        return Response.json({
          error: 'Missing migration version'
        }, { status: 400 });
      }

      // Validate request for production environment
      if (process.env.ENVIRONMENT === 'production' && !force) {
        return Response.json({
          error: 'Migration rollback requires explicit force flag in production',
          code: 'PRODUCTION_PROTECTION'
        }, { status: 403 });
      }

      console.log(`⬇️ Rolling back migration ${version}`);

      const result = await this.migrationService.rollbackMigration(version, {
        force,
        reason
      });

      return Response.json({
        success: result.status === 'completed',
        rollback: {
          version: result.migration.version,
          name: result.migration.name,
          status: result.status,
          duration: result.duration,
          error: result.error,
          rollbackReason: result.rollbackReason
        },
        metadata: {
          reason,
          executedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Rollback migration failed:', error);

      return Response.json({
        error: 'Failed to rollback migration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(request: Request, env: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const status = url.searchParams.get('status');
      const type = url.searchParams.get('type');

      // Build query
      let query = this.db.select()
        .from(schema.appliedMigrations)
        .orderBy(desc(schema.appliedMigrations.createdAt))
        .limit(limit)
        .offset(offset);

      if (status) {
        query = query.where(eq(schema.appliedMigrations.status, status));
      }

      if (type) {
        query = query.where(eq(schema.appliedMigrations.type, type));
      }

      const migrations = await query;

      // Get total count for pagination
      const totalCount = await this.db.select({ count: count() })
        .from(schema.appliedMigrations);

      return Response.json({
        success: true,
        migrations: migrations.map(migration => ({
          id: migration.id,
          version: migration.version,
          name: migration.name,
          description: migration.description,
          type: migration.type,
          priority: migration.priority,
          status: migration.status,
          duration: migration.duration,
          error: migration.error,
          rollbackReason: migration.rollbackReason,
          dependencies: migration.dependencies ? JSON.parse(migration.dependencies) : [],
          batchId: migration.batchId,
          executedBy: migration.executedBy,
          metadata: migration.metadata ? JSON.parse(migration.metadata) : {},
          createdAt: new Date(migration.createdAt).toISOString(),
          startedAt: migration.startedAt ? new Date(migration.startedAt).toISOString() : null,
          completedAt: migration.completedAt ? new Date(migration.completedAt).toISOString() : null,
          rolledBackAt: migration.rolledBackAt ? new Date(migration.rolledBackAt).toISOString() : null,
          updatedAt: new Date(migration.updatedAt).toISOString()
        })),
        pagination: {
          limit,
          offset,
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Get migration history failed:', error);

      return Response.json({
        error: 'Failed to get migration history',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Get migration batches
   */
  async getMigrationBatches(request: Request, env: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const batches = await this.db.select()
        .from(schema.migrationBatches)
        .orderBy(desc(schema.migrationBatches.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await this.db.select({ count: count() })
        .from(schema.migrationBatches);

      return Response.json({
        success: true,
        batches: batches.map(batch => ({
          id: batch.id,
          migrations: JSON.parse(batch.migrations),
          results: JSON.parse(batch.results),
          backupId: batch.backupId,
          executedBy: batch.executedBy,
          environment: batch.environment,
          duration: batch.duration,
          success: batch.success,
          totalMigrations: batch.totalMigrations,
          successfulMigrations: batch.successfulMigrations,
          failedMigrations: batch.failedMigrations,
          warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
          rollbackAvailable: batch.rollbackAvailable,
          metadata: batch.metadata ? JSON.parse(batch.metadata) : {},
          createdAt: new Date(batch.createdAt).toISOString()
        })),
        pagination: {
          limit,
          offset,
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Get migration batches failed:', error);

      return Response.json({
        error: 'Failed to get migration batches',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Validate database
   */
  async validateDatabase(request: Request, env: any): Promise<Response> {
    try {
      const validation = await this.migrationService.validateDatabase();

      // Get additional health checks
      const healthChecks = await this.db.select()
        .from(schema.migrationHealthChecks)
        .where(eq(schema.migrationHealthChecks.resolved, false))
        .orderBy(desc(schema.migrationHealthChecks.createdAt))
        .limit(10);

      return Response.json({
        success: validation.isValid,
        validation,
        healthChecks: healthChecks.map(check => ({
          id: check.id,
          type: check.checkType,
          status: check.status,
          message: check.message,
          details: check.details ? JSON.parse(check.details) : null,
          severity: check.severity,
          createdAt: new Date(check.createdAt).toISOString()
        })),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Validate database failed:', error);

      return Response.json({
        error: 'Failed to validate database',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Get backup information
   */
  async getBackups(request: Request, env: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const type = url.searchParams.get('type');

      let query = this.db.select()
        .from(schema.databaseBackups)
        .orderBy(desc(schema.databaseBackups.createdAt))
        .limit(limit)
        .offset(offset);

      if (type) {
        query = query.where(eq(schema.databaseBackups.type, type));
      }

      const backups = await query;

      const totalCount = await this.db.select({ count: count() })
        .from(schema.databaseBackups);

      return Response.json({
        success: true,
        backups: backups.map(backup => ({
          id: backup.id,
          type: backup.type,
          location: backup.location,
          size: backup.size,
          checksum: backup.checksum,
          compression: backup.compression,
          encryption: backup.encryption,
          status: backup.status,
          environment: backup.environment,
          createdBy: backup.createdBy,
          metadata: backup.metadata ? JSON.parse(backup.metadata) : {},
          createdAt: new Date(backup.createdAt).toISOString(),
          expiresAt: backup.expiresAt ? new Date(backup.expiresAt).toISOString() : null
        })),
        pagination: {
          limit,
          offset,
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Get backups failed:', error);

      return Response.json({
        error: 'Failed to get backups',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Helper methods
   */
  private async getMigrationStatistics(): Promise<any> {
    // Get migration statistics
    const totalMigrations = await this.db.select({ count: count() })
      .from(schema.appliedMigrations);

    const successfulMigrations = await this.db.select({ count: count() })
      .from(schema.appliedMigrations)
      .where(eq(schema.appliedMigrations.status, 'completed'));

    const failedMigrations = await this.db.select({ count: count() })
      .from(schema.appliedMigrations)
      .where(eq(schema.appliedMigrations.status, 'failed'));

    const recentBatches = await this.db.select()
      .from(schema.migrationBatches)
      .orderBy(desc(schema.migrationBatches.createdAt))
      .limit(5);

    return {
      totalMigrations: totalMigrations[0].count,
      successfulMigrations: successfulMigrations[0].count,
      failedMigrations: failedMigrations[0].count,
      successRate: totalMigrations[0].count > 0
        ? Math.round((successfulMigrations[0].count / totalMigrations[0].count) * 100)
        : 0,
      recentBatches: recentBatches.length,
      lastExecution: recentBatches[0] ? new Date(recentBatches[0].createdAt).toISOString() : null
    };
  }
}

/**
 * Route handlers for the database migration API
 */
export async function handleGetMigrationStatus(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.getMigrationStatus(request, env);
}

export async function handleCreateMigrationPlan(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.createMigrationPlan(request, env);
}

export async function handleExecuteMigrations(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.executeMigrations(request, env);
}

export async function handleRollbackMigration(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.rollbackMigration(request, env);
}

export async function handleGetMigrationHistory(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.getMigrationHistory(request, env);
}

export async function handleGetMigrationBatches(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.getMigrationBatches(request, env);
}

export async function handleValidateDatabase(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.validateDatabase(request, env);
}

export async function handleGetBackups(request: Request, env: any): Promise<Response> {
  const api = new DatabaseMigrationAPI(env.DB);
  return api.getBackups(request, env);
}
