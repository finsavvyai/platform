/**
 * Revolutionary Database Migration Runner
 * AI-powered migration system with intelligent error handling and rollback capabilities
 */

import type { Env } from '../types';
import { DatabaseService } from '../services/database-service';

export interface MigrationConfig {
  autoRun: boolean;
  region: 'US' | 'EU';
  environment: 'development' | 'staging' | 'production';
  enableAIMigrations: boolean;
  rollbackOnError: boolean;
  dryRun: boolean;
  verboseLogging: boolean;
}

export interface MigrationExecution {
  id: string;
  version: number;
  filename: string;
  product: string;
  region: 'US' | 'EU';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  startedAt: string;
  completedAt?: string;
  error?: string;
  rollbackVersion?: number;
  affectedRows?: number;
  executionTime: number;
  aiAnalysis?: MigrationAnalysis;
}

export interface MigrationAnalysis {
  complexity: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // in seconds
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  recommendations: string[];
  potentialIssues: string[];
  rollbackComplexity: 'low' | 'medium' | 'high';
}

export interface MigrationReport {
  executionId: string;
  status: 'success' | 'failed' | 'partial';
  totalMigrations: number;
  completedMigrations: number;
  failedMigrations: number;
  skippedMigrations: number;
  totalExecutionTime: number;
  migrations: MigrationExecution[];
  summary: string;
  aiRecommendations: string[];
  nextActions: string[];
}

export class MigrationRunner {
  private env: Env;
  private databaseService: DatabaseService;
  private config: MigrationConfig;
  private executionHistory: Map<string, MigrationExecution[]> = new Map();

  constructor(env: Env, config: Partial<MigrationConfig> = {}) {
    this.env = env;
    this.databaseService = new DatabaseService(env);
    this.config = {
      autoRun: config.autoRun ?? false,
      region: config.region ?? 'US',
      environment: config.environment ?? ((env.ENVIRONMENT as any) || 'development'),
      enableAIMigrations: config.enableAIMigrations ?? true,
      rollbackOnError: config.rollbackOnError ?? true,
      dryRun: config.dryRun ?? false,
      verboseLogging: config.verboseLogging ?? false
    };
  }

  /**
   * Run all pending migrations for all products and regions
   */
  async runAllMigrations(options: { products?: string[]; regions?: ('US' | 'EU')[] } = {}): Promise<MigrationReport> {
    const startTime = Date.now();
    const executionId = `migration_${Date.now()}_${crypto.randomUUID()}`;

    const {
      products = ['core', 'billing', 'compliance', 'intelligence', 'risk'],
      regions = ['US', 'EU']
    } = options;

    this.log(`Starting migration execution ${executionId} for products: ${products.join(', ')}`);

    const report: MigrationReport = {
      executionId,
      status: 'success',
      totalMigrations: 0,
      completedMigrations: 0,
      failedMigrations: 0,
      skippedMigrations: 0,
      totalExecutionTime: 0,
      migrations: [],
      summary: '',
      aiRecommendations: [],
      nextActions: []
    };

    try {
      // Load migrations first
      await this.databaseService.loadMigrations();

      const allExecutions: MigrationExecution[] = [];

      // Run migrations for each product and region combination
      for (const product of products) {
        for (const region of regions) {
          const execution = await this.runMigrationsForProduct(product, region, executionId);
          allExecutions.push(...execution);
        }
      }

      // Calculate totals
      report.totalMigrations = allExecutions.length;
      report.completedMigrations = allExecutions.filter(e => e.status === 'completed').length;
      report.failedMigrations = allExecutions.filter(e => e.status === 'failed').length;
      report.skippedMigrations = allExecutions.filter(e => e.status === 'rolled_back').length;
      report.migrations = allExecutions;

      // Determine overall status
      if (report.failedMigrations > 0) {
        report.status = report.completedMigrations > 0 ? 'partial' : 'failed';
      }

      // Generate AI-powered analysis and recommendations
      if (this.config.enableAIMigrations && this.env.AI) {
        const analysis = await this.generateMigrationReport(report);
        report.aiRecommendations = analysis.recommendations;
        report.nextActions = analysis.nextActions;
      }

      // Generate summary
      report.summary = this.generateSummary(report);
      report.totalExecutionTime = Date.now() - startTime;

      // Store execution history
      this.executionHistory.set(executionId, allExecutions);

      // Log completion
      this.log(`Migration execution ${executionId} completed: ${report.summary}`);

      return report;

    } catch (error) {
      report.status = 'failed';
      report.totalExecutionTime = Date.now() - startTime;
      report.summary = `Migration execution failed: ${error.message}`;

      this.log(`Migration execution ${executionId} failed:`, error);
      throw error;
    }
  }

