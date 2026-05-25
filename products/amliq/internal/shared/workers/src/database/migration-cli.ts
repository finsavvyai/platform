/**
 * Database Migration CLI
 * Command-line interface for running database migrations
 */

import { MigrationRunner, type MigrationConfig } from './migration-runner';

export interface CLICommand {
  command: string;
  options: Record<string, any>;
}

export class MigrationCLI {
  private env: any;
  private runner: MigrationRunner;

  constructor(env: any) {
    this.env = env;
    this.runner = new MigrationRunner(env);
  }

  /**
   * Execute CLI command
   */
  async execute(command: CLICommand): Promise<{
    success: boolean;
    output: string;
    data?: any;
  }> {
    try {
      switch (command.command) {
        case 'run':
          return await this.runMigrations(command.options);
        case 'status':
          return await this.checkStatus(command.options);
        case 'validate':
          return await this.validateDatabases(command.options);
        case 'history':
          return await this.getHistory(command.options);
        case 'rollback':
          return await this.rollback(command.options);
        default:
          return {
            success: false,
            output: `Unknown command: ${command.command}`
          };
      }
    } catch (error) {
      return {
        success: false,
        output: `Command execution failed: ${error.message}`
      };
    }
  }

  /**
   * Run migrations command
   */
  private async runMigrations(options: {
    products?: string;
    regions?: string;
    dryRun?: boolean;
    verbose?: boolean;
    config?: Partial<MigrationConfig>;
  }): Promise<{ success: boolean; output: string; data?: any }> {
    const {
      products,
      regions,
      dryRun = false,
      verbose = false,
      config = {}
    } = options;

    // Parse products and regions
    const productArray = products ? products.split(',').map(p => p.trim()) : undefined;
    const regionArray = regions ? regions.split(',').map(r => r.trim()) : undefined;

    // Create runner with config
    const runner = new MigrationRunner(this.env, {
      ...config,
      dryRun,
      verboseLogging: verbose
    });

    // Run migrations
    const report = await runner.runAllMigrations({
      products: productArray,
      regions: regionArray as any
    });

    return {
      success: report.status === 'success',
      output: this.formatMigrationReport(report),
      data: report
    };
  }

  /**
   * Check migration status
   */
  private async checkStatus(options: {
    product?: string;
    region?: string;
    format?: 'json' | 'table';
  }): Promise<{ success: boolean; output: string; data?: any }> {
    const { product, region, format = 'table' } = options;

    const status = await this.runner.getMigrationStatus(product, region as any);

    return {
      success: true,
      output: this.formatStatusReport(status, format),
      data: status
    };
  }

  /**
   * Validate databases
   */
  private async validateDatabases(options: {
    product?: string;
    region?: string;
    format?: 'json' | 'table';
  }): Promise<{ success: boolean; output: string; data?: any }> {
    const { product, region, format = 'table' } = options;

    const validation = await this.runner.validateDatabases(product, region as any);

    return {
      success: validation.overall !== 'invalid',
      output: this.formatValidationReport(validation, format),
      data: validation
    };
  }

  /**
   * Get migration history
   */
  private async getHistory(options: {
    executionId?: string;
    limit?: number;
    format?: 'json' | 'table';
  }): Promise<{ success: boolean; output: string; data?: any }> {
    const { executionId, limit, format = 'table' } = options;

    let history = this.runner.getMigrationHistory(executionId);

    if (limit && limit > 0) {
      history = history.slice(0, limit);
    }

    return {
      success: true,
      output: this.formatHistoryReport(history, format),
      data: history
    };
  }

  /**
   * Rollback command (placeholder - would need implementation)
   */
  private async rollback(options: {
    executionId: string;
    confirm?: boolean;
  }): Promise<{ success: boolean; output: string }> {
    const { executionId, confirm = false } = options;

    if (!confirm) {
      return {
        success: false,
        output: 'Rollback requires confirmation. Use confirm: true option.'
      };
    }

    // This would implement rollback functionality
    return {
      success: false,
      output: 'Rollback functionality not yet implemented.'
    };
  }

