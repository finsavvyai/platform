/**
 * Status Command for Questro CLI
 * Display project health, test statistics, and analytics
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';

interface ProjectStatus {
  projectId: string;
  projectName: string;
  testCount: number;
  passRate: number;
  failRate: number;
  lastRunAt: string;
  lastRunStatus: 'passed' | 'failed' | 'running';
  flakyTests: Array<{
    testId: string;
    testName: string;
    failureRate: number;
  }>;
  slowestTests: Array<{
    testId: string;
    testName: string;
    avgDuration: number;
  }>;
  executionStats: {
    totalRuns: number;
    avgDuration: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
  };
}

const createStatusCommand = (): Command => {
  const statusCmd = new Command('status')
    .description('Display project health and test analytics')
    .alias('st')
    .alias('s')
    .option('--json', 'Output as JSON')
    .option('--full', 'Show detailed statistics')
    .action(async (options: any) => {
      try {
        const spinner = ora('Fetching project status...').start();

        const response = await api.get('/api/v1/projects/status');
        const status: ProjectStatus = (response.data as any) as ProjectStatus;

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          displayStatusDashboard(status, options.full);
        }
      } catch (error) {
        logger.error('Failed to fetch status:', {}, error as Error);
        process.exit(1);
      }
    });

  return statusCmd;
};

function displayStatusDashboard(
  status: ProjectStatus,
  full?: boolean
): void {
  // Header
  console.log(chalk.bold(`\n${status.projectName}`));
  console.log(chalk.gray(status.projectId));

  // Health Summary
  displayHealthSummary(status);

  // Execution Statistics
  displayExecutionStats(status.executionStats);

  if (full) {
    // Flaky Tests
    if (status.flakyTests.length > 0) {
      displayFlakyTests(status.flakyTests);
    }

    // Slowest Tests
    if (status.slowestTests.length > 0) {
      displaySlowestTests(status.slowestTests);
    }
  }
}

function displayHealthSummary(status: ProjectStatus): void {
  const passColor = status.passRate >= 0.9 ? 'green' : status.passRate >= 0.7 ? 'yellow' : 'red';
  const passIcon = status.passRate >= 0.9 ? '✓' : status.passRate >= 0.7 ? '⚠' : '✗';
  const colorMap: Record<string, (str: string) => string> = {
    green: chalk.green,
    yellow: chalk.yellow,
    red: chalk.red,
  };
  const colorFn = colorMap[passColor] || chalk.gray;

  const summary = [
    chalk.bold('Health Metrics:'),
    `  Tests: ${status.testCount}`,
    `  Pass Rate: ${colorFn(`${passIcon} ${(status.passRate * 100).toFixed(1)}%`)}`,
    `  Fail Rate: ${chalk.red(`${(status.failRate * 100).toFixed(1)}%`)}`,
    `  Last Run: ${formatDate(status.lastRunAt)}`,
    `  Last Result: ${getStatusBadge(status.lastRunStatus)}`,
  ];

  console.log(summary.join('\n'));
  console.log();
}

function displayExecutionStats(stats: ProjectStatus['executionStats']): void {
  console.log(chalk.cyan('Execution Statistics:'));
  console.log(`  Total Runs: ${stats.totalRuns}`);
  console.log(`  Total Tests: ${stats.totalTests}`);
  console.log(`  Passed: ${chalk.green(stats.totalPassed.toString())}`);
  console.log(`  Failed: ${chalk.red(stats.totalFailed.toString())}`);
  console.log(`  Avg Duration: ${(stats.avgDuration / 1000).toFixed(2)}s`);
  console.log();
}

function displayFlakyTests(flakyTests: ProjectStatus['flakyTests']): void {
  if (flakyTests.length === 0) return;

  console.log(chalk.yellow(`Flaky Tests (${flakyTests.length}):`));
  flakyTests.slice(0, 5).forEach((test) => {
    console.log(`  ${test.testName}: ${(test.failureRate * 100).toFixed(1)}%`);
  });
  console.log();
}

function displaySlowestTests(slowestTests: ProjectStatus['slowestTests']): void {
  if (slowestTests.length === 0) return;

  console.log(chalk.magenta(`Slowest Tests (${slowestTests.length}):`));
  slowestTests.slice(0, 5).forEach((test) => {
    console.log(`  ${test.testName}: ${(test.avgDuration / 1000).toFixed(2)}s`);
  });
  console.log();
}

function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    passed: chalk.green('✓ Passed'),
    failed: chalk.red('✗ Failed'),
    running: chalk.yellow('⟳ Running'),
  };
  return badges[status] || status;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  } catch {
    return dateStr;
  }
}

export const statusCommand = createStatusCommand();