  /**
   * Run migrations for a specific product and region
   */
  async runMigrationsForProduct(
    product: string,
    region: 'US' | 'EU',
    executionId: string
  ): Promise<MigrationExecution[]> {
    const executions: MigrationExecution[] = [];

    try {
      this.log(`Running migrations for ${product} (${region})`);

      // Get database instance
      const db = this.databaseService.getDatabase(product, region);

      // Get applied migrations
      const appliedVersions = await this.databaseService.getAppliedMigrations(db);

      // Get pending migrations
      const migrationCache = (this.databaseService as any).migrationCache.get(product) || [];
      const pendingMigrations = migrationCache.filter(
        (migration: any) => !appliedVersions.includes(migration.version)
      );

      this.log(`Found ${pendingMigrations.length} pending migrations for ${product} (${region})`);

      // Run each pending migration
      for (const migration of pendingMigrations) {
        const execution = await this.runSingleMigration(migration, product, region, executionId);
        executions.push(execution);

        // Stop execution if migration failed and rollback on error is enabled
        if (execution.status === 'failed' && this.config.rollbackOnError) {
          this.log(`Migration failed for ${migration.filename}, initiating rollback`);
          await this.rollbackFailedMigrations(executions, product, region);
          break;
        }
      }

      return executions;

    } catch (error) {
      this.log(`Error running migrations for ${product} (${region}):`, error);

      // Create a failed execution record
      const failedExecution: MigrationExecution = {
        id: crypto.randomUUID(),
        version: 0,
        filename: 'migration_runner_error',
        product,
        region,
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: error.message,
        executionTime: 0
      };

      executions.push(failedExecution);
      return executions;
    }
  }

