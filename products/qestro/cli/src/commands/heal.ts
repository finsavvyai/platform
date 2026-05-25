/**
 * Heal Command for Questro CLI
 * Auto-repair failing tests using AI-powered self-healing
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';

interface HealOptions {
  runId?: string;
  testId?: string;
  interactive?: boolean;
  auto?: boolean;
}

interface HealSuggestion {
  testId: string;
  testName: string;
  failureType: string;
  originalAssertion: string;
  suggestedAssertion: string;
  confidence: number;
  explanation: string;
}

const createHealCommand = (): Command => {
  const healCmd = new Command('heal')
    .description('Auto-repair failing tests using AI self-healing')
    .alias('h')
    .option('--run-id <id>', 'Heal failures from a specific test run')
    .option('--test-id <id>', 'Heal a specific test')
    .option('-i, --interactive', 'Interactive mode - approve each fix individually')
    .option('-a, --auto', 'Auto-apply high-confidence fixes')
    .action(async (options: HealOptions) => {
      try {
        if (!options.runId && !options.testId) {
          logger.error('Provide --run-id or --test-id');
          process.exit(1);
        }

        const spinner = ora('Analyzing failures...').start();

        const response = await api.post('/api/v1/tests/heal/suggestions', {
          runId: options.runId,
          testId: options.testId,
        });

        const data = response.data as any;
        const suggestions: HealSuggestion[] = data?.suggestions || [];

        if (suggestions.length === 0) {
          spinner.succeed('No failing tests found - all tests passed!');
          return;
        }

        spinner.succeed(`Found ${suggestions.length} potential fixes`);

        let applied = 0;
        const suggestionsData = suggestions as any[];
        for (const suggestion of suggestionsData) {
          let shouldApply = false;

          if (options.auto && suggestion.confidence >= 0.8) {
            shouldApply = true;
          } else if (options.interactive) {
            const answer = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'approve',
                message: `Apply fix to ${suggestion.testName}? (${(suggestion.confidence * 100).toFixed(0)}% confidence)`,
                default: suggestion.confidence >= 0.9,
              },
            ]) as any;
            shouldApply = answer.approve;
          }

          if (shouldApply) {
            try {
              await api.post(`/api/v1/tests/${suggestion.testId}/heal`, {
                suggestedAssertion: suggestion.suggestedAssertion,
              });
              logger.info(`Applied fix to ${suggestion.testName}`);
              applied++;
            } catch (err) {
              logger.error(`Failed to apply fix to ${suggestion.testName}:`, {}, err as Error);
            }
          }
        }

        console.log(chalk.green(`\nHealing complete: ${applied}/${suggestions.length} fixes applied`));
      } catch (error) {
        logger.error('Healing failed:', {}, error as Error);
        process.exit(1);
      }
    });

  return healCmd;
};

export const healCommand = createHealCommand();