  /**
   * Format migration report for display
   */
  private formatMigrationReport(report: any): string {
    const lines = [
      `Migration Execution Report`,
      `=========================`,
      `Execution ID: ${report.executionId}`,
      `Status: ${report.status.toUpperCase()}`,
      `Total Migrations: ${report.totalMigrations}`,
      `Completed: ${report.completedMigrations}`,
      `Failed: ${report.failedMigrations}`,
      `Skipped: ${report.skippedMigrations}`,
      `Execution Time: ${report.totalExecutionTime}ms`,
      '',
      `Summary: ${report.summary}`,
      ''
    ];

    if (report.migrations.length > 0) {
      lines.push('Migration Details:');
      lines.push('-------------------');

      for (const migration of report.migrations) {
        const statusIcon = this.getStatusIcon(migration.status);
        lines.push(`${statusIcon} ${migration.filename} (${migration.product}/${migration.region})`);

        if (migration.error) {
          lines.push(`   Error: ${migration.error}`);
        }

        if (migration.executionTime) {
          lines.push(`   Time: ${migration.executionTime}ms`);
        }

        if (migration.affectedRows !== undefined) {
          lines.push(`   Rows: ${migration.affectedRows}`);
        }

        lines.push('');
      }
    }

    if (report.aiRecommendations.length > 0) {
      lines.push('AI Recommendations:');
      lines.push('-------------------');
      for (const rec of report.aiRecommendations) {
        lines.push(`• ${rec}`);
      }
      lines.push('');
    }

    if (report.nextActions.length > 0) {
      lines.push('Next Actions:');
      lines.push('-------------');
      for (const action of report.nextActions) {
        lines.push(`• ${action}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format status report
   */
  private formatStatusReport(status: any, format: string): string {
    if (format === 'json') {
      return JSON.stringify(status, null, 2);
    }

    const lines = [
      `Migration Status Report`,
      `======================`,
      `Overall Status: ${status.overallStatus.toUpperCase()}`,
      ''
    ];

    for (const [product, regions] of Object.entries(status.products)) {
      lines.push(`${product.toUpperCase()}:`);

      for (const [region, info] of Object.entries(regions as any)) {
        const statusIcon = this.getStatusIcon(info.healthStatus);
        lines.push(`  ${region}: ${statusIcon} ${info.healthStatus.toUpperCase()}`);
        lines.push(`    Applied: ${info.appliedMigrations.length} migrations`);
        lines.push(`    Pending: ${info.pendingMigrations.length} migrations`);

        if (info.lastMigration) {
          lines.push(`    Last: v${info.lastMigration}`);
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format validation report
   */
  private formatValidationReport(validation: any, format: string): string {
    if (format === 'json') {
      return JSON.stringify(validation, null, 2);
    }

    const lines = [
      `Database Validation Report`,
      `=========================`,
      `Overall Status: ${validation.overall.toUpperCase()}`,
      ''
    ];

    for (const [product, regions] of Object.entries(validation.details)) {
      lines.push(`${product.toUpperCase()}:`);

      for (const [region, info] of Object.entries(regions as any)) {
        const statusIcon = this.getStatusIcon(info.validity);
        lines.push(`  ${region}: ${statusIcon} ${info.validity.toUpperCase()}`);
        lines.push(`    Accessible: ${info.accessible ? 'Yes' : 'No'}`);
        lines.push(`    Tables: ${info.tables.length}`);

        if (info.issues.length > 0) {
          lines.push(`    Issues:`);
          for (const issue of info.issues) {
            lines.push(`      - ${issue}`);
          }
        }

        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Format history report
   */
  private formatHistoryReport(history: any[], format: string): string {
    if (format === 'json') {
      return JSON.stringify(history, null, 2);
    }

    if (history.length === 0) {
      return 'No migration history found.';
    }

    const lines = [
      `Migration History`,
      `==================`,
      `Showing ${history.length} executions`,
      ''
    ];

    for (const execution of history) {
      const statusIcon = this.getStatusIcon(execution.status);
      lines.push(`${statusIcon} ${execution.filename} (${execution.product}/${execution.region})`);
      lines.push(`   Version: ${execution.version}`);
      lines.push(`   Status: ${execution.status}`);
      lines.push(`   Started: ${execution.startedAt}`);

      if (execution.completedAt) {
        lines.push(`   Completed: ${execution.completedAt}`);
      }

      if (execution.executionTime) {
        lines.push(`   Duration: ${execution.executionTime}ms`);
      }

      if (execution.error) {
        lines.push(`   Error: ${execution.error}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get status icon for display
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
      case 'healthy':
      case 'valid':
        return '✅';
      case 'failed':
      case 'error':
      case 'invalid':
        return '❌';
      case 'pending':
      case 'needs_migration':
      case 'warning':
        return '⚠️';
      case 'running':
        return '🔄';
      case 'rolled_back':
        return '⏪';
      default:
        return '❓';
    }
  }
}