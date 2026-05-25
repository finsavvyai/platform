#!/usr/bin/env node

/**
 * Questro Professional CLI
 * Complete testing automation platform command-line interface
 *
 * This is the main entry point for the Questro CLI, providing comprehensive
 * access to all backend capabilities including recording, testing, and management features.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import updateNotifier from 'update-notifier';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import command modules
import { authCommands } from './commands/auth';
import { projectCommands } from './commands/projects';
import { recordingCommands } from './commands/recordings';
import { testCommands } from './commands/tests';
import { analyticsCommands } from './commands/analytics';
import { configCommands } from './commands/config';
import { deploymentCommands } from './commands/deployment';
import { integrationCommands } from './commands/integrations';
import { userCommands } from './commands/users';
import { createCommand } from './commands/create';
import { askAiCommand } from './commands/ask-ai';
import { generateCommand } from './commands/generate';
import { runCommand } from './commands/run';
import { healCommand } from './commands/heal';
import { statusCommand } from './commands/status';
import { initCommand } from './commands/init';

// Import utilities
import { logger } from './utils/logger';
import { config } from './utils/config';
import { handleError } from './utils/error-handler';
import AuthMiddleware from './utils/auth-middleware';

// Package metadata
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf8')
);

// Check for updates
const notifier = updateNotifier({
  pkg: packageJson,
  updateCheckInterval: 1000 * 60 * 60 * 24, // Check daily
});

if (notifier.update) {
  logger.warn(`Update available ${notifier.update.current} → ${notifier.update.latest}`);
  logger.info(`Run ${chalk.cyan('npm i -g qestro-cli')} to update`);
}

// CLI Program setup
const program = new Command();

// CLI Configuration
program
  .name('qestro')
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress non-error output')
  .option('--no-color', 'Disable colored output')
  .option('--format <format>', 'Output format (json|yaml|table)', 'table')
  .option('--profile <profile>', 'Use a specific configuration profile')
  .option('--region <region>', 'Specify the AWS-like region for services', 'us-east-1')
  .hook('preAction', (thisCommand) => {
    // Handle global options
    const options = thisCommand.opts();

    if (options.verbose) {
      process.env.QESTRO_VERBOSE = 'true';
      logger.setLevel('debug');
    } else if (options.quiet) {
      process.env.QESTRO_QUIET = 'true';
      logger.setLevel('error');
    }

    if (options.noColor) {
      process.env.NO_COLOR = 'true';
      chalk.level = 0;
    }

    if (options.profile) {
      config.setProfile(options.profile);
    }

    if (options.region) {
      config.setRegion(options.region);
    }

    if (options.format) {
      config.setOutputFormat(options.format);
    }
  });

// ASCII Art Banner
const showBanner = () => {
  if (process.env.QESTRO_QUIET !== 'true') {
    console.log(
      chalk.cyan(
        figlet.textSync('Questro CLI', {
          font: 'ANSI Shadow',
          horizontalLayout: 'default',
          verticalLayout: 'default',
        })
      )
    );
    console.log(chalk.gray('Professional Testing Automation Platform'));
    console.log(chalk.gray(`Version: ${packageJson.version}\n`));
  }
};

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  handleError(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  handleError(new Error(`Unhandled rejection: ${reason}`));
  process.exit(1);
});

// Register command modules
program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(runCommand);
program.addCommand(healCommand);
program.addCommand(statusCommand);
program.addCommand(authCommands);
program.addCommand(projectCommands);
program.addCommand(recordingCommands);
program.addCommand(testCommands);
program.addCommand(analyticsCommands);
program.addCommand(configCommands);
program.addCommand(deploymentCommands);
program.addCommand(integrationCommands);
program.addCommand(userCommands);
program.addCommand(createCommand);
program.addCommand(askAiCommand);

// Default behavior - show help if no command provided
if (process.argv.length <= 2) {
  showBanner();
  program.outputHelp();
  process.exit(0);
}

// Parse command line arguments
try {
  showBanner();
  program.parse(process.argv);
} catch (error) {
  logger.error('CLI Error:', error);
  handleError(error);
  process.exit(1);
}

export { program };