/**
 * Run Command for Questro CLI
 * Execute tests with real-time progress tracking and detailed results
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';

interface RunOptions {
  testId?: string;
  suite?: string;
  parallel?: boolean;
  timeout?: string;
  watch?: boolean;
  failFast?: boolean;
  bail?: boolean;
}

interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface RunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
}

const createRunCommand = (): Command => {
  const runCmd = new Command('run')
    .description('Run tests with real-time progress tracking')
    .alias('r')
    .argument('[test-id]', 'Optional specific test ID to run')
    .option('--suite <name>', 'Run specific test suite by name')
    .option('--parallel', 'Run tests in parallel')
    .option('--timeout <ms>', 'Test timeout in milliseconds', '60000')
    .option('-w, --watch', 'Watch mode - rerun on file changes')
    .option('--fail-fast', 'Stop on first failure')
    .option('--bail', 'Stop on first test failure (alias for fail-fast)')
    .action(async (testId: string | undefined, options: RunOptions) => {
      try {
        const spinner = ora('Initializing test run...').start();

        const runParams = {
          testId: testId || options.testId,
          suite: options.suite,
          parallel: options.parallel,
          timeout: parseInt(options.timeout || '60000'),
          failFast: options.failFast || options.bail,
        };

        spinner.text = 'Starting test execution...';
        const response = await api.post('/api/v1/tests/run', runParams);
        const data = response.data as any;
        const runId = data?.runId;

        if (!runId) {
          throw new Error('Failed to initialize test run');
        }

        let completed = false;
        let summary: RunSummary = {
          totalTests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          results: [],
        };

        while (!completed) {
          const statusResp = await api.get(`/api/v1/tests/run/${runId}/status`);
          summary = (statusResp.data as any) as RunSummary;

          const total = summary.passed + summary.failed + summary.skipped;
          spinner.text = `Running tests... ${total}/${summary.totalTests}`;
          completed = total === summary.totalTests;

          if (!completed) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        spinner.stop();
        displayRunSummary(summary);
        process.exit(summary.failed > 0 ? 1 : 0);
      } catch (error) {
        logger.error('Test run failed:', {}, error as Error);
        process.exit(1);
      }
    });

  return runCmd;
};

function displayRunSummary(summary: RunSummary): void {
  const statusIcon = summary.failed === 0 ? chalk.green('✓') : chalk.red('✗');
  const statusText = summary.failed === 0 ? chalk.green('PASSED') : chalk.red('FAILED');

  const stats = [
    `Total: ${chalk.bold(summary.totalTests)}`,
    `${chalk.green(`Passed: ${summary.passed}`)}`,
    summary.failed > 0 ? chalk.red(`Failed: ${summary.failed}`) : null,
    summary.skipped > 0 ? chalk.yellow(`Skipped: ${summary.skipped}`) : null,
    `Duration: ${(summary.duration / 1000).toFixed(2)}s`,
  ]
    .filter(Boolean)
    .join(' | ');

  console.log(`${statusIcon} ${statusText}\n${stats}`);

  if (summary.failed > 0) {
    console.log(chalk.red('\nFailed Tests:'));
    summary.results
      .filter((r) => r.status === 'failed')
      .forEach((result) => {
        console.log(`  ${chalk.red('✗')} ${result.testName}`);
      });
  }
}

export const runCommand = createRunCommand();