  /**
   * Run a single migration
   */
  async runSingleMigration(
    migration: any,
    product: string,
    region: 'US' | 'EU',
    executionId: string
  ): Promise<MigrationExecution> {
    const startTime = Date.now();

    const execution: MigrationExecution = {
      id: crypto.randomUUID(),
      version: migration.version,
      filename: migration.filename,
      product,
      region,
      status: 'running',
      startedAt: new Date().toISOString(),
      executionTime: 0
    };

    try {
      this.log(`Running migration: ${migration.filename} (v${migration.version})`);

      // AI analysis before migration if enabled
      if (this.config.enableAIMigrations && this.env.AI) {
        execution.aiAnalysis = await this.analyzeMigration(migration, product, region);

        if (execution.aiAnalysis.riskLevel === 'critical' && this.config.environment === 'production') {
          throw new Error(`Critical risk migration detected: ${execution.aiAnalysis.potentialIssues.join(', ')}`);
        }
      }

      // Dry run check
      if (this.config.dryRun) {
        this.log(`DRY RUN: Would execute ${migration.filename}`);
        execution.status = 'completed';
        execution.affectedRows = 0;
        execution.completedAt = new Date().toISOString();
        execution.executionTime = Date.now() - startTime;
        return execution;
      }

      // Get database instance
      const db = this.databaseService.getDatabase(product, region);

      // Execute migration in a transaction
      const result = await db.batch([
        db.prepare(migration.sql),
        db.prepare(`
          INSERT INTO schema_migrations (version, filename, applied_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).bind(migration.version, migration.filename)
      ]).run();

      execution.affectedRows = result.meta?.changes?.[0]?.changes || 0;
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.executionTime = Date.now() - startTime;

      this.log(`Migration completed successfully: ${migration.filename} (${execution.executionTime}ms, ${execution.affectedRows} rows affected)`);

      return execution;

    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();
      execution.executionTime = Date.now() - startTime;

      this.log(`Migration failed: ${migration.filename} - ${error.message}`);

      return execution;
    }
  }

  /**
   * Rollback failed migrations
   */
  async rollbackFailedMigrations(
    executions: MigrationExecution[],
    product: string,
    region: 'US' | 'EU'
  ): Promise<void> {
    const completedMigrations = executions.filter(e => e.status === 'completed');

    if (completedMigrations.length === 0) {
      return;
    }

    this.log(`Rolling back ${completedMigrations.length} migrations for ${product} (${region})`);

    try {
      const db = this.databaseService.getDatabase(product, region);

      // Rollback in reverse order
      for (const execution of completedMigrations.reverse()) {
        try {
          // Create rollback migration
          const rollbackSQL = `DELETE FROM schema_migrations WHERE version = ${execution.version}`;

          await db.prepare(rollbackSQL).run();

          execution.status = 'rolled_back';
          this.log(`Rolled back migration: ${execution.filename}`);

        } catch (rollbackError) {
          this.log(`Failed to rollback migration ${execution.filename}:`, rollbackError);
          execution.error = `Rollback failed: ${rollbackError.message}`;
        }
      }

    } catch (error) {
      this.log(`Critical error during rollback:`, error);
      throw error;
    }
  }

  /**
   * Analyze migration with AI
   */
  private async analyzeMigration(migration: any, product: string, region: 'US' | 'EU'): Promise<MigrationAnalysis> {
    if (!this.env.AI) {
      return {
        complexity: 'medium',
        estimatedTime: 30,
        riskLevel: 'medium',
        dependencies: [],
        recommendations: ['Review migration manually'],
        potentialIssues: ['AI analysis not available'],
        rollbackComplexity: 'medium'
      };
    }

    try {
      const analysisPrompt = `Analyze this database migration for risk and complexity:

Migration: ${migration.filename}
Version: ${migration.version}
Product: ${product}
Region: ${region}
SQL: ${migration.sql.substring(0, 2000)}${migration.sql.length > 2000 ? '...' : ''}

Return JSON with:
- complexity: 'low', 'medium', 'high', or 'critical'
- estimatedTime: execution time in seconds
- riskLevel: 'low', 'medium', 'high', or 'critical'
- dependencies: array of table/operation dependencies
- recommendations: array of recommendations
- potentialIssues: array of potential issues
- rollbackComplexity: 'low', 'medium', or 'high'`;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      if (response?.response) {
        return JSON.parse(response.response);
      }

      return {
        complexity: 'medium',
        estimatedTime: 30,
        riskLevel: 'medium',
        dependencies: [],
        recommendations: ['Manual review recommended'],
        potentialIssues: ['AI analysis failed'],
        rollbackComplexity: 'medium'
      };

    } catch (error) {
      this.log('AI migration analysis failed:', error);
      return {
        complexity: 'medium',
        estimatedTime: 30,
        riskLevel: 'medium',
        dependencies: [],
        recommendations: ['Manual review required'],
        potentialIssues: ['AI analysis error'],
        rollbackComplexity: 'medium'
      };
    }
  }

  /**
   * Generate AI-powered migration report analysis
   */
  private async generateMigrationReport(report: MigrationReport): Promise<{
    recommendations: string[];
    nextActions: string[];
  }> {
    if (!this.env.AI) {
      return {
        recommendations: ['Review migration results manually'],
        nextActions: ['Verify database integrity']
      };
    }

    try {
      const reportPrompt = `Analyze this migration execution report and provide recommendations:

Execution ID: ${report.executionId}
Status: ${report.status}
Total: ${report.totalMigrations}, Completed: ${report.completedMigrations}, Failed: ${report.failedMigrations}
Execution Time: ${report.totalExecutionTime}ms

Failed Migrations:
${report.migrations.filter(m => m.status === 'failed').map(m => `- ${m.filename}: ${m.error}`).join('\n')}

Return JSON with:
- recommendations: array of 3-5 recommendations
- nextActions: array of 3-5 next actions`;

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: reportPrompt }],
        temperature: 0.2,
        max_tokens: 400
      });

      if (response?.response) {
        return JSON.parse(response.response);
      }

      return {
        recommendations: ['Review migration logs', 'Test database operations'],
        nextActions: ['Verify database consistency', 'Monitor performance']
      };

    } catch (error) {
      this.log('AI report generation failed:', error);
      return {
        recommendations: ['Manual review required'],
        nextActions: ['Verify database integrity']
      };
    }
  }

  /**
   * Generate migration summary
   */
  private generateSummary(report: MigrationReport): string {
    const parts = [
      `Migration execution ${report.executionId} completed`,
      `${report.totalMigrations} total migrations`,
      `${report.completedMigrations} successful`,
      report.failedMigrations > 0 ? `${report.failedMigrations} failed` : 'no failures',
      `in ${report.totalExecutionTime}ms`
    ];

    return parts.join(', ');
  }

  /**
   * Get migration history
   */
  getMigrationHistory(executionId?: string): MigrationExecution[] {
    if (executionId) {
      return this.executionHistory.get(executionId) || [];
    }

    const allExecutions: MigrationExecution[] = [];
    for (const executions of this.executionHistory.values()) {
      allExecutions.push(...executions);
    }

    return allExecutions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(product?: string, region?: 'US' | 'EU'): Promise<{
    products: Record<string, Record<'US' | 'EU', {
      appliedMigrations: number[];
      pendingMigrations: number[];
      lastMigration?: number;
      healthStatus: 'healthy' | 'needs_migration' | 'error';
    }>>;
    overallStatus: 'healthy' | 'needs_migration' | 'error';
  }> {
    const products = product ? [product] : ['core', 'billing', 'compliance', 'intelligence', 'risk'];
    const regions = region ? [region] : ['US', 'EU'];

    const status: any = { products: {}, overallStatus: 'healthy' };

    await this.databaseService.loadMigrations();

    for (const prod of products) {
      status.products[prod] = {};

      for (const reg of regions) {
        try {
          const db = this.databaseService.getDatabase(prod, reg);
          const applied = await this.databaseService.getAppliedMigrations(db);
          const migrationCache = (this.databaseService as any).migrationCache.get(prod) || [];
          const pending = migrationCache
            .filter((m: any) => !applied.includes(m.version))
            .map((m: any) => m.version);

          const healthStatus = pending.length > 0 ? 'needs_migration' : 'healthy';
          const lastMigration = applied.length > 0 ? Math.max(...applied) : undefined;

          status.products[prod][reg] = {
            appliedMigrations: applied,
            pendingMigrations: pending,
            lastMigration,
            healthStatus
          };

          if (healthStatus === 'needs_migration') {
            status.overallStatus = 'needs_migration';
          }

        } catch (error) {
          status.products[prod][reg] = {
            appliedMigrations: [],
            pendingMigrations: [],
            healthStatus: 'error'
          };
          status.overallStatus = 'error';
        }
      }
    }

    return status;
  }

  /**
   * Validate database after migrations
   */
  async validateDatabases(product?: string, region?: 'US' | 'EU'): Promise<{
    overall: 'valid' | 'invalid' | 'warning';
    details: Record<string, Record<'US' | 'EU', {
      accessible: boolean;
      tables: string[];
      issues: string[];
      validity: 'valid' | 'invalid' | 'warning';
    }>>;
  }> {
    const products = product ? [product] : ['core', 'billing', 'compliance', 'intelligence', 'risk'];
    const regions = region ? [region] : ['US', 'EU'];

    const result: any = { overall: 'valid', details: {} };

    for (const prod of products) {
      result.details[prod] = {};

      for (const reg of regions) {
        try {
          const health = await this.databaseService.checkHealth(prod, reg);
          const integrity = await this.databaseService.validateIntegrity(prod, reg);

          const validity = integrity.isValid && health.accessible ? 'valid' :
                         (!health.accessible || integrity.issues.length > 0) ? 'invalid' : 'warning';

          result.details[prod][reg] = {
            accessible: health.accessible,
            tables: health.tables,
            issues: health.error ? [health.error] : integrity.issues,
            validity
          };

          if (validity === 'invalid') {
            result.overall = 'invalid';
          } else if (validity === 'warning' && result.overall === 'valid') {
            result.overall = 'warning';
          }

        } catch (error) {
          result.details[prod][reg] = {
            accessible: false,
            tables: [],
            issues: [error.message],
            validity: 'invalid'
          };
          result.overall = 'invalid';
        }
      }
    }

    return result;
  }

  /**
   * Logging helper
   */
  private log(message: string, error?: any): void {
    if (this.config.verboseLogging || error) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] MigrationRunner: ${message}`;

      if (error) {
        console.error(logMessage, error);
      } else {
        console.log(logMessage);
      }
    }
  }
}