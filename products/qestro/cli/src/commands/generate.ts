/**
 * Generate Command for Questro CLI
 * LLM-driven test generation from URL, description, or OpenAPI spec
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';

interface GenerateOptions {
  url?: string;
  description?: string;
  api?: string;
  output?: string;
  framework?: string;
  type?: string;
  interactive?: boolean;
}

interface GeneratedTest {
  name: string;
  framework: string;
  testType: string;
  code: string;
  assertions: string[];
  fileName: string;
}

const createGenerateCommand = (): Command => {
  const generateCmd = new Command('generate')
    .description('Generate tests using AI from URL, description, or OpenAPI spec')
    .alias('gen')
    .alias('g')
    .option('--url <url>', 'URL to generate tests for')
    .option('--description <desc>', 'Natural language test description')
    .option('--api <spec>', 'OpenAPI spec URL or file path')
    .option('--output <path>', 'Output directory for generated tests', './tests')
    .option('--framework <fw>', 'Test framework (playwright|cypress)', 'playwright')
    .option('--type <type>', 'Test type (e2e|api|visual)', 'e2e')
    .option('-i, --interactive', 'Interactive mode with prompts')
    .action(async (options: GenerateOptions) => {
      try {
        if (!options.url && !options.description && !options.api && !options.interactive) {
          logger.error('Provide --url, --description, --api, or use --interactive mode');
          process.exit(1);
        }

        let inputs = { ...options };
        if (options.interactive) {
          inputs = await gatherInputs(inputs);
        }

        if (!inputs.url && !inputs.description && !inputs.api) {
          logger.error('Must provide at least one source: --url, --description, or --api');
          process.exit(1);
        }

        const spinner = ora('Generating tests with AI...').start();

        const tests = await generateTests({
          url: inputs.url,
          description: inputs.description,
          api: inputs.api,
          framework: inputs.framework || 'playwright',
          type: inputs.type || 'e2e',
        } as any);

        spinner.succeed(`Generated ${tests.length} test(s)`);

        const outputDir = inputs.output || './tests';
        mkdirSync(outputDir, { recursive: true });

        const filesData = tests as any;
        for (const test of filesData) {
          const filePath = join(outputDir, test.fileName);
          writeFileSync(filePath, test.code);
          logger.success(`Saved: ${chalk.cyan(filePath)}`);
        }

        logger.info(chalk.green(`Next: Run ${chalk.cyan('qestro run')} to execute tests`));
      } catch (error) {
        logger.error('Failed to generate tests:', {}, error as Error);
        process.exit(1);
      }
    });

  return generateCmd;
};

async function gatherInputs(defaults: Partial<GenerateOptions>): Promise<GenerateOptions> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'source',
      message: 'What is your test source?',
      choices: [
        { name: 'Website URL', value: 'url' },
        { name: 'Natural language description', value: 'description' },
        { name: 'OpenAPI spec', value: 'api' },
      ],
    },
    {
      type: 'input',
      name: 'url',
      message: 'Enter website URL:',
      when: (ans: any) => ans.source === 'url',
      validate: (input: string) => input.startsWith('http') || 'Must be valid URL',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Describe the test in natural language:',
      when: (ans: any) => ans.source === 'description',
    },
    {
      type: 'input',
      name: 'api',
      message: 'Enter OpenAPI spec URL or file path:',
      when: (ans: any) => ans.source === 'api',
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Choose test framework:',
      choices: ['playwright', 'cypress'],
      default: 'playwright',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Test type:',
      choices: ['e2e', 'api', 'visual'],
      default: 'e2e',
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output directory:',
      default: './tests',
    },
  ]);

  return {
    ...defaults,
    ...answers,
  } as GenerateOptions;
}

async function generateTests(params: {
  url?: string;
  description?: string;
  api?: string;
  framework: string;
  type: string;
}): Promise<GeneratedTest[]> {
  const response = await api.post('/api/v1/tests/generate', params);
  const data = response.data as any;
  if (!data?.tests) {
    throw new Error('Invalid response from generation API');
  }
  return data.tests as GeneratedTest[];
}

export const generateCommand = createGenerateCommand();
