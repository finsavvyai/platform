/**
 * Display Utilities for Questro CLI
 * Pretty-printing and formatted output helpers
 */

import chalk from 'chalk';

export interface StatusIndicator {
  icon: string;
  color: (text: string) => string;
}

export const StatusIndicators = {
  success: { icon: '✓', color: chalk.green },
  error: { icon: '✗', color: chalk.red },
  warning: { icon: '⚠', color: chalk.yellow },
  info: { icon: 'ℹ', color: chalk.blue },
  pending: { icon: '⟳', color: chalk.cyan },
  skip: { icon: '○', color: chalk.gray },
};

/**
 * Display a formatted status line with icon
 */
export function displayStatus(indicator: StatusIndicator, message: string): void {
  console.log(`${indicator.color(indicator.icon)} ${message}`);
}

/**
 * Format duration for display
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(2)}s`;
  return `${(milliseconds / 60000).toFixed(2)}m`;
}

/**
 * Format percentage with color
 */
export function formatPercentage(
  value: number,
  goodThreshold: number = 0.8,
  excellentThreshold: number = 0.95
): string {
  const percentage = (value * 100).toFixed(1);

  if (value >= excellentThreshold) return chalk.green(`${percentage}%`);
  if (value >= goodThreshold) return chalk.yellow(`${percentage}%`);
  return chalk.red(`${percentage}%`);
}

/**
 * Format a test result with colored status
 */
export function formatTestResult(
  name: string,
  status: 'passed' | 'failed' | 'skipped'
): string {
  const indicators: Record<string, StatusIndicator> = {
    passed: StatusIndicators.success,
    failed: StatusIndicators.error,
    skipped: StatusIndicators.skip,
  };

  const indicator = indicators[status];
  if (!indicator) return name;
  return `${indicator.color(indicator.icon)} ${name}`;
}

/**
 * Display a diff between two values
 */
export function displayDiff(
  original: string,
  modified: string,
  maxLines: number = 5
): void {
  const origLines = original.split('\n').slice(0, maxLines);
  const modLines = modified.split('\n').slice(0, maxLines);

  console.log(chalk.bold('Changes:'));
  origLines.forEach((line) => console.log(chalk.red(`- ${line}`)));
  modLines.forEach((line) => console.log(chalk.green(`+ ${line}`)));
}
